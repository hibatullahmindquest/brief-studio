"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LibraryItem } from "@/lib/artifact-store";

// Phase G — Recent / Library drawer. Reads GET /api/library (cursor-paged, owner-scoped, runs
// with ≥1 artifact). Closed by default (the shell owns the toggle); hidden < 1180px. Cards link
// to the deep-link /studio/[runId] result page.

export function RecentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  async function load(reset: boolean) {
    setLoading(true); setError(false);
    try {
      const qs = new URLSearchParams({ limit: "15" });
      if (!reset && cursor) qs.set("cursor", cursor);
      const res = await fetch(`/api/library?${qs.toString()}`);
      if (!res.ok) { setError(true); return; }
      const page = (await res.json()) as LibraryItem[];
      setItems((prev) => (reset ? page : [...prev, ...page]));
      setCursor(page.length ? page[page.length - 1].runId : null);
      if (page.length < 15) setCursor(null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  // load once when first opened
  useEffect(() => {
    if (open && !loaded) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--bg-2)] min-[1180px]:flex">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <p className="eyebrow">Recent</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => load(true)} title="Refresh" className="rounded p-1 text-[var(--muted)] hover:bg-[var(--card-2)] hover:text-[var(--foreground)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
          </button>
          <button type="button" onClick={onClose} title="Close" className="rounded p-1 text-[var(--muted)] hover:bg-[var(--card-2)] hover:text-[var(--foreground)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {!loaded && loading && <p className="px-1 text-sm editorial-muted">Loading…</p>}
        {loaded && error && (
          <div className="px-1 text-sm">
            <p className="text-[var(--stop)]">Couldn&apos;t load.</p>
            <button type="button" onClick={() => load(true)} className="mt-1 font-medium text-[var(--brand)] hover:underline">Retry</button>
          </div>
        )}
        {loaded && !error && items.length === 0 && (
          <p className="px-1 text-sm editorial-muted">No runs yet — describe something to start.</p>
        )}

        {items.map((it) => (
          <RecentCard key={it.runId} item={it} onNavigate={onClose} />
        ))}

        {cursor && !loading && (
          <button type="button" onClick={() => load(false)} className="w-full rounded-lg border border-[var(--line-2)] py-2 text-xs font-medium text-[var(--ink-soft)] hover:bg-[var(--card-2)]">Load more</button>
        )}
        {loaded && loading && items.length > 0 && <p className="px-1 text-xs editorial-muted">Loading…</p>}
      </div>
    </aside>
  );
}

function RecentCard({ item, onNavigate }: { item: LibraryItem; onNavigate: () => void }) {
  const isDraft = item.status === "draft";
  return (
    <Link href={`/studio/${item.runId}`} onClick={onNavigate} className="flex gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--card)] p-2.5 transition-colors hover:border-[var(--line-2)] hover:bg-[var(--card-2)]">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--card-2)]">
        {item.thumbnailPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnailPath} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-base">📄</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--foreground)]">{item.title || "Untitled run"}</p>
        <p className="mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">{absDate(item.createdAt)}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {isDraft && <Tag>Draft</Tag>}
          {item.kinds.includes("image") && <Tag>🖼</Tag>}
          {item.kinds.includes("pdf") && <Tag>📄 PDF</Tag>}
        </div>
      </div>
    </Link>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[var(--card-2)] px-1.5 py-0.5 mono text-[8px] uppercase tracking-[0.1em] text-[var(--ink-soft)]">{children}</span>;
}

// absolute date+time — a stable reference (e.g. "26 Jun, 4:30pm"), unlike a relative "2h ago".
function absDate(d: string | Date): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const mon = dt.toLocaleString("en-US", { month: "short" });
  let h = dt.getHours();
  const m = dt.getMinutes().toString().padStart(2, "0");
  const ap = h < 12 ? "am" : "pm";
  h = h % 12 || 12;
  return `${dt.getDate()} ${mon}, ${h}:${m}${ap}`;
}
