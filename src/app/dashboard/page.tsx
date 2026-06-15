import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPaidAnalytics } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Today",
  description: "Daily overview across organic, paid, and creative.",
};

const rm = (n: number) => `RM${n.toLocaleString("en-MY", { maximumFractionDigits: n >= 100 ? 0 : 2 })}`;
const num = (n: number) => n.toLocaleString("en-MY");

export default async function TodayPage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0];

  // Brand with paid data (NakNgaji from the import).
  const withData = await prisma.adDailyMetric.findFirst({ select: { brandId: true } });
  const brand = withData
    ? await prisma.brand.findUnique({ where: { id: withData.brandId }, select: { id: true, name: true } })
    : null;
  const paid = brand ? await getPaidAnalytics(brand.id, "t7") : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="eyebrow">Today</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 editorial-muted">
          Your daily pulse across organic and paid — and what to make next.
          {paid?.asOf ? ` Paid data as of ${paid.asOf}.` : ""}
        </p>
      </section>

      {/* Split pulse: Organic | Paid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Organic — not yet wired */}
        <div className="v6-card p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Organic pulse</p>
            <span className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 mono text-[10px] font-bold uppercase text-[var(--brand)]">
              soon
            </span>
          </div>
          <p className="mt-4 text-sm text-[#7b8698]">
            Connect a Facebook Page + Instagram to see reach, saves, shares, and engagement.
          </p>
          <Link
            href="/dashboard/settings/meta"
            className="mt-4 inline-block rounded-xl border border-[var(--line-2)] px-4 py-2 text-sm font-semibold text-[#33414f] hover:bg-[var(--card-2)]"
          >
            Connect organic
          </Link>
        </div>

        {/* Paid — real data */}
        <div className="v6-card p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Paid pulse</p>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--orange)]" />
          </div>
          {paid && brand ? (
            <>
              <p className="mt-1 text-xs text-[#7b8698]">{brand.name} · last 7 days</p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <p className="mono text-2xl font-bold text-[#00262a]">{rm(paid.current.spend)}</p>
                  <p className="eyebrow mt-1">Spend</p>
                </div>
                <div>
                  <p className="mono text-2xl font-bold text-[#00262a]">{rm(paid.current.cpl)}</p>
                  <p className="eyebrow mt-1">Cost / lead</p>
                </div>
                <div>
                  <p className="mono text-2xl font-bold text-[#00262a]">{num(paid.current.leads)}</p>
                  <p className="eyebrow mt-1">Leads</p>
                </div>
              </div>
              <Link
                href="/dashboard/analytics/paid"
                className="mt-5 inline-block rounded-xl bg-[var(--orange)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--orange-2)]"
              >
                Open paid analytics →
              </Link>
            </>
          ) : (
            <p className="mt-4 text-sm text-[#7b8698]">No paid data yet. Connect a Meta ad account.</p>
          )}
        </div>
      </div>

      {/* Daily Signals strip — placeholder */}
      <section className="v6-card p-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Daily signals</p>
          <span className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 mono text-[10px] font-bold uppercase text-[var(--brand)]">
            soon
          </span>
        </div>
        <p className="mt-4 text-sm text-[#7b8698]">
          Evidence-based recommendations — Scale Similar, Create Variation, Watch, or Hold/Stop —
          will appear here once the signal engine is built on top of your synced metrics.
        </p>
      </section>

      {/* Quick create */}
      <section className="v6-card p-6">
        <p className="eyebrow">Create</p>
        <p className="mt-2 text-lg font-semibold text-[#00262a]">Start a creative brief</p>
        <p className="mt-1 text-sm text-[#7b8698]">
          Generate posters, hooks, storyboards, and scripts with brand context baked in.
        </p>
        <Link
          href="/studio"
          className="mt-4 inline-block rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-2)]"
        >
          Open Studio →
        </Link>
      </section>
    </div>
  );
}
