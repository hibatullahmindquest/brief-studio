# PRD — Module 1 Phase D: Recipe Engine

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-d-recipe-engine`
> Brainstorm: `.claude/plans/2026-06-24-m1-phase-d-recipe-engine-brainstorm.md`
> Plan ref: `creative-hub/docs/revamp/module-1-implementation.md` §Phase D

## 1. Summary

Execute the recipe the Phase C router selected. A confirmed draft `CreativeRun`
is enqueued as a `generate` job; the worker runs the recipe's expert lineup
sequentially — each step an LLM text call (Expert `systemPrompt` + brand grounding
+ prior step outputs) — writes one `Artifact` per producing step, runs Brand
Guardian QA (pass/flag/retry), logs cost per expert, and marks the run
`generated`. Generic across all recipes; experts/recipes read **live** from the DB
(admin-editable). Image rendering is deferred to a terminal seam.

**Locked decisions (A + A confirmed by user 2026-06-24):**
- Approach **C** — branch the existing `generate` handler on `recipeId`; legacy
  `runVisualJob` path untouched (legacy runs carry no `recipeId`).
- **Image render deferred** — engine stops at `strategy` + `copy` +
  `visual_direction` text artifacts. gpt-image-2 render + overlay = a terminal
  seam, wired in a follow-on phase.
- **Confirm route in scope** — `POST /api/studio/[runId]/confirm` is the trigger.

## 2. Scope

### In scope
1. `src/lib/expert.ts` — load enabled Expert by roleKey; tier→model map; single
   expert LLM call (injectable client) returning text + usage.
2. `src/lib/grounding.ts` — `buildGrounding(brandSlug, lens, spec)` →
   `{ expertBlock, guardrailBlock }`, reading the **full** M1 brand knowledge
   (contentPillars, audienceSegments, doNot, signaturePhrases,
   religiousGuidelines, signature colours/tone) — extends `getBrandContext`,
   does not duplicate it.
3. `src/lib/recipe-run.ts` — the engine: `runRecipe(run, deps)` loops the
   recipe's `steps[]`, accumulates a transcript, writes one Artifact per
   producing step, runs Brand Guardian QA, writes `contextUsed`, returns a
   structured result (artifacts, guardian verdict, total cost).
4. `src/worker/handlers/generate.ts` — branch: run has `recipeId` →
   `runRecipe`; else → legacy `runVisualJob` (unchanged).
5. `src/lib/usage.ts` — extend `module` union with `"expert"`.
6. `src/app/api/studio/[runId]/confirm/route.ts` — thin: auth → owner check →
   gap guard (reuse `gapCheck` on stored spec) → `enqueue(generate, dedupeKey=runId)`.
7. Verify scripts: `m1d-grounding.ts`, `m1d-recipe.ts` (deterministic, injected
   fake LLM), `m1d-smoke.ts` (live real poster recipe).

### Out of scope (deferred)
- gpt-image-2 render + brand overlay (terminal seam only — `visual_direction`
  artifact is the render contract).
- Studio UI to drive confirm/poll (later UI phase).
- Variations / bulk generation (Phase 2 non-goal).
- New task types beyond the seeded poster/caption/marketing_plan recipes.

## 3. Engine contract

```
runRecipe(run: CreativeRunForRun, deps?: RecipeDeps): Promise<RecipeResult>

