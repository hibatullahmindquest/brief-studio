# Brainstorm — Visual Intake Overhaul (guided brief → spec → branded generation)

**Date:** 2026-06-18
**Route:** feature
**Branch:** `feat/visual-intake-overhaul`
**Status:** brainstorm done — validated with 3 real gpt-image-2 tests + interactive mockup

---

## Problem

Current Studio visual generation is "just a generator with a locked system prompt" — pick output type → it generates. No way for the user to:
- Steer style/mood/angle with expert-curated guidance (they may not know what to pick)
- Inject a **specific brief/angle** in their own words (e.g. "commercial poster, cuti-sekolah angle, IG Story")
- See & approve the **headline + CTA** before generating
- Get output that consistently looks like the SifuTutor designer's work

## Goal

Replace the basic wizard intake with a **guided, brand-aware brief flow** that produces on-brand posters with AI-suggested (editable) copy, while **preserving all the async/history/cost infrastructure already shipped**.

---

## Decisions locked (with user)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Interaction model | **C — Hybrid**: guided chat (free-text brief + 3–4 chip questions) → Creative Spec → confirm → generate |
| 2 | Options source | **AI-suggested per brief** (lens: creative director + still-life photographer + brand strategist) |
| 3 | Custom input | **Every option has "✎ Tulis sendiri"**; free-text brief box is the PRIMARY input |
| 4 | Headline + CTA | **AI suggests, all editable**, each with **↻ Jana semula** (regenerate just that text) |
| 5 | Text rendering | **A — render-in-image** (gpt-image-2 draws the text). Validated: renders Malay + 2-font beautifully |
| 6 | Brand furniture | **Logo + footer = thin overlay** stamped post-generation, from **brand settings** (read at gen time → future changes apply to new gens) |
| 7 | Brand DNA | Injected into director prompt (palette, 2-font, subject, mood, motifs) |
| 8 | Output scope | **Single output**, no variations (deferred) |
| 9 | Lifecycle | Spec saved to history as **"Draft"** on synthesis; **Sahkan Idea → Generate** button appears; unconfirmed draft resumable (edit/generate later) |
| 10 | Semakan Lepas | **Right drawer** (mirrors existing HistoryDrawer) — NOT a bottom strip |
| 11 | Rollout | **Phased — poster first**, then extend to storyboard/video-script |

---

## Interaction model — approaches considered

- **A — Smart Wizard** (step-based + AI chips + Spec review): fast, predictable, low effort; but form-like, weak for users who don't know what they want.
- **B — Full Chat** (open conversation): most natural; but meanders, **throughput risk** (50–100 variations/day target), hard to know "enough info".
- **C — Hybrid (CHOSEN)**: guided chat (bounded 3–4 Qs + free-text brief) → Spec card → confirm → generate. Natural + predictable + bounded. Throughput preserved because chat is only for the FIRST creative decision; re-generate/edit from the Spec/history is cheap.

## SifuTutor Visual DNA (extracted from 10 real designer posters)

- **Palette:** royal blue `#2747DB` dominant · coral-orange `#F47C3C` · yellow `#FFE21F` · green `#2FBF71` (festive/logo) · white
- **Typography (signature):** BOLD uppercase sans headline + handwritten SCRIPT italic accent keyword (coloured, sticker drop-shadow)
- **Composition:** portrait, cut-out Malaysian school students (uniforms) on solid colour bg, sticker style; speech bubbles; sparkles; sometimes pixel-art icons
- **Brand furniture (fixed every poster):** logo top-left (swirl "O") + footer ("© 2025 Sifu & Edu Learning Sdn Bhd" + "Malaysia's leading private tutoring platform")
- **Tone:** friendly, youthful, trustworthy, Malaysian-Islamic-aware
- NakNgaji DNA: green `#35be89`, friendly Islamic tone.

## Architecture (reuses shipped pipeline — async/history/cost untouched)

```
Studio: brand → output type → [NEW guided brief]
  ① free-text brief + 3–4 chip Qs (AI-suggested options, custom + "let AI decide")
  ② options-generator (gpt-4o) → style/mood + headline + accent + CTA, anchored to the brief's ANGLE
  ③ Creative Spec → saved to history as DRAFT; user edits / ↻ regenerate text; Sahkan Idea
  ④ Generate button → enqueue GenerationJob (existing worker)
  ⑤ director (planVisual, enriched) builds imagePrompt = brand DNA + reserved logo/footer zones + headline/accent/CTA
  ⑥ gpt-image-2 render (render-in-image)
  ⑦ brand overlay (sharp): stamp logo (top-left) + footer (bottom) from brand settings → flatten PNG
  ⑧ persist generatedMs + costMyr into outputJson.image (existing)
  ⑨ Semakan Lepas drawer shows Draft / Siap (cost + time) — existing infra + new Draft state
```

**Kept as-is:** `GenerationJob` + worker, live timer + "Tengah jana" badge, `generatedMs`/`costMyr` in `outputJson.image`, HistoryDrawer/Modal, generate-later (featureRunId-based).
**New:** guided brief UI, options-generator (gpt-4o) call, enriched director prompt, brand-overlay composite (sharp), brand settings fields (logo + footer), "Draft" FeatureRun state, ↻ regenerate-text endpoint.

## Validation (real tests — in C:\claude\temp\)

1. `poster-compare/` — render-in-image vs text-overlay → **render-in-image wins** (gpt-image-2 spells Malay correctly, integrated typography). Overlay only wins for variations (not needed).
2. `sifututor-test/` — pure gpt-image-2 with SifuTutor DNA → **~90% brand match** (palette, students, 2-font, speech bubble, CTA, even cursor icon). Only logo + footer missing → overlay handles those.
3. `sim-brief/` — free-text brief "commercial, cuti-sekolah, IG Story" → gpt-4o director wrote **"DAPAT MANFAAT CUTI SEKOLAH"** + render + logo/footer overlay → proves custom-angle understanding end-to-end.

Interactive mockup: `C:\claude\temp\studio-flow-approaches.html` (tab C = final agreed design).

## Edge cases

- Incomplete brand context → AI flags + safe defaults, don't block
- User unsure → every question has "Biar AI decide"
- Abandon mid-chat → Spec saved as Draft, resumable
- Output not satisfactory → ↻ Jana semula (text only) OR Ubah Spec → regenerate (image)
- Cost → extra gpt-4o call per session; tracked via existing APIUsageLog
- Role access → marketing vs creative output types (existing)

## Open / deferred

- **True 9:16/16:9 ratio:** gpt-image-2 only outputs 1024×1536 (2:3). True IG-Story ratio needs crop/pad post-step — **deferred** (logged in MEMORY).
- **`<>` artifact bug:** gpt-4o echoed placeholder brackets from the director prompt template → strip + tighten prompt in build.
- **Logo asset:** brand must upload a **transparent PNG**; footer stored as `footerLeft` + `footerRight` (or single field for MVP).
- **AI decorative text:** gpt-image-2 sometimes invents background text (mostly on-brand, occasionally odd) → constrain via prompt.
- Variations / batch → Phase 2.
- Storyboard / video-script intake → later phase (different needs: panels, shot list).

## Phased rollout

- **Phase 1 (this task):** guided brief + Spec + render-in-image + brand overlay + Draft state — **poster only**, SifuTutor + NakNgaji.
- **Phase 2+:** extend to storyboard/video-script; variations; true social-ratio crop/pad.

## Next workflow steps

PRD → UX (mostly captured in mockup) → build-prompts → build → verify → review → release-notes → commit.
