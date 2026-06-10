---
name: bs-release-notes
description: "Update CHANGELOG.md before commit. Unskippable on feature, bugfix, and hotfix routes."
---

# bs-release-notes — Release Notes (Unskippable)

Must run before commit on feature, bugfix, and hotfix routes. Cannot be deferred.

## Pre-check

Read active task JSON. Verify `review` step is `done` (on routes that require it).
If not, run `/bs-review` first.

## Step 1: Summarise the change

Based on the task description and files changed, write a one-line summary:
- Feature: what new capability was added
- Bugfix: what was broken and is now fixed
- Hotfix: what production issue was resolved

## Step 2: Determine changelog section

| Change type | Section |
|------------|---------|
| New feature or capability | `### Added` |
| Bug fix | `### Fixed` |
| Behavior change | `### Changed` |
| Something removed | `### Removed` |

## Step 3: Update CHANGELOG.md

Add the entry under `## [Unreleased]`:

```markdown
## [Unreleased]

### Added
- Poster generation with SifuTutor/NakNgaji brand context injection (#branch)

### Fixed
- Brief intake skipping validation when optional fields are empty
```

Keep entries concise. One line per change. Start with a capital letter. No period at end.

## Step 4: Update task state

Set `release-notes` step in task JSON to `done` with evidence = "CHANGELOG.md updated".

## Step 5: Report

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RELEASE NOTES — DONE ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Added to CHANGELOG.md [Unreleased]:
  ### <section>
  - <entry>

Ready for: /bs-commit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

$ARGUMENTS
