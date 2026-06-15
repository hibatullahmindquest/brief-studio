# WORKFLOW.md — brief-studio

> Full workflow reference. AGENTS.md is the wallet card. This is the full detail.
> Claude must check `.claude/tasks/active.json` before starting any task.


## Task Routes

Every task follows a **route**. Use `/bs-task-router` at the start of every task to select the right route and create the workflow state file.

| Route | When to use | Branch prefix | Gates required |
|-------|------------|---------------|---------------|
| `feature` | New functionality | `feat/` | verify + review + release-notes |
| `bugfix` | Non-urgent bug | `fix/` | verify + review + release-notes |
| `hotfix` | Production broken | `fix/` | verify + release-notes |
| `small-change` | Label, config, minor UI | `fix/` or `chore/` | verify |
| `refactor` | Code restructuring, zero behavior change | `refactor/` | verify + review |
| `docs` | Documentation only | `docs/` | build check |


## Route Step Definitions

### Feature (full pipeline)

```
brainstorm → prd → ux → build-prompts → build → verify → review → release-notes → commit → push
```

| # | Step | Prerequisite | Evidence required |
|---|------|-------------|-------------------|
| 1 | brainstorm | none | Design output saved to `.claude/plans/` |
| 2 | prd | brainstorm | PRD file path |
| 3 | ux | prd | UX spec file path |
| 4 | build-prompts | ux | Build prompts file path |
| 5 | build | build-prompts | Per-prompt loop (see below) |
| 6 | verify | build | lint + tsc + build — zero errors |
| 7 | review | verify | Review output — zero critical issues |
| 8 | release-notes | review | CHANGELOG.md updated |
| 9 | commit | release-notes | Commit SHA |
| 10 | push | commit | User permission granted + push output |

#### Per-prompt loop (step 5)
Each build prompt follows: `implement → /bs-review → user confirms "next"`

### Bugfix

```
describe → diagnose → fix → verify → review → release-notes → commit
```

| # | Step | Prerequisite | Evidence required |
|---|------|-------------|-------------------|
| 1 | describe | none | Bug description + expected vs actual |
| 2 | diagnose | describe | Root cause identified |
| 3 | fix | diagnose | Files changed |
| 4 | verify | fix | lint + tsc + build — zero errors |
| 5 | review | verify | Review output — zero critical issues |
| 6 | release-notes | review | CHANGELOG.md updated |
| 7 | commit | release-notes | Commit SHA |

### Hotfix

```
describe → fix → verify → release-notes → commit
```

| # | Step | Prerequisite | Evidence required |
|---|------|-------------|-------------------|
| 1 | describe | none | Bug + reproduction steps |
| 2 | fix | describe | Files changed |
| 3 | verify | fix | lint + tsc + build — zero errors |
| 4 | release-notes | verify | CHANGELOG.md updated |
| 5 | commit | release-notes | Commit SHA |

### Small Change

```
describe → fix → verify → commit
```

| # | Step | Prerequisite | Evidence required |
|---|------|-------------|-------------------|
| 1 | describe | none | What's changing and why |
| 2 | fix | describe | Files changed |
| 3 | verify | fix | lint + build pass |
| 4 | commit | verify | Commit SHA |

### Refactor

```
describe → analyze → plan → refactor → verify → review → commit
```

| # | Step | Prerequisite | Evidence required |
|---|------|-------------|-------------------|
| 1 | describe | none | What's being refactored and why |
| 2 | analyze | describe | Analysis output |
| 3 | plan | analyze | Change plan |
| 4 | refactor | plan | Files changed |
| 5 | verify | refactor | lint + tsc + build — zero errors |
| 6 | review | verify | Review output — zero critical issues |
| 7 | commit | review | Commit SHA |

### Docs

```
describe → write → verify → commit
```

| # | Step | Prerequisite | Evidence required |
|---|------|-------------|-------------------|
| 1 | describe | none | What docs are changing |
| 2 | write | describe | Files changed |
| 3 | verify | write | Build passes |
| 4 | commit | verify | Commit SHA |


## Quality Gates

### Gate 1 — Verify (unskippable on all routes except docs)

```bash
npm run lint          # zero errors
npx tsc --noEmit      # zero errors
npm run build         # build success
```

Claude must run all three. If any fails, fix before proceeding. Cannot be skipped under any circumstance.

### Gate 2 — Review (unskippable on feature, bugfix, hotfix, refactor)

Two-stage review:
1. **Spec compliance** — does the code do what the task brief said?
2. **Code quality** — correctness, security, edge cases, Prisma usage, API route auth

Zero critical issues required before proceeding to release-notes.

### Gate 3 — Release Notes (unskippable on feature, bugfix, hotfix)

Update `CHANGELOG.md` under `[Unreleased]` section:
- `### Added` for new features
- `### Fixed` for bug fixes
- `### Changed` for behavior changes
- `### Removed` for removed functionality

Must be done before commit. Cannot be deferred.


## Unskippable Steps

These steps can NEVER be skipped regardless of user request:
- `verify` (lint + tsc + build must pass)
- `review` (on feature/bugfix/hotfix/refactor routes)
- `release-notes` (on feature/bugfix/hotfix routes)

If user requests a skip, Claude must surface the rule and offer to fix the underlying issue instead.


## Workflow State

State is tracked in `.claude/tasks/`. See `.claude/tasks/SCHEMA.md` for full schema.

- **One active task** at a time — tracked in `.claude/tasks/active.json`
- **Steps must complete in order** — Claude checks state before running each step
- **Evidence is mandatory** — every completed step records proof
- **Force-skip** only with explicit user permission — recorded and flagged


## Git Workflow

```
git checkout master && git pull
git checkout -b <type>/<short-desc>     # e.g. feat/poster-generation
# ... develop ...
/bs-verify
/bs-review
/bs-release-notes
/bs-commit
# Ask user permission before push
git push -u origin <branch>
gh pr create --repo hibatullahmindquest/brief-studio --base master
```

**Never push without explicit user permission.**

### ⚠️ FORK WARNING — pin the repo on every PR

This repo is a **GitHub fork** of `mouadhhhallem/postforge-ai`. `gh pr create`
and the GitHub "Compare & pull request" banner **default the base to the
upstream parent** — so an unpinned PR can land on PostForge by mistake.

**ALWAYS pin the fork** on PR create/merge:
```
gh pr create --repo hibatullahmindquest/brief-studio --base master --head <branch>
gh pr merge <n> --repo hibatullahmindquest/brief-studio --merge
```
- `gh repo set-default hibatullahmindquest/brief-studio` is set in this clone (re-run after a fresh clone).
- A PreToolUse hook (`.claude/hooks/guard-pr-repo.py`) **blocks** unpinned `gh pr create/merge`.
- NEVER open/merge a PR against `mouadhhhallem/postforge-ai`.
