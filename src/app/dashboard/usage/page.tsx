import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getUsageSummary } from "@/lib/usage";

export const metadata: Metadata = {
  title: "Usage",
  description: "AI usage and cost tracking.",
};

const rm = (n: number) => `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MODULE_LABEL: Record<string, string> = { visual: "Visual (images)", copy: "Copy (text)" };

function BrandDot({ slug }: { slug: string | null }) {
  const color = slug === "sifututor" ? "#3b4ee2" : slug === "nakngaji" ? "#15996b" : "#a6aebb";
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />;
}

export default async function UsagePage() {
  await requireAdmin();
  const u = await getUsageSummary();

  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-3xl p-5 sm:p-6">
        <p className="eyebrow">Admin · Usage</p>
        <h1 className="editorial-title mt-3 text-2xl sm:text-3xl">AI usage &amp; cost</h1>
        <p className="mt-3 text-sm editorial-muted">
          Setiap panggilan gpt-4o &amp; gpt-image-2 direkod. Rate: USD→MYR {u.rate.toFixed(2)}.
        </p>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="v6-card p-5">
          <p className="eyebrow">Hari ini</p>
          <p className="mono mt-2 text-2xl font-bold text-[#00262a]">{rm(u.todayMyr)}</p>
          <p className="mt-1 text-xs text-[#7b8698]">{u.todayCount} generations</p>
        </div>
        <div className="v6-card p-5">
          <p className="eyebrow">Bulan ini</p>
          <p className="mono mt-2 text-2xl font-bold text-[#00262a]">{rm(u.monthMyr)}</p>
          <p className="mt-1 text-xs text-[#7b8698]">
            {u.monthByModule.map((m) => `${MODULE_LABEL[m.module] ?? m.module}: ${rm(m.myr)}`).join(" · ") || "—"}
          </p>
        </div>
        <div className="v6-card p-5">
          <p className="eyebrow">Imej dijana</p>
          <p className="mono mt-2 text-2xl font-bold text-[#00262a]">{u.imageCount.toLocaleString("en-MY")}</p>
          <p className="mt-1 text-xs text-[#7b8698]">avg {rm(u.avgPerImageMyr)} / imej</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent */}
        <div className="v6-card p-5">
          <h2 className="text-base font-semibold text-[#00262a]">Recent generations</h2>
          <div className="mt-3">
            {u.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#a6aebb]">Belum ada generation.</p>
            ) : (
              u.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 text-[13px] last:border-0">
                  <span className="flex items-center gap-2 truncate">
                    <BrandDot slug={r.brandSlug} />
                    <span className="truncate">
                      {(r.brand ?? "—") + " · " + (MODULE_LABEL[r.module] ?? r.module)}
                      <span className="text-[#a6aebb]"> · {r.model}</span>
                    </span>
                  </span>
                  <span className="mono shrink-0 text-[#33414f]">{rm(r.costMyr)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* By module */}
        <div className="v6-card p-5">
          <h2 className="text-base font-semibold text-[#00262a]">By module (this month)</h2>
          <div className="mt-3">
            {u.monthByModule.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#a6aebb]">Belum ada data.</p>
            ) : (
              u.monthByModule.map((m) => (
                <div key={m.module} className="flex items-center justify-between border-b border-[var(--line)] py-2.5 text-[13px] last:border-0">
                  <span>{MODULE_LABEL[m.module] ?? m.module}</span>
                  <span className="mono text-[#33414f]">{rm(m.myr)}</span>
                </div>
              ))
            )}
            <p className="mt-3 text-[11px] text-[#a6aebb]">Tiada API key didedahkan — kos sahaja.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
