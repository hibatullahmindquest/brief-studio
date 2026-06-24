# Memory — brief-studio

Accumulated learnings across sessions. Newest first.
Add entries via `/bs-save-session` at end of each session.

---

## 2026-06-23 (session 6) — user-supplied file paths are a path-traversal sink even under /public
**Context:** Phase C intake accepts `uploads[]` (asset paths) from the request body; `ingest.ts` + `router.ts` read them from `public/<path>` to parse docs / encode images.
**Discovery:** Stripping only the leading slash (`p.replace(/^\/+/, "")`) does NOT stop `..` — an authed user could POST `uploads:["/../../.env.local.pdf"]`, the parser reads it, and the content flows into the LLM brief → its `intent`/`extracted` echo can exfiltrate it. Caught in review. Fix = `safePublicPath()`: `path.resolve(base, rel)` then assert the result is `=== base` or starts with `base + path.sep`; else return null → skip. Applied to BOTH the doc reader and the image-data-URL reader; added a traversal regression test (parser must never be called).
**Impact:** Any time you resolve a user-provided path under a root dir, resolve-then-verify-prefix — `replace(/^\//,'')` is not a guard. Treat upload paths from the request body as untrusted even when "they should come from our upload endpoint".
**Source:** Stage-2 security review this session (CRITICAL, fixed before merge).

## 2026-06-23 (session 6) — pdf-parse's inner module path needs `turbopackIgnore` to survive `next build`
**Context:** Used `import("pdf-parse/lib/pdf-parse.js")` (the inner module) to dodge pdf-parse's top-level debug block (it reads a missing test PDF when `module.parent` is falsy under tsx/ESM). Worked under `tsx`; `npm run build` failed.
**Discovery:** Turbopack statically analyses dynamic `import()` specifiers and tries to resolve `pdf-parse/lib/pdf-parse.js` at build time — the package's `exports` don't expose that inner path → `Module not found`. tsx resolved it fine at runtime, so it only breaks the production build. Fix = `import(/* turbopackIgnore: true */ "pdf-parse/lib/pdf-parse.js")` — keeps it a runtime import the bundler leaves alone; resolves from node_modules at run time. (`@ts-expect-error` still needed for the missing types.)
**Impact:** For Node-only server libs whose deep/inner paths the bundler can't resolve, `turbopackIgnore` (Next 16 / Turbopack) is the escape hatch — verify with a full `next build`, not just `tsx`, because runtime-vs-build resolution differ.
**Source:** verify-gate build failure this session.

## 2026-06-23 (session 6) — inject the IO (LLM, parsers) so the deterministic shell is the hard gate
**Context:** Phase C router has one gpt-4o call + pdf/docx parsing — both flaky/expensive/binary-fixture-hungry to test directly.
**Discovery:** Made `runIntake(user, body, deps?)`, `ingestUploads(paths, parsers?)`, and `gapCheck(…, phraser?)` all take their IO as injectable params (default = real). The DB-backed verify (`m1c-router` 26/26) injects a fixed classification + no-op ingest to exercise persistence, the confidence-clarification branch, lens-incompat → clarification, and the 400 paths — zero LLM calls, fully deterministic. The real LLM is covered separately by key-gated `m1c-classify`/`benchmark`/`smoke` (loose assertions: enum membership, ≥9/10, shape match — never exact wording). Doc parsing tested with STUB parsers + scratch fixtures (no committed binaries).
**Impact:** Standard shape for any LLM/IO-bearing lib here: inject the IO, make the orchestration + branching the deterministic gate, keep the model behind a key-gated loose-assertion script that skips cleanly offline. The verify gate stays green without a network or an API key.
**Source:** design pattern applied across Phase C this session.

## 2026-06-23 (session 6) — steer LLM confidence with the prompt, then pick the threshold from observed calibration
**Context:** Phase C "don't guess" rule needs a confidence cutoff: ambiguous briefs must fall below it, clear briefs above.
**Discovery:** First prompt left ambiguous "buat sesuatu untuk raya" at 0.6 (above a 0.5 cutoff → wrongly proceeded). Two-part fix: (1) tie confidence to a concrete signal in the prompt — "set confidence ≤ 0.4 when the brief does NOT name or strongly imply an output format (poster/caption/plan or a platform like IG)" pushed ambiguous to 0.3–0.4; (2) set `CLARIFY_THRESHOLD = 0.7` since clear briefs land 0.9–1.0 and ambiguous 0.3–0.6 — 0.7 separates cleanly with margin. Benchmark then hit 10/10.
**Impact:** Don't fight the model's raw calibration with a magic number alone — anchor confidence to an explicit, checkable criterion in the prompt, observe the resulting distribution, then place the threshold in the gap. Keep the threshold a named const shared by lib + tests.
**Source:** live benchmark iteration this session.

