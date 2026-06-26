import type { JobRow } from "@/lib/job-store";
import { prisma } from "@/lib/prisma";
import { runVisualJob } from "@/lib/visual-job";
import { runRecipe } from "@/lib/recipe-run";
import { isRecipeConfigError } from "@/lib/studio-error";
import type { HandlerResult } from "../dispatch";

// `generate` handler. Branches on the run shape:
//   run has a recipeId  → Module 1 recipe engine (Phase D)
//   else                → legacy poster pipeline (runVisualJob), unchanged.
// Legacy runs never carry a recipeId, so the existing /api/generate/visual flow is
// untouched — the branch only fires for creative-journey runs from the Phase C router.
export async function runGenerateHandler(job: JobRow): Promise<HandlerResult> {
  const payload = (job.payload ?? {}) as { runId?: string };
  const runId = payload.runId ?? job.featureRunId ?? null;

  if (runId) {
    const run = await prisma.creativeRun.findUnique({
      where: { id: runId },
      select: {
        id: true, recipeId: true, brandId: true, userId: true, lens: true,
        spec: true, feature: true, brand: { select: { slug: true } },
      },
    });
    if (run?.recipeId) {
      try {
        const result = await runRecipe({
          id: run.id,
          brandId: run.brandId,
          brandSlug: run.brand?.slug ?? "",
          recipeId: run.recipeId,
          lens: run.lens ?? "marketing",
          spec: run.spec,
          feature: run.feature,
          userId: run.userId,
        });

        // Phase G — TEXT-FIRST flow: the recipe job produces text + the visual_direction
        // instruction only. The image is NOT rendered here — the user reviews the copy first,
        // then triggers `POST /api/studio/[runId]/render` on demand from the Result screen
        // (renderFromRun, the same idempotent seam). visual_direction stays as the render input.
        return {
          ok: true,
          resultKind: "recipe",
          result: { artifacts: result.artifacts, guardian: result.guardian, notices: result.notices },
          costMyr: result.costMyr,
        };
      } catch (e) {
        // misconfigured recipe (no recipe/grounding/producing experts) won't fix on
        // re-run → non-retryable. Anything else (OpenAI/transient) → retryable.
        if (isRecipeConfigError(e)) {
          return { ok: false, retryable: false, reason: e.message };
        }
        return { ok: false, retryable: true, reason: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  // ── Legacy poster pipeline (unchanged) ──
  if (!job.featureRunId || !job.userId) {
    return { ok: false, retryable: false, reason: "generate job missing featureRunId/userId" };
  }
  const r = await runVisualJob({ featureRunId: job.featureRunId, userId: job.userId });
  if (r.ok && r.shouldRender) return { ok: true, resultKind: "image", costMyr: r.costMyr };
  if (r.ok) return { ok: true, resultKind: "skipped" };
  return { ok: false, retryable: r.retryable, reason: r.reason };
}
