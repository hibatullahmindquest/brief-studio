# UX Note — Async Generation Jobs

> 2026-06-16 · feature `feat/async-generation-jobs`. Reuses existing `VisualPanel` stages —
> no new visual surface. This note locks the job-status → UI-stage mapping + the two new behaviors.

## Principle
The user-facing UI barely changes. The panel already has stages
`idle | planning | rendering | done | skipped | error`. Async only changes *how* a stage is reached:
the client now learns status by **polling a job** instead of awaiting one fetch.

## Job status → VisualPanel stage
| Job status | Stage shown | Copy (existing) |
|---|---|---|
| (no job yet) | `idle` | "Jana visual untuk output ni" + ✨ Jana Visual + est cost |
| `queued` | `planning` (spinner) | "AI tengah rancang visual…" + live timer |
| `processing` | `rendering` (spinner) | "Melukis… · gpt-image-2" + live timer |
| `succeeded` (shouldRender) | `done` | image + scenes + cost badge + ⏱ + Regenerate/Download |
| `succeeded` (shouldRender=false) | `skipped` | "AI rasa output ni tak perlukan visual." |
| `failed` | `error` | classified message + retry (if `retryable`) / change-brief hint |

> Timer: keep existing elapsed counter. It starts on submit, freezes on terminal status.
> Cost/scenes for `succeeded` come from the poll response (read from FeatureRun) — no extra fetch.

## Two new behaviors
1. **Resume on mount.** When VisualPanel mounts for a run, call `GET /api/jobs?featureRunId=` once.
   If a non-terminal job exists → jump straight into spinner + start polling. If terminal → show
   that result. This makes close-tab-and-return seamless across devices.
2. **Worker-down hint (local-dev aid).** If a job stays `queued` longer than ~60s, show a small,
   non-blocking line under the spinner: "Tengah beratur lama — pastikan worker hidup (`npm run worker`)."
   Subtle muted text, not an error. Harmless on VPS (PM2 keeps worker alive).

## Unchanged
- Entry points: Studio result + HistoryModal "Jana Visual" (the `generate-visual-later` surface) both
  just call submit → poll. No layout change.
- Role gating, est-cost line, draft warning banner, native-ratio image display — all unchanged.

## Why no mockup
The user flow (submit → spinner → result, plus resume + edge cases) is already illustrated in
`temp/async-worker-approach-b.html`. The panel visuals are reused verbatim, so a new mockup adds nothing.
