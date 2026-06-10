---
name: bs-start
description: "Guided feature workflow from idea to code. Use when the user has a new feature idea and needs to be walked through planning step by step."
---

# bs-start — Guided Feature Workflow

Walk the user from a vague idea to a clear plan, then into code. Never skip phases.

## Phase 1: What are we building?

Use AskUserQuestion. One question at a time.

**Q1: What do you want to do?**
- Build something new (new screen, feature, or page)
- Improve something existing
- Fix something broken
- Not sure yet

**Q2: Describe it in one sentence.**
(Free text — what should the user be able to do?)

**Q3: Which brand is this for?**
- SifuTutor
- NakNgaji
- Both
- Not brand-specific

**Q4: Which team will use this?**
- Marketing team (hooks, copy, content)
- Creative team (poster, storyboard, script)
- Both / Admin

**Q5: Which output type does this relate to?**
- Poster (image generation)
- Hook & Copy (text variations)
- Storyboard
- Video Script
- Not related to output generation

## Phase 2: Fill in the gaps

Based on answers, ask 2–4 targeted follow-ups:
- "What does the user see first when they open this?"
- "What information does the user need to provide?"
- "What does success look like? What does the user get at the end?"
- "Is there anything similar already in the app?"
- "Who should NOT have access to this?"

## Phase 3: Save design doc

Write a design doc to `.claude/plans/YYYY-MM-DD-<slug>.md`:

```markdown
# Design: <feature name>
Date: <date>
Brand: <brand>
Output type: <type>
Team: <team>

## Problem
<one sentence>

## What we're building
<2–3 sentences>

## User flow
1. ...
2. ...

## Data
- Models affected: <Prisma models>
- New fields needed: <if any>

## API routes needed
- GET/POST /api/...

## Edge cases
- ...

## Assumptions
- ...
```

## Phase 4: What's next?

Ask: "What would you like to do next?"
- Run `/bs-task-router` to start the formal workflow → recommended
- Keep designing (more questions)
- Save and come back later

$ARGUMENTS
