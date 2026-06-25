import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getLatestJobForRun } from "@/lib/job-store";

// GET /api/studio/[runId]/status — recipe job poll for the Generating screen (Phase G).
// Owner-scoped via getLatestJobForRun (confirmRun stamps featureRunId+userId on the job).
// The UI polls this after confirm returns a jobId, stops on a terminal status, then fetches
// the grouped artifacts from GET /api/studio/[runId]. Thin: no logic beyond the owner read.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  const job = await getLatestJobForRun(runId, user.id);
  if (!job) return NextResponse.json({ error: "No job for this run." }, { status: 404 });

  // A finished recipe job stashes notices in result.notices — surface them so the UI can
  // show "image render failed" etc. without a second fetch.
  const result = (job.result ?? {}) as { notices?: unknown };
  const notices = Array.isArray(result.notices)
    ? result.notices.filter((n): n is string => typeof n === "string")
    : undefined;

  return NextResponse.json({
    status: job.status, // queued | processing | succeeded | failed
    resultKind: job.resultKind || undefined,
    notices: notices && notices.length ? notices : undefined,
    retryable: job.retryable,
    reason: job.reason ?? undefined,
  });
}