## 2026-06-23 (session 5) — verify-script guards that read a global DB count must control the whole precondition deterministically
**Context:** `m1b-users.ts` tests the last-admin guard (block demoting `isAdmin` if it would drop admin count to 0). First version branched on `prisma.user.count({isAdmin:true})` — if real admins existed it took the "demotion succeeds" path and the 409 guard path **never ran**.
**Discovery:** A guard keyed on a *global* count can't be exercised by just creating a throwaway admin — real seeded admins keep the count >1. Fix: capture the real admin ids up front, `updateMany` them to `isAdmin:false` so the test user is genuinely the sole admin, assert the 409, then **restore the real admins in `finally`** (so a mid-test crash can't leave the DB with zero admins). Made the 409 deterministic regardless of DB state.
**Impact:** When a verify script targets logic gated on an aggregate over a shared table, neutralise the pre-existing rows for the duration (and always restore in `finally`) — don't branch around them, or the critical path silently goes untested.
**Source:** caught during self-review this session (first run's PASS was hollow).

## 2026-06-23 (session 5) — validate booleans explicitly in admin libs: a non-boolean both bypasses the guard AND 500s
**Context:** `updateUser` last-admin guard checks `input.isAdmin === false`. Review found `isAdmin` was never type-checked.
**Discovery:** A non-boolean (e.g. JSON `"false"` string) makes `=== false` false → guard **skipped**, then `data.isAdmin = "false"` hits Prisma → `PrismaClientValidationError` → unmapped 500. Two bugs from one missing check. Added `if (typeof input.isAdmin !== "boolean") throw new AdminError(400, …)` before the guard. Enum fields (teamRole/team) were already safe via `.includes()`, but booleans have no enum to lean on.
**Impact:** In the deep-lib validation layer, explicitly `typeof`-check boolean inputs — a strict `=== false`/`=== true` guard silently no-ops on the wrong type instead of erroring, which is worse than a 400. Turns a security-relevant bypass + 500 into a clean 400.
**Source:** Stage-2 code review this session.

## 2026-06-23 (session 5) — squash a WIP checkpoint into a clean feature commit via `git reset --soft` (interactive rebase unavailable)
**Context:** Session opened on an uncommitted P1–P5 working tree; made a WIP checkpoint commit (`66839ad`) to protect work, then finished P6–P8. Wanted one clean `feat:` commit for the PR.
**Discovery:** The Bash tool env blocks interactive rebase (`rebase -i`), so the squash path is `git reset --soft <base>` (moves branch pointer back to before the WIP, keeps every change staged, loses nothing), then re-stage selectively + one clean commit. Also: files edited *after* the checkpoint (here `settings/page.tsx` from P8 + `CHANGELOG.md`) show as unstaged ` M` after the soft reset — must be re-`git add`ed or they silently miss the commit.
**Impact:** Checkpoint-commit-then-squash is the safe rhythm for long uncommitted multi-step work on Windows. Remember soft-reset only re-stages what the *collapsed commit* contained; anything touched afterward needs an explicit add. Also: PowerShell here-string `@'…'@` is a literal `@` in the Bash tool (POSIX sh) — use `git commit -F <file>` for multi-line messages, not heredocs/here-strings.
**Source:** done + debugged this session (first checkpoint commit got a stray `@` line from a misused here-string).

## 2026-06-22 (session 4) — native `<input type=color>` gives valid-by-construction hex (no client regex)
**Context:** P5 brand knowledge form needed a `colors[]` palette editor where "invalid hex is rejected" (UX spec).
**Discovery:** Instead of a free-text chip input + client-side `#rrggbb` regex, used a native `<input type="color">` swatch picker + "add" button. The browser only ever emits a valid 7-char `#rrggbb`, so the chip list is valid-by-construction — no client validation path to write/maintain. Server (`lib/admin/brands.ts`) still validates hex independently (defense in depth; API is the trust boundary). Swatch chips show the colour via `style={{backgroundColor:c}}`.
**Impact:** For constrained-format inputs, prefer a native input that can only produce valid values over text+validation. Less UI code, no invalid-state UX to design.
**Source:** design decision this session.

## 2026-06-22 (session 4) — folding an existing inline-validated route into the deep-lib pattern (keep old fields working)
**Context:** P5 had to ADD enriched-knowledge fields to `PATCH /api/brand`, which already validated overlay fields (footer/logoSize/logoCorner) inline in the route — not tsx-testable, unlike the session-3 admin libs.
**Discovery:** Cleanest path = extract ALL of the route's logic (old overlay + new knowledge) into `lib/admin/brands.ts` `updateBrand(input)` throwing `AdminError`, then make the route a thin gate→lib→`adminErrorResponse`. The verify script (`m1b-brands.ts`) then explicitly asserts the OLD overlay fields still update (parity check) alongside the new ones — so the refactor can't silently regress the existing feature. 16/16 PASS confirmed overlay + knowledge both work.
**Impact:** When deepening a route that already has inline logic, move the whole thing to the lib (not just the new bits) and add a parity assertion for the pre-existing behaviour. One validated path, one trust boundary, regression-proof.
**Source:** design decision + observed this session.

## 2026-06-22 (session 4) — verify scripts that mutate a real, unique-keyed table use a throwaway row
**Context:** `m1b-brands.ts` tests `updateBrand` against a Brand, but Brand rows are real seeded data (sifututor/nakngaji) with `@unique` name+slug — patching them in a test would corrupt live brand config.
**Discovery:** Created a throwaway `zztest-brand-<rand>` Brand (only name+slug required; everything else defaults), patched + asserted against it, then `deleteMany({ slug: { startsWith: "zztest-brand-" } })` in `finally`. Brand has no slug-format validator (unlike Expert.roleKey), so the `zztest-` slug is accepted. Avoids save/restore-original gymnastics on real rows.
**Impact:** Pattern for verify scripts on tables without natural temp scoping: spin a throwaway row, never touch real ones, clean by prefix in `finally`. Pair with the session-3 rule (tags must satisfy any column format validators).
**Source:** design decision this session.

## 2026-06-22 (session 3) — admin route logic must live in a lib to be tsx-testable (assertAdmin uses next/headers)
**Context:** Module 1 Phase B admin CRUD. Wanted tsx integration scripts (`scripts/m1b-*.ts`) to test route behaviour (dup→409, delete-guards) without spinning a server.
**Discovery:** Route handlers can't be called directly from a tsx script — `assertAdmin()` → `getCurrentUserWithRole()` → `cookies()` from `next/headers`, which throws outside a request scope. Solution: put all validation + referential-guard logic in a plain lib (`src/lib/admin/{experts,recipes}.ts`); the route is a thin `assertAdmin` + HTTP-mapping wrapper. Scripts import the lib functions and assert against the live DB. Cleaner module boundary AND testable.
**Impact:** Standard shape for all admin CRUD: deep lib (throws typed `AdminError{status}`) + thin route (`adminErrorResponse(e)` maps to NextResponse). Reuse for P5/P6 (brands/users).
**Source:** design decision + observed this session.

## 2026-06-22 (session 3) — `assertAdmin()` THROWS a Response, it does not return one
**Context:** Writing `/api/admin/*` route gates.
**Discovery:** `assertAdmin()` (in `lib/session.ts`) throws `new Response(..., {status:401|403})` on failure. Next.js does NOT auto-return a thrown Response from a route handler — you must catch it: `try { await assertAdmin() } catch (e) { if (e instanceof Response) return e; throw e }`. (Existing `/api/usage` route already used this pattern.) Wrapped it in a local `gate()` helper returning `Response|null`.
**Impact:** Every admin route needs the catch-and-return; forgetting it turns a 403 into an unhandled 500.
**Source:** observed (existing pattern) this session.

## 2026-06-22 (session 3) — test-row tags must satisfy slug validators (no leading underscore)
**Context:** `m1b-experts.ts` used the common `__test_*` throwaway-row prefix for a temp Expert.
**Discovery:** `createExpert` validates `roleKey` with `/^[a-z][a-z0-9_]*$/` (must start with a letter) → the `__test_expert_…` tag was rejected with a 400 before the test could run. Switched temp tags to a letter-leading prefix `zztest_*` (still greppable + self-cleaned via `deleteMany startsWith`).
**Impact:** When a model field has a format validator, the verify-script tag convention must conform to it — don't reuse `__test_` blindly for slug/key columns.
**Source:** debugging (script exit 1) this session.

## 2026-06-22 (session 2) — `@@map` model rename: blast-radius hides in `scripts/`, not just `src/`
**Context:** Module 1 Phase A renamed `FeatureRun` → `CreativeRun` via `@@map("FeatureRun")`. Grepped `prisma.featureRun` in `src/` → only 7 hits, all in `feature-store.ts` (well-encapsulated data layer). Repointed those, lint+build of the app passed.
**Discovery:** `npx tsc --noEmit` then failed on TWO leftover dev/test scripts — `scripts/live-poster-e2e.mts` + `scripts/test-async-visual.ts` — still calling `prisma.featureRun.*`. `next build` does NOT typecheck loose scripts under `scripts/`, so the build was green while tsc was red. The standalone `tsc --noEmit` gate is what caught them.
**Impact:** After any `prisma.<model>` rename, grep the WHOLE repo (incl. `scripts/`), not just `src/`. Keep `tsc --noEmit` as its own verify gate — `next build` alone misses non-bundled files.
**Source:** debugging (tsc) this session.

## 2026-06-22 (session 2) — Prisma 4 rejects literal `null` on nullable Json even in plain `create` data
**Context:** `m1a-verify.ts` round-trip created a `CreativeRun` with `contextUsed: null` (a nullable `Json?` column) to assert NULL persists.
**Discovery:** Runtime `PrismaClientValidationError`: "Argument `contextUsed` ... must not be null. Please use undefined instead." Same rule as the write-path TS error noted earlier, but here it surfaces at RUNTIME in a script (no tsc catch because the object was loosely typed). Fix: omit the field entirely (stays NULL) or pass `Prisma.DbNull`. Never pass JS `null`.
**Impact:** Reinforces the standing Prisma-4 Json rule — applies to seed/verify scripts too, not just lib write helpers. Default to OMITTING optional Json fields.
**Source:** debugging (runtime) this session.

## 2026-06-22 (session 2) — Docker Desktop daemon can be down even when STATUS says "DB running"
**Context:** Handover STATUS said "Docker `brief-studio-db` RUNNING", but `docker ps` at session start errored: daemon not reachable (`npipe ... dockerDesktopLinuxEngine`). Migration/seed need Postgres.
**Discovery:** STATUS reflects the PRIOR session's end state; Docker Desktop may have been closed since. Recipe to recover: `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`, then poll `docker info` until it returns 0 (came up in ~5s once launched). The `brief-studio-db` container has `--restart unless-stopped`, so it auto-starts with the daemon (was "Up 47s" without manual `docker start`).
**Impact:** At session start, verify the daemon live (`docker info`) before trusting STATUS; relaunch Docker Desktop + poll rather than assuming.
**Source:** observed this session.

## 2026-06-22 — Prisma 4 rejects `null` for a nullable Json column on write
**Context:** Module 0 — generalized `markSucceeded` to write a generic `result Json?` field; passed `result: (out.result ?? null) as object | null`.
**Discovery:** Prisma 4 typechecks the Json input as `InputJsonValue | NullableJsonNullValueInput` — a bare `null` is NOT assignable (`tsc` error TS2322). To write SQL NULL you must use `Prisma.JsonNull` (or `Prisma.DbNull`), imported from `@prisma/client`. Cleanest pattern: only include the field when the caller passed it, mapping null → `Prisma.JsonNull`: `...(out.result === undefined ? {} : { result: out.result === null ? Prisma.JsonNull : (out.result as Prisma.InputJsonValue) })`.
**Impact:** Any new nullable Json column write needs this; don't cast `null as object`. Affects future module result payloads (meta_sync/analyze/etc.).
**Source:** debugging (tsc) this session.

## 2026-06-22 — `@@map` lets you rename a Prisma model with ZERO data migration
**Context:** Module 0 renamed `GenerationJob` → generic `Job`, but the table holds live poster-job rows we didn't want to move.
**Discovery:** Adding `@@map("GenerationJob")` to the renamed `Job` model keeps the physical table name. `prisma migrate dev` then only ADDs the new columns + ALTERs nullability — no table rename, no data copy. The client API becomes `prisma.job.*` (was `prisma.generationJob.*`); every call-site must be repointed (tsc finds them). Gotcha: a non-obvious call-site lived in `feature-store.ts` (history visual-badge query) — the plan missed it; tsc caught it. Also `featureRunId` became nullable → guard `if (j.featureRunId && ...)` before using as a Map key.
**Impact:** Safe model-rename recipe. Always `grep` the old `prisma.<model>` name after a rename; the build won't be green until every call-site moves.
**Source:** executing Module 0 plan.

## 2026-06-22 — `skills add` writes into the repo's `.claude/skills/` → git-tracked = branch-coupled
**Context:** Ran `skills add mattpocock/skills` from the brief-studio dir. It dropped ~30 skill dirs into `.claude/skills/` + `skills-lock.json` + a gitignored `.agents/` mirror.
**Discovery:** brief-studio's `.gitignore` force-includes `.claude/**` (for the project harness), so the new external skills were tracked. Committing them to ONE branch then `git checkout`-ing to another **deletes them from disk** (they live only in the branch's commit) — they vanished when switching from master to the feature branch. Two further gotchas: (a) newly-installed skills need `/reload-plugins` (or restart) before Claude Code registers them; (b) many matt skills have `disable-model-invocation: true` → the MODEL can't invoke them, user must type `/teach` etc.
**Fix:** Keep external packs local-only — `.gitignore`: `.claude/skills/*` + `!.claude/skills/bs-*/` (keep project skills tracked) + `skills-lock.json`. Files become untracked → persist on disk across branches (not owned by any commit).
**Impact:** Don't commit `skills add` output into a frequently-branched repo; gitignore it so it's stable on disk regardless of branch.
**Source:** user-stated preference + debugging the disappear-on-checkout behaviour.

