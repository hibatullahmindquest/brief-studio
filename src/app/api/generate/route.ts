import { NextRequest, NextResponse } from "next/server";
import { generateCopy } from "@/lib/openai";
import { getLatestFeatureRun, saveFeatureRun } from "@/lib/feature-store";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/lib/session";

type GenerateBody = {
  brandName?: string;
  tone?: string;
  product?: string;
  contentType?: string;
  variant?: number;
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
    const { brandName, tone, product, contentType, variant } = (await req.json()) as GenerateBody;

    if (!brandName || !tone || !product || !contentType) {
      return NextResponse.json({ error: "Missing required generation fields" }, { status: 400 });
    }

    const copy = await generateCopy(brandName, tone, product, contentType, variant ?? 1);
    const generatedAt = new Date().toISOString();

    await saveFeatureRun({
      userId: user.id,
      feature: "generate",
      subtype: contentType,
      input: { brandName, tone, product, contentType, variant: variant ?? 1 },
      output: { ...copy, generatedAt },
    });

    return NextResponse.json({ ...copy, generatedAt });
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
