# AGENTS.md — brief-studio
**Wallet card. Read WORKFLOW.md for full detail on every route, step, and gate.**


## 1. Setup Commands

```bash
# Start DB (Docker must be running)
docker start brief-studio-db

# Install & run
npm install
npm run dev           # localhost:3000
npm run build         # production build check
npm run lint          # ESLint check
npx tsc --noEmit      # TypeScript check

# Prisma
npx prisma migrate dev
npx prisma studio

# Create/reset admin
ADMIN_EMAIL="..." ADMIN_PASSWORD="..." ADMIN_NAME="..." \
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" \
npx tsx scripts/create-admin.ts
```


## 2. NEVER SKIP — Critical Rules

1. **NEVER commit `.env*`, API keys, brand data, or credentials** — gitignored, stays in `.env.local` only.
2. **NEVER mix brand profiles** — each generation call must inject only the requested brand's context.
3. **NEVER store generated images in DB** — store file path or URL only, never base64 blob.
4. **NEVER skip brief validation before triggering generation** — all required brief fields must be present.
5. **NEVER push to `master` directly** — always branch → PR.
6. **NEVER bypass hooks** with `--no-verify` or equivalent.
7. **SURGICAL CHANGES ONLY** — every changed line must trace to a requirement in the task brief.
8. **ALWAYS inject brand context** in every AI generation call — includes tone, audience, dont_say, tagline.
9. **ALWAYS update `GOALS.md` active task** at the end of every session.
10. **ALWAYS read `GOALS.md` first** before starting any work in a new session.
11. **VALIDATE user input server-side** — client-side checks are not enough.
12. **EVERY NEW API ROUTE** must be protected by session auth middleware.
13. **TEAM ROLE ACCESS** must be enforced per feature — marketing, creative, admin scopes defined in CONTEXT.md.
14. **VERIFY gate is unskippable** — lint + build must pass zero errors before review.
15. **REVIEW gate is unskippable** — code review must complete before commit.
16. **RELEASE NOTES gate is unskippable** — CHANGELOG.md must be updated before commit.


## 3. Brief Template

```
File:        .claude/plans/YYYY-MM-DD-<slug>.md
Goal:        One sentence — what to build or change
Context:     Relevant files (paths confirmed) + DB models affected
Constraints: Task-specific only — global rules live in AGENTS.md, never repeat them
Done When:   Exact commands + expected output (tsc 0 errors, lint 0 errors, build pass)
Depends On:  Previous task that must be merged first, or "none"
```

Before starting: confirm all file paths exist, all Prisma models identified.
Self-review before reporting: Did I implement everything in Goal? Did I stay in Constraints? Do Done When commands pass?
Report format: Status (PASS/FAIL/PARTIAL) → Files changed → Unexpected changes → Blockers.


## 4. Skill Index

| Skill | Purpose |
|-------|---------|
| `bs-task-router` | Classify task → select route → create state file |
| `bs-start` | Guided workflow from idea to code |
| `bs-brainstorm` | Design session before building — brand-context aware |
| `bs-next` | Show next unblocked step + progress dashboard |
| `bs-commit` | Conventional commit with CHANGELOG draft |
| `bs-verify` | Lint + build + tsc check (unskippable gate) |
| `bs-review` | Two-stage code review (spec compliance + code quality) |
| `bs-release-notes` | Update CHANGELOG.md before commit |
| `bs-save-session` | End-of-session memory save + GOALS.md update |


## 5. Command Index

| Command | What it does |
|---------|-------------|
| `/bs-task-router` | Start any task — classifies and sets up workflow state |
| `/bs-start` | Guided feature workflow from idea |
| `/bs-brainstorm` | Design session before any new feature |
| `/bs-next` | Show next unblocked step |
| `/bs-verify` | Run lint + build + tsc — must pass before review |
| `/bs-review` | Two-stage code review |
| `/bs-commit` | Create conventional commit |
| `/bs-release-notes` | Update CHANGELOG.md |
| `/bs-save-session` | Save session learnings, update GOALS.md |