## 2026-06-19 (evening) — Squash-merged PR + kept branch → new commits need a FRESH PR, not a re-merge
**Context:** Asked to "merge PR #11", but `gh pr view 11` showed state=MERGED (squash-merged yesterday → `e00ff44` on master). The branch `feat/visual-intake-overhaul` had been kept and committed to (4 more commits today).
**Discovery:** A squash merge puts a NEW single commit on master; the branch's original commits never become ancestors of master. So after a squash-merge, `git log origin/master..branch` still lists ALL the old commits, and any new commits are NOT in the (now-closed) PR. You cannot re-merge a merged PR.
**Fix (clean):** `git checkout -b <new-branch> origin/master` → `git cherry-pick <the new commits>` (they apply cleanly because master already has the squashed content) → push → open a NEW PR. Verified the cherry-picked tip was byte-identical to the old branch tip (`git diff old..new --stat` = empty). Merged as PR #12, then deleted both old branches (local + remote).
**Impact:** After a squash-merge, treat the branch as dead — branch off fresh `master` for the next change, or you accumulate ghost commits. Don't keep committing to a squash-merged branch.
**Source:** hit it live this session.

## 2026-06-19 (evening) — brief-studio is the BUILD GROUND; features migrate into creative-hub (KVM8), not deployed standalone
**Context:** Was about to write "deploy brief-studio to KVM8" in the status report. User corrected the plan.
**Decision:** brief-studio is a prototype/build workspace. When a feature is validated here it gets **migrated into `creative-hub`**, which is the product deployed on KVM8. brief-studio itself never deploys to KVM8.
**Impact:** Stop putting "deploy KVM8" as brief-studio's pipeline endpoint. The endpoint is "migrate feature → creative-hub". Don't re-debate.
**Source:** user-stated.

