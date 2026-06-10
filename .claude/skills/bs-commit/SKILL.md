---
name: bs-commit
description: "Create a conventional commit. Checks that verify + review + release-notes gates are done before committing."
---

# bs-commit — Conventional Commit

## Pre-check: Gate enforcement

Read active task JSON. Check that required gates are done for this route:

| Route | Required before commit |
|-------|----------------------|
| feature | verify ✅ + review ✅ + release-notes ✅ |
| bugfix | verify ✅ + review ✅ + release-notes ✅ |
| hotfix | verify ✅ + release-notes ✅ |
| small-change | verify ✅ |
| refactor | verify ✅ + review ✅ |
| docs | verify ✅ |

If any required gate is not `done`, BLOCK and show what's missing.

## Step 1: Gather changes

Run `git status` and `git diff --staged` to see what's staged.
If nothing staged, ask: "Which files should be committed?"

## Step 2: Draft commit message

Conventional commit format:
```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`
Scope: module or feature name (e.g. `studio`, `brand`, `auth`, `brief`, `poster`)

Examples:
- `feat(studio): add poster generation with brand context injection`
- `fix(brief): validate all required fields before triggering generation`
- `chore(db): add FeatureRun feedback field migration`
- `docs(readme): update local dev setup instructions`

Show draft to user. Ask for confirmation or edits.

## Step 3: Commit

```bash
git add <files>
git commit -m "<message>"
```

## Step 4: Update task state

Set `commit` step in task JSON to `done` with commit SHA as evidence.

## Step 5: Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMITTED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<commit SHA>
<commit message>

Files: <n> changed

Next: ask user permission before push
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Never push without explicit user permission.**

$ARGUMENTS
