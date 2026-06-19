import { readFile, writeFile } from "fs/promises";
import path from "path";
import { getBrandContext } from "@/lib/brand-context";
import { generateCopy } from "@/lib/openai";
import { getFeatureRunOwned, updateFeatureRunOutput, setFeatureRunStatus } from "@/lib/feature-store";
import { planVisual, renderImage, kindForOutputType, buildPosterPromptFromSpec, type VisualSpec, type Aspect } from "@/lib/visual";
import { applyBrandOverlay } from "@/lib/visual-overlay";
import { OUTPUT_TYPES } from "@/lib/conversation-engine";
import { sizeForAspect, actualFromUsage } from "@/lib/pricing";
import { logUsage, sumRunCostMyr } from "@/lib/usage";
import { logError } from "@/lib/error-log";

// Shared visual-generation unit. Called by the WORKER (and previously by the
// route). Does NOT handle auth / rate-limit — the caller owns that. Returns a
// discriminated result the worker maps onto GenerationJob status.

type StoredOutput = {
  primaryPost?: string;
  caption?: string;
  callToAction?: string;
  hashtags?: string[];
  strategyNote?: string;
  generatedAt?: string;
  image?: unknown;
  visualPlan?: unknown;
};

type StoredInput = { brandSlug?: string; brandId?: string; contentType?: string; briefAnswers?: Record<string, string>; visualSpec?: VisualSpec };

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

export type Classified = { category: string; retryable: boolean; httpStatus: number; message: string };

// Map any generation error to a user-facing category + reason + whether
// retrying could help. (Real OpenAI codes are visible in the ErrorLog.)
export function classifyVisualError(err: unknown): Classified {
  const e = err as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof e?.code === "string" ? e.code : "";
  const status = typeof e?.status === "number" ? e.status : undefined;
  const msg = (typeof e?.message === "string" ? e.message : "").toLowerCase();

  if (
    code === "content_policy_violation" ||
    code === "moderation_blocked" ||
    /moderat|safety|content policy|sensitive|rejected by/.test(msg)
  ) {
    return {
      category: "moderated",
      retryable: false,
      httpStatus: 422,
      message: "Visual disekat — kandungan ada elemen sensitif. Ubah brief dan jana semula.",
    };
  }
  if (code === "insufficient_quota" || status === 429) {
    return {
      category: "quota",
      retryable: false,
      httpStatus: 402,
      message: "Kuota OpenAI habis. Hubungi admin untuk semak billing.",
    };
  }
  if (status === 408 || /timeout|timed out|etimedout|network|fetch failed|socket/.test(msg)) {
    return {
      category: "timeout",
      retryable: true,
      httpStatus: 504,
      message: "Generation terlalu lama atau masalah rangkaian. Cuba semula.",
    };
  }
  if (typeof status === "number" && status >= 500) {
    return {
      category: "api_error",
      retryable: true,
      httpStatus: 502,
      message: "Ralat server OpenAI. Cuba semula sebentar lagi.",
    };
  }
  return {
    category: "system",
    retryable: true,
    httpStatus: 500,
    message: "Ralat sistem semasa jana visual. Cuba semula.",
  };
}

export type VisualScene = { no: number; caption: string };

// Result the worker maps to job status.
export type VisualJobResult =
  | { ok: true; shouldRender: false; kind: string }
  | {
      ok: true;
      shouldRender: true;
      kind: string;
      aspect: string;
      image: { urlPath: string; aspect: string };
      scenes: VisualScene[];
      costMyr: number;
    }
  | { ok: false; reason: string; retryable: boolean; category: string };

