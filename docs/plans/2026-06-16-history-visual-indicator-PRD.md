# PRD — Semakan Lepas Visual Indicator + Generation Time

> Date: 2026-06-16 · Route: feature · Branch: `feat/history-visual-indicator`
> Mockup: `temp/semakan-lepas-indicator-mockup.html` · Depends on: `feat/async-generation-jobs` (GenerationJob)

## 1. Problem
Semakan Lepas (history) gives no at-a-glance signal of a run's visual state — you can't tell
which runs have an image, which are still generating, or which failed — and the time a generation
took is not recorded anywhere user-visible.

## 2. Goal
Show a per-run visual-status badge + the recorded generation time in the history list and the
detail modal.

## 3. Scope
**In:** status badge in history list rows + HistoryModal; record render duration; derive status by
joining the latest GenerationJob per run. **No migration.**
**Out:** changing the live VisualPanel (already has its own timer); backfilling old runs' durations;
per-run job history (only the latest job matters).

## 4. Status states (badge)
Computed per run as `visualStatus`:
| Value | Condition | Badge |
|---|---|---|
| `text` | output type is text-only (hook_copy → `visualKind==="none"`) | (no badge) |
| `ready` | `outputJson.image` exists | 🖼 Ada visual + ⏱ `generatedMs` |
| `generating` | no image AND latest job `queued`/`processing` | ⏳ Tengah jana… (spinner) |
| `failed` | no image AND latest job `failed` | ✗ Gagal |
| `pending` | visual-capable, no image, no active/failed job | ○ Belum jana |

> `ready` wins over job state (an image present = done, regardless of any later job).
> The "pending" state directly answers "belum ada image" for visual-capable runs.

## 5. Generation time
- The worker measures wall-clock duration of `runVisualJob` (claim → image persisted) and writes
  `generatedMs` into the stored `image` object (`outputJson.image.generatedMs`).
- History list shows `⏱ Ns` (rounded) next to the "Ada visual" badge; HistoryModal shows it as a chip.
- Old runs (no `generatedMs`) simply omit the time badge — graceful.

## 6. Data changes (no schema migration)
- `src/lib/visual.ts` `renderImage` already returns timing? No — add timing in `visual-job.ts`:
  measure `Date.now()` around plan+render, put `generatedMs` into the `visual` object persisted to
  `FeatureRun.outputJson.image`.
- `src/lib/feature-store.ts`:
  - `HistoryImage` gains `generatedMs?: number`.
  - `HistoryRun` gains `visualStatus: "text" | "ready" | "generating" | "failed" | "pending"`.
  - `getRecentFeatureRuns` after fetching the page of runs, does ONE extra query:
    `generationJob.findMany({ where: { featureRunId: { in: ids } }, orderBy: createdAt desc })`,
    reduce to latest-per-run, then derive `visualStatus` for each run.

## 7. UI changes
- `GenerationHistory.tsx`: render a `.badges` row under the excerpt per the mockup; map `visualStatus`
  to badge; show `⏱ Ns` when `image.generatedMs` present. No badge when `visualStatus==="text"`.
  Live refresh already happens on `generation:complete` (existing listener) so `generating → ready`
  updates when a generation finishes.
- `HistoryModal.tsx`: add a `⏱ Ns` chip near the existing cost/kind info when `generatedMs` present.

## 8. Edge cases
- Run with image but a later failed regenerate job → `ready` (image still valid) — correct.
- Text-only run that somehow has a job → still `text` (no badge); shouldn't happen.
- generatedMs missing (old run / pre-fix) → omit time badge, keep status badge.
- Empty history / search no-result → unchanged.

## 9. Acceptance criteria
1. A run with a generated image shows 🖼 Ada visual + ⏱ Ns in the list and a ⏱ chip in the modal.
2. A run mid-generation shows ⏳ Tengah jana…; it flips to 🖼 Ada visual on completion (list refresh).
3. A run whose last visual job failed (no image) shows ✗ Gagal.
4. A visual-capable run never generated shows ○ Belum jana.
5. A Hook & Copy run shows no visual badge.
6. New generations record `generatedMs`; old runs omit the time badge without breaking.
7. No DB migration added. Lint + tsc + build green; review gates pass.
