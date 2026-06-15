import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPaidAnalytics, type PaidMetrics } from "@/lib/analytics";
import { PaidControls } from "./paid-controls";

export const metadata: Metadata = {
  title: "Paid Analytics",
  description: "Meta ad performance — spend, CPL, CTR, and fatigue.",
};

const rm = (n: number) => `RM${n.toLocaleString("en-MY", { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;
const pct = (n: number) => `${n.toFixed(2)}%`;
const num = (n: number) => n.toLocaleString("en-MY");

// metric key -> { label, explainer, format, lowerIsBetter }
const CARDS: {
  key: keyof PaidMetrics;
  label: string;
  explainer: string;
  fmt: (n: number) => string;
  lowerBetter?: boolean;
}[] = [
  { key: "spend", label: "Spend", explainer: "Total ad spend this window — bigger sample = more reliable decisions.", fmt: rm },
  { key: "cpl", label: "Cost per lead", explainer: "What each lead costs. Lower is better — the core efficiency signal.", fmt: rm, lowerBetter: true },
  { key: "ctr", label: "CTR", explainer: "Click-through rate — how well the hook + creative pull clicks.", fmt: pct },
  { key: "leads", label: "Leads", explainer: "Result volume. Don't scale decisions from tiny lead counts.", fmt: num },
  { key: "frequency", label: "Frequency", explainer: "Avg times each person saw the ad. Rising = fatigue risk.", fmt: (n) => n.toFixed(2), lowerBetter: true },
  { key: "impressions", label: "Impressions", explainer: "Total times the ads were shown across this window.", fmt: num },
];

function Delta({ value, lowerBetter }: { value: number | undefined; lowerBetter?: boolean }) {
  if (value === undefined || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const good = lowerBetter ? rounded < 0 : rounded > 0;
  const neutral = rounded === 0;
  const cls = neutral ? "text-zinc-400" : good ? "text-emerald-600" : "text-red-600";
  const sign = rounded > 0 ? "+" : "";
  return <span className={`text-xs font-semibold ${cls}`}>{sign}{rounded}% vs prev</span>;
}

export default async function PaidAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ brandId?: string; period?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  // Only brands that actually have paid data.
  const withData = await prisma.adDailyMetric.findMany({
    distinct: ["brandId"],
    select: { brandId: true },
  });
  const brandIds = withData.map((b) => b.brandId);
  const brands = await prisma.brand.findMany({
    where: { id: { in: brandIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (brands.length === 0) {
    return (
      <div className="space-y-6">
        <section className="editorial-panel rounded-4xl p-6 sm:p-8">
          <p className="editorial-kicker">Analytics · Paid</p>
          <h1 className="editorial-title mt-3 text-4xl">Paid analytics</h1>
          <p className="mt-4 text-sm editorial-muted">No paid data yet. Connect a Meta ad account or import history.</p>
        </section>
      </div>
    );
  }

  const period = sp.period === "t1" ? "t1" : "t7";
  const brandId = brands.find((b) => b.id === sp.brandId)?.id ?? brands[0].id;
  const brandName = brands.find((b) => b.id === brandId)?.name ?? "";
  const data = await getPaidAnalytics(brandId, period);

  const fatigued = data.topCreatives.filter((c) => c.fatigue);

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Analytics · Paid</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">Paid analytics</h1>
        <p className="mt-3 text-sm editorial-muted">
          {brandName} · {period === "t1" ? "latest day" : "last 7 days"}
          {data.asOf ? ` · as of ${data.asOf}` : ""}
        </p>
        <div className="mt-5">
          <PaidControls brands={brands} brandId={brandId} period={period} />
        </div>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {CARDS.map((c) => (
          <div key={c.key} className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{c.label}</span>
              <span className="h-2 w-2 rounded-full bg-[#fd8549]" />
            </div>
            <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{c.fmt(data.current[c.key])}</p>
            <div className="mt-1">
              <Delta value={data.deltas[c.key]} lowerBetter={c.lowerBetter} />
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">{c.explainer}</p>
          </div>
        ))}
      </div>

      {/* Fatigue warnings */}
      {fatigued.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold text-amber-800">⚠ Fatigue warning — {fatigued.length} creative(s)</h2>
          <p className="mt-1 text-xs text-amber-700">
            Frequency is high while CTR dropped vs the previous window — refresh or create a variation instead of scaling.
          </p>
          <div className="mt-3 space-y-1">
            {fatigued.map((c) => (
              <p key={c.adId} className="text-sm text-amber-900">
                {c.name} — freq {c.frequency.toFixed(2)}, CTR {pct(c.ctr)}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Top creatives */}
      <section className="rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Top creatives by spend</h2>
        <p className="mt-1 text-xs text-zinc-500">Where the budget went this window, and how efficiently it converted.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-2 pr-3 font-medium">Creative</th>
                <th className="py-2 px-3 text-right font-medium">Spend</th>
                <th className="py-2 px-3 text-right font-medium">Leads</th>
                <th className="py-2 px-3 text-right font-medium">CPL</th>
                <th className="py-2 px-3 text-right font-medium">CTR</th>
                <th className="py-2 px-3 text-right font-medium">Freq</th>
              </tr>
            </thead>
            <tbody>
              {data.topCreatives.map((c) => (
                <tr key={c.adId} className="border-b border-zinc-50">
                  <td className="py-2 pr-3">
                    <span className="line-clamp-1 max-w-xs">{c.name}</span>
                    {c.fatigue && <span className="ml-1 text-xs text-amber-600">⚠ fatigue</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{rm(c.spend)}</td>
                  <td className="py-2 px-3 text-right font-mono">{num(c.leads)}</td>
                  <td className="py-2 px-3 text-right font-mono">{c.leads ? rm(c.cpl) : "—"}</td>
                  <td className="py-2 px-3 text-right font-mono">{pct(c.ctr)}</td>
                  <td className="py-2 px-3 text-right font-mono">{c.frequency.toFixed(2)}</td>
                </tr>
              ))}
              {data.topCreatives.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-sm text-zinc-400">
                    No creatives in this window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
