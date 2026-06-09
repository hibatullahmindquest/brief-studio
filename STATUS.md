# STATUS — brief-studio

## Current Phase
Phase 0 — Project setup selesai, belum start development

## Last Done
- Forked `mouadhhhallem/postforge-ai` → `hibatullahmindquest/brief-studio`
- Remove Stripe (routes, package, stripe.ts, checkout-form.tsx)
- Switch SQLite → PostgreSQL dalam Prisma schema
- Tambah `Brand` model (SifuTutor/NakNgaji)
- Extend `FeatureRun`: brandId, feedback, feedbackNote, title
- Tambah `teamRole` + `isAdmin` ke `User` model
- Remove old SQLite migrations, generate fresh PostgreSQL migration
- Docker PostgreSQL container running (brief-studio-db, port 5432)
- Prisma migrate dev — DB `brief_studio` synced
- Admin user created: admin@local.com (credentials dalam .env.local)
- CLAUDE.md, GOALS.md, STATUS.md updated dan accurate
- Root C:\claude\CLAUDE.md updated — brief-studio registered dalam workspace

## Next Todo
- [ ] Test login di localhost:3001 dengan admin credentials
- [ ] Explore existing `generate` + `ideas` API routes — faham current flow
- [ ] Explore existing `studio` page — faham current UI
- [ ] Build `src/lib/brand-context.ts` — brand context builder untuk AI calls
- [ ] Build `src/app/api/brand/` — CRUD untuk brand profiles (SifuTutor/NakNgaji)
- [ ] Build brief intake API + UI (core feature — soalan demi soalan)
- [ ] Seed brand data (SifuTutor + NakNgaji) via script atau admin UI
- [ ] Create docs/plans/ folder untuk design docs

## Blockers
- OPENAI_API_KEY belum diisi dalam .env.local — perlu isi sebelum test generation

## Technical Notes

**Local dev setup:**
- Docker Desktop mesti running sebelum `npm run dev`
- PostgreSQL container: `brief-studio-db` (docker start brief-studio-db)
- Dev server: `npm run dev` → localhost:3000 atau 3001
- DB: `postgresql://postgres:postgres@localhost:5432/brief_studio`

**Stack:**
- Next.js 16.1.6, React 19, TypeScript 5, Tailwind v4
- Prisma 4.16.2 + PostgreSQL 16 (Docker local, native KVM8)
- OpenAI SDK v6 (gpt-image-2 images, gpt-4o text)
- Auth: custom JWT session (SESSION_SECRET dalam .env.local)

**Decisions made:**
- Fork PostForge AI (MIT) sebagai base — bukan buat dari scratch
- Keep: Instagram OAuth, Virality, Plan, Campaign, Calendar, Notes
- Remove: Stripe billing sahaja
- Brief intake: Cara C (structured template + AI follow-up)
- Multi-brand: Brand model baru, setiap FeatureRun linked ke brand
- Team separation via teamRole field pada User
- Deploy: KVM8 VPS native PostgreSQL + PM2 (no Docker on VPS)
- Default branch: master (inherited dari fork)