## 2026-06-19 (evening) — Logo overlay: TRIM the uploaded PNG, and sample luminance from a CLEAN corner box
**Context:** User: stamped logo looked broken/wrong-colour and floated far from the corner.
**Discoveries (3 separate bugs, same root — the AI image fills the "reserved" corner):**
1. **Float:** uploaded brand PNGs carry huge transparent margins (e.g. 2084×2084 with the mark centred). Resizing+placing at `pad` leaves the visible mark drifting toward centre. Fix: `sharp(buf).trim()` before resize so the real mark sits flush at `pad`. Trim can throw on a uniform image → wrap in try/catch.
2. **Wrong variant:** luminance auto-pick was sampling the full logo footprint, which overlapped the white rendered headline → mean luminance read "light" → picked the dark-ink (light-bg) logo onto a dark blue bg. Fix: sample a small clean corner box (~7% W), and move the sample box to follow the chosen corner (tl/tr/tc).
3. **Collision:** gpt-image-2 does NOT reliably honour "keep top-left empty" — it rendered the headline there. Mitigation only: stronger prompt (hard-reserve ~28%×16% top-left + headline center/lower-center). Not a guarantee; a contrast plate would be the deterministic fix (user declined for now).
**Impact:** Any overlay-on-AI-image is fragile — trim assets, sample background away from rendered text, and don't trust the model to leave space.
**Source:** debugging a real generated poster (cropped top-left at full res to diagnose).

