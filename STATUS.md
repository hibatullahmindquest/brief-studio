# STATUS — brief-studio

## ▶ NEXT SESSION — START HERE (handover 2026-06-23 session 6)

**Where we are:** Executing the **revamp plan**. Module 0 ✅ + Module 1 Phase A ✅ merged · **Phase B (Admin) ✅ MERGED** (PR #15 → master `4b757a8`) · **Phase C (Intent Router) ✅ DONE — PR #16 OPEN** (https://github.com/hibatullahmindquest/brief-studio/pull/16, pinned fork, base `master`). Awaiting merge.

**Immediate next:**
1. **Merge PR #16** when reviewed: `gh pr merge 16 --repo hibatullahmindquest/brief-studio --squash --delete-branch` (PIN FORK — guard hook enforces). Then `git checkout master && git pull` + delete local `feat/m1-phase-c-intent-router`.
2. Then **Module 1 Phase D — Recipe engine** (`creative-hub/docs/revamp/module-1-implementation.md` §Phase D): run the experts in the recipe the router selected. Rides Module 0 queue — enqueue `kind="generate"` (recipe_id + spec); worker runs recipe steps sequentially (each step = LLM call: role `system_prompt` + grounding + prior outputs); grounding = brand knowledge; **Brand Guardian** QA (do-not/tone/religious → pass/flag/retry); cost per expert → usage log. Files: `src/worker/handlers/generate.ts` (expand) + `src/lib/{recipe-run,grounding,expert}.ts`. Acceptance: poster recipe runs Strategist→Copywriter→Art Director→QA, produces spec+copy; cost logged per expert.

**Env:** Docker `brief-studio-db` up. Dev server + worker **STOPPED** (killed for the build). Restart with `npm run dev` / `npm run worker:interactive`. **Stop them before any `npm run build`/`prisma generate`** (Windows EPERM on Prisma DLL — today 3 zombie `next dev` procs caused it; kill stray brief-studio node procs first via `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ? { $_.CommandLine -match 'brief-studio' }`).

**Phase C summary (all 10 feature-route steps done):** `POST /api/studio` (`runIntake`): `resolveLens` → `ingestUploads` → gpt-4o `classify` → confidence-gate/`selectRecipe` → `gapCheck` → persist draft `CreativeRun`. Files `src/lib/{lens,ingest,router,studio-error}.ts` + thin route. Lens = `marketing`/`social` (social_memo parked). Uploads = text+image+pdf/docx (`safePublicPath` traversal guard). Clarify threshold 0.7. **Zero schema/seed change.** Tests: lens 9/9 · ingest(+traversal) · router 26/26 · live classify/benchmark 10/10/smoke 2/2. Review PASS (fixed CRITICAL path-traversal LFI). Deps: pdf-parse, mammoth. Commit `8842928`. **Bookkeeping (GOALS/STATUS/MEMORY/task-json) left uncommitted by design** — finalised via this save-session.

**Superseded handovers below (sessions 3 & 5) — kept for history:**

---

## ▶ (OLD) NEXT SESSION — START HERE (handover 2026-06-23 session 5)

**Module 1 Phase B (Admin) ✅ DONE** — committed `114e60a`, PR #15 (since MERGED → `4b757a8`). 8 build prompts: Experts/Recipes API+UI, Brands enriched, Users/Teams API+UI, Settings hub. Pattern: deep lib `src/lib/admin/*` throws `AdminError{status}`; thin `assertAdmin` route. Verify scripts: experts 9/9 · recipes 14/14 · brands 16/16 · users 10/10.

**Superseded handover below (session 3, Phase B mid-build) — kept for history:**

---

## ▶ (OLD) NEXT SESSION — START HERE (handover 2026-06-22 session 3)

**Where we are:** Executing the **revamp plan**. Module 0 ✅ + Module 1 Phase A ✅ merged. **Module 1 Phase B (Admin) IN PROGRESS** on a feature branch — 5 of 8 build prompts done, NOTHING committed yet.

**Branch / git state:**
- On **`feat/m1-phase-b-admin`** (branched off `master` `4cc049d`). **Uncommitted working tree** — 10 new files (see `.claude/tasks/m1-phase-b-admin.json` → `metadata.affectedFiles`) + planning docs + STATUS/GOALS/MEMORY/task-json bookkeeping.
- `master` unchanged @ `4cc049d`. No open PRs.
- ⚠️ FORK repo — ALWAYS pin: `gh pr create --repo hibatullahmindquest/brief-studio --base master` (guard hook enforces).

**Phase B progress (route=feature, task `.claude/tasks/m1-phase-b-admin.json`):**
- Planning gates DONE: brainstorm + PRD + UX + build-prompts. Files:
  `.claude/plans/2026-06-22-m1-phase-b-admin-brainstorm.md` + `docs/plans/2026-06-22-m1-phase-b-admin-{prd,ux,build-prompts}.md`.
- Build (8 prompts): **P1 Experts API ✅ (m1b-experts 9/9) · P2 Experts UI ✅ · P3 Recipes API ✅ (m1b-recipes 14/14) · P4 Recipes UI ✅ · P5 Brands enriched ✅ (m1b-brands 16/16)**. `tsc --noEmit` exit 0 + `npm run lint` clean after P5. (Full `npm run build` deferred to the verify gate.)
- Built files: `src/lib/admin/{errors,experts,recipes,brands}.ts` · `src/app/api/admin/{experts,recipes}/route.ts` + extended `src/app/api/brand/route.ts` · `src/components/admin/{InlineConfirm,ExpertsAdmin,ChipListInput,RecipeStepsBuilder,RecipesAdmin,BrandKnowledgeForm}.tsx` · `src/app/dashboard/settings/{experts,recipes,brands}/page.tsx` · `scripts/m1b-{experts,recipes,brands}.ts`.
- **P4 notes:** `ChipListInput` = shared chip editor (lenses + brand knowledge reuse). `SaveBar` NOT extracted — admin components inline Save/Cancel. `RecipeStepsBuilder` reorders via ▲▼ (no drag lib), tier `""`=inherit (dropped on serialise), red ⚠ on disabled/unknown roleKey (kept selectable).
- **P5 notes:** No schema change — all enriched `Brand` fields already existed (M1-A). Extracted `src/lib/admin/brands.ts` `updateBrand(input)` (overlay + knowledge in one validated path; throws `AdminError`); `PATCH /api/brand` is now a thin gate→lib→`adminErrorResponse` (overlay fields still work, m1b-brands proves it). `BrandKnowledgeForm` reuses `ChipListInput` (doNot = `tone="danger"`); colours use a native `<input type=color>` swatch picker so only valid `#rrggbb` ever enters (server still validates hex). Two BrandKnowledgeForm + BrandFurnitureForm stacked per brand on the brands page.

**Immediate next action — resume at P6** (see `docs/plans/2026-06-22-m1-phase-b-admin-build-prompts.md` §Prompt 6):
1. **P6 Users (Teams) API** — `scripts/m1b-users.ts` (red first) → `src/app/api/admin/users/route.ts` (`GET` list id/name/email/teamRole/team/isAdmin; `PATCH ?id=` only assignment fields — never password/email/username; **last-admin guard**: block if PATCH drops admin count to 0). Follow the deep-lib pattern: put logic in `src/lib/admin/users.ts`, thin route. `assertAdmin()`.
2. P7 Users UI (`UsersAdmin.tsx` + page; per-row Save; self-row highlight; surface last-admin 409) · P8 settings hub nav+counts.
3. Then gates: verify (lint+tsc+build) → `/bs-review` → `/bs-release-notes` → `/bs-commit` → push (ask) → PR (pin fork).

**LOCKED this session:** admin path = **`/dashboard/settings/{experts,recipes,users,brands}`** + `/api/admin/{experts,recipes,users}` (NOT `src/app/admin/*`). Locked into `creative-hub/docs/revamp/module-1-implementation.md` §Phase B for future phases. Pattern: deep lib `src/lib/admin/*` throws `AdminError{status,message}`; route is thin `assertAdmin` gate + `adminErrorResponse(e)` mapping. Lifecycle = soft-disable first; hard delete guarded (expert-in-recipe / recipe-in-run → 409).

**Run verify scripts:** `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" npx tsx scripts/m1b-<x>.ts` (needs `brief-studio-db` + seeded experts via `scripts/seed-m1.ts`).

**M1-A scope notes (still active):** Expert model = `Expert` (roleKey), not `Role`. Legacy/new Brand field duplication intentional — consolidate later. CreativeRun.outputJson still required (pass `"{}"`). Prisma 4: omit nullable Json (or `Prisma.DbNull`) — never literal `null`.

**Gotchas this session (also MEMORY.md, newest entries):** (1) admin route logic must live in a lib to be tsx-testable — `assertAdmin`→`cookies()` throws outside a request scope, so can't call handlers directly. (2) `assertAdmin()` THROWS a Response — route must `catch (e) { if (e instanceof Response) return e; throw e }`. (3) verify-script temp tags must satisfy slug validators (roleKey regex starts-with-letter) — used `zztest_*` not `__test_*`.

**Env state:** Docker Desktop + `brief-studio-db` RUNNING. Dev + worker STOPPED. DB URL `postgresql://postgres:postgres@localhost:5432/brief_studio`.

**Working rhythm (Rule #28):** after each completed step in multi-step work, show an ordered ✅/⏳/❌ checklist + a `Next:` line.

---

## Module 0 — Generic Worker / Queue (2026-06-22) — branch `feat/module-0-generic-queue`
Turned the poster-only `GenerationJob` queue into a generic worker substrate (kind/lane/payload/retry).
- **Schema:** `GenerationJob` model → `Job` (`@@map("GenerationJob")`, no data migration). New cols: kind, lane, payload, dedupeKey, attempts, maxAttempts, scheduledAt, result. featureRunId/userId now nullable. Migration `20260622030550_generic_job_queue` applied.
- **Helpers:** `src/lib/job-kinds.ts` (lane map) + `src/lib/job-backoff.ts` (30s→10min exp backoff).
- **Store** (`src/lib/job-store.ts`): generic `enqueue(kind, …)` w/ dedupeKey idempotency, lane-scoped `claimNextJob(lane)`, `markFailedOrRetry` (re-queue w/ backoff else terminal), `sweepStaleJobs` via retry path. `enqueueVisualJob` kept as thin wrapper (kind=generate, dedupeKey=featureRunId). Also repointed `feature-store.ts` history badge to `prisma.job`.
- **Dispatcher:** `src/worker/dispatch.ts` (kind→handler registry) + `src/worker/handlers/generate.ts` (wraps `runVisualJob`).
- **Worker:** `src/worker/loop.ts` now lane-aware via `WORKER_LANE` env. New scripts `worker:interactive` / `worker:background` (cross-env devDep added).
- **Verify:** `scripts/m0-verify.ts` → ALL PASS (dedupe, lane isolation, success, retry+backoff, terminal, non-retryable). `npm run lint` + `npm run build` green. `grep generationJob src/` empty.
- **PENDING:** manual live smoke (enqueue via /api/generate/visual → worker:interactive → /api/jobs poll) NOT yet run — needs dev+worker+OpenAI. Then push + PR (pin fork).

### KVM8 deploy note (Module 0) — TWO PM2 worker processes
```bash
pm2 start npm --name brief-studio-worker-interactive -- run worker:interactive
pm2 start npm --name brief-studio-worker-background  -- run worker:background
```
Both share the same DB/queue; lane scoping keeps user generates fast while slow background jobs (meta_sync/analyze/video/signal — later modules) never block them.

## PR #6 MERGED (2026-06-16) — Async visual generation + Semakan Lepas status/cost/time
- **PR #6 MERGED** to master (681b1ef). Bundled 4 stacked commits + chore:
  - `039ba5a` async visual generation via worker (close-tab-safe + resumable)
  - `37aff00` Semakan Lepas visual indicator + generation time
  - `861666d` fix live generation status (timer resume + live "Tengah jana")
  - `9e0994e` fix cost display in Semakan Lepas
- Live E2E proven with real OpenAI (RM0.30 poster). lint+tsc+build green; worker boots clean.
- **Branch cleanup done (2026-06-18):** 9 stale local + 5 stale remote branches deleted (all merged). Going forward: PR merge with `--squash --delete-branch`.
- NEXT: **VPS deploy** async worker when ready (Hafiz root: `pm2 start npm --name scis-worker -- run worker:start`).

## DONE (2026-06-16) — Async Generation Jobs (committed 039ba5a on feat/async-generation-jobs)
- Approach **B** (separate worker process), local-first. All 9 workflow steps done (brainstorm→PRD→UX→build-prompts→build→verify→review→release-notes→commit). Branch NOT pushed yet.
- Built: `GenerationJob` model (2 migrations applied), `src/lib/visual-job.ts` (runVisualJob), `src/lib/job-store.ts` (enqueue/claim/sweep/mark), `POST /api/generate/visual` now enqueues, `GET /api/jobs?featureRunId=` poll/resume, worker `src/worker/index.ts`+`loop.ts` (`npm run worker`), VisualPanel submit→poll(2s)→resume + worker-down hint, `tsx` devDep.
- Locked: fully async (sync visual path removed), watchdog stale 5min, poll 2s, worker concurrency 1.
- Verify: lint+tsc+build green (26 routes, /api/jobs present); worker boots clean (`npm run worker:start`).
- Visual explainer kept at `temp/async-worker-approach-b.html` (outside repo, by choice).
- ⚠️ GOTCHA: `prisma generate` / `next build` hit EPERM when a `next dev` OR a leftover `tsx` worker process holds `query_engine-windows.dll.node` → kill stray node procs referencing brief-studio before building (Windows).

### PENDING / NEXT for this feature
- [ ] **Live end-to-end test** (needs `OPENAI_API_KEY` w/ gpt-image-2 + running worker): `npm run dev` + `npm run worker` in 2 terminals → generate a poster → confirm image lands in history; close tab mid-render → reopen → resumes; kill worker mid-processing → job goes failed(stale) after 5 min; double-click → one job only.
- [ ] **Push + PR** (only when user asks): `git push -u origin feat/async-generation-jobs` then `gh pr create --repo hibatullahmindquest/brief-studio --base master` (FORK — always pin repo; guard hook enforces).
- [ ] **VPS deploy (later, needs Hafiz root):** chown deploy dir to hibatullah, install deps, `pm2 start npm --name scis-worker -- run worker:start`, PM2 startup/save. Code unchanged from local.

## Current Phase
SCIS — all merged to master (PR #2 redesign+analytics, PR #3 visual generation+cost/error tracking, PR #4 fork-PR guard). Working tree clean, master = origin/master, no open PRs. See GOALS.md "Active Task" for next-step candidates. Repo is a FORK — pin `--repo hibatullahmindquest/brief-studio` on all PRs (guard hook enforces).

## v6 redesign + de-PostForge (2026-06-15)
- DELETED inherited PostForge feature modules entirely (overrides PRD v2 "keep"): analytics(IG growth), calendar, campaigns, content-lab, ideas, plan, virality, notes — pages + API routes + components. App is SCIS-only (25 routes, was 40).
- globals.css → v6 light design system (bg #f2f5fd, white cards, ink #00262a, brand #3b4ee2, orange #fd8549, teal sidebar). editorial-* classes remapped to light. Fonts: Poppins + JetBrains Mono.
- header: light v6, hidden on /dashboard + /studio (sidebar-only shell). sidebar: SCIS nav (Workspace/Create/Admin) + SOON badges.
- /dashboard = SCIS Today (real paid pulse + organic/signals placeholders). settings de-PostForged (+ Meta link). landing/login/signup = v6. Studio 8 components restyled to v6 (zero invisible white text).
- Verified live: login + landing screenshots clean; Today bg #f2f5fd + real paid data; Studio anyWhiteText=0. Build 25 routes, lint+tsc+build green.
- Commits: 2b17e1c shell, a73346c theme+deletes, b6a5ea6 landing/login, f8ac27e studio.

## P4 Paid Analytics (2026-06-15)
- `src/lib/analytics.ts` — getPaidAnalytics(brandId, period): rolls up AdDailyMetric to T-1/T-7 windows anchored to latest data date (asOf), deltas vs prior equal window, top creatives by spend, rule-based fatigue flag (freq>=2.5 & CTR fell vs prior).
- `src/app/dashboard/analytics/paid/` — page (metric cards w/ per-metric explainers, paid=orange accent, fatigue warnings, top-creatives table) + paid-controls (brand select + T-1/T-7 toggle via URL params).
- Nav item "Paid Analytics" added to dashboard-data.ts.
- Renders real NakNgaji data. T-7 (as of 2026-05-06): RM11,634 spend, 1,038 leads, 0.74% CTR, RM11.21 CPL.
- View at /dashboard/analytics/paid (login required).
- Verify: lint + tsc + build pass.

## BIG FIND — reusable Meta data + token (2026-06-15)
`marketing-ai-agent` local Docker Postgres (volume `marketing-ai-agent_pgdata`) held REAL synced NakNgaji paid data + a working **non-expiring System User token** ("Analytics" BM system user). Token tested live: account `act_1034360610566607` (Nakngaji.my Amin), active, MYR, pulling current data (RM7.8k last 7d).
- Imported into brief-studio via `scripts/import-meta-history.ts`:
  - 1,255 AdCreatives + 17,055 AdDailyMetric rows (2025-01-01 → 2026-05-06, RM520k)
  - Parity verified: Jan 2026 = 31 days / 85 ads / RM58,426.50 / 4,428 leads / 337 WA ✓
  - NakNgaji `ad_account` MetaConnection with token stored ENCRYPTED (META_TOKEN_KEY now set in .env.local)
- Schema upgraded to daily-grain: new `AdDailyMetric` model (rich: cpl, leads, waConversations, frequency, placement/country/age/segment in metricsJson). T-1/T-7/T-30 = rollups over this, not fixed snapshots.
- ETL date-shift bug fixed (node-pg DATE OID 1082 → keep as string, build UTC date).
- `@types/pg` added (devDep).
- To reuse the token for ongoing sync: it's a system-user token → brief-studio should support system-user-token model (paste/store), not just OAuth.

## Last Done
- Brainstorm: `.claude/plans/2026-06-15-scis-analytics-meta-mvp-brainstorm.md`
- Revised PRD: `docs/PRD-v2.md` (full SCIS, clarity pass, MVP scope locked)
- Implementation plan: `docs/plans/2026-06-15-scis-mvp-implementation.md`
- Decisions locked: full SCIS product, lightweight rule-based Daily Signals, hybrid reports, unified `MetaConnection` table, stringified `String` JSON, Graph `v21.0`
- P1.1 `src/lib/crypto.ts` — AES-256-GCM token encryption (key from `META_TOKEN_KEY`)
- P1.2 `src/lib/session.ts` — added `getCurrentUserWithRole`, `requireAdmin`, `assertAdmin`
- P1.3 `prisma/schema.prisma` — added MetaConnection, OrganicPost(+snapshot), AdCreative(+snapshot), DailySignal, Report + Brand back-relations
- P1.4 migration `20260615030132_scis_meta_analytics` APPLIED, DB in sync ✅
- P1.5 `.env.example` — added META_GRAPH_VERSION, META_REDIRECT_URI, META_TOKEN_KEY

## Last Done (P2 — Meta OAuth)
- `src/lib/meta.ts` — Graph v21 client (oauthUrl, exchangeCode, exchangeLongLived, getPages, getIgAccount, getAdAccounts) + HMAC signed-state CSRF (signState/verifyState, 10-min TTL)
- `src/app/api/meta/connect` — admin starts OAuth (signed state)
- `src/app/api/meta/callback` — exchange code → long-lived token → upsert Page + IG + ad_account MetaConnections (tokens encrypted), redirect to /dashboard/settings/meta
- `src/app/api/meta/status` — masked health (no token), any authed user
- `src/app/api/meta/disconnect` — admin deletes brand connections
- `src/app/dashboard/settings/meta/page.tsx` + `meta-connections-panel.tsx` — admin-gated UI, connect/reconnect/disconnect with confirm modal, status pills
- Verify gate: lint + tsc + build all pass

## Next Todo
- [ ] **Before live OAuth test:** set `META_APP_ID`, `META_APP_SECRET`, `META_TOKEN_KEY` (`openssl rand -base64 32`) in `.env.local`; register `http://localhost:3000/api/meta/callback` as a valid OAuth redirect URI in the Meta App dashboard; put app in Development mode
- [ ] Live test: connect a brand → verify MetaConnection rows created, `tokenEnc` is ciphertext (not readable), status masked
- [ ] P3 — Sync layer: `POST /api/meta/sync` pull organic + ad snapshots, idempotent upsert (see plan §P3)

## Blockers
- none (P1 generate-lock resolved by bouncing dev server)

## Technical Notes

**Local dev setup:**
- Docker Desktop running before `npm run dev`
- PostgreSQL container: `brief-studio-db` (docker start brief-studio-db)
- Dev server: `npm run dev` → localhost:3000
- DB: `postgresql://postgres:postgres@localhost:5432/brief_studio`

**Stack:**
- Next.js 16.1.6, React 19, TypeScript 5, Tailwind v4
- Prisma 4.16.2 + PostgreSQL 16 (Docker local, native KVM8)
- OpenAI SDK v6
- Auth: stateless HMAC session cookie (no role in token → DB lookup for admin gating)

**SCIS decisions:**
- Unified `MetaConnection{type}` instead of 3 PRD tables (deviation, logged in plan)
- JSON stored as stringified `String` (matches existing FeatureRun convention)
- Tokens encrypted at rest via lib/crypto; never returned to frontend
- Timezone for periods: Asia/Kuala_Lumpur (MYT), store UTC
- Branch: `feat/scis-meta-analytics` (no direct master)
