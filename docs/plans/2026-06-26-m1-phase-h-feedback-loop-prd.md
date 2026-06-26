# PRD — Phase H: Feedback loop wiring

> Module 1 FINAL phase · Route: feature · Branch: `feat/m1-phase-h-feedback-loop`
> Brainstorm: `.claude/plans/2026-06-26-m1-phase-h-feedback-loop-brainstorm.md`
> Plan ref: `creative-hub/docs/archive/revamp/module-1-implementation.md §Phase H`

## 1. Summary

Close Module 1 by capturing the learning signal on a finished run: **a per-run 👍/👎**
(small, unobtrusive, in the Result header) persisted to `CreativeRun.feedback`, plus a
**light "Take it further" chaining offer** that pre-fills the front door from this run's
output to start a related run. **No migration** (`CreativeRun.feedback`/`feedbackNote` exist
from Phase A).

## 2. Goals / Non-goals

**Goals**
- One-click thumb feedback per result, persisted + shown on reopen.
- Optional short note on 👎.
- "Take it further" chips start a pre-filled new run for a real target recipe.

**Non-goals (this phase)**
- Per-artifact feedback (deferred — `Artifact.feedback` stays available, additive later).
- Full auto-chaining / new recipes (storyboard/video/carousel have no recipe yet).
- Using the feedback signal (training/ranking) — that's M3/M4; `context_used` stays empty.

## 3. Functional requirements

### FR-1 — Feedback persistence (deep lib + thin route)
- `src/lib/studio-feedback.ts` — `setRunFeedback(user, runId, value, note?)`: owner-scoped (`CreativeRun.userId === user.id`, else `StudioError` 404), validates `value ∈ {1, -1, 0}` (0 → clear to `null`), writes `CreativeRun.feedback` (+ `feedbackNote` — set on -1, cleared otherwise/on 0). Returns `{ feedback, feedbackNote }`.
- `POST /api/studio/[runId]/feedback` — thin: auth → `setRunFeedback` → map `StudioError`. Body `{ value: 1|-1|0, note?: string }`.

### FR-2 — Surface stored feedback in the read layer
- `getRunArtifacts` (`artifact-store.ts`) — select `CreativeRun.feedback` + `feedbackNote`, return them on the `run` object (`run.feedback: number|null`, `run.feedbackNote: string|null`). Additive — existing m1f/m1g shapes unaffected.

### FR-3 — Wire the Result feedback buttons
- `ResultView` `FeedbackButtons` — real 👍/👎 (small icons, current placement). Reflect `art.run.feedback` (active state); click toggles (same thumb again → clear). Optimistic update with revert-on-error. On 👎, reveal a small optional note input (saved via the same route). Works in the live flow AND the deep-link (shared component).

### FR-4 — "Take it further" chaining (light pre-fill)
- `ResultView` chips → for each **real enabled target** taskType ≠ the current run's taskType (`poster`→"Make a poster", `caption`→"Write captions", `marketing_plan`→"Marketing plan"; drop carousel/video). Hidden when there's no seedable text.
- Click → `sessionStorage.setItem("studio:seed", JSON.stringify({ text, type }))` (text = this run's copy artifacts joined) → navigate to `/studio`.
- `StudioWorkspace` — on mount, read+clear `studio:seed`; if present, pre-fill `StepDescribe` (textarea = seed text, with the target type as a quick-start hint). The router re-classifies normally on Send.

## 4. Acceptance criteria

- **AC-1** 👍/👎 on a result persists to `CreativeRun.feedback`; clicking the active thumb clears it; switching overwrites.
- **AC-2** 👎 reveals a note input; the note saves to `feedbackNote` and clears on 👍/clear.
- **AC-3** Reopening the run (Recent → deep-link) shows the stored thumb state (via `getRunArtifacts.run.feedback`).
- **AC-4** Feedback route is owner-scoped (other user → 404) and validates `value` (bad value → 400).
- **AC-5** "Take it further" chips show only real target recipes ≠ current type, and only when there's text; clicking pre-fills the front door and the new run can be sent normally.
- **AC-6** No migration; `lint` + `tsc` + `build` green; m1f/m1g regressions intact.

## 5. Affected surface

**New:** `src/lib/studio-feedback.ts`, `src/app/api/studio/[runId]/feedback/route.ts`.
**Edited:** `src/lib/artifact-store.ts` (FR-2), `src/components/studio/ResultView.tsx` (FR-3 + FR-4 chips), `src/components/studio/StudioWorkspace.tsx` (FR-4 seed pre-fill), `src/components/studio/StepDescribe.tsx` (accept an initial seed).
**Tests:** `scripts/m1h-feedback.ts` (setRunFeedback: set/toggle/clear/note/owner/validation + getRunArtifacts surfaces run.feedback).

## 6. Risks

- **Optimistic UI drift** — revert thumb on a failed write; keep the source of truth in `run.feedback`.
- **Seed leakage** — clear `studio:seed` immediately after reading so a later manual visit isn't pre-filled.
- **Chaining honesty** — never offer a target with no recipe (would 404 at intake/confirm).
