# Build Prompts — Module 1 Phase C: Intent Router

> Date: 2026-06-23 · Branch: `feat/m1-phase-c-intent-router`
> PRD: `docs/plans/2026-06-23-m1-phase-c-intent-router-prd.md` · Contract: `...-ux.md`
> Loop per prompt: **write verify (red) → implement (green) → `/bs-review` → user says "next"**.
> No schema change, no seed change. Verify via tsx scripts (`scripts/m1c-*.ts`) + lint + tsc + build.
> Stop dev + worker before any `npm run build` (Windows EPERM on Prisma DLL).

Build order follows the data flow: **lens → ingest → recipe/gap (deterministic) → classify (LLM) → route → benchmark.**
Deterministic libs first so the LLM-dependent pieces sit on a tested base.

---

## Prompt 1 — Lens resolver + verify

**Files:** `src/lib/lens.ts`, `scripts/m1c-lens.ts`.

1. `scripts/m1c-lens.ts` (red first): the scope matrix —
   - `single` marketing → `marketing`; `single` creative → `social`; **explicit ignored** for `single`.
   - `multi`/`all` with valid explicit → that lens; without explicit → teamRole default.
   - invalid explicit (`"boss"`) → throws (assert it throws).
2. `lens.ts`: `LENSES = ["marketing","social"] as const`; `type Lens`; `resolveLens(user:{teamRole,team}, explicit?)`. Pure, no DB. Throw a typed error (reuse `AdminError`-style or a local `RouterError{status}`) on invalid explicit so the route maps it to 400.
**Done when:** `scripts/m1c-lens.ts` PASS.

## Prompt 2 — Upload ingest + verify

**Files:** `src/lib/ingest.ts`, `scripts/m1c-ingest.ts`.

1. `scripts/m1c-ingest.ts` (red): images pass through to `images[]`; `.pdf`/`.docx` → text appended to `extraText` (use a tiny fixture file in scratch or a stubbed parser path); unknown ext / missing file → `skipped[]`, never throws; URL/video paths → `skipped` (out of scope).
2. `ingest.ts`: `ingestUploads(paths) → { extraText, images, skipped }`. Image exts (`.png/.jpg/.jpeg/.webp`) → `images`. `.pdf`/`.docx` → parse to text via a **pure-JS** parser (prefer zero native dep; pick in this prompt, add to package.json). Parse failure / missing → push to `skipped` + `logError("studio.ingest", …)`. Keep a clear seam comment for future URL/video/OCR.
**Done when:** `scripts/m1c-ingest.ts` PASS (image route + doc-parse + skip cases).

## Prompt 3 — Recipe selection + gap-check (deterministic) + verify

