import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getLatestFeatureRun, saveFeatureRun } from "@/lib/feature-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export type ViralityPrediction = {
  viralScore: number;          // 0–100
  verdict: "Low" | "Average" | "Good" | "Viral" | "Mega Viral";
  predictedLikes: number;
  predictedComments: number;
  predictedReach: number;
  predictedShares: number;
  predictedSaves: number;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  bestPostingTime: string;
  bestDay: string;
  trendAlignment: number;      // 0–100
  hookStrength: number;        // 0–100
  captionScore: number;        // 0–100
  hashtagScore: number;        // 0–100
};

const SYSTEM_PROMPT = `You are an AI virality prediction engine trained on millions of Instagram posts.
Analyze the given post content and predict its performance. 
Respond with ONLY valid JSON (no markdown, no extra text):
{
  "viralScore": <0-100>,
  "verdict": "<Low|Average|Good|Viral|Mega Viral>",
  "predictedLikes": <number>,
  "predictedComments": <number>,
  "predictedReach": <number>,
  "predictedShares": <number>,
  "predictedSaves": <number>,
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "improvements": ["<specific improvement 1>", "<specific improvement 2>", "<specific improvement 3>"],
  "bestPostingTime": "<e.g. 7–9 PM>",
  "bestDay": "<e.g. Tuesday or Wednesday>",
  "trendAlignment": <0-100>,
  "hookStrength": <0-100>,
  "captionScore": <0-100>,
  "hashtagScore": <0-100>
}`;

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
  const latest = await getLatestFeatureRun<ViralityPrediction>({
    userId: user.id,
    feature: "virality",
  });

  if (!latest) {
    return NextResponse.json(null);
  }

  return NextResponse.json(latest.output);
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "feature:virality",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  try {
    const user = await requireUser();
    const stats = await prisma.stats.findUnique({ where: { userId: user.id } });

    const body = await req.json();
    const { caption, hashtags, format, hook } = body as {
      caption: string;
      hashtags: string[];
      format: string;
      hook?: string;
    };

    if (!caption) {
      return NextResponse.json({ error: "caption is required" }, { status: 400 });
    }

    const inputPayload = {
      caption,
      hashtags,
      format: format || "Post",
      hook: hook || "",
    };

    const igFollowers: number = stats?.igFollowers ?? 1000;
    const igEngagementRate: number = stats?.igEngagementRate ?? 2.5;
    const niche: string = stats?.industry || "lifestyle";
    const brandName: string = stats?.brandName || user.name;

    const userPrompt = `
Account: "${brandName}" (@${stats?.instagramHandle || user.username})
Followers: ${igFollowers.toLocaleString()}
Current Avg Engagement Rate: ${igEngagementRate}%
Niche: ${niche}

Post to analyze:
Format: ${format || "Post"}
Hook: ${hook || "(not provided)"}
Caption: ${caption}
Hashtags: ${(hashtags || []).map((h: string) => `#${h}`).join(" ")}

Predict this post's virality. Base predictions on the ${igFollowers} follower count.
Be honest — not every post goes viral. Score weaknesses if the hook is weak or caption is generic.
    `.trim();

    if (!openai) {
      console.warn("[/api/virality] OPENAI_API_KEY missing - using fallback prediction");
      const payload = fallbackPrediction(igFollowers, igEngagementRate);

      await saveFeatureRun({
        userId: user.id,
        feature: "virality",
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
        temperature: 0.5,
        max_tokens: 1000,
      });
      raw = completion.choices[0]?.message?.content ?? "{}";
    } catch (err) {
      if (isRecoverableOpenAIError(err)) {
        console.warn("[/api/virality] OpenAI quota/rate limit hit - using fallback prediction");
        const payload = fallbackPrediction(igFollowers, igEngagementRate);

        await saveFeatureRun({
          userId: user.id,
          feature: "virality",
          input: inputPayload,
          output: payload,
        });

        return NextResponse.json(payload);
      }
      throw err;
    }

    let parsed: ViralityPrediction;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : fallbackPrediction(igFollowers, igEngagementRate);
    }

    await saveFeatureRun({
      userId: user.id,
      feature: "virality",
      input: inputPayload,
      output: parsed,
    });

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/virality]", err);
    return NextResponse.json({ error: "Failed to predict virality" }, { status: 500 });
  }
}

function fallbackPrediction(followers: number, engRate: number): ViralityPrediction {
  const base = Math.round(followers * (engRate / 100));
  const score = Math.min(95, Math.round(40 + engRate * 6));
  return {
    viralScore: score,
    verdict: score > 75 ? "Viral" : score > 55 ? "Good" : score > 35 ? "Average" : "Low",
    predictedLikes: base,
    predictedComments: Math.round(base * 0.08),
    predictedReach: followers * 3,
    predictedShares: Math.round(base * 0.05),
    predictedSaves: Math.round(base * 0.1),
    strengths: ["Consistent brand voice", "Clear call to action"],
    weaknesses: ["Hook could be stronger", "Hashtag diversity limited"],
    improvements: ["Start with a bold question or statement", "Add trending audio", "Include a save-worthy tip"],
    bestPostingTime: "7–9 PM",
    bestDay: "Tuesday",
    trendAlignment: Math.round(engRate * 8),
    hookStrength: score - 10,
    captionScore: score - 5,
    hashtagScore: score,
  };
}
