import { prisma } from "@/lib/prisma";
import { StudioError } from "@/lib/studio-error";

// Module 1 Phase H — per-run feedback (deep lib).
// One 👍/👎 per result, stored on CreativeRun.feedback (1 = up, -1 = down, null = none) with an
// optional note on a thumbs-down. Owner-scoped. The route is a thin auth + error-map wrapper.
// (Per-artifact feedback stays available on Artifact.feedback for a future granular pass.)

export type FeedbackResult = { feedback: number | null; feedbackNote: string | null };

export async function setRunFeedback(
  user: { id: string },
  runId: string,
  value: number,
  note?: string,
): Promise<FeedbackResult> {
  const id = (runId ?? "").trim();
  if (!id) throw new StudioError(400, "runId is required");
  if (value !== 1 && value !== -1 && value !== 0) throw new StudioError(400, "value must be 1, -1, or 0");

  // owner-scoped — you can only rate your own run
  const run = await prisma.creativeRun.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!run) throw new StudioError(404, "Run not found");

  const feedback = value === 0 ? null : value;
  // a note only makes sense on a thumbs-down; cleared on up / clear
  const feedbackNote = value === -1 ? (note?.trim() || null) : null;

  await prisma.creativeRun.update({ where: { id }, data: { feedback, feedbackNote } });
  return { feedback, feedbackNote };
}