**Files:** `src/lib/router.ts` (part 1: `selectRecipe`, `REQUIRED_FIELDS`, `gapCheck`'s deterministic core), `scripts/m1c-router.ts`.

1. `scripts/m1c-router.ts` (red): seed-backed —
   - `selectRecipe("poster","marketing")` → poster recipe; `selectRecipe("marketing_plan","social")` → `null` (lens-incompat; marketing_plan serves marketing only); unknown taskType → `null`.
   - `REQUIRED_FIELDS` has poster/caption = `[objective,platform,key_message]`, marketing_plan = `[objective,audience,timeframe]`.
   - gap-field SET: poster with `{objective,platform}` → missing `key_message`; with all three → `[]`. (Assert the `field` set; question text may be a stub here — see note.)
2. `router.ts`: `selectRecipe(taskType, lens)` = Prisma lookup (`enabled` + `lenses` ∋ lens) → `RecipeRef|null`. `REQUIRED_FIELDS` map. `gapCheck` core = compute missing `field`s deterministically; **phrasing split out** so this prompt's test asserts fields without an LLM call (inject a phrasing fn; default stub returns `field` as the question; the real LLM phrasing lands in Prompt 4).
**Done when:** `scripts/m1c-router.ts` PASS (selection + gap-field sets).

## Prompt 4 — Classify (gpt-4o structured output) + verify

**Files:** `src/lib/router.ts` (part 2: `classify` + LLM gap phrasing), `scripts/m1c-classify.ts` (live, OPENAI_API_KEY-gated).

1. `scripts/m1c-classify.ts` (red, **skips with a notice if no `OPENAI_API_KEY`**): for the 2 roadmap briefs assert `taskType` ∈ enabled set + correct match (`poster`, `marketing_plan`); assert `confidence` is a 0..1 number; assert ambiguous brief ("buat sesuatu untuk raya") → low confidence.
2. `router.ts`: `classify({text,images,brandSlug,enabledTaskTypes})` → gpt-4o **structured output** (JSON schema / tool-call) constrained to the `enabledTaskTypes` enum; returns `{taskType,intent,confidence,suggestedLens,extracted}`. Inject `brand-context.ts` block. Log cost via `usage`/`pricing` tagged `studio.classify`. Wire the real LLM gap-phrasing fn into `gapCheck`. On OpenAI error → throw a mapped error (route → 502 + `logError`).
**Done when:** `scripts/m1c-classify.ts` PASS (or cleanly skips without a key); lint+tsc green.

## Prompt 5 — Route `POST /api/studio` + draft persistence + verify

**Files:** `src/app/api/studio/route.ts`, extend `scripts/m1c-router.ts` (persistence assertions on the lib path).

- `route.ts`: `requireUser()` → validate (text|uploads, brandSlug) → `resolveLens` → `ingestUploads` → `classify` → confidence `< 0.5` ⇒ force `task_type` clarification + `recipe:null` → else `selectRecipe`; `null` ⇒ clarification gap → `gapCheck` → persist draft `CreativeRun` (`status="draft"`, legacy cols satisfied: `feature=taskType`, `outputJson:"{}"`) → `200 StudioResponse`. Error mapping: 400 (empty/invalid/unknown brand), 401, 502 (OpenAI via `error-log`), else rethrow.
- Persistence is the testable seam: factor the orchestration core into a lib fn (e.g. `runIntake(user, body)` in `router.ts`) the script can call directly (route stays a thin auth+HTTP wrapper, mirroring the Phase B deep-lib pattern — `requireUser`/`cookies()` can't run in a tsx script). Verify: a crafted classification (inject/stub classify) → exactly one draft `CreativeRun` with correct `lens/intent/recipeId/spec/status`; clarification path persists `recipeId=null`.
**Done when:** `scripts/m1c-router.ts` PASS incl. persistence + clarification; lint+tsc+build green.

## Prompt 6 — Classification benchmark + live smoke

**Files:** `scripts/m1c-benchmark.ts` (+ inline fixture of 10 labelled briefs), `scripts/m1c-smoke.ts`.

- `m1c-benchmark.ts` (OPENAI-gated, skips w/o key): 10 briefs (poster/caption/marketing_plan × marketing/social + 2 ambiguous) → assert correct `taskType` on **≥ 9/10** + both ambiguous → clarification gap. Print a score line. Loose assertions (membership/match), never exact wording.
- `m1c-smoke.ts` (OPENAI-gated): end-to-end `runIntake` for the 2 roadmap acceptance briefs → print the full `StudioResponse`; clean up any draft runs it creates (prefix/tag).
**Done when:** benchmark ≥ 9/10 with a live key (record the score); smoke prints both expected shapes.

---

## After all prompts → resume feature route

verify (gate) → review (gate, `/bs-review`) → release-notes (`/bs-release-notes`) →
commit (`/bs-commit`) → push (ask permission) → PR (pin fork:
`gh pr create --repo hibatullahmindquest/brief-studio --base master`).

## Notes
- **Deep-lib pattern (carry-forward from Phase B):** route logic that a tsx script must test goes in a lib (`runIntake` in `router.ts`); the route is a thin `requireUser` + HTTP/error wrapper. `requireUser()`→`cookies()` throws outside a request scope.
- **Verify-script temp data:** any `CreativeRun`/throwaway rows use a `zztest`-style tag and clean up in `finally` (Phase B rule). Brand reads use real seeded brands (read-only).
- **LLM tests are key-gated and loose** — deterministic code (lens/recipe/gap-field/persistence) is the hard gate; classify/benchmark/smoke skip gracefully without `OPENAI_API_KEY` so the verify gate stays green offline.
- **Dependency add** (PDF/docx parser, Prompt 2) — prefer pure-JS, no native build; record in CHANGELOG at release-notes.
