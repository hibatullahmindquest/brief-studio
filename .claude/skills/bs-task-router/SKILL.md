---
name: bs-task-router
description: "Route any task to the correct workflow. Run at the start of every task — classifies the task type, selects the route, creates the workflow state file, and shows the step pipeline."
---

# bs-task-router — Task Workflow Router

Run this at the start of EVERY task. Never skip.

## Step 1: Classify the task

Ask the user (using AskUserQuestion):

**"What type of work is this?"**
- New feature or functionality → `feature`
- Bug that's not urgent → `bugfix`
- Production is broken, fix now → `hotfix`
- Small change (label, config, minor UI tweak) → `small-change`
- Code restructuring, zero behavior change → `refactor`
- Documentation only → `docs`

## Step 2: Collect task details

Ask:
- "Describe the task in one sentence."
- "Which branch should this go on?" (suggest based on route)
- For feature: "Which output type does this relate to? (poster / hook-copy / storyboard / video-script / none)"
- For feature: "Which brand? (sifututor / nakngaji / both / none)"

## Step 3: Create workflow state file

Create `.claude/tasks/<task-id>.json` with:
- `id`: kebab-case slug from description
- `route`: selected route
- `created`: current timestamp
- `branch`: suggested branch name
- `description`: one-sentence description
- `steps`: array with all steps for the route, all set to `pending` except first which is `in_progress`
- `metadata`: outputType, brand, affectedFiles (empty)

Update `.claude/tasks/active.json` with the new task.

## Step 4: Show the pipeline

Display the step pipeline for the selected route:

```
Route: <route>
Branch: <branch>

Steps:
  ▶ 1. <current step> (in_progress)
    2. <next step> (pending)
    3. ...

Gates on this route: <list unskippable gates>
```

## Step 5: Begin first step

Proceed immediately to the first step of the route. Do not wait.

$ARGUMENTS
