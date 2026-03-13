import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

// ---------- Instagram scraper via Apify ----------
const APIFY_TOKEN = process.env.APIFY_TOKEN?.trim();
const APIFY_ACTOR = "shu8hvrXbJbY3Eb9W"; // apify/instagram-scraper

type IgProfile = {
  followers: number | null;
  posts: number | null;
  bio: string | null;
  fullName: string | null;
  avgLikes: number | null;
  avgComments: number | null;
  engagementRate: number | null;
  hashtagsUsed: string[];
  latestCaptions: string[];
};

type ApifyDatasetItem = {
  // Profile-level (resultsType: 'details')
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  biography?: string;
  fullName?: string;
  username?: string;
  profilePicUrl?: string;
  verified?: boolean;
  // Post-level (resultsType: 'posts')
  likesCount?: number;
  commentsCount?: number;
  hashtags?: string[];
  caption?: string;
  timestamp?: string;
  // When addParentData=true, profile fields nested under ownerFullName etc.
  ownerUsername?: string;
  ownerFullName?: string;
  // Some versions use these names
  edge_followed_by?: { count?: number };
  edge_media_to_comment?: { count?: number };
};

async function runApifyActor(input: Record<string, unknown>): Promise<ApifyDatasetItem[]> {
  if (!APIFY_TOKEN) {
    return [];
  }

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APIFY_TOKEN}`,
      },
      body: JSON.stringify(input),
    }
  );
  if (!startRes.ok) return [];
  const startJson = await startRes.json() as { data?: { id?: string } };
  const runId = startJson?.data?.id;
  if (!runId) return [];

  // Poll until finished (max 90 s)
  let datasetId: string | undefined;
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
      headers: {
        Authorization: `Bearer ${APIFY_TOKEN}`,
      },
    });
    if (!statusRes.ok) continue;
    const statusJson = await statusRes.json() as { data?: { status?: string; defaultDatasetId?: string } };
    const s = statusJson?.data?.status;
    if (s === "SUCCEEDED" || s === "FINISHED") {
      datasetId = statusJson?.data?.defaultDatasetId;
      break;
    }
    if (s === "FAILED" || s === "ABORTED" || s === "TIMED-OUT") break;
  }
  if (!datasetId) return [];

  const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=100`, {
    headers: {
      Authorization: `Bearer ${APIFY_TOKEN}`,
    },
  });
  if (!dsRes.ok) return [];
  const items = await dsRes.json();
  return Array.isArray(items) ? items as ApifyDatasetItem[] : [];
}

async function scrapeInstagramApify(handle: string): Promise<IgProfile> {
  const empty: IgProfile = {
    followers: null, posts: null, bio: null, fullName: null,
    avgLikes: null, avgComments: null, engagementRate: null,
    hashtagsUsed: [], latestCaptions: [],
  };
  try {
    const igUrl = `https://www.instagram.com/${handle}/`;

    // Run profile details + posts in parallel
    const [profileItems, postItems] = await Promise.all([
      runApifyActor({
        directUrls: [igUrl],
        resultsType: "details",
        resultsLimit: 1,
      }),
      runApifyActor({
        directUrls: [igUrl],
        resultsType: "posts",
        resultsLimit: 12,
      }),
    ]);

    // --- Profile data ---
    const p = profileItems[0] ?? {};
    const followers = p.followersCount ?? null;
    const postsCount = p.postsCount ?? null;
    const bio = p.biography ?? null;
    const fullName = p.fullName ?? null;

    // --- Post engagement ---
    let avgLikes: number | null = null;
    let avgComments: number | null = null;
    let engagementRate: number | null = null;
    const hashtagSet = new Set<string>();
    const captions: string[] = [];

    const validPosts = postItems.filter(
      (it) => it.likesCount != null || it.commentsCount != null
    );

    if (validPosts.length > 0) {
      const totalLikes = validPosts.reduce((s, it) => s + (it.likesCount ?? 0), 0);
      const totalComments = validPosts.reduce((s, it) => s + (it.commentsCount ?? 0), 0);
      avgLikes = Math.round(totalLikes / validPosts.length);
      avgComments = Math.round(totalComments / validPosts.length);
      if (followers && followers > 0) {
        engagementRate = parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2));
      }
      for (const it of validPosts) {
        (it.hashtags ?? []).forEach((h) => hashtagSet.add(h));
        if (it.caption) captions.push(it.caption.slice(0, 140));
      }
    }

    return {
      followers,
      posts: postsCount,
      bio,
      fullName,
      avgLikes,
      avgComments,
      engagementRate,
      hashtagsUsed: [...hashtagSet].slice(0, 20),
      latestCaptions: captions.slice(0, 5),
    };
  } catch {
    return empty;
  }
}

// Alias kept for the rest of the file
const scrapeInstagram = scrapeInstagramApify;

function buildFallbackSummary(brandName: string, ig: IgProfile, goals: string[]): string {
  const goalMap: Record<string, string> = {
    grow_followers: "grow a larger audience",
    increase_sales: "convert followers into buyers",
    launch_product: "launch a new product",
    build_brand: "build long-term brand authority",
  };
  const goalText = goals.length > 0
    ? goals.map((g) => goalMap[g] ?? g).join(" and ")
    : "grow";

  if (ig.followers != null && ig.posts != null) {
    return `${brandName} has built a community of ${ig.followers.toLocaleString()} followers across ${ig.posts} posts. With a clear goal to ${goalText}, PostForge AI will help turn that audience into a revenue engine.`;
  }
  if (ig.followers != null) {
    return `${brandName} is sitting on ${ig.followers.toLocaleString()} followers and is ready to ${goalText}. PostForge AI will build the content strategy to make it happen.`;
  }
  return `${brandName} is entering PostForge AI with a clear focus to ${goalText}. The strategy starts now — let's build content that converts.`;
}

