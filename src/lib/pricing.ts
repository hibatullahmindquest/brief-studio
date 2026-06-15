// AI cost estimation + actual cost for usage logging.
// Rates are USD and intentionally configurable — verify against current
// OpenAI pricing periodically. Image rates are per-image (gpt-image-2);
// text rates are per 1K tokens.

export const USD_TO_MYR = Number(process.env.USD_TO_MYR) || 4.7;

// Text models — USD per 1K tokens.
const TEXT_RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 0.0025, out: 0.01 },
  "gpt-5": { in: 0.00125, out: 0.01 },
};
const TEXT_FALLBACK = { in: 0.0025, out: 0.01 };

// Image model (gpt-image-2) — USD per image by size.
const IMAGE_RATES: Record<string, number> = {
  "1024x1024": 0.04,
  "1024x1536": 0.06,
  "1536x1024": 0.06,
};
const IMAGE_FALLBACK = 0.06;

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";
export type Aspect = "1:1" | "9:16" | "16:9";

export type Cost = { usd: number; myr: number };

export function sizeForAspect(aspect: Aspect | string): ImageSize {
  if (aspect === "9:16") return "1024x1536";
  if (aspect === "16:9") return "1536x1024";
  return "1024x1024";
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function pack(usd: number): Cost {
  return { usd: round(usd, 6), myr: round(usd * USD_TO_MYR, 2) };
}

// Rough director-call token budget for the pre-render estimate.
const DIRECTOR_EST_TOKENS = { in: 900, out: 450 };

export function textModelName(): string {
  return process.env.OPENAI_MODEL ?? "gpt-5";
}

/** Estimate before rendering: one image + a small gpt-4o/gpt-5 director call. */
export function estimateVisual(size: ImageSize, textModel = textModelName()): Cost {
  const img = IMAGE_RATES[size] ?? IMAGE_FALLBACK;
  const t = TEXT_RATES[textModel] ?? TEXT_FALLBACK;
  const director =
    (DIRECTOR_EST_TOKENS.in / 1000) * t.in + (DIRECTOR_EST_TOKENS.out / 1000) * t.out;
  return pack(img + director);
}

export type UsageInput = {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  imageSize?: string;
};

/** Actual cost from real usage. Image calls bill per image; text calls per token. */
export function actualFromUsage(u: UsageInput): Cost {
  if (u.imageCount && u.imageCount > 0) {
    const per = IMAGE_RATES[u.imageSize ?? ""] ?? IMAGE_FALLBACK;
    return pack(per * u.imageCount);
  }
  const t = TEXT_RATES[u.model] ?? TEXT_FALLBACK;
  const usd =
    ((u.inputTokens ?? 0) / 1000) * t.in + ((u.outputTokens ?? 0) / 1000) * t.out;
  return pack(usd);
}
