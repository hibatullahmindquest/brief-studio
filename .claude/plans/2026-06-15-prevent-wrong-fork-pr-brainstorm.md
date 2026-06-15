# Brainstorm — Prevent PRs going to the wrong (upstream) repo

> Date: 2026-06-15 · Trigger: PR #10 accidentally opened against `mouadhhhallem/postforge-ai` (upstream) instead of our fork. Closed, no harm. How do we stop it recurring?

---

## Root cause
`hibatullahmindquest/brief-studio` is a **GitHub fork** of `mouadhhhallem/postforge-ai`. Two default behaviours point at the upstream parent:
1. **`gh pr create`** on a fork **defaults the base to the parent repo** (upstream) unless told otherwise.
2. GitHub's web **"Compare & pull request"** banner (shown after a push) also defaults to the upstream base.

So both CLI and web nudge toward the wrong target. Prevention = remove that default + guard against it.

---

## Prevention layers (defense in depth)

### L1 — Set gh's default repo (config; fixes the root default)
`gh repo set-default hibatullahmindquest/brief-studio`
- Makes every `gh pr`/`gh issue` in this clone target the **fork** by default — no flags to remember.
- **Pros:** fixes the actual default; one command; immediate.
- **Cons:** local to this clone (`.git/config`); must re-run on a fresh clone / other machine; doesn't stop the GitHub *web* banner.

### L2 — Documented hard rule (WORKFLOW.md + CLAUDE.md)
Add to the Git Workflow section + a one-line hard rule in CLAUDE.md (Claude reads it every session):
> **This repo is a FORK.** Always create PRs with the repo pinned:
> `gh pr create --repo hibatullahmindquest/brief-studio --base master`
> NEVER open a PR against `mouadhhhallem/postforge-ai`.
- **Pros:** portable (committed, travels with repo + every clone); lands in Claude's context each session so the agent follows it; covers the web-banner case (human reminder).
- **Cons:** soft guard — relies on reading/following, not enforced.

### L3 — Automated hook (settings.json PreToolUse) — hard enforcement
A `PreToolUse` Bash hook that inspects the command: if it's `gh pr create`/`gh pr merge` **without** `--repo hibatullahmindquest/brief-studio`, **block** it with a message ("pin the fork repo").
- **Pros:** actually prevents it regardless of memory; strongest guard; committed in `.claude/settings.json` so it's shared.
- **Cons:** more setup; must keep the matcher correct (avoid false blocks); slight friction.

### L4 — Bake into the workflow skill
Put the pinned `--repo … --base master` into the PR step of `WORKFLOW.md` Git section (and any ship/commit skill) so the canonical command is always correct.
- **Pros:** the "official" command is right by construction. **Cons:** doc-level (same class as L2).

---

## Edge cases
- **Fresh clone / new machine** → L1 must be re-run; L2+L3 are committed so they persist. → favour L2/L3 for durability.
- **GitHub web banner** → only L2 (human awareness) helps; CLI guards (L1/L3) don't touch the web.
- **False positives** (L3) → scope the matcher to `gh pr create`/`gh pr merge` only; allow if `--repo hibatullahmindquest/brief-studio` present.
- **Detaching the fork** (GitHub support) → removes the parent default entirely, but heavy/irreversible-ish; not worth it.
- No `upstream` git remote is configured (good) — but `gh` still learns the parent via the GitHub API, so removing remotes alone doesn't fix it.

---

## Key decisions
- [ ] **L1** — run `gh repo set-default` now? (recommend yes — instant root fix)
- [ ] **L2** — add the fork rule to WORKFLOW.md + CLAUDE.md? (recommend yes — durable + Claude follows it)
- [ ] **L3** — add a PreToolUse hook to hard-block unpinned `gh pr create/merge`? (recommend yes if you want it impossible to repeat; optional)
- [ ] Route to apply: **small-change** (config + docs) — verify gate only; or **docs** if just L2/L4.

---

## Recommendation (one line)
Do **L1 + L2 now** (set gh's default repo to the fork **and** document the pinned-`--repo` rule in WORKFLOW.md + CLAUDE.md so it's both fixed-by-default and Claude-followed-every-session), and add the **L3 PreToolUse hook** if you want hard, un-forgettable enforcement.
