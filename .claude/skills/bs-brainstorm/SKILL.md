---
name: bs-brainstorm
description: "Design session before building. Run before any new feature to explore approaches, surface edge cases, and make key decisions. Brand-context and output-type aware."
---

# bs-brainstorm — Design Session

Never start building without running this first on feature tasks.

## What this does

Explores a feature idea from multiple angles before any code is written. Surfaces:
- Approach options with tradeoffs
- Brand context implications
- Edge cases and failure modes
- Key decisions that need to be made

## Step 1: Read context

Before brainstorming, read:
- `GOALS.md` — current phase and active task
- `CONTEXT.md` — domain terms and brand definitions
- `CLAUDE.md` — architecture and key files
- The active task description from `.claude/tasks/active.json`

## Step 2: Explore approaches

For the feature being built, generate 2–3 distinct approaches:

```
Approach A: <name>
- How it works: ...
- Pros: ...
- Cons: ...
- Brand context impact: ...

Approach B: <name>
- How it works: ...
- Pros: ...
- Cons: ...
- Brand context impact: ...
```

## Step 3: Surface edge cases

Think through:
- What happens if the brand context is incomplete?
- What happens if the OpenAI API call fails?
- What happens if the user abandons mid-brief?
- What happens if the output doesn't meet expectations?
- Role access — who can and cannot use this?

## Step 4: Key decisions

List decisions that must be made before building:
- [ ] Which approach to use
- [ ] Which Prisma models are affected
- [ ] New API routes needed
- [ ] UI state handling (loading, error, empty)

## Step 5: Recommendation

Give a clear recommendation with one-line rationale. Ask user to confirm before proceeding.

## Step 6: Save output

Save brainstorm output to `.claude/plans/YYYY-MM-DD-<slug>-brainstorm.md`.
Update the `brainstorm` step in the active task JSON to `done` with evidence = file path.

$ARGUMENTS
