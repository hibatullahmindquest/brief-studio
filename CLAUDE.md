# brief-studio — Claude Code Configuration

## Session Start — Read These First

**Every session, before any work:**
1. Read `GOALS.md` — current phase, active task, blockers
2. Read `AGENTS.md` — critical rules, command index
3. Check `RULES.md` — rules Claude follows every session
4. Check `.claude/tasks/active.json` — resume any in-progress task

**Full references:**
- `CONTEXT.md` — domain glossary (Brand, FeatureRun, output types, team roles)
- `WORKFLOW.md` — task routes, step definitions, quality gates
- `CHANGELOG.md` — release history
- `.claude/memory/MEMORY.md` — accumulated session learnings

## Project identity

- **Path**: `C:\claude\workspace\brief-studio`
- **Repo**: `github.com/hibatullahmindquest/brief-studio`
- **Base**: Forked from `mouadhhhallem/postforge-ai` (MIT License)
- **Stack**: Next.js 16.1.6, React 19, TypeScript 5, Tailwind v4, PostgreSQL 16
- **ORM**: Prisma 4.16.2 (postgresql provider)
- **AI**: OpenAI SDK v6 — `gpt-image-2` (images), `gpt-4o` (text/brief conversation)
- **Deploy**: KVM8 VPS (Hostinger) via PM2 — local dev dulu

## Purpose

AI-powered creative workspace untuk pasukan SifuTutor/NakNgaji (7 orang internal).

**Core flow:** pilih brand → pilih output type → brief intake soalan demi soalan → AI generate output → simpan ke history

**MVP output types:**
- Poster / image generation (gpt-image-2)
- Hook & copywriting
- Storyboard
- Video script & shooting plan

**Inherited dari PostForge (keep):**
- Instagram OAuth + Meta API integration
- Virality analysis
- Content plan
- Campaign tracker
- Content calendar
- Notes

**Removed dari PostForge:**
- Stripe billing (checkout, pricing, offerings pages)

## Brands

| Brand | Slug |
|-------|------|
| SifuTutor | sifututor |
| NakNgaji | nakngaji |

Brand guidelines (warna, tone, audience, dont_say, tagline) editable via admin web UI.
Injected sebagai structured context ke setiap AI generation call.

## Team roles

| Role | Access |
|------|--------|
| `marketing` | hooks, copy, content plan, virality, ideas |
| `creative` | poster, storyboard, video script, shooting plan |
| `admin` | brand management, user management, semua features |

## Dev environment (local)

```bash
# Pastikan Docker Desktop running dulu (PostgreSQL container)
docker start brief-studio-db

npm install
npm run dev          # localhost:3000 (atau 3001 kalau port in use)
npm run build        # production build check
npm run lint
```

**Database (local dev):**
```bash
# Docker PostgreSQL container
docker run -d --name brief-studio-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=brief_studio \
  -p 5432:5432 --restart unless-stopped postgres:16

# Prisma migrate
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" npx prisma migrate dev
```

**Create/reset admin:**
```bash
ADMIN_EMAIL="..." ADMIN_PASSWORD="..." ADMIN_NAME="..." \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" \
npx tsx scripts/create-admin.ts
```

Admin credentials disimpan dalam `.env.local` (gitignored).

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/        — login, logout, signup, me
│   │   ├── generate/    — core generation endpoint
│   │   ├── ideas/       — ideas generation
│   │   ├── brief/       — brief intake flow (TODO: build)
│   │   ├── brand/       — brand CRUD (TODO: build)
│   │   ├── instagram/   — Meta OAuth + stats
│   │   ├── virality/    — virality analysis
│   │   ├── plan/        — content plan
│   │   ├── campaigns/   — campaign tracker
│   │   ├── calendar/    — content calendar
│   │   ├── notes/       — notes
│   │   ├── onboarding/  — user onboarding
│   │   └── settings/    — user settings
│   ├── dashboard/       — overview + recent history
│   ├── studio/          — main generation workspace
│   ├── login/
│   └── signup/
├── components/          — shared UI components
└── lib/
    ├── prisma.ts        — Prisma client
    ├── session.ts       — JWT session handling
    ├── rate-limit.ts    — rate limiting
    └── brand-context.ts — brand context builder (TODO: build)
```

## Key Prisma models

| Model | Purpose |
|-------|---------|
| `User` | teamRole (marketing/creative/admin), isAdmin |
| `Brand` | SifuTutor/NakNgaji profiles + guidelines + social handles |
| `FeatureRun` | semua generation history, linked to brand, ada feedback field |
| `Stats` | Instagram/Meta stats (igFollowers, igImpressions, etc.) |
| `Campaign` | campaign tracker |
| `CalendarEvent` | content calendar |
| `Note` | notes |
| `UserPreference` | default tone, brand preference |

## .env.local structure

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio"
SESSION_SECRET="..."
OPENAI_API_KEY="..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
META_APP_ID=""
META_APP_SECRET=""
ADMIN_EMAIL="..."
ADMIN_PASSWORD="..."
ADMIN_NAME="..."
```

## Git workflow

```bash
git checkout -b <type>/<short-desc>
git push -u origin <branch>
gh pr create --repo hibatullahmindquest/brief-studio --base master
```

No direct push ke `master`. Default branch: `master` (inherited dari PostForge fork).

### ⚠️ FORK — HARD RULE for PRs

This repo is a **fork** of `mouadhhhallem/postforge-ai`. `gh pr create`/the GitHub web banner **default to the upstream parent**, so an unpinned PR can mistakenly target PostForge.

- **ALWAYS pin the fork** on create/merge:
  `gh pr create --repo hibatullahmindquest/brief-studio --base master`
  `gh pr merge <n> --repo hibatullahmindquest/brief-studio --merge`
- **NEVER** open/merge a PR against `mouadhhhallem/postforge-ai`.
- Guards in place: `gh repo set-default` (this clone) + a PreToolUse hook (`.claude/hooks/guard-pr-repo.py`) that blocks unpinned `gh pr create/merge`.

## Secret-handling — HARD RULE

Never commit `.env*`, API keys, tokens, passwords, credentials.
Values dalam `.env.local` sahaja (gitignored).

## KVM8 deployment (planned)

- PM2 process name: `brief-studio`
- Node version: v22.22.3
- PostgreSQL: native install pada KVM8, DB name `brief_studio`
- Image storage: `/var/www/brief-studio/public/uploads/generated/`
- No Docker pada VPS — native PostgreSQL terus

## Conventions

- No Vercel-specific APIs (no Edge Runtime, no Vercel Blob, no Vercel KV)
- File storage: local filesystem
- Prisma migrations applied manually before deploy ke KVM8
- Update `STATUS.md` selepas every significant step
- Plans/design docs: `docs/plans/` (TODO: create folder)