## 2026-06-19 — Worker is `tsx watch` → hot-reloads lib changes; no manual restart needed to test overlay/prompt edits
**Context:** Edited `visual-overlay.ts` / `visual.ts` while `npm run worker` was running.
**Discovery:** The worker (`tsx watch src/worker/index.ts`) restarts itself on any imported-file change, so generation picks up overlay/prompt edits immediately — just regenerate. Still must STOP dev+worker before `prisma generate`/`npm run build` (Windows EPERM locks `.prisma`/`.next`). Preview overlay placement WITHOUT an API call by compositing the trimmed logo onto a solid brand-colour canvas via a throwaway `node -e` sharp script.
**Impact:** Faster iteration on generation code; don't waste image-API spend just to eyeball logo placement.
**Source:** observed worker log (`[tsx] change in ... Restarting`).

## 2026-06-18 (evening) — Poster flow needed its OWN copy-gen; the guided flow skips the legacy text path
**Context:** New `GuidedPosterFlow` goes brief → spec → image only. User noticed caption/CTA/hashtags/strategyNote "disappeared" vs the old generic flow.
**Discovery:** Those copy fields come from `generateCopy` (gpt-4o) in the *legacy* `/api/generate` path. The poster flow never calls it, so a poster run had no copy. Fix: `runVisualJob` (spec path) now also calls `generateCopy` (best-effort, try/catch — a copy failure must NOT fail the already-rendered image) and merges the fields into the run's `outputJson`. History/HistoryModal already render those fields, so they show up automatically; the live result reads them via `GET /api/studio/run-output`.
**Impact:** Any new "image-only" flow that should still produce a post must explicitly call `generateCopy` — image and copy are separate OpenAI calls on separate pipelines.
**Source:** user-stated requirement + implementation.

## 2026-06-18 (evening) — Cost rollup: sum APIUsageLog by featureRunId, don't recompute
**Context:** P11 — a guided poster's cost = spec synth (gpt-5) + N regenerations + image (gpt-image-2) + now copy (gpt-4o). The old code only summed director+image.
**Discovery:** Every call already logs to `APIUsageLog` with `costMyr` and a `featureRunId`. Cleanest rollup = `prisma.aPIUsageLog.aggregate({_sum:{costMyr},where:{featureRunId}})` AFTER all calls are logged (`sumRunCostMyr` in usage.ts), with a fallback to the direct director+image sum if the table read returns 0. Avoids re-deriving per-model costs.
**Impact:** Reuse `sumRunCostMyr` for any multi-call run cost. Order matters — call it after the last `logUsage`.
**Source:** implementation.

