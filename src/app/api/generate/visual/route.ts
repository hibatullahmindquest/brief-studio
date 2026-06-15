import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserWithRole } from "@/lib/session";
import { getBrandContext } from "@/lib/brand-context";
import { getFeatureRunOwned, updateFeatureRunOutput } from "@/lib/feature-store";
import { planVisual, renderImage } from "@/lib/visual";
import { OUTPUT_TYPES } from "@/lib/conversation-engine";
import { sizeForAspect, actualFromUsage } from "@/lib/pricing";
import { logUsage } from "@/lib/usage";
import { logError } from "@/lib/error-log";
import { enforceRateLimit } from "@/lib/rate-limit";

type Body = { featureRunId?: string };

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

type StoredInput = { brandSlug?: string; brandId?: string; contentType?: string; briefAnswers?: Record<string, string> };

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

type Classified = { category: string; retryable: boolean; httpStatus: number; message: string };

// Map any generation error to a user-facing category + reason + whether
// retrying could help. (Real OpenAI codes are visible in the ErrorLog.)
function classifyVisualError(err: unknown): Classified {
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

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, { keyPrefix: "feature:visual", limit: 15, windowMs: 10 * 60 * 1000 });
  if (rateLimited) return rateLimited;

  // Auth — creative or admin only (visual outputs are a creative concern).
  const user = await getCurrentUserWithRole();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin && user.teamRole !== "creative") {
    return NextResponse.json({ error: "Forbidden — creative or admin only" }, { status: 403 });
  }

  const { featureRunId } = (await req.json().catch(() => ({}))) as Body;
  if (!featureRunId) return NextResponse.json({ error: "Missing featureRunId" }, { status: 400 });

  const run = await getFeatureRunOwned(featureRunId, user.id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  const output = safeParse<StoredOutput>(run.outputJson) ?? {};
  const input = safeParse<StoredInput>(run.inputJson) ?? {};

  const brandSlug = input.brandSlug;
  if (!brandSlug) return NextResponse.json({ error: "Run has no brand" }, { status: 422 });
  const brand = await getBrandContext(brandSlug);
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  // Resolve output type id from the stored label (input.contentType = OutputType.label).
  const outputTypeId = OUTPUT_TYPES.find((o) => o.label === input.contentType)?.id ?? "";
  const outputText = output.primaryPost ?? "";
  const briefAnswers = input.briefAnswers ?? {};

  let phase: "plan" | "render" = "plan";
  try {
    const { plan, usage: planUsage } = await planVisual({ outputTypeId, outputText, briefAnswers, brand });

    // Always log the director call.
    if (planUsage.model !== "none") {
      await logUsage({
        userId: user.id, brandId: brand.id, featureRunId,
        module: "visual", model: planUsage.model,
        inputTokens: planUsage.inputTokens, outputTokens: planUsage.outputTokens,
      });
    }

    if (!plan.shouldRender) {
      return NextResponse.json({ shouldRender: false, kind: plan.kind });
    }

    const size = sizeForAspect(plan.aspect);
    phase = "render";
    const image = await renderImage({ prompt: plan.imagePrompt, size, runId: featureRunId });

    // Log the image render.
    await logUsage({
      userId: user.id, brandId: brand.id, featureRunId,
      module: "visual", model: "gpt-image-2",
      imageCount: image.imageCount, imageSize: image.size,
    });

    // Persist into the run's output so it shows in history.
    const visual = {
      kind: plan.kind,
      aspect: plan.aspect,
      urlPath: image.urlPath,
      prompt: plan.imagePrompt,
      scenes: plan.scenes,
    };
    await updateFeatureRunOutput(featureRunId, { ...output, image: visual, visualPlan: { kind: plan.kind, scenes: plan.scenes } });

    const directorCost = planUsage.model !== "none"
      ? actualFromUsage({ model: planUsage.model, inputTokens: planUsage.inputTokens, outputTokens: planUsage.outputTokens })
      : { myr: 0 };
    const imageCost = actualFromUsage({ model: "gpt-image-2", imageCount: image.imageCount, imageSize: image.size });
    const costMyr = Math.round((directorCost.myr + imageCost.myr) * 100) / 100;

    return NextResponse.json({
      shouldRender: true,
      kind: plan.kind,
      aspect: plan.aspect,
      image: { urlPath: image.urlPath, aspect: plan.aspect },
      scenes: plan.scenes,
      costMyr,
    });
  } catch (err) {
    const c = classifyVisualError(err);
    await logError({
      source: `visual.${phase}`,
      error: err,
      httpStatus: c.httpStatus,
      userId: user.id,
      brandId: brand.id,
      featureRunId,
      context: { outputTypeId, phase, category: c.category, model: phase === "render" ? "gpt-image-2" : "director" },
    });
    return NextResponse.json(
      { error: c.message, category: c.category, retryable: c.retryable },
      { status: c.httpStatus }
    );
  }
}
