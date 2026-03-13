import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getLatestFeatureRun, saveFeatureRun } from "@/lib/feature-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type ContentIdea = {
  type: "reel" | "carousel" | "post" | "story" | "trend";
  title: string;
  hook: string;
  script: string;
  caption: string;
  hashtags: string[];
  visualConcept: string;
  bestPostingTime: string;
  viralScore: number;          // 0–100
  predictedLikes: number;
  predictedComments: number;
  predictedReach: number;
  trendingAudio?: string;
};

export type IdeasResponse = {
  reels: ContentIdea[];
  carousels: ContentIdea[];
  trends: ContentIdea[];
  trendingHashtags: string[];
  trendingAudio: string[];
  generatedAt: string;
};

const SYSTEM_PROMPT = `You are an elite social media content strategist and virality expert. 
Given a brand's Instagram data and niche, generate highly creative, trend-aware content ideas.

ALWAYS respond with ONLY valid JSON matching this exact structure (no markdown, no extra text):
{
  "reels": [
    {
      "type": "reel",
      "title": "<catchy title>",
      "hook": "<first 3 seconds hook — must stop the scroll>",
      "script": "<step-by-step script outline, 3-5 steps>",
      "caption": "<engaging caption with emojis, 2-3 sentences>",
      "hashtags": ["tag1", "tag2"],
      "visualConcept": "<visual direction — colors, transitions, style>",
      "bestPostingTime": "<e.g. Tuesday 7–9 PM>",
      "viralScore": <number 0-100>,
      "predictedLikes": <number>,
      "predictedComments": <number>,
      "predictedReach": <number>,
      "trendingAudio": "<optional trending audio name>"
    }
  ],
  "carousels": [ <same shape, type: "carousel"> ],
  "trends": [ <same shape, type: "trend"> ],
  "trendingHashtags": ["<hashtag1>", "<hashtag2>", "..."],
  "trendingAudio": ["<audio1>", "<audio2>", "..."]
}

Generate 3 reels, 3 carousels, 2 trends. Hashtags plain (no #). Make predictions realistic based on follower count.`;

function isRecoverableOpenAIError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { code?: string; status?: number; type?: string };
  return (
    maybe.code === "insufficient_quota" ||
    maybe.code === "rate_limit_exceeded" ||
    maybe.status === 429 ||
    maybe.type === "insufficient_quota" ||
    maybe.type === "rate_limit_error"
  );
}

export async function GET() {
  const user = await requireUser();
  const latest = await getLatestFeatureRun<IdeasResponse>({
    userId: user.id,
    feature: "ideas",
  });

  if (!latest) {
    return NextResponse.json(null);
  }

  return NextResponse.json(latest.output);
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "feature:ideas",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  try {
    const user = await requireUser();
    const stats = await prisma.stats.findUnique({ where: { userId: user.id } });

    const body = await req.json().catch(() => ({}));
    const niche: string = body.niche || stats?.industry || "lifestyle";
    const audience: string = body.audience || "general audience";
    const goal: string = body.goal || stats?.mainGoal || "grow followers";
    const igHandle: string = stats?.instagramHandle || user.username;
    const igFollowers: number = stats?.igFollowers ?? 1000;
    const igEngagementRate: number = stats?.igEngagementRate ?? 2.5;
    const igAvgLikes: number = stats?.igAvgLikes ?? Math.round(igFollowers * 0.04);
    const brandName: string = stats?.brandName || user.name;
    const inputPayload = { niche, audience, goal };

    const userPrompt = `
Brand: "${brandName}"
Instagram: @${igHandle}
Followers: ${igFollowers.toLocaleString()}
Engagement Rate: ${igEngagementRate}%
Avg Likes per Post: ${igAvgLikes}
Niche/Industry: ${niche}
Target Audience: ${audience}
Main Goal: ${goal}

Generate 3 viral reel ideas, 3 carousel ideas, and 2 trending content ideas tailored to this brand.
Make viral scores and predictions realistic based on the ${igFollowers} follower count.
Tailor every idea to the "${niche}" niche and trending content in March 2026.
    `.trim();

    if (!openai) {
      console.warn("[/api/ideas] OPENAI_API_KEY missing - using fallback ideas");
      const fallback = fallbackIdeas(igFollowers, niche, brandName);
      const payload = {
        ...fallback,
        source: "fallback",
        reason: "missing_api_key",
      };

      await saveFeatureRun({
        userId: user.id,
        feature: "ideas",
        input: inputPayload,
        output: payload,
      });

      return NextResponse.json(payload);
    }

    let raw = "{}";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 3000,
      });
      raw = completion.choices[0]?.message?.content ?? "{}";
    } catch (err) {
      if (isRecoverableOpenAIError(err)) {
        console.warn("[/api/ideas] OpenAI quota/rate limit hit - using fallback ideas");
        const fallback = fallbackIdeas(igFollowers, niche, brandName);
        const payload = {
          ...fallback,
          source: "fallback",
          reason: "quota_or_rate_limit",
        };

        await saveFeatureRun({
          userId: user.id,
          feature: "ideas",
          input: inputPayload,
          output: payload,
        });

        return NextResponse.json(payload);
      }
      throw err;
    }

    let parsed: IdeasResponse;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Attempt to extract JSON from response if it has markdown
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : fallbackIdeas(igFollowers, niche, brandName);
    }

    parsed.generatedAt = new Date().toISOString();

    await saveFeatureRun({
      userId: user.id,
      feature: "ideas",
      input: inputPayload,
      output: parsed,
    });

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/ideas]", err);
    return NextResponse.json({ error: "Failed to generate ideas" }, { status: 500 });
  }
}

