# STATUS — brief-studio

## Current Phase
Phase 2 — Brand context wired, studio page rebuild next

## Last Done
- Built `src/lib/brand-context.ts` — load brand dari DB, build AI prompt block
- Updated `src/lib/openai.ts` — generateCopy() kini terima BrandContext, inject brand guidelines ke system prompt
- Updated `src/app/api/generate/route.ts` — terima brandSlug, load context dari DB, pass ke AI
- Seeded SifuTutor + NakNgaji brand data ke DB via `scripts/seed-brands.ts`
- TypeScript clean — zero errors

## Next Todo
- [ ] Rebuild studio page — brand picker → output type → brief intake → generate
- [ ] Build brief intake flow API + UI (soalan demi soalan, Cara C)
- [ ] Build `src/app/api/brand/` — CRUD untuk brand profiles (admin UI Phase B)

## Blockers
- none

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
