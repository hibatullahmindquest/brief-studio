# brief-studio — Claude Code Configuration

## Project identity

- **Path**: `C:\claude\workspace\brief-studio`
- **Repo**: `github.com/hibatullahmindquest/brief-studio`
- **Base**: Forked from `mouadhhhallem/postforge-ai` (MIT)
- **Stack**: Next.js 16, React 19, TypeScript 5, Tailwind v4, PostgreSQL
- **ORM**: Prisma (PostgreSQL provider)
- **AI**: OpenAI SDK v6 — `gpt-image-2` (images), `gpt-4o` (text/brief)
- **Deploy**: KVM8 VPS (Hostinger) via PM2

## Purpose

AI-powered creative workspace untuk pasukan SifuTutor/NakNgaji.

Flow: pilih brand → pilih output type → brief intake (soalan demi soalan) → AI generate output → simpan ke history.

**Output types (MVP):**
- Poster / image generation (gpt-image-2)
- Hook & copywriting
- Storyboard
- Video script & shooting plan

## Brands

| Brand | Slug |
|-------|------|
| SifuTutor | sifututor |
| NakNgaji | nakngaji |

Brand guidelines editable via admin web UI. Injected as structured context into every AI call.

## Team roles

| Role | Access |
|------|--------|
| `marketing` | hooks, copy, content plan, virality, ideas |
| `creative` | poster, storyboard, video script, shooting plan |
| `admin` | brand management, user management, all features |

## Dev environment

```bash
npm install
npm run dev          # localhost:3000
npm run db:migrate   # prisma migrate dev
npm run build        # production build
npm run lint
```

## Architecture

- `src/app/` — App Router pages + API routes
- `src/app/api/` — API handlers (auth, generate, brief, brand, instagram, etc.)
- `src/app/studio/` — main generation workspace
- `src/app/dashboard/` — overview + recent history
- `src/components/` — shared UI components
- `src/lib/` — db (Prisma client), auth, openai utils, brand context builder
- `prisma/schema.prisma` — DB schema

## Key models

- `User` — teamRole (marketing/creative/admin), isAdmin
- `Brand` — SifuTutor/NakNgaji profiles, guidelines, social handles
- `FeatureRun` — all generation history, linked to brand, with feedback
- `Stats` — Instagram/Meta stats per brand (via OAuth)

## Git workflow

```bash
git checkout -b <type>/<short-desc>
git push -u origin <branch>
gh pr create
```

No direct push to `main`.

## Secret-handling

Never commit `.env`, API keys, tokens, passwords.
Reference env var names only. Values in `.env.local` (gitignored).

## KVM8 deployment (future)

- PM2 process: `brief-studio`
- PostgreSQL: local on KVM8, DB name `brief_studio`
- Images: `/var/www/brief-studio/public/uploads/generated/`
- Node: v22.22.3

## Conventions

- No Vercel-specific APIs (no Edge Runtime, no Vercel Blob, no Vercel KV)
- File storage: local filesystem (dev), `/var/www/` path (prod)
- Prisma migrations applied manually before deploy
- Update `STATUS.md` after every significant step
