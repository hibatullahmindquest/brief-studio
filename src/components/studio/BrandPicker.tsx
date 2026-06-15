"use client";

import { useEffect, useState } from "react";
import type { BrandSummary } from "./StudioWizard";

export function BrandPicker({ onSelect }: { onSelect: (brand: BrandSummary) => void }) {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data) => { setBrands(data as BrandSummary[]); setLoading(false); })
      .catch(() => { setError("Gagal load brands. Reload page."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="editorial-panel rounded-4xl p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-white/80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="editorial-panel rounded-4xl p-8 text-center text-sm text-red-400">{error}</div>
    );
  }

  return (
    <div className="editorial-panel rounded-3xl p-5 sm:p-6 space-y-6">
      <div>
        <p className="editorial-kicker">Langkah 1</p>
        <h2 className="editorial-title mt-2 text-2xl sm:text-3xl">Pilih brand</h2>
        <p className="mt-2 text-sm editorial-muted">
          Output AI akan disesuaikan dengan guidelines brand yang dipilih.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() => onSelect(brand)}
            className="rounded-3xl border border-[var(--line)] bg-white p-6 text-left transition hover:border-[rgba(212,183,143,0.4)] hover:bg-[var(--card-2)]"
          >
            <div
              className="mb-4 h-2 w-12 rounded-full"
              style={{ backgroundColor: brand.primaryColor }}
            />
            <p className="text-lg font-semibold">{brand.name}</p>
            <p className="mt-1 text-sm editorial-muted">{brand.tagline}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
