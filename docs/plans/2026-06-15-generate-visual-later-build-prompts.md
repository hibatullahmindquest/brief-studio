# Build Prompts — Generate Visual Later

> Source: docs/PRD-generate-visual-later.md · Per-prompt loop: implement → /bs-review → "next".

## BP1 — `outputTypeId` on HistoryRun
**Files:** `src/lib/feature-store.ts`
- Add `outputTypeId: string` to `HistoryRun`.
- In `getRecentFeatureRuns`, parse `input.contentType` (the stored label) and map to the id via `OUTPUT_TYPES` (label → id); default "".
**Acceptance:** tsc clean; existing history still loads.

## BP2 — VisualPanel inside HistoryModal
**Files:** `src/components/studio/HistoryModal.tsx`
- Import `VisualPanel`. Compute visual kind from `run.outputTypeId`.
- If `run.image` exists → show it (current block).
- Else if kind is visual (poster/storyboard/video) → render `<VisualPanel featureRunId={run.id} outputTypeId={run.outputTypeId} />`.
- Hook & Copy → neither.
**Acceptance:** saved run w/o image shows Jana Visual + can generate; existing-image run shows image; verify gate green.

## After BP2 — gates
verify → review → release-notes → commit.
