# Build Prompts — Module 1 Phase D: Recipe Engine

> Date: 2026-06-24 · 6 prompts. Deep-lib + thin-handler + inject-the-IO house style.
> PRD: `...-prd.md` · UX/API: `...-ux.md`
> Run verify scripts: `node --env-file=.env.local --import tsx scripts/<x>.ts`
> (live ones need OPENAI_API_KEY); deterministic ones only need DATABASE_URL +
> `brief-studio-db` seeded via `scripts/seed-m1.ts`.

---

## Prompt 1 — `expert.ts`: load expert + tier→model + single expert call

**File:** `src/lib/expert.ts` (new). Also extend `src/lib/usage.ts` `module` union
with `"expert"`.

- `tierToModel(tier: string): string` — `fast`→`gpt-4o`, `standard`→`gpt-4o`,
  `premium`→`gpt-5`; env override `OPENAI_MODEL_PREMIUM`/`_STANDARD`/`_FAST`
  optional; unknown tier → `gpt-4o`. Must return a **priced** model (pricing.ts).
- `loadExpert(roleKey): Promise<ExpertRow | null>` — `prisma.expert.findFirst({where:{roleKey, enabled:true}})`.
- `type ExpertCall = (args:{ system:string; user:string; model:string }) => Promise<{ text:string; usage:{model,inputTokens,outputTokens} }>`.
- `defaultExpertCall: ExpertCall` — wraps `getClient().chat.completions.create`
  (no `response_format` — experts return prose; guardian parsing handled in P3).
  Mirror the quota→graceful pattern from `openai.ts` only if trivial; otherwise
  let it throw (engine treats as retryable).
- Keep it injectable: the engine receives `ExpertCall`, never imports OpenAI
  directly.

**Verify:** `scripts/m1d-expert.ts` (deterministic, no LLM) — asserts
`tierToModel` mappings + that every seeded Expert's `modelTier` maps to a model
present in `pricing` TEXT_RATES (guards the "must be priced" rule). `loadExpert`
returns the seeded strategist and `null` for a disabled/unknown roleKey.

---

## Prompt 2 — `grounding.ts`: full M1 brand knowledge → expert + guardrail blocks

**File:** `src/lib/grounding.ts` (new). **Red first:** `scripts/m1d-grounding.ts`.

- `buildGrounding(brandSlug, lens, spec): Promise<Grounding | null>` where
  `Grounding = { brandId, expertBlock, guardrailBlock }`.
- Read the **raw Brand row** (not just `getBrandContext`) to surface the M1 fields
  `getBrandContext` omits: `contentPillars[]`, `audienceSegments[]`, `doNot[]`,
  `signaturePhrases[]`, `religiousGuidelines`, colours/fonts, tagline/tone.
- `expertBlock` — brand voice for producing steps: name, tagline, tone, audience
  segments, content pillars, signature phrases, colours, + the current `spec`
  (formatted) + `lens` framing (marketing=paid/campaign, social=organic).
- `guardrailBlock` — the **hard rules** for Brand Guardian: `doNot[]` +
  `religiousGuidelines` + tone, phrased as pass/flag/retry checklist. Empty fields
  → omit lines (never throw on empty knowledge).
