# Brainstorm — Module 1 Phase E: Visual Pipeline

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-e-visual-pipeline`
> Plan ref: `creative-hub/docs/revamp/module-1-implementation.md` §Phase E

## Goal

Turn the **deferred render seam** from Phase D into a real, brand-overlaid image.
Phase D's recipe engine stops at a `visual_direction` Artifact (free text from the
`art_director` expert). Phase E renders that into an image + stamps brand furniture.

**Acceptance (revamp doc):** poster generates correct ratio + exact logo overlay from
the admin asset; change the admin logo → next gen uses the new logo.

## What already exists (reuse, don't rebuild)

| Asset | File | Reuse |
|-------|------|-------|
| Image render (gpt-image-2 → save PNG) | `visual.ts` `renderImage()` | as-is |
| Brand overlay (logo variant auto-pick by luminance, size/corner, footer) | `visual-overlay.ts` `applyBrandOverlay()` | as-is |
| Spec→prompt builder | `visual.ts` `buildPosterPromptFromSpec()` | adapt — it's `VisualSpec`-shaped |
| Brand furniture (logoPath light/dark, logoSize, logoCorner, footer, colours, visualDna) | `getBrandContext()` | as-is (NOT `buildGrounding` — that lacks furniture) |
| Error classify + cost sum | `classifyVisualError()`, `sumRunCostMyr()` | as-is |
| Ratio→pixel size | `pricing.ts` `sizeForAspect()` | as-is |

**Artifact model is image-ready:** `mediaPath` + `exportFormat` columns exist. No migration.

## The core problem

`art_director` produces **free text** (`visual_direction` artifact). To render we need a
**structured render contract** — `{ imagePrompt, ratio }`. That bridge is the new
`visual-direction.ts` the revamp doc names. The "3 modes" (auto/reference/describe) are
3 ways to produce that contract.

---

## Approaches

### Approach A — Render INSIDE `runRecipe` (terminal step)
- After producing steps + guardian, if recipe is image-producing, `runRecipe` synthesises
  the render contract from the `visual_direction` artifact and renders.
- **Pros:** one job, one place; cost/status all settled in one function.
- **Cons:** mutates the merged, 20/20-tested engine core; couples text + image failure modes
  (an image moderation block would muddy the recipe result); harder to test the text engine
  in isolation. Violates the "engine is a deterministic shell" house style.

### Approach B — Separate job kind `kind="render"`
- `runRecipe` finishes (text), then enqueues a second job `kind="render"` (own lane/retry).
  A new `render` handler does direction→render→overlay→image artifact.
- **Pros:** clean separation; render retries independently; render can run on the slow lane.
- **Cons:** two jobs per run = more moving parts, status choreography (when is the run "done"?),
  poll UX sees two phases. Heavier than this phase needs; Module 0 lanes are there but the
  poster flow is interactive — user waits for the image.

### Approach C — Render as a terminal SEAM in the worker handler (separate lib fn) ★
- `runRecipe` stays text-only (untouched, tests intact). The `generate` handler, after
  `runRecipe` succeeds **and** the recipe output is visual, calls a new
  `renderFromRun(runId, userId)` in `visual.ts`/`visual-direction.ts`:
  1. `resolveVisualDirection()` → `{ imagePrompt, ratio, mode }` from the `visual_direction`
     artifact (+ spec + brand). (mode branch lives here)
  2. `renderImage()` → `applyBrandOverlay()` → write an **`image` Artifact** (`mediaPath`).
  3. log image usage; re-sum `sumRunCostMyr`.
- Same job, same wall-clock as the user expects; but render is its own injectable lib fn so
  it's unit-testable and render failure is classified separately (reuse `classifyVisualError`).
- **Pros:** zero change to the tested recipe engine; isolates render failure; matches house
  style (deep lib + thin handler + inject IO); mirrors how `runVisualJob` already orchestrates.
- **Cons:** the run is briefly `status="generated"` (text) before the image artifact lands —
  acceptable for single-shot worker; UI polls artifacts, not just status.

**Recommendation: Approach C.** It's the literal "terminal seam onto the artifact" the Phase D
handover described, keeps the merged engine untouched, and reuses the entire existing render
stack.

---

## The 3 visual-direction modes (which to build now)

| Mode | Input | Build now? |
|------|-------|-----------|
| **auto** | art_director `visual_direction` text + spec + brand → synthesise image prompt | **YES** — required for acceptance |
| **describe** | user's own free-text visual description (run.inputText / a spec field) used directly as the prompt seed | **YES — cheap**, no extra model call, just a branch |
| **reference** | user-uploaded reference image (`inputUploads`) → match style; needs multimodal/vision input to gpt-image-2 | **DEFER** — heavier, needs image-input plumbing; revamp doc allows defer |

**auto** mechanics — two sub-options:
- **A1: deterministic** — build the prompt straight from the art_director text + `brand.visualDna`
  + ratio, no extra LLM call. Cheapest; art_director already did the creative thinking.
- **A2: synthesiser LLM** — one small gpt-4o call turns the free text into a tight
  `{imagePrompt, ratio}` JSON (like `planSpec`). Cleaner prompts, +1 call cost.

Lean **A1 (deterministic) first** — the art_director output IS the visual direction; wrap it
with the layout/brand-reserve boilerplate from `buildPosterPromptFromSpec` and render. Add A2
only if poster quality needs it. Keeps cost down and the seam testable without OpenAI.

## Ratio strategy
- Contract carries `ratio: "1:1" | "9:16" | "16:9"`.
- Default from lens/platform (IG feed → 1:1, IG story/reel → 9:16), overridable from `spec`.
- For MVP, read ratio from `spec` if present, else default `9:16` (poster) — mirror existing
  `planSpec` fallback. Platform→ratio map can be a small const.

## Multi-platform variants → DEFER (revamp doc: optional/defer).

---

## Edge cases / failure modes

- **No `visual_direction` artifact** (recipe was text-only, e.g. marketing_plan) → render seam
  is a **no-op**; only fire when an image-producing recipe ran. Gate on artifact presence /
  recipe `outputFormat`.
- **Render fails (moderation/quota/timeout)** → classify via `classifyVisualError`; the **text
  artifacts survive** (already persisted). Surface a notice; non-retryable (moderation/quota)
  vs retryable (timeout/5xx) — reuse the existing mapping. Don't lose the run.
- **Overlay fails / logo missing** → `applyBrandOverlay` is already a safe no-op; render still
  succeeds with the bare image (existing behaviour).
- **Brand has no logo configured** → image renders, no logo stamped (acceptance still met when
  a logo IS configured; that's the test).
- **Idempotent re-run** (guardian retry already deleted+rewrote text artifacts) → render must be
  idempotent too: delete prior `image` artifacts for the run before writing, or key by attempt.
- **Cost** → log image usage (`module:"visual"`, model `gpt-image-2`) + re-sum so the run's
  total includes render. Sub-sen edge case noted in Phase D still applies.
- **Role access** → unchanged; render runs in the worker under the run's owner. No new surface.

## Decisions LOCKED (2026-06-24, confirmed by user)

- [x] **D1 — render trigger:** **Approach C** — render is a standalone seam (`renderFromRun(runId)`),
      called by the worker handler after `runRecipe` succeeds. The recipe engine stays text-only
      and untouched. **Rationale (user):** image render must be **decoupled** from text generation
      so the team can **regenerate/edit the text output without re-rendering the image**, and
      **regenerate the image without touching the text**. `renderFromRun` is therefore designed to
      be **independently re-invokable** (a future "jana semula gambar" button in Phase G calls the
      same fn on an existing run) and **idempotent** (clears prior `image` artifacts before writing).
- [x] **D2 — modes now:** **auto + describe**; **defer reference** (needs multimodal image input).
- [x] **D3 — auto mechanic:** **A1 deterministic** — build the gpt-image-2 prompt straight from the
      art_director `visual_direction` text + `brand.visualDna` + layout-reserve boilerplate. No extra
      LLM call (the art_director already did the creative thinking). Cheap + testable without OpenAI.
- [x] **D4 — gate:** fire render only when an image-producing recipe ran — gate on **visual_direction
      artifact presence** (text-only recipes like marketing_plan → render is a no-op).
- [x] **D5 — schema:** **none** — `Artifact.mediaPath` + `exportFormat` already exist.
- [x] **D6 — files:** new `visual-direction.ts` (resolve contract + auto/describe modes) +
      `renderFromRun` in `visual.ts`; reuse `visual-overlay.ts` as-is; thin branch in
      `worker/handlers/generate.ts`; `scripts/m1e-*.ts` (unit + live smoke).

## Proposed files

- `src/lib/visual-direction.ts` — `resolveVisualDirection(run, artifacts, brand) → RenderContract`
  (auto/describe branch; ratio resolve). Pure/injectable.
- `src/lib/visual.ts` — add `renderFromRun({runId,userId})`: contract → render → overlay →
  write `image` Artifact → log usage → re-sum cost. (or a sibling `visual-render.ts`)
- `src/worker/handlers/generate.ts` — after `runRecipe` ok & visual, call the seam.
- `scripts/m1e-*.ts` — unit (injected fake render) + live smoke (real gpt-image-2 poster).

## Carry-forward
- House style: deep lib + thin handler + inject the IO (engine testable without OpenAI).
- Read brand furniture LIVE via `getBrandContext` (admin-editable). REUSE overlay pipeline.
- DEFERRED (still open from visual-intake): headline = brand-name fix (headline should be the
  campaign message, not the brand name). Not in this phase unless it blocks acceptance.
