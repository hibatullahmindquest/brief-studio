"use client";

import { OUTPUT_TYPES } from "@/lib/conversation-engine";
import type { BrandSummary } from "./StudioWizard";

const TEAM_LABELS: Record<string, string> = {
  marketing: "Team Marketing",
  creative: "Team Creative",
  video: "Team Video",
};

export function OutputTypePicker({
  brand,
  onSelect,
  onBack,
}: {
  brand: BrandSummary;
  onSelect: (id: string) => void;
  onBack: () => void;
}) {
  const grouped = OUTPUT_TYPES.reduce<Record<string, typeof OUTPUT_TYPES>>((acc, ot) => {
    if (!acc[ot.team]) acc[ot.team] = [];
    acc[ot.team].push(ot);
    return acc;
  }, {});

  return (
    <div className="editorial-panel rounded-3xl p-5 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="editorial-kicker">Langkah 2 — {brand.name}</p>
          <h2 className="editorial-title mt-2 text-2xl sm:text-3xl">Apa yang nak dibuat?</h2>
          <p className="mt-2 text-sm editorial-muted">
            Pilih jenis output — AI akan tanya soalan yang berkaitan.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-full border border-[var(--line)] px-4 py-2 text-sm editorial-muted hover:border-[var(--line-2)] transition"
        >
          ← Tukar brand
        </button>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([team, types]) => (
          <div key={team}>
            <p className="mb-3 text-xs uppercase tracking-[0.2em] editorial-muted">
              {TEAM_LABELS[team]}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {types.map((ot) => (
                <button
                  key={ot.id}
                  type="button"
                  onClick={() => onSelect(ot.id)}
                  className="rounded-3xl border border-[var(--line)] bg-white p-5 text-left transition hover:border-[rgba(212,183,143,0.4)] hover:bg-[var(--card-2)]"
                >
                  <p className="font-semibold">{ot.label}</p>
                  <p className="mt-1 text-sm editorial-muted">{ot.description}</p>
                  <p className="mt-3 text-xs editorial-muted opacity-60">
                    {ot.questions.length} soalan
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
