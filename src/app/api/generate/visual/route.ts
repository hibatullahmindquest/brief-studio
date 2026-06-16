import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import { getFeatureRunOwned } from "@/lib/feature-store";
import { enqueueVisualJob } from "@/lib/job-store";
import { enforceRateLimit } from "@/lib/rate-limit";

type Body = { featureRunId?: string };

// ENQUEUE a visual generation job. The heavy OpenAI work runs in the worker
// process (see src/worker/index.ts), not in this request — so closing the tab
// no longer drops the generation. Returns a jobId the client polls via
// GET /api/jobs?featureRunId=. Idempotent: one active job per run.
export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, { keyPrefix: "feature:visual", limit: 15, windowMs: 10 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  // Auth — creative or admin only (visual outputs are a creative concern).
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin && user.teamRole !== "creative") {
    return NextResponse.json({ error: "Forbidden — creative or admin only" }, { status: 403 });
  }

  const { featureRunId } = (await req.json().catch(() => ({}))) as Body;
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });

  // Ownership — the run must belong to this user before we queue work on it.
  const run = await getFeatureRunOwned(featureRunId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const { job, reused } = await enqueueVisualJob({ featureRunId, userId: user.id });

  return NextResponse.json({ jobId: job.id, status: job.status, reused });
}
