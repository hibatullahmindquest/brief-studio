# STATUS — brief-studio

## PR #6 MERGED (2026-06-16) — Async visual generation + Semakan Lepas status/cost/time
- **PR #6 MERGED** to master (681b1ef). Bundled 4 stacked commits + chore:
  - `039ba5a` async visual generation via worker (close-tab-safe + resumable)
  - `37aff00` Semakan Lepas visual indicator + generation time
  - `861666d` fix live generation status (timer resume + live "Tengah jana")
  - `9e0994e` fix cost display in Semakan Lepas
- Live E2E proven with real OpenAI (RM0.30 poster). lint+tsc+build green; worker boots clean.
- **Branch cleanup done (2026-06-18):** 9 stale local + 5 stale remote branches deleted (all merged). Local now = `master` only after this sync. Going forward: PR merge with `--squash --delete-branch`.
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
