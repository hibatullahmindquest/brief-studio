# PRD — Generate Visual Later (from a saved run)

> Feature · 2026-06-15 · Branch `feat/visual-generation` · Source: `.claude/plans/2026-06-15-generate-visual-later-brainstorm.md`
> Small — reuses `VisualPanel` + the existing `/api/generate/visual` (already `featureRunId`-based). UX folded into §4.

## 1. Overview
Let a user generate the image for a **saved run** whose visual wasn't made yet, from the **Semakan Lepas** history (HistoryModal) — not only in the live result flow. Solves: close tab before pressing "Jana Visual" → can still do it later.

## 2. Scope
**In:** show "Jana Visual" inside HistoryModal for visual-type runs without an image yet (reuse `VisualPanel`); add `outputTypeId` to `HistoryRun`.
**Out:** standalone Library page (later), regenerate an existing image from history, batch.

## 3. Functional requirements
- **FR1** `HistoryRun` carries `outputTypeId` (derived from stored `input.contentType` label via `OUTPUT_TYPES`).
- **FR2** HistoryModal: if the run has **no image** AND its output type is visual (poster/storyboard/video_script) → render `VisualPanel` (the existing Jana Visual flow, keyed by `featureRunId`). If it **has an image** → show it (current behaviour). Hook & Copy → neither.
- **FR3** Generating from the modal reuses `POST /api/generate/visual { featureRunId }` (no new endpoint), persists into the run, and dispatches `generation:complete` so the history list refreshes.
- **FR4** Ownership unchanged — the route already scopes to the requesting user.

## 4. UX
- Open a past run in Semakan Lepas:
  - Has image → image + captions (as today).
  - No image + visual type → the `VisualPanel` (idle → estimate + "Jana Visual" → timer → done image + cost), inline in the modal.
  - Hook & Copy → text only.
- After generate: image shows inline; the list row updates (now has a visual).

## 5. Data model
No schema change. `HistoryRun` (in-memory type) gains `outputTypeId: string`.

## 6. Acceptance criteria
- [ ] A saved poster/storyboard run with no image shows "Jana Visual" in HistoryModal and can generate it.
- [ ] Generating from history saves the image to the run + refreshes the list.
- [ ] A run that already has an image shows the image (no duplicate generate prompt).
- [ ] Hook & Copy run shows no visual control.
- [ ] Verify gate green (lint + tsc + build).
