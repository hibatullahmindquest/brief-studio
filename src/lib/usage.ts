import { prisma } from "@/lib/prisma";
import { actualFromUsage, USD_TO_MYR, type UsageInput } from "@/lib/pricing";

export type LogUsageInput = UsageInput & {
  userId: string;
  brandId?: string | null;
  featureRunId?: string | null;
  module: "visual" | "copy" | "router" | "expert";
};

// Records one AI call's usage + cost. Never throws — logging must not break
// the user-facing generation flow.
export async function logUsage(input: LogUsageInput): Promise<void> {
  const cost = actualFromUsage(input);
  try {
    await prisma.aPIUsageLog.create({
      data: {
        userId: input.userId,
        brandId: input.brandId ?? null,
        featureRunId: input.featureRunId ?? null,
        module: input.module,
        model: input.model,
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        imageCount: input.imageCount ?? 0,
        imageSize: input.imageSize ?? "",
        costUsd: cost.usd,
        costMyr: cost.myr,
      },
    });
  } catch (e) {
    console.error("[usage] log failed:", e instanceof Error ? e.message : e);
  }
}

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Total MYR cost logged against one FeatureRun — sums every AI call attributed
// to it (spec synthesis + per-field regenerations + the image render) so the
// guided-brief flow can show a true end-to-end poster cost. Never throws.
export async function sumRunCostMyr(featureRunId: string): Promise<number> {
  try {
    const agg = await prisma.aPIUsageLog.aggregate({
      _sum: { costMyr: true },
      where: { featureRunId },
    });
    return round2(agg._sum.costMyr ?? 0);
  } catch {
    return 0;
  }
}

export type UsageRecent = {
  id: string;
  brand: string | null;
  brandSlug: string | null;
  module: string;
  model: string;
  costMyr: number;
  imageCount: number;
  createdAt: string;
};

export type UsageSummary = {
  todayMyr: number;
  todayCount: number;
  monthMyr: number;
  monthByModule: { module: string; myr: number }[];
  imageCount: number;
  avgPerImageMyr: number;
  rate: number;
  recent: UsageRecent[];
};

// Org-wide AI cost summary. Period boundaries computed in MYT (store UTC).
// Date logic lives here (a lib), not in the page component, to keep the
// server component pure.
export async function getUsageSummary(): Promise<UsageSummary> {
  const now = new Date();
  const myt = new Date(now.getTime() + MYT_OFFSET_MS);
  const todayStart = new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate()) - MYT_OFFSET_MS);
  const monthStart = new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), 1) - MYT_OFFSET_MS);

  const [today, month, monthByMod, images, recentRows, brands] = await Promise.all([
    prisma.aPIUsageLog.aggregate({ _sum: { costMyr: true }, _count: true, where: { createdAt: { gte: todayStart } } }),
    prisma.aPIUsageLog.aggregate({ _sum: { costMyr: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.aPIUsageLog.groupBy({ by: ["module"], _sum: { costMyr: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.aPIUsageLog.aggregate({ _sum: { costMyr: true, imageCount: true }, where: { imageCount: { gt: 0 } } }),
    prisma.aPIUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, brandId: true, module: true, model: true, costMyr: true, imageCount: true, createdAt: true },
    }),
    prisma.brand.findMany({ select: { id: true, name: true, slug: true } }),
  ]);

  const brandMap = new Map(brands.map((b) => [b.id, { name: b.name, slug: b.slug }]));
  const totalImg = images._sum.imageCount ?? 0;
  const imgMyr = images._sum.costMyr ?? 0;

  return {
    todayMyr: round2(today._sum.costMyr ?? 0),
    todayCount: today._count,
    monthMyr: round2(month._sum.costMyr ?? 0),
    monthByModule: monthByMod.map((m) => ({ module: m.module, myr: round2(m._sum.costMyr ?? 0) })),
    imageCount: totalImg,
    avgPerImageMyr: totalImg > 0 ? round2(imgMyr / totalImg) : 0,
    rate: USD_TO_MYR,
    recent: recentRows.map((r) => ({
      id: r.id,
      brand: r.brandId ? brandMap.get(r.brandId)?.name ?? null : null,
      brandSlug: r.brandId ? brandMap.get(r.brandId)?.slug ?? null : null,
      module: r.module,
      model: r.model,
      costMyr: round2(r.costMyr),
      imageCount: r.imageCount,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
