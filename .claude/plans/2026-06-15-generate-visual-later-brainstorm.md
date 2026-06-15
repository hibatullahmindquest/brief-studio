# Brainstorm — Generate Visual Later (from a saved run)

> Date: 2026-06-15 · Scenario: text output generated + saved, user closes tab / leaves Studio BEFORE pressing "Jana Visual". Can they generate the image later?

---

## 0. Direct answer
**Right now: no UI path** — but the data is all there, and the fix is small.

### What persists vs what's lost
| Thing | State after closing the tab |
|-------|------------------------------|
| The text output (brand, brief answers, output) | ✅ **Saved** as a `FeatureRun` in DB at the generate step |
| Appears in **Semakan Lepas** history + HistoryModal | ✅ Yes |
| The **"Jana Visual" button** | ❌ Lost — it lives in the live result (`VisualPanel`), wired to `featureRunId` held in **in-memory wizard state**. Closing the tab clears it; reopening Studio resets to step 1. |
| HistoryModal (where the run reappears) | 📖 **Read-only** — shows text (+ image if one was already made), but has **no generate button** |

So: the run is safe, but there's currently **no way to trigger the visual later**. You'd have to re-run the brief (new run + new cost).

### The key enabler (why this is easy)
`POST /api/generate/visual` already takes **only `{ featureRunId }`** and loads everything (brand, brief, output) **from the DB** — it never needed the live wizard state. So "generate later" = just **exposing that action on a saved run**. The backend already supports it.

---

## 1. Approaches

### A — Add "Jana Visual" to HistoryModal (recommend)
When you open a past run in Semakan Lepas: if it has no image yet **and** it's a visual output type (poster/storyboard/video), show a **"Jana Visual"** button (same `VisualPanel` behaviour) → calls `/api/generate/visual { featureRunId }`. If it already has an image, show it (as today).
- **Pros:** tiny — reuses the existing route + most of `VisualPanel`; works from anywhere (history is global), survives tab close, any browser. Solves the scenario fully.
- **Cons:** HistoryModal becomes interactive (was read-only) — needs loading/cost/error state + refresh after generate. (Basically: reuse `VisualPanel` inside the modal.)

### B — Persist the live result/session (localStorage resume)
Save the current result + runId to localStorage; on reopening Studio, restore the result view with its VisualPanel.
- **Pros:** restores the exact last session.
- **Cons:** same-browser only; doesn't help "from another module" or another device; fragile; A is strictly better.

### C — Dedicated Library/Output page with per-output actions
The PRD's Library: every saved output is a card with "Generate visual / regenerate / download". "Generate later" is one action there.
- **Pros:** the proper long-term home; A is a natural subset.
- **Cons:** bigger (a whole page). Do A now, grow into C later.

**Recommend A** — surface the existing visual action in HistoryModal; it reuses everything and fully solves the scenario. Naturally extends into the Library page (C) later.

---

## 2. How A works (concretely)
- `HistoryRun` already carries `image` (null if none) + `subtype`/output type.
- In HistoryModal: derive visual-kind from the run; if kind ≠ none:
  - `image` present → show it (today's behaviour).
  - `image` null → render a **"Jana Visual"** control (reuse `VisualPanel`, passing `featureRunId`), which calls the same route, saves into the run, and shows the result inline.
- On success → refresh the history list (the run now has an image) — dispatch the existing `generation:complete` event.
- Need: the run's **output-type id** in `HistoryRun` (currently we store `subtype` = the label; map label→id, same as the visual route does) so the panel knows poster vs storyboard vs none.

---

## 3. Edge cases
- Run is **Hook & Copy** (text-only) → no button (kind none).
- Run **already has an image** → show it; optionally allow Regenerate.
- **Ownership** → `/api/generate/visual` already scopes to the requesting user (`getFeatureRunOwned`), so you can only generate for your own runs.
- **Cost** → same estimate/actual + the timer we just added.
- **Old runs** (pre-visual-feature) → still work; route loads from DB regardless of when the run was made.
- **Concurrent**: generating from history while a live session is open → fine, keyed by `featureRunId`.
- **Moderation/failure** → same categorized errors we built.

---

## 4. Key decisions
- [ ] **Approach A** (Jana Visual in HistoryModal, reuse `VisualPanel` + route)? (recommend yes)
- [ ] **Where to expose** — HistoryModal now; full Library page (C) later? (recommend yes)
- [ ] **`HistoryRun` needs the output-type id** (map from stored label) so the panel knows the kind — small `feature-store` tweak.
- [ ] **Allow Regenerate** on a run that already has an image, or view-only? (recommend: view now, regenerate later)
- [ ] Route classification when built: **feature** (new capability: generate from history) — small.

---

## 5. Recommendation (one line)
**Yes, make it work** via Approach A — surface the existing `featureRunId`-based "Jana Visual" action inside HistoryModal (reusing `VisualPanel`), so any saved run can generate its image later from Semakan Lepas; the backend already supports it, so it's a small UI-reuse job, and it grows naturally into the Library page.
