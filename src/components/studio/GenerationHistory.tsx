"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { HistoryRun } from "@/lib/feature-store";
import { HistoryModal } from "./HistoryModal";

const BRAND_NAMES: Record<string, string> = {
  sifututor: "SifuTutor",
  nakngaji: "NakNgaji",
};

const BRAND_COLORS: Record<string, string> = {
  sifututor: "#3b4ee2",
  nakngaji: "#15996b",
};

type BrandFilter = "all" | "sifututor" | "nakngaji";

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

function msToSec(ms?: number): string | null {
  if (typeof ms !== "number" || ms <= 0) return null;
  return `${Math.round(ms / 1000)}s`;
}

// Visual-status badge row for a history item. Renders nothing for text-only runs.
function VisualBadges({ run }: { run: HistoryRun }) {
  const time = msToSec(run.image?.generatedMs);
  switch (run.visualStatus) {
    case "ready":
      return (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--ok-soft)] px-1.5 py-0.5 mono text-[10px] font-bold text-[var(--ok)]">🖼 Ada visual</span>
          {time && <span className="rounded-md bg-[var(--card-2)] px-1.5 py-0.5 mono text-[10px] text-[#7b8698]">⏱ {time}</span>}
        </div>
      );
    case "generating":
      return (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#eef0ff] px-1.5 py-0.5 mono text-[10px] font-bold text-[var(--brand)]">
            <span className="inline-block h-2 w-2 animate-spin rounded-full border-[1.5px] border-[#c7ccf5] border-t-[var(--brand)]" />
            Tengah jana…
          </span>
        </div>
      );
    case "failed":
      return (
        <div className="mt-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 mono text-[10px] font-bold text-red-600">✗ Gagal</span>
        </div>
      );
    case "pending":
      return (
        <div className="mt-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--card-2)] px-1.5 py-0.5 mono text-[10px] font-semibold text-[#a6aebb]">○ Belum jana</span>
        </div>
      );
    default: // "text" — no visual badge
      return null;
  }
}

export function GenerationHistory() {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [selected, setSelected] = useState<HistoryRun | null>(null);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<BrandFilter>("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const LIMIT = 10;

  const fetchPage = useCallback(async (afterCursor?: string) => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (afterCursor) params.set("cursor", afterCursor);
      const res = await fetch(`/api/history?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as HistoryRun[];
      setRuns((prev) => (afterCursor ? [...prev, ...data] : data));
      setCursor(data.length > 0 ? data[data.length - 1].id : undefined);
      setHasMore(data.length === LIMIT);
    } finally {
      setLoadingMore(false);
      setInitialLoaded(true);
    }
  }, []);

  // Initial fetch + refresh when a new generation completes.
  useEffect(() => {
    void fetchPage();
    function onGenerated() {
      setRuns([]);
      setCursor(undefined);
      setHasMore(true);
      setInitialLoaded(false);
      void fetchPage();
    }
    window.addEventListener("generation:complete", onGenerated);
    return () => window.removeEventListener("generation:complete", onGenerated);
  }, [fetchPage]);

  // Infinite scroll.
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!sentinelRef.current || !hasMore || loadingMore) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) void fetchPage(cursor);
      },
      { threshold: 0.1 }
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [cursor, hasMore, loadingMore, fetchPage]);

  const filtered = runs.filter((run) => {
    const matchesBrand = brandFilter === "all" || run.brandSlug === brandFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      run.primaryPostExcerpt.toLowerCase().includes(q) ||
      (run.subtype ?? "").toLowerCase().includes(q) ||
      (run.brandSlug ? BRAND_NAMES[run.brandSlug] ?? "" : "").toLowerCase().includes(q);
    return matchesBrand && matchesSearch;
  });

  const TABS: { key: BrandFilter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "sifututor", label: "SifuTutor" },
    { key: "nakngaji", label: "NakNgaji" },
  ];

  return (
    <>
      <aside className="v6-card flex flex-col overflow-hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
          <span className="text-sm font-semibold text-[#00262a]">Semakan Lepas</span>
          <span className="rounded-full border border-[var(--line)] bg-[var(--card-2)] px-2 py-0.5 mono text-[10px] text-[#7b8698]">
            {runs.length}
          </span>
        </div>

        {/* Search */}
        <div className="border-b border-[var(--line)] px-3 py-2.5">
          <input
            type="text"
            placeholder="Cari output..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs text-[#00262a] placeholder-[#a6aebb] outline-none transition focus:border-[var(--brand)]"
          />
        </div>

        {/* Brand tabs */}
        <div className="flex gap-1 border-b border-[var(--line)] px-3 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setBrandFilter(tab.key)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                brandFilter === tab.key
                  ? "bg-[var(--brand)] text-white"
                  : "text-[#7b8698] hover:bg-[var(--card-2)] hover:text-[#33414f]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {!initialLoaded ? (
            <div className="flex items-center justify-center py-12">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--line-2)] border-t-[var(--brand)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs leading-6 text-[#a6aebb]">
              {search
                ? `Tiada hasil untuk "${search}"`
                : runs.length === 0
                  ? "Belum ada output. Jana yang pertama →"
                  : "Tiada history untuk brand ini."}
            </div>
          ) : (
            <>
              {filtered.map((run) => {
                const brandColor = run.brandSlug ? BRAND_COLORS[run.brandSlug] ?? "#888" : "#888";
                const brandName = run.brandSlug ? BRAND_NAMES[run.brandSlug] ?? run.brandSlug : "—";
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelected(run)}
                    className="w-full border-b border-[var(--line)] px-4 py-3.5 text-left transition hover:bg-[var(--card-2)]"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: brandColor }}
                      />
                      <span className="text-[11px] font-semibold text-[#00262a]">{brandName}</span>
                      <span className="text-[11px] text-[#a6aebb]">·</span>
                      <span className="text-[11px] text-[#7b8698]">{run.subtype ?? "Generation"}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-[#a6aebb]">
                        {formatRelative(run.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-5 text-[#7b8698]">
                      {run.primaryPostExcerpt}
                    </p>
                    <VisualBadges run={run} />
                  </button>
                );
              })}
              {hasMore && !search && brandFilter === "all" && (
                <div ref={sentinelRef} className="flex items-center justify-center gap-2 px-5 py-5">
                  {loadingMore && (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-[var(--line-2)] border-t-[var(--brand)]" />
                      <span className="text-[11px] text-[#a6aebb]">Memuatkan lagi...</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {selected && <HistoryModal run={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
