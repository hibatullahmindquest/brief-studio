# History Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible history panel below the Studio wizard that lists the user's last 20 AI generations — click a card to open a modal with the full output.

**Architecture:** Extend `feature-store.ts` with a `getRecentFeatureRuns` query, expose it via `GET /api/history`, then build a client-side `GenerationHistory` component that fetches on mount and listens for a `generation:complete` custom event dispatched by `StudioWizard` after each successful generation.

**Tech Stack:** Next.js App Router, React 19, Tailwind v4, Prisma 4 (FeatureRun table), TypeScript 5

---

## Task 1: Extend feature-store with getRecentFeatureRuns

**Files:**
- Modify: `src/lib/feature-store.ts`

No tests — data layer function, covered by integration.

**Step 1: Add HistoryRun type and getRecentFeatureRuns to feature-store.ts**

Add after the existing `getLatestFeatureRun` export:

```ts
export type HistoryRun = {
  id: string;
  subtype: string | null;
  brandSlug: string | null;
  primaryPostExcerpt: string;
  fullOutput: {
    primaryPost: string;
    caption: string;
    callToAction: string;
    hashtags: string[];
    strategyNote: string;
    generatedAt: string;
  };
  createdAt: string;
};

export async function getRecentFeatureRuns(
  userId: string,
  limit = 20
): Promise<HistoryRun[]> {
  const rows = await prisma.featureRun.findMany({
    where: { userId, feature: "generate" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.flatMap((row) => {
    const output = safeParse<HistoryRun["fullOutput"]>(row.outputJson);
    if (!output) return [];
    const input = safeParse<{ brandSlug?: string }>(row.inputJson);
    return [
      {
        id: row.id,
        subtype: row.subtype,
        brandSlug: input?.brandSlug ?? null,
        primaryPostExcerpt: (output.primaryPost ?? "").slice(0, 120),
        fullOutput: output,
        createdAt: row.createdAt.toISOString(),
      },
    ];
  });
}
```

**Step 2: Verify tsc clean**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/lib/feature-store.ts
git commit -m "feat(history): add getRecentFeatureRuns to feature-store"
```

---

## Task 2: GET /api/history endpoint

**Files:**
- Create: `src/app/api/history/route.ts`

**Step 1: Create route**

```ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { getRecentFeatureRuns } from "@/lib/feature-store";

export async function GET() {
  const user = await requireUser();
  const runs = await getRecentFeatureRuns(user.id);
  return NextResponse.json(runs);
}
```

**Step 2: Verify tsc clean**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/app/api/history/route.ts
git commit -m "feat(history): add GET /api/history endpoint"
```

---

## Task 3: HistoryModal component

**Files:**
- Create: `src/components/studio/HistoryModal.tsx`

Shows the full output of a past run in a centered modal overlay. Closes on backdrop click or X button.

**Step 1: Create HistoryModal.tsx**

```tsx
"use client";

import { useEffect } from "react";
import type { HistoryRun } from "@/lib/feature-store";

const BRAND_NAMES: Record<string, string> = {
  sifututor: "SifuTutor",
  nakngaji: "NakNgaji",
};

const BRAND_COLORS: Record<string, string> = {
  sifututor: "#0b1c73",
  nakngaji: "#1a7a4a",
};

export function HistoryModal({
  run,
  onClose,
}: {
  run: HistoryRun;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const brandName = run.brandSlug ? (BRAND_NAMES[run.brandSlug] ?? run.brandSlug) : "—";
  const brandColor = run.brandSlug ? (BRAND_COLORS[run.brandSlug] ?? "#888") : "#888";
  const { fullOutput } = run;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto editorial-panel rounded-4xl p-6 sm:p-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs editorial-muted">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: brandColor }}
              />
              <span>{brandName}</span>
              <span>·</span>
              <span>{run.subtype ?? "Generation"}</span>
            </div>
            <p className="mt-1 text-xs editorial-muted">
              {new Date(run.createdAt).toLocaleString("ms-MY")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs editorial-muted hover:border-white/20 transition"
          >
            Tutup ✕
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Primary Post</p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7">
            {fullOutput.primaryPost}
          </pre>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Caption</p>
            <p className="mt-3 text-sm leading-7 editorial-muted">{fullOutput.caption}</p>
          </div>
          <div className="rounded-3xl border border-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">CTA</p>
            <p className="mt-3 text-sm leading-7 editorial-muted">{fullOutput.callToAction}</p>
          </div>
        </div>

        {fullOutput.hashtags?.length > 0 && (
          <div className="rounded-3xl border border-white/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Hashtags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {fullOutput.hashtags.map((tag, i) => (
                <span
                  key={`${tag}-${i}`}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs editorial-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-white/10 p-5">
          <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Strategy Note</p>
          <p className="mt-3 text-sm leading-7 editorial-muted">{fullOutput.strategyNote}</p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify tsc clean**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/components/studio/HistoryModal.tsx
git commit -m "feat(history): add HistoryModal component"
```

---

## Task 4: GenerationHistory component

**Files:**
- Create: `src/components/studio/GenerationHistory.tsx`

Collapsible panel. Fetches `/api/history` on mount. Listens for `generation:complete` custom event (dispatched by StudioWizard) to auto-refetch. Each card opens HistoryModal.

**Step 1: Create GenerationHistory.tsx**

```tsx
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
```

**Step 2: Verify tsc clean**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/components/studio/GenerationHistory.tsx
git commit -m "feat(history): add GenerationHistory collapsible panel"
```

---

## Task 5: StudioWizard — dispatch generation:complete event

**Files:**
- Modify: `src/components/studio/StudioWizard.tsx`

After `setStage("RESULT")` in `handleGenerate`, dispatch a custom event so GenerationHistory knows to refetch.

**Step 1: Add event dispatch in handleGenerate**

Find this block in `handleGenerate()`:

```ts
      setResult(data as GeneratedOutput);
      setStage("RESULT");
```

Replace with:

```ts
      setResult(data as GeneratedOutput);
      setStage("RESULT");
      window.dispatchEvent(new CustomEvent("generation:complete"));
```

**Step 2: Verify tsc clean**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 3: Commit**

```bash
git add src/components/studio/StudioWizard.tsx
git commit -m "feat(history): dispatch generation:complete event after successful generation"
```

---

## Task 6: Integrate GenerationHistory into Studio page

**Files:**
- Modify: `src/app/studio/page.tsx`

**Step 1: Import and add GenerationHistory below StudioWizard**

```tsx
import { requireUser } from "@/lib/session";
import { StudioWizard } from "@/components/studio/StudioWizard";
import { GenerationHistory } from "@/components/studio/GenerationHistory";

export default async function StudioPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <section className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Studio</p>
        <h1 className="editorial-title mt-3 text-4xl sm:text-5xl">
          Apa yang nak dibuat hari ni?
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 editorial-muted">
          Pilih brand dan output — AI akan tanya soalan yang betul untuk hasilkan brief yang tepat.
        </p>
      </section>
      <StudioWizard />
      <GenerationHistory />
    </div>
  );
}
```

**Step 2: Verify tsc clean**

```bash
npx tsc --noEmit
```
Expected: zero errors.

**Step 3: Run build**

```bash
npm run build
```
Expected: build succeeds, `/studio` route listed.

**Step 4: Commit**

```bash
git add src/app/studio/page.tsx
git commit -m "feat(history): add GenerationHistory to Studio page"
```

---

## After all tasks: run bs-verify gate

```bash
npm run lint
npx tsc --noEmit
npm run build
```

All three must pass before proceeding to review.
