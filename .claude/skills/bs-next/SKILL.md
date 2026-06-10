---
name: bs-next
description: "Show the next unblocked step in the current task workflow. Use after completing any step to see what comes next."
---

# bs-next — Next Unblocked Step

## Step 1: Read current state

Read `.claude/tasks/active.json` to get the active task file path.
Read the active task JSON file.

## Step 2: Find next step

Scan steps array for:
1. First step with status `in_progress` → this is the current step, show evidence needed
2. First step with status `pending` after all `done` steps → this is the next step

## Step 3: Display dashboard

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TASK: <description>
ROUTE: <route> | BRANCH: <branch>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROGRESS:
  ✅ 1. brainstorm
  ✅ 2. prd
  ▶  3. ux  ← current
     4. build-prompts (pending)
     5. build (pending)
     6. verify (pending)
     7. review (pending)
     8. release-notes (pending)
     9. commit (pending)
    10. push (pending)

CURRENT STEP: ux
Evidence needed: UX spec file path saved to .claude/plans/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Step 4: Begin the step

Proceed with the current step immediately. Do not wait for user to say "go".

## Step 5: After step completes

Update the task JSON:
- Set completed step status to `done`
- Add `at` timestamp (use today's date)
- Add `evidence` string
- Set next step status to `in_progress`

Then show the updated dashboard automatically.

## If no active task

```
No active task. Run /bs-task-router to start one.
```

$ARGUMENTS
