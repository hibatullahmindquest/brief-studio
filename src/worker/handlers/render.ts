import type { JobRow } from "@/lib/job-store";
import { renderFromRun } from "@/lib/visual-render";
import type { HandlerResult } from "../dispatch";

// `render` handler — the on-demand poster render (Phase G text-first flow). Runs the same
// idempotent renderFromRun seam the worker used to call inline, but now as its own queued job
// so the user can leave the Result screen and pick the image up from Recent when it's done.
export async function runRenderHandler(job: JobRow): Promise<HandlerResult> {
  const payload = (job.payload ?? {}) as { runId?: string; ratio?: "1:1" | "9:16" | "16:9" };
  const runId = payload.runId ?? job.featureRunId ?? null;
  const userId = job.userId;
  if (!runId || !userId) return { ok: false, retryable: false, reason: "render job missing runId/userId" };

  const r = await renderFromRun({ runId, userId, ratio: payload.ratio });
  if (r.ok && r.skipped) return { ok: true, resultKind: "skipped", reason: r.reason };
  if (r.ok) return { ok: true, resultKind: "image", costMyr: r.costMyr, result: { mediaPath: r.mediaPath, ratio: r.ratio } };
  return { ok: false, retryable: r.retryable, reason: r.reason };
}
