import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import { getFeatureRunOwned } from "@/lib/feature-store";

type StoredOutput = {
  primaryPost?: string;
  caption?: string;
  callToAction?: string;
  hashtags?: string[];
  strategyNote?: string;
  image?: { urlPath?: string } | null;
};

// GET — return the generated copy (caption/CTA/hashtags/strategy note) for a run,
// shown below the poster once generation completes. Creative/admin, ownership-scoped.
export async function GET(req: NextRequest) {
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin && user.teamRole !== "creative") {
    return NextResponse.json({ error: "Forbidden — creative or admin only" }, { status: 403 });
  }

  const featureRunId = req.nextUrl.searchParams.get("featureRunId");
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });

  const run = await getFeatureRunOwned(featureRunId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  let out: StoredOutput = {};
  try { out = JSON.parse(run.outputJson ?? "{}") as StoredOutput; } catch { out = {}; }

  const hasCopy = !!(out.primaryPost || out.caption || out.callToAction || (out.hashtags && out.hashtags.length) || out.strategyNote);
  return NextResponse.json({
    status: run.status,
    hasCopy,
    primaryPost: out.primaryPost ?? "",
    caption: out.caption ?? "",
    callToAction: out.callToAction ?? "",
    hashtags: Array.isArray(out.hashtags) ? out.hashtags : [],
    strategyNote: out.strategyNote ?? "",
  });
}
