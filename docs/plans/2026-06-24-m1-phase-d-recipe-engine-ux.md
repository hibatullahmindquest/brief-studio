# UX / API Contract — Module 1 Phase D: Recipe Engine

> Date: 2026-06-24 · Phase D is **backend** (engine + worker + one thin API route).
> No UI in this phase — this doc is the API + integration contract.
> PRD: `docs/plans/2026-06-24-m1-phase-d-recipe-engine-prd.md`

## A. Confirm route — `POST /api/studio/[runId]/confirm`

The trigger that moves a Phase-C draft into the recipe engine.

**Auth:** session required (same as `/api/studio`). The run must belong to the
caller (owner check) — else 403.

**Request:** no body required. (Optional later: `{ spec?: {...} }` to patch
last-mile answers — out of scope this phase.)

**Behaviour (thin route → lib):**
1. `getSessionUser()` → 401 if absent.
2. Load `CreativeRun{id}` (select id, userId, recipeId, brandId, lens, spec,
   feature, status). 404 if missing.
3. Owner check: `run.userId === user.id` → else 403.
4. State guard: `run.status === "draft"` → else 409 (`already <status>`).
5. Recipe guard: `run.recipeId` present → else 409 (`no recipe selected — clarify the brief`).
6. **Gap guard:** `gapCheck(run.feature, run.spec, ctx)` — if required gaps remain → 409 with `{ gaps }`.
7. `enqueue({ kind:"generate", lane:"interactive", dedupeKey: runId, featureRunId: runId, userId: run.userId, brandId: run.brandId, payload:{ runId } })`.

**Response 200:**
```json
{ "runId": "...", "jobId": "...", "status": "queued", "reused": false }
```
**Errors:** 401 (no session) · 403 (not owner) · 404 (no run) · 409 (not draft / no recipe / gaps remain, with `gaps`).

**Idempotency:** `dedupeKey = runId` → a second confirm while a job is active
returns the same job (`reused:true`), never a duplicate (Module 0 guarantee).

## B. Worker integration — `generate` handler branch

`runGenerateHandler(job)`:
```
load run by (payload.runId ?? job.featureRunId)
  run has recipeId  → return adapt(runRecipe(run))        // Phase D engine
  else              → return runVisualJob(...)             // legacy poster, unchanged
```
- `adapt()` maps `RecipeResult` → `HandlerResult{ ok, resultKind:"recipe", result:{artifacts,guardian}, costMyr }`.
- Failure: `runRecipe` throws on OpenAI/transient error → handler returns
  `{ ok:false, retryable:true }` (Module 0 backoff re-runs). Config errors (no
  enabled producing experts) → `{ ok:false, retryable:false }`.
- Legacy detection is by `recipeId` only — no payload flag needed (legacy runs
  never have one), so the existing `/api/generate/visual` path is unaffected.

## C. Status lifecycle (CreativeRun.status)

```
draft ──confirm/enqueue──▶ (job queued) ──worker claims──▶ processing*
   ▲                                                         │
   │                                            runRecipe ok │
   └─ (stays draft on 409)                                   ▼
                                                         generated
```
*`processing` is tracked on the Job row, not necessarily mirrored to the run in
this phase; the run flips `draft → generated` on success. (A `failed` run-status
is optional; the Job row already carries failure/retry state.)

## D. Result surface (for the future Studio UI — not built now)

Artifacts are queryable via `Artifact` rows by `runId` (already indexed
`[runId, createdAt]`). A later `GET /api/studio/[runId]/result` (out of scope)
will return artifacts + `contextUsed.guardian` + `sumRunCostMyr`. This phase only
guarantees the rows exist and are correct.

## E. Observable acceptance (maps to PRD §6)

- Confirm a seeded draft poster run → 200 `{status:"queued"}`; worker (interactive
  lane) processes it → 3 Artifacts (`strategy`,`copy`,`visual_direction`) on the
  run; `contextUsed.guardian.verdict` set; `sumRunCostMyr` > 0.
- Confirm a run with remaining required gaps → 409 `{gaps:[...]}`, no job.
- Confirm another user's run → 403.