CreativeRunForRun = { id, brandId, brandSlug, recipeId, lens, spec, intent, inputText, userId }
RecipeDeps        = { callExpert }   // injected LLM call → testable without OpenAI
RecipeResult      = { ok, artifacts: ArtifactOut[], guardian: GuardianVerdict, costMyr, status }
GuardianVerdict   = { verdict: "pass"|"flag"|"retry"|"skipped", reasons: string[] }
ArtifactOut       = { type, content }   // persisted as Artifact rows
```

Step execution (per `steps[]` entry, in order):
1. Load Expert by `roleKey` (live). Disabled/missing non-guardian step → skip + notice.
2. Resolve model = tier→model(step.modelTier ?? Expert.modelTier).
3. Build messages: system = `Expert.systemPrompt` + `grounding.expertBlock`;
   user = `spec` (formatted) + accumulated transcript of prior step outputs.
4. Call LLM (injected). Append output to transcript.
5. Persist one `Artifact{runId, type, content}` (type by role — see §4). Log usage
   (`module:"expert"`, model, tokens).
6. **Brand Guardian** is the QA role: its system prompt gets `grounding.guardrailBlock`;
   it returns structured `{verdict, reasons}` — NOT an Artifact.

Guardian handling:
- `pass` → done.
- `flag` → keep artifacts, set run flag in `contextUsed`, status `generated`.
- `retry` → re-run **content-producing** steps **once** with guardian reasons
  appended to the transcript, then accept regardless. (Bounded — no infinite loop.)
- missing guardian → `verdict:"skipped"`.

Idempotent re-run: at the **start** of each attempt, delete existing `Artifact`
rows for `runId` (Module 0 may re-run the whole job on retryable failure).

On success: `CreativeRun.status = "generated"`, `contextUsed = {grounding, guardian}`.

## 4. Artifact type mapping (by expert role)

| roleKey | Artifact.type | content shape (Json) |
|---------|---------------|----------------------|
| strategist | `strategy` | `{ text }` |
| copywriter | `copy` | `{ text }` (headline/body/CTA inside text) |
| art_director | `visual_direction` | `{ text }` — the render contract |
| social | `social` | `{ text }` |
| brand_guardian | — (no artifact) | verdict → `contextUsed.guardian` |
| (unknown role) | `text` | `{ text }` |

## 5. Decisions (resolved)

| # | Decision | Resolution |
|---|----------|-----------|
| 1 | Approach | C — branch `generate` on `recipeId` |
| 2 | Trigger | confirm route `POST /api/studio/[runId]/confirm` in scope |
| 3 | Artifact granularity | one per producing step; guardian excluded |
| 4 | Guardian retry budget | 1 (then accept) |
| 5 | Image render | deferred — `visual_direction` artifact is the seam |
| 6 | Gap guard | confirm refuses enqueue while required gaps remain |
| 7 | tier→model | fast→`gpt-4o`, standard→`gpt-4o`, premium→`gpt-5`; env-overridable; step.modelTier overrides Expert.modelTier |
| 8 | Cost tag | `logUsage` module `"expert"`; per-run total via `sumRunCostMyr` |
| 9 | Grounding | new `grounding.ts` surfaces full M1 knowledge; expert vs guardrail blocks |

## 6. Acceptance criteria

- **AC-1** A confirmed draft poster run (recipe `poster`) runs Strategist →
  Copywriter → Art Director → Social → Brand-Guardian in order and produces
  `strategy` + `copy` + `visual_direction` Artifacts (the "spec + copy").
- **AC-2** Cost is logged **per expert** (`module:"expert"`); `sumRunCostMyr(runId)`
  returns the recipe total > 0 after a live run.
- **AC-3** Brand Guardian verdict (`pass`/`flag`/`retry`) is recorded in
  `CreativeRun.contextUsed.guardian`; a `retry` verdict re-runs content steps at
  most once.
- **AC-4** Engine is generic: running the `caption` recipe (copywriter →
  guardian) produces a `copy` artifact with no code change.
- **AC-5** Legacy poster path untouched: a run **without** `recipeId` still routes
  to `runVisualJob` and behaves exactly as before.
- **AC-6** `runRecipe` is unit-testable with an injected fake LLM (no OpenAI key) —
  `m1d-recipe.ts` passes deterministically.
- **AC-7** Confirm route: rejects non-owner (403), rejects while required gaps
  remain (409), enqueues idempotently (dedupeKey=runId) otherwise.
- **AC-8** No schema migration. `verify` gate green (lint + tsc + build).

## 7. Risks / notes

- **Grounding gap is the headline risk** — Brand Guardian is useless without the
  M1 do-not/religious fields, which `getBrandContext` omits today. `grounding.ts`
  must read them from the raw `Brand` row.
- Prisma 4: `spec`/`contextUsed` Json never literal `null`; `outputJson` stays
  required (`"{}"`). modelTier values must map to a **priced** model or cost logs
  as fallback rate.
- Keep the LLM call injected (house style) so the deterministic shell is the test
  gate; live smoke only proves wiring + cost.
