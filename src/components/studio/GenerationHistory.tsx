"use client";

import { useEffect, useState, useCallback } from "react";
import type { HistoryRun } from "@/lib/feature-store";
import { HistoryModal } from "./HistoryModal";

const BRAND_NAMES: Record<string, string> = {
  sifututor: "SifuTutor",
  nakngaji: "NakNgaji",
};

const BRAND_COLORS: Record<string, string> = {
  sifututor: "#0b1c73",
  nakngaji: "#1a7a4a",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "baru sahaja";
  if (mins < 60) return `${mins} minit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  return `${days} hari lalu`;
}

export function GenerationHistory() {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<HistoryRun | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      if (!res.ok) return;
      const data = await res.json() as HistoryRun[];
      setRuns(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();

    function onGenerated() {
      void fetchHistory();
      setOpen(true);
    }
    window.addEventListener("generation:complete", onGenerated);
    return () => window.removeEventListener("generation:complete", onGenerated);
  }, [fetchHistory]);

  if (loading) return null;
  if (runs.length === 0) return null;

  return (
    <>
      <div className="editorial-panel rounded-4xl overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm hover:bg-white/[0.02] transition"
        >
          <span className="font-medium">Semakan Lepas ({runs.length})</span>
          <span className="editorial-muted text-xs">{open ? "▲ Tutup" : "▼ Buka"}</span>
        </button>

        {open && (
          <div className="border-t border-white/10 divide-y divide-white/5">
            {runs.map((run) => {
              const brandName = run.brandSlug
                ? (BRAND_NAMES[run.brandSlug] ?? run.brandSlug)
                : "—";
              const brandColor = run.brandSlug
                ? (BRAND_COLORS[run.brandSlug] ?? "#888")
                : "#888";
              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelected(run)}
                  className="w-full text-left px-6 py-4 hover:bg-white/[0.03] transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: brandColor }}
                    />
                    <span className="text-xs font-medium">{brandName}</span>
                    <span className="text-xs editorial-muted">·</span>
                    <span className="text-xs editorial-muted">{run.subtype ?? "Generation"}</span>
                    <span className="ml-auto text-xs editorial-muted shrink-0">
                      {formatRelative(run.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs editorial-muted line-clamp-2 leading-5">
                    {run.primaryPostExcerpt}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <HistoryModal run={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
