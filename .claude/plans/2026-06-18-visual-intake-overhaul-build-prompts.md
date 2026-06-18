# Build Prompts — Visual Intake Overhaul (Phase 1: Poster)

**Date:** 2026-06-18 · **Branch:** `feat/visual-intake-overhaul`
**PRD:** `docs/plans/2026-06-18-visual-intake-overhaul-PRD.md`
**Order matters** — each step is atomic + independently verifiable. Stop dev + worker before any `prisma generate`/build (Windows EPERM, per MEMORY).

---

## P1 — Data model + migration
**Goal:** schema for brand furniture + run lifecycle.
- `prisma/schema.prisma`:
  - `Brand`: `logoPath String?`, `posterFooterLeft String?`, `posterFooterRight String?`
  - `FeatureRun`: `status String @default("generated")` (values: `draft|confirmed|generated`)
- Migration `visual_intake_overhaul`. Legacy rows → `generated`.
**Verify:** migrate applies; `prisma generate` clean; tsc green.

## P2 — Brand DNA in brand context
**Goal:** inject the extracted visual DNA so output looks on-brand.
- `src/lib/brand-context.ts`: add a `visualDna` block to `promptBlock` per brand (SifuTutor: royal blue #2747DB + orange #F47C3C + yellow #FFE21F, bold-uppercase + script-accent 2-font, cut-out Malaysian school students sticker style, speech bubbles/sparkles, friendly/youthful/trustworthy; NakNgaji: green #35be89, friendly Islamic). Editable later via brand guidelines.
**Verify:** unit-ish — `getBrandContext("sifututor").promptBlock` contains the DNA; tsc green.

## P3 — Options-generator (director copy) API
**Goal:** free-text brief → suggested spec, anchored to angle.
- `src/lib/visual.ts`: add `planSpec({ brief, gaps, brand, outputTypeId })` → gpt-5 (env `OPENAI_MODEL`, `max_completion_tokens` 4500, `response_format` json_object) → `{ styleOptions[], moodOptions[], headline, accent, cta, concept, ratio }`. **Strip `<>`/markdown artifacts** from values; deterministic fallback (reuse `fallbackPrompt` pattern).
- `POST /api/studio/visual-spec`: `{ featureRunId, brief, gaps }` → calls `planSpec`, persists `inputJson.visualSpec`, sets `FeatureRun.status="draft"`, logs usage (APIUsageLog). Auth + ownership scoped.
**Verify:** curl/seed run returns spec; status=draft; usage logged; lint+tsc.

## P4 — Regenerate single text field
**Goal:** ↻ Jana semula for headline/accent/cta.
- `POST /api/studio/regenerate-text`: `{ featureRunId, field }` → gpt-5 returns one fresh value anchored to brief+angle+existing spec; update that field in `visualSpec`. Log usage.
**Verify:** repeated calls give varied on-angle suggestions; lint+tsc.

## P5 — Confirm spec
**Goal:** Sahkan Idea gate.
- `POST /api/studio/confirm-spec`: `{ featureRunId }` → set `FeatureRun.status="confirmed"`. (Generate button gated on status===confirmed.)
**Verify:** status transitions; lint+tsc.

## P6 — Enriched director prompt (render-in-image)
**Goal:** build the image prompt from spec + DNA + reserved zones.
- `src/lib/visual.ts` `planVisual`/`runVisualJob`: when `visualSpec` present, compose `imagePrompt` = brand `visualDna` + scene(`concept`) + **render headline (`headline`) + script accent (`accent`) + CTA button (`cta`)** + "keep top-left clear for logo, thin bottom strip clear for footer" + "spell Malay exactly". Ratio from spec (`9:16`→1024×1536).
**Verify:** generated prompt string contains headline/cta + reserve-zone instructions; one live poster on-brand (manual).

## P7 — Brand overlay (logo + footer)
**Goal:** stamp brand furniture post-render.
- `src/lib/visual-overlay.ts` (new): `applyBrandOverlay(buffer, brand)` using **sharp** — composite logo PNG (`brand.logoPath`, top-left, ~22% width, padding 34px) + footer SVG bar (left=`posterFooterLeft`, right=`posterFooterRight`, XML-escaped). Skip gracefully if no logo.
- Wire into `runVisualJob` after `renderImage`, before persist. Final flattened PNG saved as today.
**Verify:** poster shows logo + footer; missing-logo run still works; lint+tsc.

## P8 — Brand settings UI (admin): logo upload + footer
**Goal:** manage brand furniture.
- Logo upload endpoint (multipart → `public/uploads/generated/../brand/<slug>-logo.png`; validate PNG). Extend brand update for `posterFooterLeft/Right`.
- Admin brand settings page: logo upload control + 2 footer inputs + preview.
**Verify:** upload persists `logoPath`; footer saves; next gen uses them; lint+tsc.

## P9 — Studio guided-brief UI
**Goal:** the tab-C flow.
- New components: free-text brief box + objective chips → parsed-understanding → gap chips (style/mood, each with "Tulis sendiri" + "Biar AI decide"); live "Brief setakat ini" panel.
- Creative Spec card: editable HEADLINE/ACCENT/CTA fields each with **↻ Jana semula**; spec table; **Sahkan Idea** → **Generate Poster** (gated); **Ubah Spec**.
- Wire to P3/P4/P5 endpoints; Generate → existing `POST /api/generate/visual`.
**Verify:** full flow click-through against mockup tab C; lint+tsc+build.

## P10 — Semakan Lepas drawer: Draft state
**Goal:** show Draft + actions; keep cost/time/timer.
- `getRecentFeatureRuns` + visual-status: surface `status` (`draft`→ "○ Draft" badge + Edit/Generate; `generated`→ thumbnail + cost + time as today).
- Draft "Edit" reopens Spec; "Generate" enqueues (status→generated on completion).
**Verify:** draft appears immediately on spec synthesis; generate-later works; cost/time intact; lint+tsc+build.

## P11 — Cost rollup
**Goal:** include options-gen + director + image in `costMyr`.
- Ensure `runVisualJob` sums planSpec/regenerate usage already logged for the run into the persisted `outputJson.image.costMyr` (or document that spec-gen cost is tracked separately in APIUsageLog).
**Verify:** Semakan Lepas cost reflects total; lint+tsc.

---

## Gates (after P1–P11)
- **verify:** `npm run lint` + tsc + `npx next build` green; worker boots; one live E2E poster (SifuTutor) with logo+footer.
- **review:** stage 1 spec compliance (8 acceptance criteria) + stage 2 code quality.
- **release-notes:** CHANGELOG.
- **commit + PR** (pin fork; squash --delete-branch).

## Notes / risks
- Windows: stop dev+worker before prisma generate/build (EPERM).
- gpt-5 reasoning: generous token budget; guard empty output (reuse fallback).
- True 9:16 crop/pad deferred; ratio = 1024×1536.
- Suggest building in waves: **Wave A** P1–P7 (backend/pipeline, testable via script), **Wave B** P8–P11 (UI + settings).
