# Build Prompts — Async Generation Jobs

> 2026-06-16 · `feat/async-generation-jobs` · PRD: `docs/plans/2026-06-16-async-generation-jobs-PRD.md`
> Ordered, atomic build steps. Each is independently verifiable. Build step executes these in order.

## P1 — Prisma model + migration
- Add `GenerationJob` model to `prisma/schema.prisma` (fields per PRD §5) + relation back from
  `FeatureRun` (jobs) and `Brand`/`User` if needed for queries. Indexes: `[status]`, `[featureRunId]`.
- Run migration `add_generation_job` against local DB; `prisma generate`.
- **Verify:** migration applies; `npx prisma validate` clean; client types include `generationJob`.

## P2 — Extract shared visual-job logic → `src/lib/visual-job.ts`
- Move from `api/generate/visual/route.ts`: `classifyVisualError`, the plan→render→persist→logUsage body,
  and brand/outputType resolution, into a pure function e.g.
  `runVisualJob({ featureRunId, userId }): Promise<{status,reason?,retryable?,...}>`.
- This function does NOT do auth/rate-limit (caller's job) — it's the unit the worker calls.
- **Verify:** tsc clean; no behavior change yet (route still calls it synchronously at this point — temp).

## P3 — Job store helpers → `src/lib/job-store.ts`
- `enqueueVisualJob({featureRunId,userId,brandId})` — idempotent: return existing active job or create queued.
- `getLatestJobForRun(featureRunId, userId)` — for poll/resume.
- `claimNextQueuedJob()` — atomic `updateMany WHERE status='queued'` ordered oldest; returns claimed row or null.
- `markSucceeded / markFailed(jobId, …)`.
- `sweepStaleJobs(maxAgeMs)` — watchdog: `processing` & `claimedAt < now-maxAge` → failed(stale).
- **Verify:** tsc clean; atomic claim uses a single update (no read-then-write race).

## P4 — Rewrite `POST /api/generate/visual` → enqueue
- Keep auth (creative/admin) + rate limit + ownership check.
- Replace work with `enqueueVisualJob(...)` → return `{ jobId, status }`. Remove the inline OpenAI calls.
- **Verify:** returns fast JSON `{jobId}`; no OpenAI call in the request path.

## P5 — `GET /api/jobs` route
- `GET /api/jobs?featureRunId=` — auth; ownership; return latest job mapped to client shape
  (`{jobId,status,reason,retryable, image?,scenes?,costMyr?}`). On `succeeded`, hydrate image/scenes/cost
  from the FeatureRun output.
- **Verify:** returns correct status for queued/processing/succeeded/failed runs.

## P6 — Worker `src/worker/index.ts` + tooling
- Poll loop: sweepStaleJobs → claimNextQueuedJob → `runVisualJob` → markSucceeded/markFailed → sleep 2s.
- Concurrency 1. Graceful log lines. Reads `.env.local` (dotenv or Next env loading via tsx).
- Add `tsx` devDep + `"worker": "tsx watch src/worker/index.ts"` to package.json.
- **Verify:** `npm run worker` boots, idles, picks up a queued job, completes it, image in history.

## P7 — VisualPanel submit → poll → resume
- Submit: POST enqueue → store jobId → start polling (2s).
- Poll: GET /api/jobs; map status to existing stages (UX note table); stop on terminal/unmount.
- Resume on mount: one GET; restore stage from any active/recent job.
- Worker-down hint at `queued` > 60s (subtle muted text).
- Keep existing elapsed timer (start on submit, freeze on terminal).
- **Verify:** close tab mid-run → reopen → resumes; double-click → one job; kill worker → stale after 5min.

## P8 — Full verify gate
- `npm run lint` + `tsc --noEmit` + `npm run build` all green. Manual run-through of acceptance criteria §12.

## Notes
- P2 is a refactor that briefly keeps the route working synchronously; P4 flips it to enqueue. This keeps
  each step compiling.
- No change to text `/api/generate`. Visual only.
