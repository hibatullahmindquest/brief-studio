# Brainstorm — Async Generation Jobs (LOCAL FIRST)

> Date: 2026-06-16 · Route: feature · Branch: `feat/async-generation-jobs`
> Base: `docs/plans/2026-06-15-async-generation-jobs-FUTURE.md`
> **Decision locked: Approach B (separate worker process).**

## Goal
"Tutup tab pun generation jalan, boleh resume" — close-tab-safe visual generation.
Scope LOCAL only; VPS/PM2 deploy deferred to a later ops task (needs Hafiz root setup —
hibatullah confirmed no sudo, no `/var/www` write on KVM8).

## Approaches considered

### A — In-process detached promise
Route starts work without `await` inside the Next server, returns jobId, client polls.
- Pro: minimal change; close-tab-safe on local too (work lives in Next server, not the tab).
- Con: work runs *inside the web process* → web restart/crash/deploy kills in-flight jobs;
  **requires re-architecting to a worker when moving to VPS = double work.**

### B — Separate worker process polling job table  ✅ CHOSEN
Route only enqueues `GenerationJob(queued)`. A second process (`npm run worker` →
`tsx src/worker/index.ts`) polls the table, claims a job, runs OpenAI, updates status.
Local = 2 terminals (`npm run dev` + `npm run worker`). VPS = same script under PM2.
- Pro: true isolation (web restart can't kill jobs); **local build = VPS build → zero rework**;
  central cost throttle (process N=1).
- Con: 2 processes during dev; needs atomic claim; add `tsx` devDep + script.

### C — SSE/streaming instead of polling
Orthogonal (how client learns status, not resume). More complex, no resume benefit if tab closed.
**Skipped for MVP** — polling is fine for 7 internal users.

## Why B (one-line)
Strategy is "local first, VPS later" → B builds the architecture once; VPS becomes pure ops
(PM2 + chown) with no code change. A would force a rewrite at the VPS step.

## State machine
`queued` → (worker claim) → `processing` → (done) → `succeeded`
`processing` → (OpenAI fail OR stale >5min) → `failed` → user can re-generate (new job)

## GenerationJob (process tracking only — image stays in FeatureRun.outputJson)
`id`, `featureRunId`, `userId`, `brandId`, `status(queued|processing|succeeded|failed)`,
`reason`, `retryable`, `claimedAt`, `createdAt`, `updatedAt`.

## Architecture deltas
- **Prisma:** new `GenerationJob` model. `FeatureRun` unchanged.
- **Routes:**
  - `POST /api/generate/visual` → becomes ENQUEUE (create job, return `{jobId}`); idempotent per `featureRunId`.
  - `GET /api/jobs?featureRunId=` → poll status (used both for active polling and on-mount resume).
- **Worker:** `src/worker/index.ts` — poll loop + atomic claim + run `planVisual`/`renderImage`
  (moved out of the route, logic reused) + `updateFeatureRunOutput` + `logUsage` + watchdog sweep.
- **Client (VisualPanel):** submit → store jobId → poll ~2s → map status to existing stages;
  on mount, `GET /api/jobs?featureRunId=` to resume (processing→spinner, succeeded→image, failed→error).
- **Tooling:** add `tsx` devDep + `"worker": "tsx watch src/worker/index.ts"` script.

## Edge cases & handling
| Scenario | Handling |
|---|---|
| Worker crash mid-job (stuck `processing`) | **Watchdog:** each loop, mark `processing` with `claimedAt` > 5 min → `failed (stale)` |
| Two workers race same job | **Atomic claim:** `UPDATE … WHERE status='queued'`; only one row-update wins |
| OpenAI fails (moderation/quota/timeout) | Worker catches → reuse `classifyVisualError` → `failed` + `reason` + `retryable`; UI honors retryable |
| WEB (next) restart/deploy | No effect — work lives in WORKER (B's key advantage over A) |
| Worker not running (forgot `npm run worker`) | Job stays `queued`; UI shows "in queue", optional warn if queued >60s; PM2 keeps worker alive on VPS |
| User clicks Jana twice for same run | **Idempotent:** one active job per `featureRunId`; second submit returns existing job |
| Many users generate at once | Worker processes 1-by-1 (or small N) → natural throttle; bounded concurrency in one place |
| User closes tab mid-run | Job continues; result lands in FeatureRun history |
| Job succeeds but tab closed | Fine — worker persists to FeatureRun; history always correct regardless of tab |
| DB down on worker update | Worker retries write; else watchdog eventually marks stale |

## Role / access
- Submit endpoint keeps creative/admin gate (unchanged from current visual route).
- Worker runs trusted (no per-request auth) — it only acts on already-authorized queued jobs.

## Local → VPS (no rework)
- Local: `npm run dev` + `npm run worker` (2 terminals). Hibatullah can build+test fully, no VPS/root.
- VPS later (Hafiz, one-time): `pm2 start … scis-app` + `pm2 start … scis-worker`, chown deploy dir, PM2 startup/save. Code unchanged.

## Visual explainer
`temp/async-worker-approach-b.html` (4 actors, happy path, resume, 10 edge cases, state machine).

## Open questions for PRD step
- Watchdog stale threshold: 5 min default (confirm).
- Poll interval: 2s (confirm).
- Worker concurrency: N=1 for MVP (confirm).
- Keep a sync fallback or fully replace the sync path? (lean: fully replace.)