// ---------- Route handler ----------
export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "feature:onboarding",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();
  const body = await req.json() as {
    brandName?: string;
    instagramHandle?: string;
    industry?: string;
    monthlyRevenue?: number | string;
    adSpend?: number | string;
    teamSize?: string;
    mainGoal?: string | string[];
  };

  const { brandName, instagramHandle, industry, monthlyRevenue, adSpend, teamSize, mainGoal } = body;

  if (!brandName || typeof brandName !== "string") {
    return NextResponse.json({ error: "Brand name is required" }, { status: 400 });
  }

  // Normalise mainGoal: accept array or string, always store as comma-separated string
  const goalsArray: string[] = Array.isArray(mainGoal)
    ? mainGoal.filter((g): g is string => typeof g === "string")
    : typeof mainGoal === "string" && mainGoal
    ? [mainGoal]
    : [];
  const goalsString = goalsArray.join(",");

  const handle =
    typeof instagramHandle === "string"
      ? instagramHandle.replace(/^@/, "").trim() || null
      : null;

  // Already onboarded — never regenerate
  const existing = await prisma.stats.findUnique({ where: { userId: user.id } });
  if (existing?.onboardingDone) {
    return NextResponse.json({ ok: true, alreadyDone: true });
  }

  // Fetch Instagram data
  let ig: IgProfile = { followers: null, posts: null, bio: null, fullName: null, avgLikes: null, avgComments: null, engagementRate: null, hashtagsUsed: [], latestCaptions: [] };
  if (handle) {
    ig = await scrapeInstagram(handle);
  }

  // Parse financials
  const rev = typeof monthlyRevenue === "number" ? monthlyRevenue : parseFloat(String(monthlyRevenue)) || 0;
  const spend = typeof adSpend === "number" ? adSpend : parseFloat(String(adSpend)) || 0;

  const igFollowers = ig.followers ?? null;
  const igPosts = ig.posts ?? null;

  // leadsThisWeek: derived from IG followers or revenue
  let leadsThisWeek: number;
  if (igFollowers != null && igFollowers > 0) {
    leadsThisWeek = Math.max(1, Math.round(igFollowers * 0.0005));
  } else if (rev > 0) {
    leadsThisWeek = Math.max(1, Math.round(rev / 25 / 4));
  } else {
    leadsThisWeek = 0;
  }

  // avgCtr: spend-tier based
  let avgCtr: number;
  if (spend === 0) {
    avgCtr = igFollowers ? parseFloat((igFollowers > 5000 ? 2.1 : 1.4).toFixed(2)) : 0;
  } else if (spend < 500) {
    avgCtr = 1.8;
  } else if (spend < 2000) {
    avgCtr = 2.6;
  } else {
    avgCtr = 3.2;
  }

  // postsPublished
  let postsPublished: number;
  if (igPosts != null) {
    postsPublished = igPosts;
  } else if (teamSize === "solo") {
    postsPublished = 15;
  } else if (teamSize === "2-5") {
    postsPublished = 35;
  } else if (teamSize === "6-20") {
    postsPublished = 70;
  } else {
    postsPublished = 120;
  }

  // Build AI summary
  const igContext = handle
    ? `Instagram @${handle}: ${igFollowers != null ? igFollowers.toLocaleString() + " followers, " : ""}${igPosts != null ? igPosts + " posts. " : ""}${ig.bio ? `Bio: "${ig.bio}". ` : ""}`
    : "";

  const goalsLabel = goalsArray.map((g) => g.replace(/_/g, " ")).join(", ");
  const summaryPrompt = `Write a 2-sentence analytics overview for the brand "${brandName}" in the ${industry || "marketing"} industry. Monthly revenue: $${rev.toLocaleString()}. Ad spend: $${spend.toLocaleString()}/month. Team: ${teamSize || "unknown"}. Goals: ${goalsLabel || "growth"}. ${igContext}Be specific and energetic — no generic filler.`;

  let summaryText: string;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const aiRes = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: summaryPrompt }],
      max_tokens: 140,
    });
    summaryText =
      aiRes.choices[0]?.message?.content?.trim() ?? buildFallbackSummary(brandName, ig, goalsArray);
  } catch {
    summaryText = buildFallbackSummary(brandName, ig, goalsArray);
  }

  const payload = {
    brandName,
    instagramHandle: handle,
    industry: industry || null,
    monthlyRevenue: rev,
    adSpend: spend,
    teamSize: teamSize || null,
    mainGoal: goalsString || null,
    igFollowers,
    igPosts,
    igAvgLikes: ig.avgLikes,
    igAvgComments: ig.avgComments,
    igEngagementRate: ig.engagementRate,
    onboardingDone: true,
    summary: summaryText,
    leadsThisWeek,
    revenue: rev,
    avgCtr,
    postsPublished,
  };

  if (existing) {
    await prisma.stats.update({ where: { userId: user.id }, data: payload });
  } else {
    await prisma.stats.create({ data: { userId: user.id, ...payload } });
  }

  return NextResponse.json({
    ok: true,
    ig: {
      followers: ig.followers,
      posts: ig.posts,
      bio: ig.bio,
      avgLikes: ig.avgLikes,
      avgComments: ig.avgComments,
      engagementRate: ig.engagementRate,
      hashtagsUsed: ig.hashtagsUsed,
      latestCaptions: ig.latestCaptions,
    },
  });
}
