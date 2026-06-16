# PRD — Async Generation Jobs (LOCAL FIRST)

> Date: 2026-06-16 · Route: feature · Branch: `feat/async-generation-jobs`
> Brainstorm: `.claude/plans/2026-06-16-async-generation-jobs-brainstorm.md`
> Approach: **B (separate worker process)** · Visual: `temp/async-worker-approach-b.html`

## 1. Problem
Visual generation is synchronous — tied to a live browser request (~20–35s). Closing the tab
mid-generation drops the request before the result is persisted: no image, possibly wasted OpenAI
spend, no progress/resume. (See current `src/app/api/generate/visual/route.ts`.)

## 2. Goal
Close-tab-safe, resumable visual generation. User can submit, close the tab, and the result still
lands in history; reopening the run resumes the live status.

## 3. Scope
**In:** GenerationJob model, enqueue API, status/poll API, worker process, VisualPanel submit+poll+resume,
watchdog. **Local execution only.**
**Out (deferred):** VPS/PM2 deploy (separate ops task — needs Hafiz root: chown deploy dir, PM2 startup/save).
SSE/streaming. Batch/bulk generation. Async for the text-only `/api/generate` path (visual only for now).

## 4. Locked decisions
- **Fully async** — the sync visual path is **removed**, not kept as fallback. Worker MUST be running.
- **Watchdog:** `processing` with `claimedAt` older than **5 min** → `failed (stale)`.
- **Poll interval:** **2s** (client).
- **Worker concurrency:** **1 job at a time** (natural cost throttle).
- Worker polls DB every **~2s** when idle.
- One active job per `featureRunId` (idempotent submit).

## 5. Data model — `GenerationJob`
| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `featureRunId` | String | FK → FeatureRun; the run whose visual we generate |
| `userId` | String | submitter (for ownership checks on poll) |
| `brandId` | String | for logging/usage attribution |
| `status` | String | `queued` \| `processing` \| `succeeded` \| `failed` |
| `reason` | String? | failure category + message (from `classifyVisualError`) |
| `retryable` | Boolean | default true; drives UI retry affordance |
| `claimedAt` | DateTime? | set on claim; basis for watchdog staleness |
| `createdAt` | DateTime | default now |
| `updatedAt` | DateTime | @updatedAt |

Indexes: `@@index([status])` (worker poll), `@@index([featureRunId])` (resume/idempotency lookup).
The actual image result stays in `FeatureRun.outputJson` (job tracks *process*, not payload).

## 6. API
### `POST /api/generate/visual` — ENQUEUE (replaces current sync work)
- Auth: creative or admin (unchanged). Rate limit: keep existing.
- Body: `{ featureRunId }`. Validate run ownership (existing `getFeatureRunOwned`).
- Idempotency: if an active job (`queued`|`processing`) exists for this `featureRunId`, return it.
- Else create `GenerationJob(status='queued')`. Return `{ jobId, status }` (~50ms, no OpenAI call).

### `GET /api/jobs?featureRunId=<id>` — STATUS / RESUME
- Auth: any authed user owning the run. Returns the **latest** job for that run:
  `{ jobId, status, reason, retryable, image?, scenes?, costMyr? }`.
  On `succeeded`, include the persisted image/scenes/cost (read from FeatureRun) so the client renders
  without a second call.
- Used by VisualPanel both for active polling and on-mount resume.

> `GET /api/jobs/:id` optional; the `featureRunId` query covers both poll + resume with one endpoint.

## 7. Worker — `src/worker/index.ts`
Run via `npm run worker` (`tsx watch src/worker/index.ts`). Loop:
1. **Watchdog sweep:** mark `processing` rows with `claimedAt < now-5min` → `failed`, reason "stale".
2. **Claim:** atomic `updateMany WHERE status='queued' (oldest) SET status='processing', claimedAt=now`.
   If 0 rows claimed → sleep 2s, repeat.
3. **Run:** load FeatureRun input/output, resolve brand + outputType, call `planVisual` → (if shouldRender)
   `renderImage`. (Logic lifted from the current route; route no longer does this.)
4. **Persist:** `updateFeatureRunOutput` (image into history) + `logUsage` (director + image). Set job
   `succeeded`. If `shouldRender===false`, set `succeeded` with a "skipped" marker.
5. **On error:** `classifyVisualError` → job `failed` + `reason` + `retryable`; `logError` (as today).
6. Loop. Concurrency = 1 (claim one, finish, claim next).

Shared logic (`planVisual`, `renderImage`, `logUsage`, `logError`, `classifyVisualError`, brand/outputType
resolution) is extracted into a reusable module so both worker and (former) route shape stay DRY. Move
`classifyVisualError` + the plan/render/persist body into `src/lib/visual-job.ts` (or similar).

## 8. Client — `VisualPanel.tsx`
- **Submit:** POST enqueue → store `jobId`, set stage from response (`queued`→planning-spinner).
- **Poll:** every 2s `GET /api/jobs?featureRunId=` until terminal. Map:
  `queued|processing` → spinner (keep existing planning/rendering copy + live timer),
  `succeeded` → render image + scenes + cost (existing DONE UI),
  `failed` → existing ERROR UI honoring `retryable`.
- **Resume on mount:** call the same GET; if an active/recent job exists, restore the matching stage.
- **Stop polling** on unmount / terminal status. Keep the existing elapsed timer.
- Optional: if `queued` > 60s, show a subtle "worker mungkin tak hidup" hint (local-dev aid).

## 9. Tooling
- Add `tsx` devDependency. Add script `"worker": "tsx watch src/worker/index.ts"`.
- Prisma migration `add_generation_job`.

## 10. Edge cases (from brainstorm — must be covered)
Worker crash → watchdog; double-claim → atomic update; OpenAI fail → classified failed; web restart →
unaffected (worker isolated); worker down → job stays queued + UI hint; double submit → idempotent;
many users → 1-by-1 throttle; tab closed → result still persisted; reopen → resume.

## 11. Out-of-scope confirmations
- No change to text `/api/generate`. No bulk. No cancel button (failed-via-watchdog only) — a manual
  cancel can be a fast-follow.

## 12. Acceptance criteria
1. Submit visual → returns `{jobId}` in <200ms (no OpenAI in request).
2. Worker (running) picks up job, generates, image appears in history within normal time.
3. Close tab mid-generation → reopen run → image present (or live spinner if still processing).
4. Kill worker mid-`processing` → after 5 min the job shows `failed (stale)`; user can re-generate.
5. Double-click Jana → only one job/one OpenAI spend.
6. OpenAI moderation/quota error → job `failed`, correct non-retryable message in UI.
7. Restart `next` dev while a job is processing → job still completes (worker untouched).
8. Lint + tsc + build green; review gates pass.
