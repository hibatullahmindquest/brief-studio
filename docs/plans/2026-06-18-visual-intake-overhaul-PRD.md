# PRD — Visual Intake Overhaul (Phase 1: Poster)

**Date:** 2026-06-18 · **Route:** feature · **Branch:** `feat/visual-intake-overhaul`
**Brainstorm:** `.claude/plans/2026-06-18-visual-intake-overhaul-brainstorm.md`
**Mockup:** `C:\claude\temp\studio-flow-approaches.html` (tab C)

## 1. Summary

Replace the basic "pick type → generate" visual flow with a **guided, brand-aware brief**: free-text angle + AI-suggested chip questions → **Creative Spec** (editable headline/accent/CTA, each regenerate-able) → **Sahkan Idea** → **Generate**. Output is rendered by gpt-image-2 (render-in-image) with brand DNA injected, then a thin **logo + footer overlay** (from brand settings) is stamped on. All existing async/history/cost infra is preserved; a new **Draft** state is added. **Phase 1 = poster only**, SifuTutor + NakNgaji.

## 2. User stories

- As a creative, I describe my poster in my own words (angle, occasion, where it runs) and AI asks only the gaps with smart chip options, so I'm guided even when unsure.
- As a creative, AI suggests the headline + CTA; I can edit them or hit **↻ Jana semula** for fresh suggestions before anything is generated.
- As a creative, I see a **Creative Spec** I must confirm before the **Generate** button appears; if I don't confirm, the idea is saved as a **Draft** I can resume later.
- As any user, generated posters keep the live timer, recorded cost + time, and appear in the **Semakan Lepas** drawer — exactly as today.
- As an admin, I upload a brand **logo** + set **footer** text in brand settings; every future generation stamps them automatically.

## 3. Functional requirements

### 3.1 Guided brief (Studio, poster)
- FR1: First prompt is a **free-text brief box** (angle/occasion/placement) + objective chips. Free text is the primary signal.
- FR2: AI parses the brief → extracts objective, angle, format (placement→ratio) → confirms back, then asks only remaining gaps (style, mood) as **AI-suggested chips**.
- FR3: Every chip group includes **"✎ Tulis sendiri"** (custom) and **"Biar AI decide"**.
- FR4: A live **"Brief setakat ini"** panel reflects captured fields.

### 3.2 Creative Spec
- FR5: AI synthesizes a Spec: **headline**, **accent** (script phrase), **CTA**, concept, style/mood, brand guardrail, ratio.
- FR6: Headline / accent / CTA are **editable text fields**; each has **↻ Jana semula** (regenerate just that field, anchored to brief + angle).
- FR7: On synthesis, the Spec is **saved to history as a Draft** (no image yet).
- FR8: **Sahkan Idea** confirms the spec → the **Generate** button appears/enables.
- FR9: **Ubah Spec** returns to edit; an unconfirmed Draft is resumable from Semakan Lepas (edit / generate later).

### 3.3 Generation
- FR10: Generate enqueues a `GenerationJob` (existing worker) keyed by `featureRunId`.
- FR11: Director (`planVisual`, enriched) builds the image prompt = **brand DNA** + **reserved logo (top-left) + footer (bottom) zones** + headline/accent/CTA (render-in-image).
- FR12: After gpt-image-2 returns, a **brand overlay** (sharp) stamps **logo** (top-left) + **footer** (bottom) read from brand settings, then flattens to PNG.
- FR13: `generatedMs` + `costMyr` persisted into `outputJson.image` (existing); cost includes the extra options-generator gpt-4o call.

### 3.4 Brand settings (admin)
- FR14: Upload brand **logo** (transparent PNG) → stored under `public/uploads/brand/`.
- FR15: Set **footer** text (`footerLeft` + `footerRight`).
- FR16: Logo + footer are read **at generation time** → changing them affects only **new** generations (existing outputs are already flattened).

