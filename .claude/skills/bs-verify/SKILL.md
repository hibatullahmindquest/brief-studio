---
name: bs-verify
description: "Run lint + TypeScript check + build. Unskippable quality gate before review or commit. Must pass zero errors."
---

# bs-verify — Verify Gate (Unskippable)

This gate can NEVER be skipped. If any check fails, fix before proceeding.

## Step 1: Check active task

Read `.claude/tasks/active.json`. Verify that `verify` step is the current or next step.
If verify step is `blocked` (prerequisites not met), show what's missing and stop.

## Step 2: Run all checks

Run these three commands in sequence:

```bash
npm run lint
```
Expected: zero errors, zero warnings (warnings are okay if lint config allows them)

```bash
npx tsc --noEmit
```
Expected: zero errors

```bash
npm run build
```
Expected: build success, no compilation errors

## Step 3: Handle failures

If any check fails:
- Show the full error output
- Identify the root cause
- Fix the issue
- Re-run the failed check
- Do NOT proceed until all three pass

## Step 4: Record evidence

Update the `verify` step in the active task JSON:

```json
{
  "name": "verify",
  "status": "done",
  "at": "<date>",
  "evidence": {
    "lint": "passed",
    "tsc": "passed",
    "build": "passed"
  }
}
```

## Step 5: Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFY GATE — PASSED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
lint:   ✅ passed
tsc:    ✅ passed
build:  ✅ passed

Ready for: /bs-review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Run `/bs-next` to proceed to the next step.

$ARGUMENTS
