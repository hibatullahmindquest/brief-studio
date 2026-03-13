import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const APIFY_TOKEN = process.env.APIFY_TOKEN?.trim();
const APIFY_ACTOR = "shu8hvrXbJbY3Eb9W"; // apify/instagram-scraper

type ApifyDatasetItem = {
  followersCount?: number;
  postsCount?: number;
  biography?: string;
  fullName?: string;
  likesCount?: number;
  commentsCount?: number;
  hashtags?: string[];
  caption?: string;
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
    if (s === "SUCCEEDED" || s === "FINISHED") { datasetId = statusJson?.data?.defaultDatasetId; break; }
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

/**
 * POST /api/instagram/rescrape
 * Re-runs the Apify scraper for the user's stored Instagram handle
 * and updates the DB with fresh stats.
 */
export async function POST(req: Request) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "feature:instagram-rescrape",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const user = await requireUser();

  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: "Missing APIFY_TOKEN environment variable" }, { status: 500 });
  }

  const stats = await prisma.stats.findUnique({ where: { userId: user.id } });
  const handle = stats?.instagramHandle;

  if (!handle) {
    return NextResponse.json({ error: "No Instagram handle saved. Complete onboarding first." }, { status: 400 });
  }

  try {
    const igUrl = `https://www.instagram.com/${handle}/`;

    // Run profile details + posts in parallel for accurate data
    const [profileItems, postItems] = await Promise.all([
      runApifyActor({ directUrls: [igUrl], resultsType: "details", resultsLimit: 1 }),
      runApifyActor({ directUrls: [igUrl], resultsType: "posts", resultsLimit: 12 }),
    ]);

    if (profileItems.length === 0 && postItems.length === 0) {
      throw new Error("No data returned by Apify");
    }

    const profileItem = profileItems[0] ?? {};
    const followers = profileItem.followersCount ?? null;
    const posts = profileItem.postsCount ?? null;
    const bio = profileItem.biography ?? null;

    const validPosts = postItems.filter((it) => it.likesCount != null || it.commentsCount != null);
    const hashtagSet = new Set<string>();
    const captions: string[] = [];
    let avgLikes: number | null = null;
    let avgComments: number | null = null;
    let engagementRate: number | null = null;

    if (validPosts.length > 0) {
      const totalLikes = validPosts.reduce((s, p) => s + (p.likesCount ?? 0), 0);
      const totalComments = validPosts.reduce((s, p) => s + (p.commentsCount ?? 0), 0);
      avgLikes = Math.round(totalLikes / validPosts.length);
      avgComments = Math.round(totalComments / validPosts.length);
      if (followers && followers > 0) {
        engagementRate = parseFloat((((avgLikes + avgComments) / followers) * 100).toFixed(2));
      }
      for (const p of validPosts) {
        (p.hashtags ?? []).forEach((h) => hashtagSet.add(h));
        if (p.caption) captions.push(p.caption.slice(0, 140));
      }
    }

    // 4. Persist to DB
    await prisma.stats.update({
      where: { userId: user.id },
      data: {
        igFollowers: followers ?? undefined,
        igPosts: posts ?? undefined,
        igAvgLikes: avgLikes ?? undefined,
        igAvgComments: avgComments ?? undefined,
        igEngagementRate: engagementRate ?? undefined,
      },
    });

    return NextResponse.json({
      ok: true,
      ig: {
        followers,
        posts,
        bio,
        avgLikes,
        avgComments,
        engagementRate,
        hashtagsUsed: [...hashtagSet].slice(0, 20),
        latestCaptions: captions.slice(0, 5),
      },
    });
  } catch (err) {
    console.error("[instagram/rescrape]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scrape failed" },
      { status: 500 }
    );
  }
}