### 3.5 Semakan Lepas (right drawer)
- FR17: Stays a **right drawer** (existing HistoryDrawer). Adds a **Draft** state (spec, no image) with **Edit / Generate** actions, alongside **Siap** entries (thumbnail + cost + time).

## 4. Data model changes (Prisma)

- **Brand**: `logoPath String?`, `posterFooterLeft String?`, `posterFooterRight String?`
- **FeatureRun**: store the spec in `inputJson.visualSpec` = `{ angle, objective, style, mood, headline, accent, cta, concept, ratio }`.
- **FeatureRun.status** (LOCKED = Decision B): new column, default `"generated"` for legacy rows; values `"draft" | "confirmed" | "generated"`. Set `draft` on spec synthesis, `confirmed` on Sahkan Idea, `generated` once an image lands. Requires a migration. `getRecentFeatureRuns` + visual-status badge logic read this column (Draft badge + Edit/Generate actions in the drawer).

## 5. API

- `POST /api/studio/visual-spec` — gpt-4o options-generator: input `{ featureRunId, brief, brand, gaps }` → `{ styleOptions[], moodOptions[], headline, accent, cta, concept, ratio }`. Persists `visualSpec` (draft) to the run.
- `POST /api/studio/regenerate-text` — input `{ featureRunId, field: "headline"|"cta"|"accent" }` → returns a fresh suggestion (anchored to brief+angle); updates `visualSpec`.
- `POST /api/studio/confirm-spec` — set `visualSpec.confirmed = true`.
- `POST /api/generate/visual` — **existing**, enqueue; director reads `visualSpec` + brand overlay.
- Brand settings: extend brand update route + a **logo upload** endpoint (multipart → `public/uploads/brand/<slug>-logo.png`).

## 6. Brand overlay spec

- **Logo:** top-left, padding ~34px, target width ~22% of canvas, transparent PNG from `brand.logoPath`. Prompt reserves a clean top-left zone.
- **Footer:** full-width thin bar at bottom (~3.5% height), `footerLeft` left + `footerRight` right, on a subtle dark/scrim. Prompt reserves a clean thin bottom strip.
- Implemented with **sharp** (already installed, v0.34.5) compositing an SVG layer; XML-escape all text.

## 7. Acceptance criteria

1. A poster run starts from a free-text brief; AI confirms parsed objective/angle/format and asks only gaps.
2. Headline/accent/CTA are AI-suggested, editable, and each regenerates independently.
3. Spec is saved as a Draft before confirm; Generate appears only after Sahkan Idea.
4. An unconfirmed Draft is resumable from Semakan Lepas (edit + generate).
5. Generated poster shows brand DNA + correct Malay headline/CTA + stamped logo + footer.
6. Changing logo/footer in brand settings changes only new generations.
7. Timer, cost, time, history drawer all behave as before.
8. `npm run lint && tsc && build` green; worker boots.

## 8. Out of scope (deferred)

- Variations / batch generation (Phase 2).
- True 9:16/16:9 crop/pad (gpt-image-2 outputs 1024×1536; deferred).
- Storyboard / video-script guided intake (later phase).
- Controlling AI-invented decorative background text (tighten prompt; monitor).

## 9. Resolved decisions (locked 2026-06-18)

- **Q1 Draft state → B:** add explicit `FeatureRun.status` column (draft/confirmed/generated) + migration; legacy rows default `generated`.
- **Q2 Footer → two fields:** `posterFooterLeft` (©) + `posterFooterRight` (tagline).
- **Q3 Options-generator model → gpt-5** (env default `OPENAI_MODEL`, consistent with `planVisual`/`generateCopy`); set `max_completion_tokens` 4000–5000 (reasoning model needs budget, per MEMORY).
- **Q4 Logo upload → A:** multipart → local FS `public/uploads/brand/<slug>-logo.png`; Brand stores `logoPath`.
