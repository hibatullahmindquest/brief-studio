"use client";

import { useRouter, useSearchParams } from "next/navigation";

type BrandOpt = { id: string; name: string };

export function PaidControls({ brands, brandId, period }: { brands: BrandOpt[]; brandId: string; period: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.push(`/dashboard/analytics/paid?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {brands.length > 1 && (
        <select
          value={brandId}
          onChange={(e) => setParam("brandId", e.target.value)}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
        {[
          { key: "t1", label: "T-1 · latest day" },
          { key: "t7", label: "T-7 · last 7 days" },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setParam("period", p.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              period === p.key ? "bg-[#fd8549] text-white" : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
