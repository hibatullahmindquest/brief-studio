# STATUS — brief-studio

## Current Phase
SCIS MVP — P1 (Schema) + P2 (Meta OAuth) DONE on branch `feat/scis-meta-analytics`. Next: P3 (Sync).

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
