# STATUS — brief-studio

## Current Phase
Phase 2 — Studio Wizard DONE, ready for browser verification + PR

## Last Done
- Studio Wizard fully built and committed to `feat/studio-wizard`
- Brand picker, output type picker, scripted Q&A (4 output types, 20 questions), brief review, generation result
- Brand context injection wired: getBrandContext() → AI system prompt
- Scripted conversation engine: conversation-engine.ts
- GET /api/brand endpoint
- briefAnswers passed into generateCopy prompt
- Studio added to nav
- Brand data seeded (SifuTutor + NakNgaji) via scripts/seed-brands.ts
- verify gate passed: lint ✅ tsc ✅ build ✅
- review: fixed ConversationStep state bleed between questions (key={question.id})
- All committed: 284f1df

## Next Todo
- [ ] Start dev server + browser test Studio wizard full flow (`npm run dev` → localhost:3000/studio)
- [ ] Create PR: feat/studio-wizard → master (`gh pr create`)
- [ ] Phase 3 planning (see GOALS.md for deferred decisions + KIV list)

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
