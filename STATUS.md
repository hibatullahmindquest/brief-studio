# STATUS — brief-studio

## Current Phase
SCIS MVP — P1 (Schema) executing on branch `feat/scis-meta-analytics`

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

## Next Todo
- [ ] Regenerate Prisma client (`npx prisma generate`) — was blocked by running next dev holding the query-engine DLL; bounce dev server then regenerate
- [ ] P1 verify: `npm run lint` + `tsc --noEmit`
- [ ] Commit P1
- [ ] P2 — Meta OAuth: `src/lib/meta.ts`, connect/callback/status/disconnect routes, Settings UI (see plan §P2)
- [ ] Set real `META_TOKEN_KEY` in `.env.local` (`openssl rand -base64 32`) before testing connect

## Blockers
- Prisma generate EPERM (Windows file lock) — running `next dev` (PID on :3000) holds the DLL. Stop dev server → generate → restart.

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
