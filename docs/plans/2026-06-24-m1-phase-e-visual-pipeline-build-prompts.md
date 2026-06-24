# Build Prompts — Module 1 Phase E: Visual Pipeline

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-e-visual-pipeline`
> PRD: `docs/plans/2026-06-24-m1-phase-e-visual-pipeline-prd.md`
> UX: `docs/plans/2026-06-24-m1-phase-e-visual-pipeline-ux.md`

House style: deep lib + thin handler + **inject the IO** (engine testable without OpenAI).
Test-first where practical (red → green). No schema change.

---

## Prompt 1 — `visual-direction.ts` (pure render-contract resolver) + unit test
**File:** `src/lib/visual-direction.ts` · **Test:** `scripts/m1e-direction.ts`
- Export `RenderMode`, `RenderContract`, `ResolveInput` (per PRD FR-1).
- `resolveVisualDirection(input): RenderContract` — pure, no IO:
  - `mode` from an explicit flag (`describe` only when `describeText` present **and** chosen;
    else `auto`).
  - `imagePrompt`: assemble deterministically — ratio sentence + `brand.visualDna` + the
    **source text** (art_director `visualDirectionText` for auto; `describeText` for describe) +
    the **layout-reserve boilerplate** (hard-reserve top-left ~28%×16% logo zone + bottom footer
    strip — lift the proven wording from `buildPosterPromptFromSpec`). Trim/clamp absurd length.
    Never return "".
  - `ratio`: `resolveRatio(spec)` — small platform→ratio map (feed→`1:1`, story/reel→`9:16`,
    landscape→`16:9`); fall back `9:16`. Tolerant of unknown/missing spec shape.
- **Tests (AC-4, AC-5):** auto → non-empty prompt containing the art_director text + reserve
  clause; describe → prompt seeded from describeText; ratio resolves from a spec platform; ratio
  falls back to 9:16 on empty/garbage spec. Run: `npx tsx scripts/m1e-direction.ts` (no DB/OpenAI).

## Prompt 2 — `renderFromRun` seam (injectable) + unit test
**File:** extend `src/lib/visual.ts` (or sibling `src/lib/visual-render.ts`) · **Test:** `scripts/m1e-render.ts`
- `renderFromRun({ runId, userId, deps? })` per PRD FR-2. `deps` injects `{ render, overlay }`
  (defaults = real `renderImage` + `applyBrandOverlay`) so tests run without OpenAI/sharp-on-real.
- Flow: load run owner-scoped → find `visual_direction` artifact (**absent → `{ok:true,skipped:true}`,
  never call render**) → `getBrandContext` → `resolveVisualDirection` → **delete prior `image`
  artifacts** → render → overlay (best-effort, never fails the render) → write `image` Artifact
  `{type:"image", mediaPath, exportFormat:"png", content:{ratio,prompt}}` → `logUsage(module:"visual",
  model:"gpt-image-2",...)` → `sumRunCostMyr` → `{ok:true,skipped:false,mediaPath,ratio,costMyr}`.
- Errors → `classifyVisualError` → `{ok:false,retryable,reason,category}`; text artifacts untouched.
- **Tests (AC-6,7,8):** with an injected fake render — (a) writes exactly one `image` artifact;
  (b) **idempotent**: two calls → still one image, text artifacts unchanged; (c) no
  `visual_direction` → `skipped:true`, fake render never invoked; (d) fake render throws moderation
  → `{ok:false,retryable:false,category:"moderated"}`, text artifacts intact. Needs DB (seed a run +
  artifacts), no OpenAI.

## Prompt 3 — worker handler wiring
**File:** `src/worker/handlers/generate.ts`
- After `runRecipe` returns ok, if a `visual_direction` artifact exists for the run, call
  `renderFromRun({runId, userId:run.userId})`. Fold render `costMyr` into the returned `costMyr`
  (sum, or just re-read `sumRunCostMyr`). Append a notice on render failure; do **not** flip the
  whole job to failed when text succeeded but image failed (text run is valuable) — return ok with
  the image-failed notice, OR (if we want retry of just the image) classify; **decision: keep the
  job ok + notice** this phase (no separate render retry — that's Approach B, deferred).
- Legacy `runVisualJob` branch unchanged.
- Verify the existing `m1d-*` recipe tests still pass (no regression on the text engine).

## Prompt 4 — live smoke `m1e-smoke`
**File:** `scripts/m1e-smoke.ts` — run with `node --env-file=.env.local --import tsx scripts/m1e-smoke.ts`
- Seed/confirm a poster `CreativeRun` (reuse the m1d-smoke setup), run the recipe to get a real
  `visual_direction` artifact, then `renderFromRun` against real gpt-image-2.
- Assert: an `image` Artifact with a `mediaPath` that exists on disk; PNG is non-trivial size;
  brand logo overlaid (manual eyeball of the saved file path printed); cost > 0 and folded into
  `sumRunCostMyr`. Print the saved file path. (AC-1,2,3 — change-logo check done manually once.)

---

## Gates after build
verify (lint + tsc + build) → `/bs-review` (spec + quality) → `/bs-release-notes` (CHANGELOG) →
`/bs-commit` → push (ask) → PR (pin fork: `--repo hibatullahmindquest/brief-studio --base master`).

## Env reminders
- Stop dev + worker before any `npm run build`/`prisma generate` (Windows EPERM on Prisma DLL —
  kill stray brief-studio node procs first).
- Live scripts need `node --env-file=.env.local --import tsx ...` (loads OPENAI_API_KEY).
- Docker `brief-studio-db` must be up for DB-backed tests.