function fallbackIdeas(followers: number, niche: string, brand: string): IdeasResponse {
  const base = Math.round(followers * 0.04);
  return {
    reels: [
      {
        type: "reel",
        title: `Behind the scenes of ${brand}`,
        hook: "You've never seen how we make this…",
        script: "1. Show raw materials\n2. Production process\n3. Final product reveal\n4. Customer reaction\n5. CTA",
        caption: `The process behind ${brand} is nothing short of obsessive. 🔥 Every detail matters. Link in bio.`,
        hashtags: [niche, "behindthescenes", "reels", "viral", brand.toLowerCase().replace(/\s/g, "")],
        visualConcept: "Close-up shots, fast cuts, satisfying transitions, warm colour grade",
        bestPostingTime: "Tuesday 7–9 PM",
        viralScore: 78,
        predictedLikes: base * 3,
        predictedComments: Math.round(base * 0.15),
        predictedReach: followers * 4,
      },
    ],
    carousels: [
      {
        type: "carousel",
        title: `5 mistakes people make in ${niche}`,
        hook: "Swipe before you waste another month →",
        script: "Slide 1: Hook\nSlides 2-6: One mistake each\nSlide 7: Solution\nSlide 8: CTA",
        caption: `Most people in ${niche} are making these mistakes and they don't even know it. 👀 Save this post.`,
        hashtags: [niche, "tips", "mistakes", "growth", "carousel"],
        visualConcept: "Clean minimal design, bold typography, consistent brand colours",
        bestPostingTime: "Wednesday 12–2 PM",
        viralScore: 82,
        predictedLikes: base * 2,
        predictedComments: Math.round(base * 0.2),
        predictedReach: followers * 3,
      },
    ],
    trends: [
      {
        type: "trend",
        title: "POV trending format",
        hook: "POV: You just discovered the best kept secret in " + niche,
        script: "Use trending POV audio\nShow transformation or reveal\nText overlay tells the story",
        caption: `POV you finally found it. 🤍 Comment 'yes' if this is you.`,
        hashtags: ["pov", "trending", niche, "fyp", "viral"],
        visualConcept: "Vertical video, text overlay, trending audio",
        bestPostingTime: "Friday 6–8 PM",
        viralScore: 85,
        predictedLikes: base * 4,
        predictedComments: Math.round(base * 0.3),
        predictedReach: followers * 6,
        trendingAudio: "Trending sound on Instagram",
      },
    ],
    trendingHashtags: [niche, "reels2026", "viral", "trending", "fyp", "content", "growth", "instagram"],
    trendingAudio: ["Lo-fi beats", "Trending pop remix", "Motivational speech cut"],
    generatedAt: new Date().toISOString(),
  };
}
