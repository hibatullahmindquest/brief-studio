---
name: bs-review
description: "Two-stage code review before commit. Stage 1: spec compliance. Stage 2: code quality, security, edge cases. Unskippable on feature/bugfix/hotfix/refactor routes."
---

# bs-review — Two-Stage Code Review

This gate can NEVER be skipped on feature, bugfix, hotfix, and refactor routes.

## Pre-check

1. Read active task JSON — verify `verify` step is `done`. If not, run `/bs-verify` first.
2. Read the task brief (description + any plan file) to know what was supposed to be built.

## Stage 1: Spec Compliance

Check: does the code actually do what the task brief said?

For each requirement in the brief:
- [ ] Is it implemented?
- [ ] Is it complete (not partial)?
- [ ] Does it handle the expected inputs/outputs?

Check brand context rules:
- [ ] Every AI generation call injects brand context
- [ ] No brand values hardcoded in code
- [ ] Brand is read from DB, not config

Check access control:
- [ ] New API routes are protected by session auth middleware
- [ ] Team role checks enforced where required (marketing/creative/admin)

## Stage 2: Code Quality

Check for:

**Correctness**
- [ ] No logic errors in generation flow
- [ ] Error handling at API boundaries (OpenAI failures, DB failures)
- [ ] Async/await used correctly, no unhandled promises

**Security**
- [ ] No secrets in code
- [ ] User input validated server-side before use
- [ ] No SQL injection risk in raw queries (prefer Prisma)
- [ ] Auth check on every new API route

**Prisma usage**
- [ ] Migrations created for schema changes
- [ ] Relations used correctly
- [ ] No N+1 query patterns

**File storage**
- [ ] Generated images saved as file path, never base64 blob in DB
- [ ] Upload path uses `public/uploads/generated/`

**Edge cases**
- [ ] What if OpenAI API times out or returns an error?
- [ ] What if brand context is incomplete?
- [ ] What if user has wrong team role?

## Report format

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODE REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STAGE 1 — SPEC COMPLIANCE: PASS / FAIL
<findings if any>

STAGE 2 — CODE QUALITY: PASS / FAIL
Critical issues: <n>
  ❌ [CRITICAL] <issue>
  ⚠️  [WARN] <issue>
  💡 [SUGGEST] <suggestion>

VERDICT: PASS / FAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## On FAIL

Fix all critical issues. Re-run `/bs-verify` after fixes. Then re-run `/bs-review`.

## On PASS

Update `review` step in task JSON to `done` with evidence.
Run `/bs-next` to proceed.

$ARGUMENTS
