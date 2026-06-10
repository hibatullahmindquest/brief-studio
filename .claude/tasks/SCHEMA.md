# Workflow State Schema — brief-studio

## Overview

Every task follows a **route** with tracked **steps**. State is stored in `.claude/tasks/` as JSON files.
Claude checks this state before every action and updates it after each step.

## Files

| File | Purpose |
|------|---------|
| `active.json` | Points to the current active task |
| `<task-id>.json` | Workflow state for a specific task |

## active.json Format

```json
{
  "activeTask": "poster-generation",
  "taskFile": ".claude/tasks/poster-generation.json",
  "route": "feature"
}
```

Set `activeTask` to `null` when no task is in progress:
```json
{
  "activeTask": null,
  "taskFile": null,
  "route": null
}
```

## Workflow State Format

```json
{
  "id": "poster-generation",
  "route": "feature | bugfix | hotfix | small-change | refactor | docs",
  "created": "2026-06-10T10:00:00Z",
  "branch": "feat/poster-generation",
  "description": "Add AI poster generation with brand context injection",
  "steps": [
    {
      "name": "brainstorm",
      "status": "done | in_progress | pending | blocked | skipped",
      "at": "2026-06-10T10:05:00Z",
      "evidence": "Design saved to .claude/plans/2026-06-10-poster-generation.md"
    }
  ],
  "metadata": {
    "outputType": "poster | hook-copy | storyboard | video-script | null",
    "brand": "sifututor | nakngaji | null",
    "affectedFiles": [],
    "buildPromptsFile": null,
    "currentPrompt": null,
    "totalPrompts": null
  }
}
```

## Step Statuses

| Status | Meaning |
|--------|---------|
| `done` | Completed with evidence |
| `in_progress` | Currently being worked on |
| `pending` | Ready to start (prerequisites met) |
| `blocked` | Cannot start (prerequisites not met) |
| `skipped` | Explicitly skipped by user (reason recorded) |

## Enforcement Rules

1. Claude checks `active.json` before starting any step.
2. Steps must complete in order — prerequisites enforced.
3. `verify` step can NEVER be skipped.
4. `review` step can NEVER be skipped on feature/bugfix/hotfix/refactor routes.
5. `release-notes` step can NEVER be skipped on feature/bugfix/hotfix routes.
6. Force-skip only with explicit user permission — recorded as `"status": "skipped", "reason": "user: <reason>"`.
7. Skipped steps must be flagged in PR description.
8. On task completion, set `active.json` `activeTask` back to `null`.

## Verify Evidence Format

```json
{
  "name": "verify",
  "status": "done",
  "at": "2026-06-10T11:00:00Z",
  "evidence": {
    "lint": "passed",
    "tsc": "passed",
    "build": "passed"
  }
}
```

## Review Evidence Format

```json
{
  "name": "review",
  "status": "done",
  "at": "2026-06-10T11:10:00Z",
  "evidence": {
    "stage1_spec_compliance": "passed",
    "stage2_code_quality": "passed",
    "critical_issues": 0,
    "notes": "..."
  }
}
```
