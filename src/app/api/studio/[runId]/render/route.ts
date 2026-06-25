import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { enqueue } from "@/lib/job-store";
import { prisma } from "@/lib/prisma";

// POST /api/studio/[runId]/render — queue an on-demand poster render (Phase G "Generate poster"
// / "↻ Variation"). ASYNC like the text generation: enqueue a `render` job (idempotent per run
// via dedupeKey) and return the jobId; the worker runs renderFromRun and the client polls
// GET /api/studio/[runId]/status. So the user can leave and pick the image up from Recent.
const RATIOS = new Set(["1:1", "9:16", "16:9"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;

  // owner pre-check — don't queue a render job for a run the caller doesn't own (parity with
  // confirmRun; renderFromRun also owner-scopes, but this avoids junk cross-user jobs + gives 404).
  const owned = await prisma.creativeRun.findFirst({ where: { id: runId, userId: user.id }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const ratio = typeof body?.ratio === "string" && RATIOS.has(body.ratio) ? body.ratio : undefined;

  const { job, reused } = await enqueue({
    kind: "render",
    lane: "interactive",
    dedupeKey: `render:${runId}`, // one active render per run; distinct from the generate job
    featureRunId: runId,
    userId: user.id,
    payload: { runId, userId: user.id, ratio },
  });

  return NextResponse.json({ jobId: job.id, status: job.status, reused });
}
