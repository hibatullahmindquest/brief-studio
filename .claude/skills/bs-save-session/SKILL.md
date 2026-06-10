---
name: bs-save-session
description: "End-of-session knowledge save. Updates GOALS.md active task, saves non-obvious learnings to .claude/memory/, and summarises what was done."
---

# bs-save-session — End of Session

Run at the end of every working session before closing.

## Step 1: Summarise the session

List:
- What was completed today (bullet points)
- What's in progress (current step in active task)
- What's next (immediate next step after resume)
- Any blockers discovered

## Step 2: Update GOALS.md

Update the `## Active Task` section at the bottom of GOALS.md:

```markdown
## Active Task (update every session)

> Last updated: <date>

**Phase:** <phase name>
**Task:** <current task description>
**Status:** <current step> — <brief status>
**Next:** <exact next action after resume>
**Blockers:** <none / describe>
```

## Step 3: Save non-obvious learnings

For each thing discovered during the session that is NOT obvious from the code:
- API behaviour quirks (e.g. "gpt-image-2 returns base64, needs conversion before saving")
- Prisma edge cases
- Next.js App Router gotchas
- Brand context injection patterns that work vs don't
- Any debugging path taken and root cause found

Save to `.claude/memory/MEMORY.md` (append, newest first):

```markdown
## <date> — <short title>

**Context:** <what we were building>
**Discovery:** <what was learned>
**Impact:** <why this matters>
**Source:** <observed / user-stated / debugging>
```

## Step 4: Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION SAVED ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Done today:
  - <item>

Current: <step> on task <task-id>
Next: <action>

Memory saved: <n> new entries
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

$ARGUMENTS
