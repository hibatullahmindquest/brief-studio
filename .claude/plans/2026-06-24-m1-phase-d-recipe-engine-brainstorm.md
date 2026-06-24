# Brainstorm — Module 1 Phase D: Recipe Engine

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-d-recipe-engine`
> Task: `.claude/tasks/m1-phase-d-recipe-engine.json`
> Plan ref: `creative-hub/docs/revamp/module-1-implementation.md` §Phase D

## Goal

Execute the recipe the Phase C router selected: run the recipe's expert lineup
sequentially, each step an LLM call (Expert `systemPrompt` + brand grounding +
prior step outputs), then Brand Guardian QA (pass/flag/retry), with cost logged
per expert. **Generic across all recipes** (read experts/recipes live). Poster is
the acceptance smoke.

**Acceptance (from handover):** poster recipe runs Strategist → Copywriter →
Art Director → Brand-Guardian, produces **spec + copy**, cost logged per expert.
Note the acceptance says spec+copy (text), *not* a final rendered PNG — image
render is a terminal concern (see Decision 5).

---

## Grounded findings (read the real code first)

| Fact | Source | Implication |
|------|--------|-------------|
| `runIntake` persists a **draft** `CreativeRun` (status=`draft`, recipeId, spec, lens, brandId, inputText) and returns gaps. **It does not enqueue anything.** | `src/lib/router.ts:273` | Phase D needs a **confirm → enqueue** trigger. |
| Module 0 queue: `enqueue({kind, payload, dedupeKey, lane, featureRunId,...})`; worker `dispatch` routes `kind="generate"` → `runGenerateHandler` → wraps **legacy** `runVisualJob`. | `job-store.ts`, `dispatch.ts`, `handlers/generate.ts` | The `generate` handler is the seam, but it currently means "legacy poster". Must not break it. |
| `HandlerResult = {ok, resultKind?, result?, costMyr?, retryable?, reason?}`. | `dispatch.ts:4` | Recipe handler returns the same contract. |
| `Recipe.steps` = `[{roleKey, modelTier?}]`; `Expert{roleKey, systemPrompt, modelTier(fast|standard|premium), enabled}`. | schema + seed-m1 | Engine loops steps, loads Expert live by roleKey, step.modelTier overrides Expert.modelTier. |
| `getBrandContext(slug)` surfaces **only** tagline/tone/targetAudience/coreOffer/keyMessages/dontSay + visualDna. The richer **M1 fields seed-m1 writes — `doNot[]`, `religiousGuidelines`, `signaturePhrases`, `contentPillars`, `audienceSegments` — are NOT surfaced.** | `brand-context.ts:43` vs `seed-m1.ts:14` | **`grounding.ts` must read those raw Brand fields** — they're the Brand Guardian's whole job. |
| `logUsage({module, model, inputTokens, outputTokens,...})`; `module` union = `"visual"\|"copy"\|"router"`. | `usage.ts:8` | Add a per-expert module tag (e.g. `"expert"`). `sumRunCostMyr(runId)` already aggregates per-run. |
| Pricing knows `gpt-4o` + `gpt-5` text rates only. **No tier→model map exists.** | `pricing.ts:9` | New tier→model map must map to a priced model. |
| `Artifact{runId, type, content(Json), exportFormat, mediaPath?, feedback?}`. | schema:137 | One Artifact per producing step. Guardian verdict is QA, not an output → goes to `CreativeRun.contextUsed`. |
| `CreativeRun.contextUsed` (Json) = grounding slot, empty now. | schema:97 | Record `{grounding, guardian:{verdict,reasons}}` here. |
| `CreativeRun.outputJson` still **required** (`"{}"`); `spec`/`contextUsed` Json must never be literal `null` (Prisma 4). | M1-A carry-forward | Keep the discipline. |

---

## Approaches

### Approach A — New job kind `recipe` + dedicated handler
- **How:** confirm route enqueues `kind="recipe"`, payload `{runId}`. New `runRecipeHandler` + `runRecipe()` engine. Legacy `generate` untouched.
- **Pros:** clean separation; legacy poster pipeline never at risk; lane map explicit.
- **Cons:** touches Module 0 lane map (`job-kinds.ts`) + dispatch registry; two "generation" kinds to reason about; the handover explicitly named the `generate` handler as the seam.
- **Brand impact:** none extra.

### Approach B — Keep `generate`, branch in handler, engine renders image end-to-end
- **How:** confirm enqueues `kind="generate"`, payload `{runId}`. Handler loads the run: has `recipeId` → recipe engine; else → legacy `runVisualJob`. Engine runs text experts **and** the terminal gpt-image-2 render + overlay for `outputFormat="image"`.
- **Pros:** one kind; matches "the generate handler is the seam"; full poster PNG end-to-end.
- **Cons:** biggest scope — drags the whole image-render + overlay pipeline into Phase D; acceptance only asks for spec+copy; risks a sprawling first cut.
- **Brand impact:** needs visualDna + furniture too.

### Approach C — Keep `generate`, branch on `recipeId`, engine = expert text pipeline; image render is a thin terminal stage, deferred-friendly *(recommended)*
- **How:** confirm enqueues `kind="generate"`, payload `{runId}` (dedupeKey=runId). `runGenerateHandler` branches: run has `recipeId` → `runRecipe(run)`; else → legacy `runVisualJob` (unchanged). `runRecipe` loops `steps[]`, each = LLM text call (Expert prompt + grounding + transcript), writes one Artifact per producing step, logs cost per expert, runs Brand Guardian QA (pass/flag/retry, bounded 1 retry), writes verdict+grounding to `contextUsed`, sets status=`generated`. For `outputFormat="image"` the engine leaves a **`visual_direction` artifact** as the render contract and exposes a seam `renderTerminal(run, artifacts)` — wired to reuse the existing render/overlay path, but not required for Phase-D acceptance (spec+copy).
- **Pros:** matches the named seam **and** the acceptance scope; legacy path untouched (branch only when recipeId present — legacy runs have none); image render stays a clean seam to fill when wiring poster end-to-end; smallest correct first cut.
- **Cons:** poster doesn't emit a final PNG in this phase (by design — acceptance is spec+copy); the render seam is a follow-on.
- **Brand impact:** `grounding.ts` surfaces full M1 knowledge for experts + a strict guardrail block for the Guardian.

---

## Edge cases & failure modes

- **Disabled/missing expert in a live recipe:** skip a disabled non-guardian step with a notice; if the recipe's only producing steps are all disabled → fail non-retryable (misconfiguration). Missing Brand Guardian → run completes but mark `contextUsed.guardian = {verdict:"skipped"}`.
- **OpenAI fails mid-recipe:** return `{ok:false, retryable:true}` → Module 0 backoff re-runs the **whole** recipe. To stay idempotent, **delete prior Artifacts for the run at the start of each attempt** (clean re-run) — keyed by runId.
- **Guardian verdict = retry:** re-run the content-producing steps **once** with the guardian's reasons appended to the transcript, then accept regardless (no infinite loop). `flag` → keep output, mark run flagged. `pass` → done.
- **Incomplete brand grounding:** grounding builds from whatever fields exist; empty `doNot`/`religiousGuidelines` → Guardian still runs tone/keyMessage checks. Never throw on empty knowledge.
- **Brief still has gaps (spec incomplete):** confirm route should refuse to enqueue if required gaps remain (re-use Phase C `gapCheck`), or enqueue with a notice. Decision 6.
- **Double-confirm / double-click:** `dedupeKey=runId` makes enqueue idempotent (one active job per run) — already provided by Module 0.
- **Run not in draft (already generated):** confirm route rejects re-confirm unless explicitly re-running.
- **Role access:** generation inherits the run's owner; lens already resolved in Phase C. No new role gate (creative+marketing both allowed per their lens). Admin unaffected.

---

## Key decisions

1. **[Approach]** → **C** (branch `generate` on `recipeId`; expert text pipeline; image render = seam). *Confirm.*
2. **[Trigger]** Phase D includes a thin **confirm route** that enqueues the draft run (`POST /api/studio/[runId]/confirm` or `POST /api/studio/run`). The worker engine is the heart. *Confirm route in scope?*
3. **[Artifacts]** One `Artifact` per producing step (`type` from expert role / recipe `outputFormat`): strategist→`strategy`, copywriter→`copy`, art_director→`visual_direction`, social→`social`. Guardian → **not** an artifact; verdict to `contextUsed`. *Confirm granularity.*
4. **[Guardian retry]** Bounded **1** retry of content steps on `verdict=retry`, then accept. `flag` keeps output + marks run. *Confirm budget = 1.*
5. **[Image render]** Phase D stops at `visual_direction` + copy artifacts (acceptance = spec+copy). Actual gpt-image-2 render + overlay = a terminal seam `renderTerminal()`, wired as a follow-on (this phase: stub/seam only). *Confirm deferral.*
6. **[Gap guard]** Confirm refuses to enqueue while required gaps remain (reuse `gapCheck` on the stored spec). *Confirm.*
7. **[modelTier→model]** Map `fast→gpt-4o`, `standard→gpt-4o`, `premium→gpt-5` (only priced models; env-overridable). step.modelTier overrides Expert.modelTier. *Confirm map.*
8. **[Cost tag]** Extend `logUsage` `module` union with `"expert"`; tag each expert call `module:"expert"` + carry `model`. Per-run total via existing `sumRunCostMyr`. *Confirm tag.*
9. **[Grounding]** New `grounding.ts` = `buildGrounding(brandSlug, lens, spec)` → `{expertBlock, guardrailBlock}`, reading the **full** M1 Brand knowledge (extends, does not duplicate, `getBrandContext`). Also addresses the Phase-C review's "dedupe getBrandContext" note where practical. *Confirm.*

## Models / files touched

- **Schema:** none (Phase A already has CreativeRun/Artifact/Expert/Recipe/contextUsed). No migration.
- **New libs:** `src/lib/recipe-run.ts` (the loop, injectable LLM dep), `src/lib/grounding.ts`, `src/lib/expert.ts` (load expert + tier→model + single expert call).
- **Expand:** `src/worker/handlers/generate.ts` (branch on recipeId), `src/lib/usage.ts` (`"expert"` module).
- **New route (Decision 2):** `src/app/api/studio/[runId]/confirm/route.ts` (thin: auth → owner check → gap guard → `enqueue`).
- **Verify scripts:** `scripts/m1d-recipe.ts` (deterministic engine test, injected fake LLM), `scripts/m1d-grounding.ts`, plus a live `scripts/m1d-smoke.ts` (real poster recipe).

## Recommendation

**Approach C.** It honours the named `generate`-handler seam, keeps the legacy
poster pipeline untouched (branch only fires when `recipeId` is set), matches the
spec+copy acceptance exactly, and leaves image rendering as a clean terminal seam
to wire when we take poster fully end-to-end. Deep-lib + inject-the-IO house style
throughout (the LLM call is a dependency so the engine is testable without OpenAI).