## 2026-06-18 (evening) — Headless Edge → PDF for status reports (no node dep)
**Context:** Generating `docs/reports/brief-studio-status-*.pdf` in the creative-hub format.
**Discovery:** Fill an HTML template, then `msedge.exe --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=4000 --print-to-pdf=<out> file:///<html>`. Edge prints a benign `task_manager ... ERROR` line to stderr even on success — ignore it; check the output file exists + `%PDF` header instead. Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Template/skill live in `creative-hub/.claude/skills/report/`. NOTE: `pdftoppm` is NOT installed, so the Read tool can't render a PDF back to verify visually — verify via byte size + magic header.
**Impact:** Repeatable way to produce styled PDFs on this Windows box with zero extra deps.
**Source:** observed (replicated creative-hub's build.ps1).

## 2026-06-18 (evening) — Draft runs have no copy output → derive a list title from the spec
**Context:** Semakan Lepas showed blank lines for Draft (and generated-from-spec) poster runs because `outputJson.primaryPost` is empty.
**Discovery:** In `getRecentFeatureRuns`, when `primaryPost` is empty, fall back to `inputJson.visualSpec.angle || headline || brief` so the card reads "Idea: <angle>". Applies to BOTH draft and generated-from-spec runs (both can lack copy at list time). Also: draft cards in the drawer must be a `<div>`, not a `<button>` — they contain Edit/Generate buttons (no nested buttons).
**Impact:** Any run type that skips copy needs a title fallback for the history list.
**Source:** debugging the empty-excerpt drawer rows.

---

## 2026-06-18 — gpt-image-2 renders Malay + 2-font beautifully (old "garble" note is OUTDATED)
**Context:** Designing the visual-intake overhaul; tested render-in-image vs text-overlay for headline+CTA.
**Discovery:** gpt-image-2 (2026) renders short Malay headlines/CTA **correctly and with integrated typography** — including a bold-uppercase + handwritten-script accent treatment. The 2026-06-15 MEMORY note "keep text minimal — it garbles" is **superseded**: for poster headlines/CTA, **render-in-image wins** over a text overlay (better look, exact spelling, edits happen at the Spec stage before generating so the "edit=regen" downside rarely bites). Overlay only wins when reusing one image with many text variants (not needed yet).
**Impact:** Default to render-in-image for poster copy. Keep overlay ONLY for fixed brand furniture (see next entry).
**Source:** real tests (C:\claude\temp\poster-compare, sifututor-test, sim-brief).

## 2026-06-18 — Brand consistency = AI gets ~90%, overlay stamps the fixed 10%
**Context:** Extracted SifuTutor visual DNA from 10 real designer posters, then tested how close pure gpt-image-2 gets.
**Discovery:** With the DNA in the prompt (palette, 2-font, cut-out students, speech bubbles, sparkles), gpt-image-2 nails **~90%** of the brand look. What it CANNOT reproduce consistently: the **exact logo** and the **fixed footer tagline**. So the architecture = **gpt-image-2 renders the creative + a thin `sharp` overlay stamps logo (top-left) + footer (bottom)** read from brand settings at gen time. Prompt must **reserve clean top-left + bottom strips** or the AI headline collides with the logo. DNA lives in `BrandContext.visualDna` (kept OUT of `promptBlock` so it never pollutes copy gen).
**Impact:** "AI background/subject + branded overlay" is the pattern for on-brand output; changing logo/footer in settings affects only NEW gens (old are flattened).
**Source:** design + tests (sifututor-test, sim-brief, verify-wave-a).

## 2026-06-18 — LLM JSON director: don't use `<...>` placeholders; strip artifacts
**Context:** gpt-4o/gpt-5 director (`planSpec`) returns a JSON spec (headline/accent/cta).
**Discovery:** A system prompt that shows the JSON shape with `"<angle/occasion ...>"` style placeholders makes the model **echo the angle brackets into the values** (e.g. `"<Dapat Manfaat Cuti Sekolah>"`). Fix: describe each field in prose (no `<>`), AND defensively `clean()` every value (strip leading/trailing `"'`<>()[]`, `**`). Also: gpt-5 is a reasoning model — give `max_completion_tokens` 4000–5000 or it returns empty (per earlier note). sharp SVG overlay text MUST XML-escape `&`/`<`/`>` (footer "Sifu & Edu" crashed librsvg with raw `&`).
**Impact:** Robust director output; no stray brackets on posters; no SVG parse crashes.
**Source:** debugging (sim-brief `<>` echo; sharp `xmlParseEntityRef` on `&`).

## 2026-06-18 — Windows Git Bash mangles `git show rev:.claude/...` paths
**Context:** Verifying file content inside a commit via `git show`.
**Discovery:** MSYS path-conversion mangles `git show "origin/master:.claude/memory/MEMORY.md"` → `origin\master;.claude\...` (colon→`;`, `/`→`\`) when the path has multiple slashes. Prefix with `MSYS_NO_PATHCONV=1 git show "<rev>:<path>"`.
**Impact:** Use `MSYS_NO_PATHCONV=1` for any `git show rev:path` with nested paths on Windows.
**Source:** debugging (path mangle during the GOALS/STATUS sync).

## 2026-06-18 — Branch hygiene: squash-merge + always verify commit before push
**Context:** Cleaning up after PR #6. Found 4 "stacked" branches (async→indicator→timer→cost) each branched off the previous, so every branch re-contained the earlier commits. Also 9 stale local + 5 stale remote branches lingering after merges.
**Discovery:** (1) **Stacked branches** happen when you `git checkout -b B` while on branch A instead of off `master` — B then carries A's commits. For one shippable unit, use ONE branch with many commits; for independently-mergeable units, branch each off `master`. (2) **`--squash --delete-branch`** on `gh pr merge` collapses a branch to one commit AND auto-removes it (local+remote) → no pile-up, no leftover dangling commits. Set "Allow squash merging" as the only option in repo settings to make it default. (3) **commit-msg hook + heredoc = trap:** `git commit -m "$(cat <<'EOF'…EOF)"` failed the conventional-commit hook (the `$()` reached git unexpanded) AND silently dropped staged edits because the failed first attempt's `git add -A` never ran. Use separate `-m` flags. (4) **ALWAYS `git show HEAD:file` after committing docs, before pushing** — I pushed a commit that had stale GOALS/STATUS (edits never staged), costing a 3-PR detour (#7 partial, #8 conflict-closed, #9 fixed).
**Impact:** Going forward: squash+delete-branch on every PR merge; verify HEAD content before push; never heredoc a commit message when a commit-msg hook is active.
**Source:** debugging (self-inflicted during branch cleanup).

## 2026-06-16 — Async worker (Approach B): web enqueues, worker process generates
**Context:** Built close-tab-safe visual generation. App is long-running Node (`next start`, NOT serverless — CLAUDE.md forbids Vercel/Edge), so a separate worker process is viable.
**Discovery:** Pattern = `GenerationJob` table is the only channel between web (enqueue) and worker (`npm run worker` = `tsx watch src/worker/index.ts`). Web does NO OpenAI work. Atomic claim via `updateMany WHERE status='queued'` (loser gets count 0). Watchdog sweeps `processing` older than `claimedAt+5min` → failed. The `kind` field on GenerationJob is future-proofing for async TEXT (bulk variations, Phase 2) — same worker, same queue.
**Impact:** Local = 2 terminals (`dev` + `worker`); VPS = same script under PM2 `scis-worker`, zero code change. Worker MUST run or visuals stick at "queued".
**Source:** built + live E2E proven (real OpenAI, RM0.30 poster).

## 2026-06-16 — tsx worker gotchas: top-level await + env-before-import
**Context:** Worker wouldn't boot.
**Discovery:** (1) tsx transforms a worker entry as CJS (no `"type":"module"`) → top-level `await import()` throws "Top-level await is currently not supported with the cjs output format". Use `import("./loop").catch(...)` instead. (2) Env must load BEFORE modules that read it at construct-time (Prisma client). Pattern: `process.loadEnvFile(".env.local")` (sync, Node 20.12+/22+) in a bootstrap entry, THEN dynamic-import the loop. (3) tsx resolves tsconfig `@/*` paths even from `src/worker` + `scripts/` — no extra config.
**Impact:** Worker entry = thin bootstrap (loadEnvFile + dynamic import); loop in a separate file.
**Source:** debugging (boot failures).

## 2026-06-16 — Windows: Prisma generate EPERM = a node process holds the engine DLL
**Context:** `npm run build` (runs `prisma generate`) failed `EPERM unlink query_engine-windows.dll.node`.
**Discovery:** ANY live node process holding the DLL blocks it — a running `next dev` OR a leftover `tsx` worker/script. `kill` in Git Bash often doesn't reap npm-spawned node children; use PowerShell `Stop-Process` on procs whose CommandLine matches the project. Stop dev + worker before any build/generate.
**Impact:** Build hygiene on Windows: kill stray project node procs first. Also logged to global KNOWLEDGE.md.
**Source:** debugging (recurred twice this session).

## 2026-06-16 — Cost/time data placement: persist into outputJson.image, not just the job
**Context:** Cost showed on the live card but not in Semakan Lepas.
**Discovery:** The live VisualPanel reads cost/time from `GET /api/jobs` (job row). History (HistoryModal) reads `FeatureRun.outputJson` — a totally separate source. Anything history must show (generatedMs, costMyr) has to be written into `outputJson.image` by the worker at persist time, NOT only kept on GenerationJob/APIUsageLog. Visual status badge is the exception — derived by joining the latest job at query time (`getRecentFeatureRuns`), one batched `findMany WHERE featureRunId IN (...)`.
**Impact:** When adding any per-run display field, decide its read-source: live card = job; history = outputJson.
**Source:** debugging (user reported missing cost).

## 2026-06-15 — gpt-image-2 only outputs 3 sizes (not true 9:16/16:9)
**Context:** Generated visual rendered cropped.
**Discovery:** gpt-image-2 supports only 1024×1024 (1:1), 1024×1536 (2:3), 1536×1024 (3:2). We labelled brief sizes 9:16/16:9 and set the CSS container to that ratio with `object-fit: cover` → mismatch (2:3≠9:16) cropped the image. Fix = display native ratio (no fixed aspect + no cover). True 9:16/16:9 needs a crop/pad/outpaint post-step (deferred, FUTURE plan).
**Impact:** Image-display code must use the real output ratio, not the requested social label.
**Source:** debugging (user reported crop).

## 2026-06-15 — gpt-5 reasoning model: low max_completion_tokens → empty content
**Context:** "Gagal jana visual" — empty image prompt.
**Discovery:** OPENAI_MODEL defaults to gpt-5 (reasoning). With `max_completion_tokens: 1500`, reasoning ate the budget → empty `content` → planVisual returned empty `imagePrompt` → gpt-image-2 threw `400 Invalid 'prompt': empty string`. Fix: 4000 tokens + deterministic fallback prompt + guard renderImage against empty. (generateCopy already used 5000.)
**Impact:** Reasoning models need generous completion budgets; always guard downstream against empty LLM output.
**Source:** debugging via the new ErrorLog.

## 2026-06-15 — Persistent error logging = fastest diagnosis
**Context:** Couldn't see why image gen failed.
**Discovery:** `ErrorLog` + `logError()` normalizes OpenAI APIError (status/code/type/body) into `detail`. The empty-prompt 400 was found instantly from one row. View at `/dashboard/settings/logs` (admin) or `SELECT ... FROM "ErrorLog"`.
**Impact:** Wire logError into every AI/integration catch; pays off immediately.
**Source:** built + used same session.

## 2026-06-15 — Prisma accessor + Windows DLL lock + client/server boundary
**Discovery:** (1) Prisma camelCases models → `prisma.aPIUsageLog`, `prisma.errorLog` (first letter lowercased). (2) Windows: a running `next dev` holds `query_engine-windows.dll.node` → `prisma generate` EPERM; stop dev before migrate/generate. (3) `visual.ts` imports `fs/promises` → can't be imported by a `"use client"` component; replicate tiny helpers (visualKind) client-side, import only pure libs (pricing); `import type {…}` from a server lib is erased → safe in client. (4) `react-hooks/purity` flags `Date.now()` in a server-component render body → put time logic in lib functions.
**Impact:** Avoids repeated build/lint failures.
**Source:** debugging.

## 2026-06-15 — Real NakNgaji Meta data was in marketing-ai-agent's LOCAL docker pg
**Discovery:** That project's `SUPABASE_URL` was a local Docker Postgres DSN (`db:5432`), not cloud. Real NakNgaji paid data (17,055 daily rows, RM520k, Jan'25–May'26) + a **non-expiring BM System User token** ("Analytics") lived in the `marketing-ai-agent_pgdata` volume. Imported via `scripts/import-meta-history.ts`. node-pg parses DATE (OID 1082) at local midnight → day shifts on UTC+8; fix = `types.setTypeParser(1082, v=>v)` + build UTC date.
**Impact:** System-user token (non-expiring) is simplest Meta auth for an internal tool; data is reusable.
**Source:** investigation + ETL.

## 2026-06-15 — /api/generate/visual is featureRunId-based → "generate later" is free
**Discovery:** The visual route loads brand/brief/output from DB by `featureRunId` only — never needs live wizard state. Surfacing `VisualPanel` in HistoryModal made "generate image later from a saved run" a pure UI-reuse job, zero backend change.
**Impact:** Keep generation endpoints DB-keyed (not session-coupled) → enables history/Library reuse + future async jobs.
**Source:** design + build.

---

## 2026-06-12 — browser_screenshot tidak share cookie dengan browser_run

**Context:** Cuba screenshot Studio page (authenticated) guna Playwright MCP tools.
**Discovery:** `mcp__browser__browser_screenshot` dan `mcp__browser__browser_run` adalah browser instances berasingan — cookie/session dari `browser_run` tidak persist ke `browser_screenshot`. Workaround: login via fetch API dalam same `browser_run` session sebelum navigate, guna evaluate untuk inspect DOM.
**Impact:** Untuk screenshot authenticated pages, kena login dan navigate dalam satu `browser_run` call chain. `browser_screenshot` hanya berguna untuk public pages.
**Source:** Observed semasa debug UI overlap issue.

## 2026-06-12 — Fixed drawer bertindan dengan nav header

**Context:** GenerationHistory slide-over drawer `top-0 z-40` tapi nav header `fixed top-0 z-50 h-[73px]`.
**Discovery:** Drawer header tertutup di belakang nav. Fix: `top-[73px] h-[calc(100vh-73px)]` untuk drawer, `inset-x-0 top-[73px] bottom-0` untuk backdrop. Nilai 73px dari `getBoundingClientRect()` pada header element.
**Impact:** Semua fixed panels/drawers kena offset 73px dari top. Kalau header height berubah, kena update semua arbitrary values.
**Source:** Observed via DOM inspection dalam browser_run.

## 2026-06-12 — gh branch protection via API

**Context:** GitHub warning master branch tidak protected selepas PR created.
**Discovery:** `gh api repos/<owner>/<repo>/branches/master/protection --method PUT --input -` dengan JSON body. `required_pull_request_reviews` mesti object (bukan null). `required_status_checks: null` untuk skip CI requirement.
**Impact:** Branch protection boleh set terus via CLI tanpa masuk GitHub settings UI.
**Source:** Observed during PR creation workflow.

## 2026-06-11 — Prisma DLL lock on Windows blocks `npm run build`

**Context:** Running full build gate selepas implement history sidebar.
**Discovery:** `npm run build` runs `prisma generate && next build`. Bila dev server sedang running, Prisma cuba unlink `query_engine-windows.dll.node` tapi fail (EPERM) sebab DLL locked oleh process lain. Workaround: run `npx next build` terus — Prisma client dah generated, Next.js build sendiri berjalan clean.
**Impact:** Jangan panik bila `npm run build` fail dengan EPERM. Check dev server running dulu. `npx next build` confirm code betul.
**Source:** Observed during Task 6 quality gate.

## 2026-06-11 — History sidebar: inline collapsible → slide-over drawer upgrade

**Context:** Implement history sidebar untuk Studio page.
**Discovery:** Plan asal (inline collapsible panel bawah wizard) fully implemented dan working. Tapi selepas user review prototype, decided upgrade ke slide-over drawer pattern (macam Linear/Vercel) yang lebih modern — fixed right panel, slide animation, search, infinite scroll via Intersection Observer, cursor-based pagination.
**Impact:** Branch `feat/history-sidebar` ada 6 commits (collapsible version). Next session kena replace `GenerationHistory.tsx` dengan `HistoryDrawer.tsx` dan update `/api/history` untuk cursor pagination sebelum buat PR.
**Source:** User decision selepas tengok HTML prototype di `C:\claude\temp\history-drawer-prototype.html`.

## 2026-06-11 — generation:complete custom event pattern untuk cross-component communication

**Context:** StudioWizard (deep component) perlu notify GenerationHistory (sibling, bukan parent) bila generation selesai.
**Discovery:** `window.dispatchEvent(new CustomEvent("generation:complete"))` dalam StudioWizard, dan `window.addEventListener("generation:complete", handler)` dalam GenerationHistory. Clean tanpa prop drilling atau global state. Works across any component tree depth.
**Impact:** Pattern boleh reuse untuk event-driven refresh lain dalam app (e.g. notify nav badge, dashboard stats).
**Source:** Implemented in Task 5.
