import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getLatestFeatureRun, saveFeatureRun } from "@/lib/feature-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type ContentDay = {
  day: number;
  date: string;            // e.g. "Mon 16 Mar"
  format: "Reel" | "Carousel" | "Story" | "Post" | "Meme" | "UGC";
  theme: string;
  hook: string;
  caption: string;
  hashtags: string[];
  bestPostingTime: string;
  viralScore: number;
  predictedLikes: number;
  predictedReach: number;
};

export type ContentPlanResponse = {
  plan: ContentDay[];
  summary: string;
  generatedAt: string;
};

const SYSTEM_PROMPT = `You are a world-class social media strategist building a 30-day content calendar.
Respond with ONLY valid JSON (no markdown):
{
  "plan": [
    {
      "day": 1,
      "date": "Mon 16 Mar",
      "format": "Reel",
      "theme": "<content theme in 4-6 words>",
      "hook": "<scroll-stopping first line>",
      "caption": "<2-3 sentence engaging caption with emojis>",
      "hashtags": ["tag1", "tag2"],
      "bestPostingTime": "e.g. 7–9 PM",
      "viralScore": <0-100>,
      "predictedLikes": <number>,
      "predictedReach": <number>
    }
  ],
  "summary": "<2-3 sentence strategic overview of this 30-day plan>"
}

Rules:
- 30 days total. Skip weekends (post Mon–Fri only, ~22 posting days).
- Rotate formats: Reel → Carousel → Post/Story → Meme/UGC
- Make predictions realistic for the follower count provided.
- Hashtags plain text, no #.`;

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
  const latest = await getLatestFeatureRun<ContentPlanResponse>({
    userId: user.id,
    feature: "plan",
  });

  if (!latest) {
    return NextResponse.json(null);
  }

  return NextResponse.json(latest.output);
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "feature:plan",
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
    const igFollowers: number = stats?.igFollowers ?? 1000;
    const igEngagementRate: number = stats?.igEngagementRate ?? 2.5;
    const brandName: string = stats?.brandName || user.name;
    const inputPayload = { niche, audience, goal };

    // Build calendar dates starting from today
    const startDate = new Date();
    const userPrompt = `
Brand: "${brandName}"
Followers: ${igFollowers.toLocaleString()}
Engagement Rate: ${igEngagementRate}%
Niche: ${niche}
Target Audience: ${audience}
Goal: ${goal}
Calendar Start: ${startDate.toDateString()}

Create a 30-day content plan. Include all 30 days but mark weekends as "rest days" by using format "Story" with low effort themes. 
Make predictions realistic. Tailor every idea to "${niche}". 
    `.trim();

    if (!openai) {
      console.warn("[/api/plan] OPENAI_API_KEY missing - using fallback plan");
      const fallback = fallbackPlan(igFollowers, niche, brandName);
      const payload = {
        ...fallback,
        source: "fallback",
        reason: "missing_api_key",
      };

      await saveFeatureRun({
        userId: user.id,
        feature: "plan",
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
        temperature: 0.75,
        max_tokens: 4000,
      });
      raw = completion.choices[0]?.message?.content ?? "{}";
    } catch (err) {
      if (isRecoverableOpenAIError(err)) {
        console.warn("[/api/plan] OpenAI quota/rate limit hit - using fallback plan");
        const fallback = fallbackPlan(igFollowers, niche, brandName);
        const payload = {
          ...fallback,
          source: "fallback",
          reason: "quota_or_rate_limit",
        };

        await saveFeatureRun({
          userId: user.id,
          feature: "plan",
          input: inputPayload,
          output: payload,
        });

        return NextResponse.json(payload);
      }
      throw err;
    }

    let parsed: ContentPlanResponse;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : fallbackPlan(igFollowers, niche, brandName);
    }

    parsed.generatedAt = new Date().toISOString();

    await saveFeatureRun({
      userId: user.id,
      feature: "plan",
      input: inputPayload,
      output: parsed,
    });

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/plan]", err);
    return NextResponse.json({ error: "Failed to generate content plan" }, { status: 500 });
  }
}

const FORMATS: ContentDay["format"][] = ["Reel", "Carousel", "Post", "Story", "Meme", "UGC"];
const FORMAT_THEMES = ["Behind the scenes", "Tips & tricks", "Product showcase", "Community spotlight", "Trending format", "Transformation story"];

function fallbackPlan(followers: number, niche: string, brand: string): ContentPlanResponse {
  const base = Math.round(followers * 0.04);
  const plan: ContentDay[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const fmt = isWeekend ? "Story" : FORMATS[i % FORMATS.length];
    const theme = FORMAT_THEMES[i % FORMAT_THEMES.length];
    const score = isWeekend ? 40 : 65 + Math.round(Math.random() * 25);
    return {
      day: i + 1,
      date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      format: fmt,
      theme: `${theme} — ${niche}`,
      hook: `You won't believe what ${brand} has been working on…`,
      caption: `Day ${i + 1} of our ${niche} journey. 🔥 The results speak for themselves. Follow for daily updates.`,
      hashtags: [niche, fmt.toLowerCase(), "daily", brand.toLowerCase().replace(/\s/g, ""), "growth"],
      bestPostingTime: ["12–2 PM", "6–8 PM", "7–9 PM"][i % 3],
      viralScore: score,
      predictedLikes: Math.round(base * (isWeekend ? 0.8 : 1.5 + Math.random())),
      predictedReach: Math.round(followers * (isWeekend ? 1 : 2 + Math.random() * 3)),
    };
  });
  return { plan, summary: `A 30-day content plan for ${brand} in the ${niche} niche. Focused on growing followers and engagement through varied formats.`, generatedAt: new Date().toISOString() };
}
