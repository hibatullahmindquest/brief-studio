import { prisma } from "@/lib/prisma";
import { enqueue } from "@/lib/job-store";
import { gapCheck } from "@/lib/router";
import type { Lens } from "@/lib/lens";
import { StudioError } from "@/lib/studio-error";

// Module 1 Phase D — confirm trigger (deep lib).
// Moves a Phase-C draft CreativeRun into the recipe engine: validates owner / state /
// recipe / remaining gaps, then enqueues a `generate` job (idempotent on runId). The
// route is a thin auth + error-map wrapper around this.

export type ConfirmResult = { runId: string; jobId: string; status: string; reused: boolean };

export async function confirmRun(user: { id: string }, runId: string): Promise<ConfirmResult> {
  const id = (runId ?? "").trim();
  if (!id) throw new StudioError(400, "runId is required");

  const run = await prisma.creativeRun.findUnique({
    where: { id },
    select: {
      id: true, userId: true, recipeId: true, brandId: true, lens: true,
      spec: true, feature: true, status: true, brand: { select: { slug: true } },
    },
  });
  if (!run) throw new StudioError(404, "Run not found");
  if (run.userId !== user.id) throw new StudioError(403, "Not your run");
  if (run.status !== "draft") throw new StudioError(409, `Run already ${run.status}`);
  if (!run.recipeId) throw new StudioError(409, "No recipe selected — clarify the brief first");

  // Gap guard — refuse to generate while required brief fields are still missing.
  const spec = run.spec && typeof run.spec === "object" ? (run.spec as Record<string, string>) : {};
  const lens = (run.lens ?? "marketing") as Lens;
  const brandSlug = run.brand?.slug ?? "";
  const gaps = await gapCheck(run.feature, spec, { taskType: run.feature, lens, brandSlug });
  if (gaps.length > 0) {
    throw new StudioError(409, "Brief incomplete — jawab soalan yang tinggal", false, { gaps });
  }

  const { job, reused } = await enqueue({
    kind: "generate",
    lane: "interactive",
    dedupeKey: run.id, // one active generate per run
    featureRunId: run.id,
    userId: run.userId,
    brandId: run.brandId,
    payload: { runId: run.id },
  });

  return { runId: run.id, jobId: job.id, status: job.status, reused };
}
