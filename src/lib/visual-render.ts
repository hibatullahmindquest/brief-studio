import { readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getBrandContext } from "@/lib/brand-context";
import { renderImage, IMAGE_MODEL } from "@/lib/visual";
import { applyBrandOverlay, type OverlayBrand } from "@/lib/visual-overlay";
import { resolveVisualDirection, type RenderRatio } from "@/lib/visual-direction";
import { sizeForAspect, type ImageSize } from "@/lib/pricing";
import { logUsage, sumRunCostMyr } from "@/lib/usage";
import { logError } from "@/lib/error-log";
import { classifyVisualError } from "@/lib/visual-job";

// Module 1 Phase E — the render seam.
//
// Standalone, idempotent, owner-scoped. Called by the worker generate handler AFTER a recipe
// run produced a `visual_direction` Artifact — but takes only a runId so it is independently
// re-invokable (a future "regenerate image" action calls the same fn). It NEVER touches the
// text artifacts: regenerating the image leaves strategy/copy/visual_direction in place, and a
// render failure leaves the (already valuable) text run intact. The image render + brand overlay
// are injected (real defaults wired) so the seam is unit-testable without OpenAI.

const VISUAL_DIRECTION = "visual_direction";
const IMAGE = "image";

export type RenderDeps = {
  render?: (args: { prompt: string; size: ImageSize; runId: string }) => Promise<{ urlPath: string; size: ImageSize; imageCount: number }>;
  overlay?: (input: Buffer, brand: OverlayBrand) => Promise<Buffer>;
};

export type RenderOutcome =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; mediaPath: string; ratio: RenderRatio; costMyr: number }
  | { ok: false; retryable: boolean; reason: string; category: string };

export async function renderFromRun(args: {
  runId: string;
  userId: string;
  /** opt into describe mode (use the run's own visual description). Worker uses auto (false). */
  useDescribe?: boolean;
  deps?: RenderDeps;
}): Promise<RenderOutcome> {
  const { runId, userId } = args;
  const render = args.deps?.render ?? renderImage;
  const overlay = args.deps?.overlay ?? applyBrandOverlay;

  // owner-scoped load — render only runs on a run the caller owns.
  const run = await prisma.creativeRun.findFirst({
    where: { id: runId, userId },
    select: { id: true, brandId: true, spec: true, inputText: true, brand: { select: { slug: true } } },
  });
  if (!run) return { ok: false, retryable: false, reason: "Run not found.", category: "not_found" };

  // Gate: only render when an image-producing recipe left a visual_direction artifact.
  const direction = await prisma.artifact.findFirst({
    where: { runId, type: VISUAL_DIRECTION },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });
  if (!direction) return { ok: true, skipped: true, reason: "no visual_direction artifact — text-only recipe" };

  const dirText = ((direction.content as { text?: unknown } | null)?.text ?? "").toString();

  const brandSlug = run.brand?.slug ?? "";
  const brand = brandSlug ? await getBrandContext(brandSlug) : null;
  if (!brand) return { ok: false, retryable: false, reason: "Brand not found for render.", category: "no_brand" };

  const contract = resolveVisualDirection({
    visualDirectionText: dirText,
    describeText: run.inputText,
    useDescribe: args.useDescribe,
    spec: run.spec,
    brand,
  });

  // Idempotent: drop any image artifact from a prior render before (re)writing. IMAGE type only,
  // so text artifacts are never affected.
  await prisma.artifact.deleteMany({ where: { runId, type: IMAGE } });

  try {
    const image = await render({ prompt: contract.imagePrompt, size: sizeForAspect(contract.ratio), runId });

    // Stamp brand furniture (logo + footer). Best-effort — overlay failure must NOT fail render.
    try {
      const abs = path.join(process.cwd(), "public", image.urlPath.replace(/^\/+/, ""));
      const stamped = await overlay(await readFile(abs), {
        logoPath: brand.logoPath, logoPathLight: brand.logoPathLight, logoPathDark: brand.logoPathDark,
        logoSize: brand.logoSize, logoCorner: brand.logoCorner,
        footerLeft: brand.footerLeft, footerRight: brand.footerRight,
      });
      await writeFile(abs, stamped);
    } catch (e) {
      await logError({ source: "visual.overlay", error: e, featureRunId: runId, userId, brandId: brand.id, context: {} });
    }

    await prisma.artifact.create({
      data: {
        runId,
        type: IMAGE,
        mediaPath: image.urlPath,
        exportFormat: "png",
        content: { ratio: contract.ratio, mode: contract.mode, prompt: contract.imagePrompt },
      },
    });

    await logUsage({
      userId, brandId: brand.id, featureRunId: runId,
      module: "visual", model: IMAGE_MODEL,
      imageCount: image.imageCount, imageSize: image.size,
    });

    const costMyr = await sumRunCostMyr(runId);
    return { ok: true, skipped: false, mediaPath: image.urlPath, ratio: contract.ratio, costMyr };
  } catch (err) {
    const c = classifyVisualError(err);
    await logError({
      source: "visual.render", error: err, httpStatus: c.httpStatus,
      userId, brandId: brand.id, featureRunId: runId,
      context: { phase: "render", category: c.category, model: IMAGE_MODEL },
    });
    return { ok: false, retryable: c.retryable, reason: c.message, category: c.category };
  }
}