- Reuse `getBrandContext` for the parts it already builds; do **not** duplicate
  its prompt assembly — compose. (Also satisfies the Phase-C review "dedupe
  getBrandContext" note where practical.)
- Return `null` for unknown/inactive brand.

**Verify:** `m1d-grounding.ts` — sifututor + nakngaji: `expertBlock` contains a
content pillar + a signature phrase; `guardrailBlock` contains a `doNot` item;
nakngaji `guardrailBlock` contains the religious-guidelines text; unknown slug →
null. (No LLM.)

---

## Prompt 3 — `recipe-run.ts`: the engine (THE HEART)

**File:** `src/lib/recipe-run.ts` (new). **Red first:** `scripts/m1d-recipe.ts`
with an **injected fake `ExpertCall`** (no OpenAI).

- `runRecipe(run: RunInput, deps?: RecipeDeps): Promise<RecipeResult>` per PRD §3.
  - `RunInput = { id, brandId, brandSlug, recipeId, lens, spec, feature, userId }`.
  - `RecipeDeps = { callExpert: ExpertCall; grounding?: typeof buildGrounding }`
    (both injectable; default to real).
- Steps:
  1. Load recipe by `recipeId` (with `steps[]`). No recipe → throw non-retryable.
  2. `buildGrounding(brandSlug, lens, spec)` once; null → throw non-retryable.
  3. **Delete existing `Artifact` rows for `run.id`** (idempotent re-run).
  4. Loop `steps[]` in order; maintain a `transcript` string of prior outputs.
     - `loadExpert(step.roleKey)`; disabled/missing **non-guardian** → skip +
       push notice; continue.
     - model = `tierToModel(step.modelTier ?? expert.modelTier)`.
     - `brand_guardian` step → system = `expert.systemPrompt` +
       `grounding.guardrailBlock` + a strict "reply JSON `{verdict,reasons}`"
       instruction; parse verdict (`pass|flag|retry`, default `flag` on parse
       fail). Log usage (`module:"expert"`). **No Artifact.**
     - producing step → system = `expert.systemPrompt` + `grounding.expertBlock`;
       user = formatted `spec` + `transcript`. Call LLM; append to transcript;
       persist `Artifact{runId, type: typeForRole(roleKey), content:{text}}`; log
       usage (`module:"expert"`).
  5. **Guardian retry:** if verdict `retry` and not yet retried → re-run the
     producing steps **once** with guardian reasons appended to transcript
     (delete+rewrite their artifacts), then accept regardless.
  6. Persist `CreativeRun`: `status="generated"`,
     `contextUsed = { grounding:{brandId,lens}, guardian:{verdict,reasons}, notices }`
     (object, never null — Prisma 4).
  - Return `{ ok:true, artifacts, guardian, costMyr: sumRunCostMyr(run.id), status:"generated" }`.
- `typeForRole`: strategist→`strategy`, copywriter→`copy`, art_director→
  `visual_direction`, social→`social`, default→`text`.

**Verify:** `m1d-recipe.ts` — seed a draft poster `CreativeRun` (recipeId=poster
recipe, spec complete); fake `callExpert` returns role-tagged text + a guardian
`pass`. Assert: 3 producing Artifacts in order (`strategy`,`copy`,
`visual_direction`); guardian recorded in `contextUsed`; status `generated`;
re-running deletes+recreates (no dupes). Second case: guardian returns `retry`
once → producing steps run twice, then accept. Third case: `caption` recipe →
single `copy` artifact (AC-4, generic). No OpenAI key needed.

---

## Prompt 4 — worker handler branch

**File:** `src/worker/handlers/generate.ts` (expand).

- Resolve `runId = (job.payload as any)?.runId ?? job.featureRunId`.
- Load run `select { id, recipeId, brandId, userId, lens, spec, feature, brand:{slug} }`.
- `run.recipeId` present → `runRecipe({...run, brandSlug: run.brand.slug})`,
  then `adapt` → `HandlerResult{ ok, resultKind:"recipe", result, costMyr }`.
- else → existing `runVisualJob` path **unchanged**.
- Wrap `runRecipe` in try/catch: rethrow-as-result — non-retryable engine errors
  (no recipe / no grounding / no producing experts) → `{ok:false, retryable:false}`;
  anything else (OpenAI/transient) → `{ok:false, retryable:true}`. Use a small
  tagged error (e.g. `RecipeConfigError`) to distinguish, mirroring `StudioError`.

**Verify:** covered by P3 (engine) + P6 (live). Add a deterministic branch check to
`m1d-recipe.ts` if cheap: a run with no recipeId is **not** handled by `runRecipe`
(documents AC-5; the legacy call itself isn't exercised offline).

---

## Prompt 5 — confirm route + gap guard

**Files:** `src/lib/studio-confirm.ts` (deep lib) + thin
`src/app/api/studio/[runId]/confirm/route.ts`. Per UX §A.

- Deep lib `confirmRun(user, runId): Promise<{jobId, status, reused}>` — does the
  load / owner / state / recipe / gap checks; throws `StudioError(status,msg, extra?)`
  (reuse Phase C's `StudioError`; extend to carry `{gaps}` if needed). Calls
  `enqueue(...)` with `dedupeKey=runId`.
- Gap guard reuses `gapCheck(run.feature, run.spec as Record<string,string>, ctx)`
  from `router.ts` — required gaps remaining → `StudioError(409, "...", {gaps})`.
- Route: thin — `getSessionUser` → 401; `confirmRun` → map `StudioError` via the
  same response helper Phase C uses; 200 `{runId, jobId, status, reused}`.

**Verify:** `scripts/m1d-confirm.ts` (deterministic, no LLM) — seed runs:
(a) complete-spec draft poster → enqueues, returns jobId, second call reuses;
(b) draft with a required field blanked → throws 409 with gaps, no job;
(c) run owned by another user → 403; (d) already-`generated` run → 409.

---

## Prompt 6 — live smoke (real poster recipe end-to-end)

**File:** `scripts/m1d-smoke.ts` (live — needs OPENAI_API_KEY + seeded DB).

- Seed/locate a complete-spec draft poster `CreativeRun` for sifututor.
- Call `runRecipe` with the **real** `defaultExpertCall` (or enqueue + run one
  worker tick) → assert: `strategy`+`copy`+`visual_direction` Artifacts written;
  each contains non-empty text; `contextUsed.guardian.verdict` ∈ pass/flag/retry;
  `sumRunCostMyr(runId) > 0` and per-expert `APIUsageLog` rows have `module:"expert"`.
- Print the produced copy + guardian verdict + total RM for eyeballing.
- Keep cost tiny (one recipe run). This proves AC-1, AC-2, AC-3 live.

---

## Gate order after build

verify (lint + tsc + build, stop dev/worker first — Windows EPERM) → `/bs-review`
(2-stage) → `/bs-release-notes` (CHANGELOG) → `/bs-commit` → push (ask) → PR
(**pin fork**: `--repo hibatullahmindquest/brief-studio --base master`).
