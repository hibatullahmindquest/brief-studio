# STATUS — brief-studio

## Current Phase
Phase 0 — Project setup & base cleanup

## Last Done
- Forked postforge-ai → hibatullahmindquest/brief-studio
- Removed Stripe (routes + package)
- Removed: checkout, pricing, offerings, approach, community pages
- Switched SQLite → PostgreSQL in Prisma schema
- Added Brand model to schema
- Updated FeatureRun: added brandId, feedback, feedbackNote, title
- Added teamRole + isAdmin to User model
- Updated .env.example, package.json name, CLAUDE.md, GOALS.md, STATUS.md

## Next Todo
- [ ] Run `npm install` to update lockfile (remove stripe, add pg)
- [ ] Scan remaining source files for Stripe imports and remove them
- [ ] Create PostgreSQL database `brief_studio` locally
- [ ] Run `prisma migrate dev` to generate initial migration
- [ ] Check existing generate/ideas API routes — understand current flow
- [ ] Build brand context builder (`src/lib/brand-context.ts`)
- [ ] Build brief intake API + UI (core feature)

## Blockers
- none

## Notes
- Base: postforge-ai fork (MIT license)
- Stack: Next.js 16, React 19, TypeScript, Tailwind v4, Prisma + PostgreSQL, OpenAI SDK v6
- Keep: Instagram OAuth, Virality, Plan, Campaign, Calendar, Notes
- Remove only: Stripe
- Node on KVM8: v22.22.3
- No Vercel-specific APIs — deploy via PM2 on KVM8
