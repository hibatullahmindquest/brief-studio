# Build Prompts — Phase H: Feedback loop wiring

> Route: feature · Branch: `feat/m1-phase-h-feedback-loop`
> PRD: `...-prd.md` · UX: `...-ux.md`
> Loop per prompt: implement → `/bs-review` → user confirms "next".
> House style: deep-lib + thin-route + inject-the-IO. No schema change/migration.

Order: backend (feedback persistence + read-layer) first so the UI wires to real contracts,
then the two UI surfaces (feedback buttons, chaining), then the live smoke.

---

## P0 — Feedback persistence + read-layer + test
- `src/lib/studio-feedback.ts` — `setRunFeedback(user, runId, value, note?)`: owner-scoped (`CreativeRun.userId === user.id` → else `StudioError(404)`), `value ∈ {1,-1,0}` (0 → `null`; bad value → `StudioError(400)`), writes `feedback` (+ `feedbackNote`: keep on -1 w/ note, else null). Returns `{ feedback, feedbackNote }`.
- `POST /api/studio/[runId]/feedback` — thin auth → `setRunFeedback` → `studioErrorResponse`. Body `{ value, note? }`.
- `getRunArtifacts` — select + return `run.feedback` / `run.feedbackNote`.
- **Test** `scripts/m1h-feedback.ts`: set 👍/👎, toggle-clear (0), note set-on-down + cleared-on-up, owner 404, bad-value 400, and `getRunArtifacts` surfaces `run.feedback`. Regression: `m1f-library` (shape additive) + `m1g-gaps` green.

## P1 — Wire the Result feedback buttons
- `ResultView` `FeedbackButtons` → live: read `art.run.feedback`, render active state (aria-pressed), toggle via `POST .../feedback` (optimistic + revert-on-error), note input revealed on 👎 (save via same route), refetch/keep `run` state in sync.
- **Test:** build + visual (thumb persists across reopen via the read layer; note shows on 👎).

## P2 — "Take it further" chaining (light pre-fill)
- `ResultView` chips → real enabled targets ≠ current taskType (poster/caption/marketing_plan map); hidden when no copy text. Click → `sessionStorage["studio:seed"] = { text, type }` → navigate `/studio`.
- `StepDescribe` — accept an optional `seed` (initial text + quick-start hint). `StudioWorkspace` — on mount read+clear `studio:seed`, pass to `StepDescribe`; show a subtle "Continuing from a previous run" note.
- **Test:** build + visual (chip pre-fills front door; seed cleared after read; only real targets shown).

## P3 — Live smoke (optional)
- `scripts/m1h-smoke.ts`: seed a run → set feedback via lib → `getRunArtifacts` reflects it → clear → null. (DB-only; no OpenAI.)

---
**Gates after build:** verify (lint+tsc+build, m1f/m1g regression) → review (2-stage) → release-notes → commit → push (PR pinned to fork) → **Module 1 COMPLETE.**
**Env:** stop dev+worker before build/prisma (Windows EPERM); `brief-studio-db` up for tests.
