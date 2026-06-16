# Build Prompts — Semakan Lepas Visual Indicator + Generation Time

> 2026-06-16 · `feat/history-visual-indicator` · PRD: `docs/plans/2026-06-16-history-visual-indicator-PRD.md`

## P1 — Record duration in the worker path
- In `src/lib/visual-job.ts`: capture `t0 = Date.now()` at the start of `runVisualJob`; compute
  `generatedMs = Date.now() - t0` right before persisting; add `generatedMs` to the `visual` object
  written into `FeatureRun.outputJson.image`. (Also fine to include in the success return.)
- Verify: tsc clean; a fresh generation stores `image.generatedMs`.

## P2 — Derive visualStatus + expose generatedMs in history data
- In `src/lib/feature-store.ts`:
  - `HistoryImage` += `generatedMs?: number`.
  - `HistoryRun` += `visualStatus: "text" | "ready" | "generating" | "failed" | "pending"`.
  - `getRecentFeatureRuns`: after building the page rows, collect run ids, run ONE
    `prisma.generationJob.findMany({ where: { featureRunId: { in: ids } }, orderBy: { createdAt: "desc" } })`,
    reduce to latest job per run, then derive `visualStatus` per row using: image present → ready;
    else text-only type → text; else latest job queued/processing → generating; failed → failed;
    else → pending.
  - Map `image.generatedMs` through into the returned `image`.
- Verify: tsc clean; status values correct for image/active/failed/none/text cases.

## P3 — List badges (GenerationHistory.tsx)
- Render a `.badges` row under the excerpt per the mockup. Map `visualStatus`:
  ready → 🖼 Ada visual (+ ⏱ Ns if `image.generatedMs`); generating → ⏳ spinner "Tengah jana…";
  failed → ✗ Gagal; pending → ○ Belum jana; text → render nothing.
- Reuse v6 tokens (ok-soft/brand/bad-soft/card-2). Existing `generation:complete` refresh already
  flips generating→ready.
- Verify: lint clean; badges match mockup.

## P4 — Modal time chip (HistoryModal.tsx)
- Add a `⏱ Ns` chip near the existing kind/cost info when `run.image?.generatedMs` present.
- Verify: lint clean.

## P5 — Verify gate
- `npm run lint` + `tsc --noEmit` + `npm run build` green. Manual run-through of acceptance criteria.

## Notes
- No schema migration. `generatedMs` lives in JSON; `visualStatus` is derived at query time.
- Helper `msToSec(ms)` → rounded seconds for display.
