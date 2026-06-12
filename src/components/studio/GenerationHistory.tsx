"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { HistoryRun } from "@/lib/feature-store";
import { HistoryModal } from "./HistoryModal";

const BRAND_NAMES: Record<string, string> = {
  sifututor: "SifuTutor",
  nakngaji: "NakNgaji",
};

const BRAND_COLORS: Record<string, string> = {
  sifututor: "#3b5bdb",
  nakngaji: "#2f9e44",
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

export function GenerationHistory() {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [open, setOpen] = useState(false);
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
      const data = await res.json() as HistoryRun[];
      setRuns((prev) => afterCursor ? [...prev, ...data] : data);
      setCursor(data.length > 0 ? data[data.length - 1].id : undefined);
      setHasMore(data.length === LIMIT);
    } finally {
      setLoadingMore(false);
      setInitialLoaded(true);
    }
  }, []);

  // Initial fetch + generation:complete listener
  useEffect(() => {
    void fetchPage();

    function onGenerated() {
      setRuns([]);
      setCursor(undefined);
      setHasMore(true);
      setInitialLoaded(false);
      void fetchPage();
      setOpen(true);
    }
    window.addEventListener("generation:complete", onGenerated);
    return () => window.removeEventListener("generation:complete", onGenerated);
  }, [fetchPage]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!sentinelRef.current || !hasMore || loadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          void fetchPage(cursor);
        }
      },
      { threshold: 0.1 }
    );
    observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
  }, [cursor, hasMore, loadingMore, fetchPage]);

  // Escape key closes drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !selected) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected]);

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

  if (!initialLoaded) return null;
  if (runs.length === 0) return null;

  const TABS: { key: BrandFilter; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "sifututor", label: "SifuTutor" },
    { key: "nakngaji", label: "NakNgaji" },
  ];

  return (
    <>
      {/* Floating trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-medium shadow-lg transition-all duration-200 ${
          open
            ? "border-(--accent) bg-[rgba(212,183,143,0.1)] text-(--accent)"
            : "border-white/15 bg-[var(--color-panel)] text-white/70 hover:border-white/25 hover:text-white"
        }`}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: open ? "var(--accent)" : "rgba(255,255,255,0.4)" }}
        />
        Semakan Lepas
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]">
          {runs.length}
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-40 flex h-full w-full max-w-sm flex-col border-l border-white/8 bg-[var(--color-panel)] shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0,0.15,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <span className="text-sm font-semibold">Semakan Lepas</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-xs text-white/40 transition hover:border-white/20 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-white/8 px-4 py-3">
          <input
            type="text"
            placeholder="Cari output..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-white/25 outline-none transition focus:border-white/20"
          />
        </div>

        {/* Brand filter tabs */}
        <div className="flex gap-1 border-b border-white/8 px-4 py-2.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setBrandFilter(tab.key)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                brandFilter === tab.key
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-white/25 leading-6">
              {search ? `Tiada hasil untuk "${search}"` : "Tiada history untuk brand ini."}
            </div>
          ) : (
            <>
              {filtered.map((run) => {
                const brandColor = run.brandSlug ? (BRAND_COLORS[run.brandSlug] ?? "#888") : "#888";
                const brandName = run.brandSlug ? (BRAND_NAMES[run.brandSlug] ?? run.brandSlug) : "—";
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelected(run)}
                    className="w-full border-b border-white/[0.04] px-5 py-4 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: brandColor }}
                      />
                      <span className="text-[11px] font-semibold">{brandName}</span>
                      <span className="text-[11px] text-white/20">·</span>
                      <span className="text-[11px] text-white/40">{run.subtype ?? "Generation"}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-white/20">
                        {formatRelative(run.createdAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-5 text-white/45">
                      {run.primaryPostExcerpt}
                    </p>
                  </button>
                );
              })}

              {/* Infinite scroll sentinel */}
              {hasMore && !search && brandFilter === "all" && (
                <div ref={sentinelRef} className="flex items-center justify-center gap-2 px-5 py-5">
                  {loadingMore && (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-white/15 border-t-white/50" />
                      <span className="text-[11px] text-white/25">Memuatkan lagi...</span>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Detail modal */}
      {selected && (
        <HistoryModal run={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
