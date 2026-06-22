import type { JobRow } from "@/lib/job-store";
import { runVisualJob } from "@/lib/visual-job";
import type { HandlerResult } from "../dispatch";

// Adapts the existing poster pipeline to the generic handler contract.
export async function runGenerateHandler(job: JobRow): Promise<HandlerResult> {
  if (!job.featureRunId || !job.userId) {
    return { ok: false, retryable: false, reason: "generate job missing featureRunId/userId" };
  }
  const r = await runVisualJob({ featureRunId: job.featureRunId, userId: job.userId });
  if (r.ok && r.shouldRender) return { ok: true, resultKind: "image", costMyr: r.costMyr };
  if (r.ok) return { ok: true, resultKind: "skipped" };
  return { ok: false, retryable: r.retryable, reason: r.reason };
}
