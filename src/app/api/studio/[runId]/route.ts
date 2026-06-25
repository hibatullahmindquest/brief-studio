import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getRunArtifacts } from "@/lib/artifact-store";
import { applyAnswers } from "@/lib/studio-answers";
import { studioErrorResponse } from "@/lib/studio-error";
import { logError } from "@/lib/error-log";

// GET /api/studio/[runId] — the artifact-grouped result view (Module 1 Phase F).
// Owner-scoped; images (carousel) + texts + pdf + per-run cost + contextUsed. Phase G result consumes this.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  const result = await getRunArtifacts(runId, user.id);
  if (!result) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json(result);
}

// PATCH /api/studio/[runId] — answer the intake gaps (Phase G Understand step). Merges the
// user's answers (and an optional task-type re-pick) into the draft run's spec, re-selects the
// recipe, and returns the remaining gaps. Thin: auth → applyAnswers → map StudioError.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const result = await applyAnswers(user, runId, {
      answers: body.answers && typeof body.answers === "object" ? body.answers : undefined,
      taskType: typeof body.taskType === "string" ? body.taskType : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const mapped = studioErrorResponse(e);
    if (mapped) return mapped;
    await logError({ source: "studio.answers", error: e, httpStatus: 502, featureRunId: runId, userId: user.id });
    return NextResponse.json({ error: "Could not save answers — cuba semula", retryable: true }, { status: 502 });
  }
}
