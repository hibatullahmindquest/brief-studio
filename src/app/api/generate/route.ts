import { NextRequest, NextResponse } from "next/server";
import { generateCopy } from "@/lib/openai";
import { getBrandContext } from "@/lib/brand-context";
import { getLatestFeatureRun, saveFeatureRun } from "@/lib/feature-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";
import { logUsage } from "@/lib/usage";

type GenerateBody = {
  brandSlug?: string;
  product?: string;
  contentType?: string;
  variant?: number;
  briefAnswers?: Record<string, string>;
};

export async function GET(req: NextRequest) {
  const user = await requireUser();
  const contentType = req.nextUrl.searchParams.get("contentType") ?? undefined;

  const latest = await getLatestFeatureRun({
    userId: user.id,
    feature: "generate",
    subtype: contentType,
  });

  if (!latest) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    ...(latest.output as Record<string, unknown>),
    input: latest.input,
    generatedAt: latest.createdAt,
  });
}

export async function POST(req: NextRequest) {
  const rateLimited = enforceRateLimit(req, {
    keyPrefix: "feature:generate",
    limit: 25,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  try {
    const user = await requireUser();
    const { brandSlug, product, contentType, variant, briefAnswers } = (await req.json()) as GenerateBody;

    if (!brandSlug || !product || !contentType) {
      return NextResponse.json({ error: "Missing required generation fields" }, { status: 400 });
    }

    const brand = await getBrandContext(brandSlug);
    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { copy, usage } = await generateCopy(brand, product, contentType, variant ?? 1, briefAnswers);
    const generatedAt = new Date().toISOString();

    const run = await saveFeatureRun({
      userId: user.id,
      feature: "generate",
      subtype: contentType,
      input: { brandSlug, brandId: brand.id, product, contentType, variant: variant ?? 1, briefAnswers },
      output: { ...copy, generatedAt },
    });

    await logUsage({
      userId: user.id,
      brandId: brand.id,
      featureRunId: run.id,
      module: "copy",
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });

    return NextResponse.json({ ...copy, generatedAt, id: run.id });
  } catch (err) {
    console.error("generation error", err);
    const isQuota =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "insufficient_quota";
    if (isQuota) {
      return NextResponse.json(
        { error: "OpenAI quota exceeded. Please add billing details at platform.openai.com." },
        { status: 402 }
      );
    }
    const msg = err instanceof Error ? err.message : "generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
