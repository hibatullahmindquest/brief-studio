# PRD — Visual Generation from Studio Output

> Feature PRD · 2026-06-15 · Route: feature · Branch: `feat/visual-generation`
> Source: `.claude/plans/2026-06-15-visual-generation-brainstorm.md` · Mockup: `C:/Claude/temp/scis-visual-feature-mockup.html`
> Status: locked for build

---

## 1. Overview

After a Studio text output is generated, the user can produce an **AI image** for it. A **gpt-4o "visual director"** reads the output + brief + brand and returns a structured **VisualPlan**; **gpt-image-2** then renders **exactly one image**. Every AI call's cost is shown to the user and logged to a Usage module.

**Why:** the creative team gets an instant visual concept (poster / storyboard) straight from the brief, without leaving the tool — while keeping spend visible and tracked.

---

## 2. Scope

### In scope
- Visual generation for **Poster**, **Storyboard**, **Video Script** outputs.
- gpt-4o VisualPlan (kind, panels/scenes, prompt, aspect, brand guardrails), kind defaulted from output type.
- gpt-image-2 single-image render → saved to local filesystem.
- Cost **estimate** (pre-render) + **actual** (post-render), in MYR.
- `APIUsageLog` for **every** gpt-4o and gpt-image call (copy generation included).
- `/dashboard/usage` module (admin): totals, recent generations, by-module, USD→MYR rate.
- Visual shown in the result + saved with the run (visible in Semakan Lepas / HistoryModal).

### Out of scope (this feature)
- Hook & Copy visuals (text-only — explicitly no image).
- Per-scene individual images / downloadable separate frames (composite image only).
- Server-side image compositing (single composite from the model, not stitched).
- Logo/exact-text overlay, editor/compositor (future phase — designer does this).
- Editable USD→MYR via UI (env constant for now).

---

## 3. User flow

1. User completes a Studio brief → text output appears (existing flow).
2. If output type is Poster/Storyboard/Video Script, a **Visual panel** shows under the text with a **"Jana Visual"** button + **cost estimate**.
3. Click → **planning** (gpt-4o) → **rendering** (gpt-image-2) → **done**:
   - **Poster:** one image at brief aspect + actual cost + Download + Regenerate.
   - **Storyboard/Video:** one composite multi-panel image + **scene captions as text below** + cost + Download + Regenerate.
4. Visual is saved with the FeatureRun; re-openable from Semakan Lepas.
5. Admin can open **/dashboard/usage** to see cost totals and recent generations.

Hook & Copy outputs show no Visual panel (or a "tiada visual" note).

---

## 4. Functional requirements

### FR1 — VisualPlan (gpt-4o director)
`planVisual(output, brief, brand)` returns:
```json
{
  "shouldRender": true,
  "kind": "poster | storyboard | none",
  "aspect": "1:1 | 9:16 | 16:9",
  "brandNotes": "string — colours/mood; do NOT render logo or exact price/date",
  "imagePrompt": "string — the single image prompt (poster, or 'N-panel storyboard…')",
  "scenes": [ { "no": 1, "caption": "string" } ]   // present for storyboard/video
}
```
- `kind` defaults from output type (poster→poster; storyboard/video_script→storyboard; hook_copy→none) — gpt-4o may not override the family.
- Scene count parsed from the **actual output text**; fall back to brief `scenes` (3/5/7).
- Prompt must request **consistent style across panels** and **minimal/no in-image text**.

### FR2 — Render (gpt-image-2)
- `renderImage(prompt, size)` → one image. Size map: `1:1`→1024×1024, `9:16`→1024×1536, `16:9`→1536×1024, A4→portrait.
- Save to `public/uploads/generated/<runId>-<ts>.png`. Store path, never a blob in DB.

### FR3 — Cost estimate + actual
- **Estimate** before render (button): 1 gpt-image call (by size) + 1 small gpt-4o call → MYR.
- **Actual** after: real token usage (gpt-4o) + image usage (gpt-image) → USD → MYR (`× USD_TO_MYR`).
- Both shown in UI; actual written to `APIUsageLog`.

### FR4 — Usage logging
- Log a row on **every** gpt-4o and gpt-image call (visual director, image render, and the existing copy generation).
- Fields: `userId, brandId, featureRunId?, module, model, inputTokens, outputTokens, imageCount, imageSize, costUsd, costMyr, createdAt`.

### FR5 — Usage module `/dashboard/usage`
- Admin-only (page guard). KPIs: today / month total (MYR), images generated.
- Recent generations list (brand, type, model, cost).
- By-module breakdown. Current USD→MYR rate displayed.
- Never expose API keys.

### FR6 — Persistence & history
- FeatureRun output extended with `image` (path, aspect, prompt) + `visualPlan` (captions, kind).
- HistoryModal renders the saved image when present.

---

## 5. Data model (Prisma)

New:
```
model APIUsageLog {
  id           String   @id @default(cuid())
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId       String
  brandId      String?
  featureRunId String?
  module       String   // "visual" | "copy"
  model        String   // "gpt-4o" | "gpt-image-2"
  inputTokens  Int      @default(0)
  outputTokens Int      @default(0)
  imageCount   Int      @default(0)
  imageSize    String   @default("")
  costUsd      Float    @default(0)
  costMyr      Float    @default(0)
  createdAt    DateTime @default(now())
  @@index([userId, createdAt])
  @@index([brandId, module, createdAt])
}
```
Reuse `FeatureRun` (extend `output` JSON with `image` + `visualPlan`). User back-relation `apiUsageLogs APIUsageLog[]`.

---

## 6. API

- **`POST /api/generate/visual`** — body `{ featureRunId }`.
  - Auth: creative or admin. Loads the run + brand → `planVisual` → if `shouldRender` → `renderImage` → save file → update FeatureRun.output → log `APIUsageLog` (×2: director + render) → return `{ image, scenes, costMyr }`.
  - Errors: 402 quota, 422 content-policy (retryable), 404 run, 403 role.
- **`GET /api/usage`** — admin. Returns totals + recent rows (masked, no keys).

---

## 7. Cost / pricing (`src/lib/pricing.ts`)
- Token rates for gpt-4o; per-image rate for gpt-image-2 by size.
- `USD_TO_MYR` from env (default e.g. 4.70).
- `estimateVisual(kind, size)` and `actualFromUsage(usage)` → `{ usd, myr }`.

---

## 8. Non-functional
- Render latency 10–30s → clear progress states; no UI lock.
- All AI prompts include brand context (colours, tone, dont_say).
- Image is a **draft concept** — UI states logo + exact text added by designer.
- No API key in any response/log/screenshot.

---

## 9. Acceptance criteria
- [ ] Poster output → "Jana Visual" with estimate → renders 1 image at brief aspect → shows actual cost.
- [ ] Storyboard/Video output → 1 composite multi-panel image + scene captions as text below.
- [ ] Hook & Copy output → no Visual panel (or "tiada visual").
- [ ] gpt-4o `shouldRender:false` path handled (shows "tak perlu visual").
- [ ] Every gpt-4o + gpt-image call logged to `APIUsageLog` with MYR cost.
- [ ] `/dashboard/usage` shows today/month totals, recent generations, by-module, rate — admin-only.
- [ ] Image saved to disk + path in FeatureRun; visible in Semakan Lepas HistoryModal.
- [ ] Quota / content-policy errors surfaced gracefully + retryable.
- [ ] Brand context injected into prompts; no logo/exact-price requested.
- [ ] Verify gate green (lint + tsc + build).