// Run the full visual generation for one FeatureRun. Pure of HTTP concerns.
// `userId` is the job submitter (used for the ownership-scoped run lookup +
// usage/error attribution). `brandId` (optional) lets callers skip a lookup.
export async function runVisualJob(args: { featureRunId: string; userId: string }): Promise<VisualJobResult> {
  const { featureRunId, userId } = args;

  const run = await getFeatureRunOwned(featureRunId, userId);
  if (!run) return { ok: false, reason: "Run not found.", retryable: false, category: "not_found" };

  const output = safeParse<StoredOutput>(run.outputJson) ?? {};
  const input = safeParse<StoredInput>(run.inputJson) ?? {};

  const brandSlug = input.brandSlug;
  if (!brandSlug) return { ok: false, reason: "Run has no brand.", retryable: false, category: "no_brand" };
  const brand = await getBrandContext(brandSlug);
  if (!brand) return { ok: false, reason: "Brand not found.", retryable: false, category: "no_brand" };

  // Resolve output type id from the stored label (input.contentType = OutputType.label).
  const outputTypeId = OUTPUT_TYPES.find((o) => o.label === input.contentType)?.id ?? "";
  const outputText = output.primaryPost ?? "";
  const briefAnswers = input.briefAnswers ?? {};

  const spec = input.visualSpec;
  let phase: "plan" | "render" = "plan";
  const startedAt = Date.now(); // wall-clock for the recorded generation time
  try {
    // Two paths: (1) NEW guided-brief flow — a confirmed Creative Spec already
    // exists (director cost paid when the spec was synthesised), so build the
    // image prompt from it directly; (2) legacy flow — call planVisual.
    let plan: { shouldRender: boolean; kind: string; aspect: Aspect; imagePrompt: string; scenes: VisualScene[] };
    let planUsage: { model: string; inputTokens: number; outputTokens: number } = { model: "none", inputTokens: 0, outputTokens: 0 };

    if (spec) {
      plan = {
        shouldRender: true,
        kind: kindForOutputType(outputTypeId) === "none" ? "poster" : kindForOutputType(outputTypeId),
        aspect: spec.ratio,
        imagePrompt: buildPosterPromptFromSpec(spec, brand),
        scenes: [],
      };
    } else {
      const r = await planVisual({ outputTypeId, outputText, briefAnswers, brand });
      plan = r.plan;
      planUsage = r.usage;
    }

    // Log the director call (legacy path only — spec path logged it at synthesis).
    if (planUsage.model !== "none") {
      await logUsage({
        userId, brandId: brand.id, featureRunId,
        module: "visual", model: planUsage.model,
        inputTokens: planUsage.inputTokens, outputTokens: planUsage.outputTokens,
      });
    }

    if (!plan.shouldRender) {
      return { ok: true, shouldRender: false, kind: plan.kind };
    }

    const size = sizeForAspect(plan.aspect);
    phase = "render";
    const image = await renderImage({ prompt: plan.imagePrompt, size, runId: featureRunId });

    // P7: stamp brand furniture (logo + footer) onto the saved poster. Spec path
    // only; overlay failure must NOT fail the generation.
    if (spec) {
      try {
        const abs = path.join(process.cwd(), "public", image.urlPath.replace(/^\/+/, ""));
        const stamped = await applyBrandOverlay(await readFile(abs), {
          logoPath: brand.logoPath, logoPathLight: brand.logoPathLight, logoPathDark: brand.logoPathDark,
          logoSize: brand.logoSize, logoCorner: brand.logoCorner,
          footerLeft: brand.footerLeft, footerRight: brand.footerRight,
        });
        await writeFile(abs, stamped);
      } catch (e) {
        await logError({ source: "visual.overlay", error: e, featureRunId, userId, brandId: brand.id, context: {} });
      }
    }

    // Log the image render.
    await logUsage({
      userId, brandId: brand.id, featureRunId,
      module: "visual", model: "gpt-image-2",
      imageCount: image.imageCount, imageSize: image.size,
    });

    // Guided-brief flow: also generate the social copy (caption / CTA / hashtags /
    // strategy note) so a poster carries the full post, not just the image.
    // Best-effort — a copy failure must not fail the (already rendered) poster.
    let copyFields: Partial<StoredOutput> = {};
    if (spec) {
      try {
        const product = spec.brief?.trim() || spec.angle || brand.name;
        const { copy, usage } = await generateCopy(brand, product, "Poster", 1, {
          angle: spec.angle, objective: spec.objective, style: spec.style, mood: spec.mood,
          headline: spec.headline, accent: spec.accent, cta: spec.cta, concept: spec.concept,
        });
        copyFields = copy;
        await logUsage({
          userId, brandId: brand.id, featureRunId,
          module: "copy", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
        });
      } catch (e) {
        await logError({ source: "visual.copy", error: e, userId, brandId: brand.id, featureRunId, context: {} });
      }
    }

    // Total cost for the run, persisted into its output so Semakan Lepas shows it.
    // P11: sum every AI call logged against this run — spec synthesis + per-field
    // regenerations (guided-brief flow) or the director call (legacy flow), plus
    // the image render just logged above. Falls back to a direct director+image
    // sum if the usage table can't be read.
    let costMyr = await sumRunCostMyr(featureRunId);
    if (costMyr <= 0) {
      const directorCost = planUsage.model !== "none"
        ? actualFromUsage({ model: planUsage.model, inputTokens: planUsage.inputTokens, outputTokens: planUsage.outputTokens })
        : { myr: 0 };
      const imageCost = actualFromUsage({ model: "gpt-image-2", imageCount: image.imageCount, imageSize: image.size });
      costMyr = Math.round((directorCost.myr + imageCost.myr) * 100) / 100;
    }

    // Persist into the run's output so it shows in history.
    const generatedMs = Date.now() - startedAt;
    const visual = {
      kind: plan.kind,
      aspect: plan.aspect,
      urlPath: image.urlPath,
      prompt: plan.imagePrompt,
      scenes: plan.scenes,
      generatedMs,
      costMyr,
    };
    await updateFeatureRunOutput(featureRunId, {
      ...output,
      ...copyFields,
      generatedAt: output.generatedAt ?? new Date().toISOString(),
      image: visual,
      visualPlan: { kind: plan.kind, scenes: plan.scenes },
    });
    await setFeatureRunStatus(featureRunId, "generated");

    return {
      ok: true,
      shouldRender: true,
      kind: plan.kind,
      aspect: plan.aspect,
      image: { urlPath: image.urlPath, aspect: plan.aspect },
      scenes: plan.scenes,
      costMyr,
    };
  } catch (err) {
    const c = classifyVisualError(err);
    await logError({
      source: `visual.${phase}`,
      error: err,
      httpStatus: c.httpStatus,
      userId,
      brandId: brand.id,
      featureRunId,
      context: { outputTypeId, phase, category: c.category, model: phase === "render" ? "gpt-image-2" : "director" },
    });
    return { ok: false, reason: c.message, retryable: c.retryable, category: c.category };
  }
}
