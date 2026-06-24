# PRD — Module 1 Phase E: Visual Pipeline

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-e-visual-pipeline`
> Brainstorm: `.claude/plans/2026-06-24-m1-phase-e-visual-pipeline-brainstorm.md`
> Plan ref: `creative-hub/docs/revamp/module-1-implementation.md` §Phase E

## 1. Summary

Render the `visual_direction` Artifact produced by the Phase D recipe engine into a real,
brand-overlaid image. The recipe engine stays text-only; rendering is a **standalone,
idempotent, independently-invokable seam** (`renderFromRun`) called by the worker's `generate`
handler after a recipe run succeeds — and re-callable later on its own (Phase G "regenerate
image"). Reuses the existing `renderImage` + `applyBrandOverlay` stack. **No schema change.**

## 2. Goals / Non-goals

**Goals**
- G1 — `visual_direction` text → gpt-image-2 image, saved as an `image` Artifact (`mediaPath`).
- G2 — Stamp brand furniture (logo variant by luminance, size/corner, footer) via existing overlay.
- G3 — Correct ratio from the run's platform/spec, with a sane default.
- G4 — `auto` mode (deterministic prompt from art_director text) + `describe` mode (user's own text).
- G5 — Render decoupled from text: re-running render never regenerates text; idempotent on re-run.
- G6 — Cost of the image render logged + folded into the run total.

**Non-goals (defer)**
- `reference` mode (match an uploaded image — needs multimodal input). 
- Multi-platform variant sets (one image per run this phase).
- Any UI (Phase G). The "regenerate image" button is Phase G; Phase E only ships the lib it calls.
- Storyboard multi-panel rendering (poster family is the acceptance target).
- The headline≠brand-name fix (still deferred).

## 3. Users / access
Internal team. Render runs in the worker under the run's owner (`userId`). No new auth surface.

## 4. Functional requirements

### FR-1 — Render contract (`visual-direction.ts`)
`resolveVisualDirection(input) → RenderContract` where:
```ts
type RenderMode = "auto" | "describe";
type RenderContract = {
  mode: RenderMode;
  imagePrompt: string;   // final gpt-image-2 prompt (non-empty)
  ratio: "1:1" | "9:16" | "16:9";
};
type ResolveInput = {
  visualDirectionText: string;     // the art_director artifact content.text
  describeText?: string | null;    // user's own visual description (run.inputText), if used
  spec: unknown;                    // run.spec (may carry ratio/platform)
  brand: { visualDna: string; primaryColor: string; secondaryColor: string; name: string };
};
```
- **auto** (default): `imagePrompt` = art_director text + `brand.visualDna` + the layout-reserve
  boilerplate (reserve top-left logo zone + bottom footer strip), assembled deterministically
  (no LLM call). Pattern mirrors `buildPosterPromptFromSpec` minus the structured-spec fields.
- **describe**: when the run carries a user visual description and the team opted to use it,
  seed the prompt from `describeText` instead of the art_director text (still wrapped with brand
  DNA + layout boilerplate). Mode is chosen by an explicit input flag, **not** guessed.
- **ratio**: from `spec` (platform→ratio map; IG feed→`1:1`, story/reel→`9:16`) else default
  `9:16`. Never empty.
- Pure function, no IO → unit-testable.

### FR-2 — Render seam (`renderFromRun` in `visual.ts`)
`renderFromRun({ runId, userId, deps? }) → RenderOutcome`
1. Load the run (owner-scoped) + its `visual_direction` artifact. **If none → `{ ok:true, skipped:true }`** (text-only recipe). 
2. Load brand furniture via `getBrandContext(brandSlug)`.
3. `resolveVisualDirection(...) → contract`.
4. **Idempotent:** delete any existing `image` artifacts for the run before writing.
5. `renderImage({ prompt: contract.imagePrompt, size: sizeForAspect(contract.ratio), runId })`.
6. `applyBrandOverlay(buffer, furniture)` → overwrite the saved PNG (safe no-op if no logo).
7. Write one `image` Artifact: `{ type:"image", mediaPath: urlPath, exportFormat:"png", content:{ ratio, prompt } }`.
8. `logUsage({ module:"visual", model:"gpt-image-2", imageCount, imageSize })`; re-sum `sumRunCostMyr`.
9. Return `{ ok:true, skipped:false, mediaPath, ratio, costMyr }`.
- The render call + overlay are **injectable** (`deps`) so the seam is unit-testable without OpenAI.
- On failure → classify via `classifyVisualError`; return `{ ok:false, retryable, reason, category }`.
  **Text artifacts are untouched** (already persisted by the recipe run).

### FR-3 — Worker wiring (`worker/handlers/generate.ts`)
After `runRecipe` returns ok, if the recipe is image-producing (a `visual_direction` artifact
exists), call `renderFromRun`. Fold render cost into the handler's `costMyr`. A **render failure
does NOT discard the successful text run** — surface it as a notice; classify retryable per the
existing mapping (moderation/quota = non-retryable, timeout/5xx = retryable). Legacy
(`runVisualJob`) path stays untouched.

### FR-4 — Cost & status
- Image usage logged under `module:"visual"`. Run total = `sumRunCostMyr` (text experts + image).
- Run `status` stays `"generated"`. (No new "rendering" state this phase.)

## 5. Data model
**No migration.** Uses existing `Artifact.mediaPath`, `Artifact.exportFormat`, `Artifact.content`.
New `image` artifact rows are additive.

## 6. Acceptance criteria

- **AC-1** — A poster recipe run produces an `image` Artifact with a real PNG at `mediaPath`,
  rendered from the `visual_direction` text. *(live smoke)*
- **AC-2** — The saved poster has the **brand logo overlaid** from the admin asset (correct
  variant by background luminance, at the configured corner/size). *(live smoke + visual check)*
- **AC-3** — Change the admin logo → next render uses the **new** logo. *(furniture read live)*
- **AC-4** — Ratio matches the platform/spec (or `9:16` default). *(unit)*
- **AC-5** — `resolveVisualDirection` returns a non-empty prompt for both `auto` and `describe`
  modes; ratio resolves from spec else default. *(unit)*
- **AC-6** — `renderFromRun` is **idempotent**: calling it twice yields exactly one `image`
  artifact; the second call does not regenerate text artifacts. *(unit, injected fake render)*
- **AC-7** — A text-only recipe (no `visual_direction` artifact) → `renderFromRun` returns
  `skipped:true`, writes no image, never calls the image API. *(unit)*
- **AC-8** — A render failure (simulated) returns a classified `{ok:false,...}` and leaves the
  run's text artifacts intact. *(unit)*
- **AC-9** — `lint` + `tsc` + `build` green. No schema change.

## 7. Risks / mitigations
- **gpt-image-2 ignores reserved logo zone** → reuse the proven layout-reserve boilerplate that
  hard-reserves top-left ~28%×16% + bottom strip (already tuned in `buildPosterPromptFromSpec`).
- **art_director text too verbose/garbled for an image prompt** → A1 wraps + truncates sensibly;
  if quality is poor in smoke, A2 (synthesiser) is the documented fallback (not built now).
- **Coupling text+image** → avoided by the standalone seam; render failure can't corrupt text.
- **Double images on retry** → idempotent delete-before-write (AC-6).

## 8. Out of scope → later
reference mode · multi-platform variants · storyboard panels · "regenerate image" UI (Phase G) ·
headline≠brand-name fix.
