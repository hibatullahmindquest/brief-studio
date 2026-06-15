import { prisma } from "@/lib/prisma";

// Paid analytics roll-ups over AdDailyMetric. Periods are anchored to the
// latest available data date (asOf) — not wall-clock — so imported history
// renders meaningful windows. T-1 = latest day, T-7 = latest 7 days; deltas
// compare against the immediately preceding equal-length window.

export type PaidPeriod = "t1" | "t7";

export type PaidMetrics = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  linkClicks: number;
  leads: number;
  waConversations: number;
  ctr: number; // %
  cpc: number;
  cpm: number;
  cpl: number;
  frequency: number;
};

export type PaidCreative = {
  adId: string;
  metaAdId: string;
  name: string;
  campaignName: string;
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
  frequency: number;
  fatigue: boolean; // freq high while CTR fell vs prior window
};

export type PaidAnalytics = {
  brandId: string;
  asOf: string | null;
  period: PaidPeriod;
  windowDays: number;
  current: PaidMetrics;
  previous: PaidMetrics;
  deltas: Partial<Record<keyof PaidMetrics, number>>; // % change vs previous
  topCreatives: PaidCreative[];
};

const ZERO: PaidMetrics = {
  spend: 0, impressions: 0, reach: 0, clicks: 0, linkClicks: 0, leads: 0,
  waConversations: 0, ctr: 0, cpc: 0, cpm: 0, cpl: 0, frequency: 0,
};

function dayUTC(d: Date, offsetDays = 0): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays));
}

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

type SumRow = {
  _sum: {
    spend: number | null; impressions: number | null; reach: number | null;
    clicks: number | null; linkClicks: number | null; leads: number | null;
    waConversations: number | null;
  };
  _avg: { frequency: number | null };
};

function deriveMetrics(s: SumRow): PaidMetrics {
  const spend = s._sum.spend ?? 0;
  const impressions = s._sum.impressions ?? 0;
  const clicks = s._sum.clicks ?? 0;
  const leads = s._sum.leads ?? 0;
  return {
    spend,
    impressions,
    reach: s._sum.reach ?? 0,
    clicks,
    linkClicks: s._sum.linkClicks ?? 0,
    leads,
    waConversations: s._sum.waConversations ?? 0,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    cpc: clicks ? spend / clicks : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
    cpl: leads ? spend / leads : 0,
    frequency: s._avg.frequency ?? 0,
  };
}

async function aggregateWindow(brandId: string, gte: Date, lte: Date): Promise<PaidMetrics> {
  const res = await prisma.adDailyMetric.aggregate({
    where: { brandId, metricDate: { gte, lte } },
    _sum: {
      spend: true, impressions: true, reach: true, clicks: true,
      linkClicks: true, leads: true, waConversations: true,
    },
    _avg: { frequency: true },
  });
  return deriveMetrics(res as SumRow);
}

export async function getPaidAnalytics(brandId: string, period: PaidPeriod): Promise<PaidAnalytics> {
  const maxRow = await prisma.adDailyMetric.aggregate({
    where: { brandId },
    _max: { metricDate: true },
  });
  const asOf = maxRow._max.metricDate ?? null;

  if (!asOf) {
    return {
      brandId, asOf: null, period, windowDays: period === "t1" ? 1 : 7,
      current: ZERO, previous: ZERO, deltas: {}, topCreatives: [],
    };
  }

  const windowDays = period === "t1" ? 1 : 7;
  const anchor = dayUTC(asOf);
  const currGte = dayUTC(anchor, -(windowDays - 1));
  const currLte = anchor;
  const prevGte = dayUTC(anchor, -(windowDays * 2 - 1));
  const prevLte = dayUTC(anchor, -windowDays);

  const [current, previous] = await Promise.all([
    aggregateWindow(brandId, currGte, currLte),
    aggregateWindow(brandId, prevGte, prevLte),
  ]);

  const deltas: Partial<Record<keyof PaidMetrics, number>> = {};
  (Object.keys(current) as (keyof PaidMetrics)[]).forEach((k) => {
    deltas[k] = pctDelta(current[k], previous[k]);
  });

  // Top creatives in current window + prior CTR for fatigue detection.
  const [currGroup, prevGroup, creatives] = await Promise.all([
    prisma.adDailyMetric.groupBy({
      by: ["adId"],
      where: { brandId, metricDate: { gte: currGte, lte: currLte } },
      _sum: { spend: true, leads: true, impressions: true, clicks: true },
      _avg: { frequency: true },
    }),
    prisma.adDailyMetric.groupBy({
      by: ["adId"],
      where: { brandId, metricDate: { gte: prevGte, lte: prevLte } },
      _sum: { impressions: true, clicks: true },
    }),
    prisma.adCreative.findMany({
      where: { brandId },
      select: { id: true, name: true, metaAdId: true },
    }),
  ]);

  const nameById = new Map(creatives.map((c) => [c.id, c.name]));
  const metaAdIdById = new Map(creatives.map((c) => [c.id, c.metaAdId]));
  const prevCtrById = new Map(
    prevGroup.map((g) => {
      const imp = g._sum.impressions ?? 0;
      const clk = g._sum.clicks ?? 0;
      return [g.adId, imp ? (clk / imp) * 100 : 0];
    })
  );

  const topCreatives: PaidCreative[] = currGroup
    .map((g) => {
      const spend = g._sum.spend ?? 0;
      const leads = g._sum.leads ?? 0;
      const imp = g._sum.impressions ?? 0;
      const clk = g._sum.clicks ?? 0;
      const ctr = imp ? (clk / imp) * 100 : 0;
      const frequency = g._avg.frequency ?? 0;
      const prevCtr = prevCtrById.get(g.adId);
      // Fatigue: audience saturating (freq high) and CTR fell vs prior window.
      const fatigue = frequency >= 2.5 && prevCtr !== undefined && prevCtr > 0 && ctr < prevCtr;
      return {
        adId: g.adId,
        metaAdId: metaAdIdById.get(g.adId) ?? "",
        name: nameById.get(g.adId) ?? g.adId,
        campaignName: "",
        spend,
        leads,
        ctr,
        cpl: leads ? spend / leads : 0,
        frequency,
        fatigue,
      };
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10);

  return {
    brandId,
    asOf: asOf.toISOString().slice(0, 10),
    period,
    windowDays,
    current,
    previous,
    deltas,
    topCreatives,
  };
}
