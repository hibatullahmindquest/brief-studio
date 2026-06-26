import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { setRunFeedback } from "@/lib/studio-feedback";
import { studioErrorResponse } from "@/lib/studio-error";
import { logError } from "@/lib/error-log";

// POST /api/studio/[runId]/feedback — record the per-run 👍/👎 (Phase H). Thin: auth →
// setRunFeedback (owner-scoped, value 1|-1|0 with 0=clear, optional note on -1) → map StudioError.
export async function POST(req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { runId } = await params;
  try {
    const body = await req.json().catch(() => ({}));
    const value = typeof body?.value === "number" ? body.value : NaN;
    const note = typeof body?.note === "string" ? body.note : undefined;
    const result = await setRunFeedback(user, runId, value, note);
    return NextResponse.json(result);
  } catch (e) {
    const mapped = studioErrorResponse(e);
    if (mapped) return mapped;
    await logError({ source: "studio.feedback", error: e, httpStatus: 502, featureRunId: runId, userId: user.id });
    return NextResponse.json({ error: "Could not save feedback — cuba semula", retryable: true }, { status: 502 });
  }
}
