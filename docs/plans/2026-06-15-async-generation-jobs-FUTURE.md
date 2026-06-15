# FUTURE PLAN — Async Generation Jobs (Isu 3)

> Status: **PARKED** (separate phase) · Captured 2026-06-15
> Problem: generation is synchronous (tied to the browser request). Close the tab mid-generation → not guaranteed to finish/save, and there's no way to check progress or resume.

## Goal
"Tutup tab pun generation jalan, dan boleh check semula bila-bila" — like Kling / Higgsfield / Flow.

## Why it's a separate (bigger) phase
Requires a background job system, not just a code tweak:
- A **job/status record** (`GenerationJob`: id, status `queued|processing|succeeded|failed`, reason, result ref, brand/user, timestamps).
- A **worker** that runs the OpenAI calls outside the request (PM2 `scis-worker` per PRD §06, or a queued task).
- The API **submits** a job → returns `jobId` immediately; the client **polls** status (or SSE) and shows progress.
- **Resume:** on reload, list in-progress jobs; on done, the result is in history regardless of tab state.
- A **watchdog** to mark jobs stale/failed after N minutes (ties into the earlier "stuck generation" brainstorm — timeout/cancel).

## Aligns with
- PRD `scis-worker` (background jobs).
- The earlier stuck/timeout brainstorm (`logError` + timeout/cancel) — the watchdog + retryable classification belong here too.

## Rough scope (when picked up)
- Prisma `GenerationJob` model.
- `POST /api/generate/visual` → enqueue + return jobId (instead of awaiting).
- Worker/route to process the queue; `GET /api/jobs/:id` for status.
- VisualPanel: submit → poll → progress; resume in-progress on mount.
- Watchdog + timeout/cancel.

## Decision
Defer. Build only after Isu 1+2 (display + failure UX) ship and the synchronous flow is proven. Revisit when generation gets slow/batched or the team needs close-and-resume.
