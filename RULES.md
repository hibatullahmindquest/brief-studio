# RULES.md — brief-studio

> Claude must follow these rules in every session, automatically, without being reminded.
> These rules are non-negotiable. If a rule conflicts with a user request, surface the conflict — do not silently ignore the rule.


## Session Start Rules

1. **Read `GOALS.md` first** — before any work, read GOALS.md to understand current phase, active task, and blockers.
2. **Read `AGENTS.md`** — know the critical rules and command index before touching code.
3. **Check git status** — know what's staged, unstaged, and what branch is active.
4. **Never start mid-task without context** — if resuming, check `.claude/tasks/active.json` for current workflow state.


## Code Rules

5. **No comments unless WHY is non-obvious** — well-named identifiers explain what. Comments explain why (hidden constraints, workarounds, subtle invariants only).
6. **No features beyond task scope** — a bug fix doesn't need surrounding cleanup. No speculative abstractions.
7. **No error handling for impossible scenarios** — only validate at system boundaries (user input, OpenAI API responses, file system).
8. **Validate server-side** — client-side validation is UX only, never security.
9. **No hardcoded brand values in code** — always read from DB via brand context builder.
10. **Every screen needs loading, error, and empty states** — not optional.


## AI Generation Rules

11. **Always inject brand context** before calling OpenAI — tone, audience, dont_say, tagline are mandatory fields.
12. **Never mix brands in one generation call** — one brand per FeatureRun.
13. **Brief must be validated** before triggering generation — all required fields present.
14. **Store images as path/URL only** — never base64 in DB.
15. **Log every generation call** — FeatureRun must be created before API call, updated after (success or failure).


## Git Rules

16. **Never push to `master` directly** — always branch → PR.
17. **Branch format enforced** — `feat/`, `fix/`, `chore/`, `docs/`, `refactor/` prefix required.
18. **Commit format enforced** — conventional commits: `type(scope): description`.
19. **Never bypass hooks** — no `--no-verify` or equivalent.
20. **Never commit `.env*`** — not even accidentally. Check `git status` before every commit.


## Quality Gate Rules

21. **Verify gate is unskippable** — `npm run lint` + `npm run build` + `npx tsc --noEmit` must pass zero errors.
22. **Review gate is unskippable** — code review must complete before commit on feature/bugfix/hotfix routes.
23. **Release notes gate is unskippable** — `CHANGELOG.md` must be updated before commit.
24. **Never mark task done without passing all gates for the route** — partial completion is not completion.


## Session End Rules

25. **Update `GOALS.md` active task** — set current phase, what was done, what's next, any blockers.
26. **Run `/bs-save-session`** — save any non-obvious learnings to `.claude/memory/`.
27. **If a technical gotcha was discovered** — add to `.claude/memory/` with date and context.
