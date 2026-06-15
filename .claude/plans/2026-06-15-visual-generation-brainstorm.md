# Brainstorm — Visual Generation from Studio Output

> Date: 2026-06-15 · Feature: turn the text output into actual images via OpenAI
> Flow: text output → **gpt-4o analyzes & plans the visual** → **gpt-image-2 renders** → display

---

## 0. Can OpenAI do this? — Yes

- **Text reasoning:** `gpt-4o` (already used for copy). Acts as a "visual director" — reads the output, decides what image(s) to make, writes the image prompt(s).
- **Image rendering:** `gpt-image-2` via the Images API (`images.generate({ model, prompt, size, n })`). Returns image(s) we save to `public/uploads/generated/`.
- Two-model split is the right architecture: gpt-4o is good at *deciding & describing*, gpt-image is good at *drawing*. Don't feed raw output straight to the image model — quality jumps when gpt-4o translates it into a tight, brand-aware prompt first.

---

## 1. Categorisation — output type → visual strategy  ✅ LOCKED

Image generation **only for visual/video outputs**. Hook & Copy is text-only → **no image**.

| Output type | Visual to produce | Image calls | Aspect source |
|-------------|-------------------|-------------|---------------|
| **Poster** | Single poster image | 1 | from brief `size` (1:1 / 9:16 / 16:9 / A4) |
| **Storyboard** | **One composite storyboard image** — all scenes as panels in a single picture | 1 | 16:9 or 9:16 per `platform` |
| **Video Script** | **One composite storyboard image** — one panel per key shot/scene | 1 | per `objective`/platform |
| ~~Hook & Copy~~ | **No image** — text output only | 0 | — |

So every visual output = **exactly one image** (poster, or a single multi-panel storyboard image). Simple + cheap.

---

## 2. What the analysis step determines (the "VisualPlan")

gpt-4o reads: the text output (primaryPost / scenes / strategy) + the original brief answers + brand context. It returns a structured **VisualPlan**:

```json
{
  "shouldRender": true,
  "kind": "poster | social_card | storyboard_grid | keyframe_grid | none",
  "aspect": "1:1 | 9:16 | 16:9",          // maps to gpt-image size
  "brandNotes": "deep blue + crescent, warm family tone; do NOT render exact logo or price text",
  "poster": {                              // present when kind = poster/social_card
    "prompt": "Full scene description for one image, brand-aware, no garbled text"
  },
  "scenes": [                              // present when kind = *_grid
    { "no": 1, "caption": "Hook — student stressed over SPM math", "prompt": "..." },
    { "no": 2, "caption": "...", "prompt": "..." }
  ]
}
```

Key things it decides:
1. **Kind** — poster vs grid (routed by output type, validated against actual content).
2. **Scene count** — *parsed from the real storyboard text*, not just the brief (the output is the source of truth; brief is the fallback).
3. **Per-frame prompts + captions** — each scene's frame described for the image model; caption shown in the UI.
4. **Aspect ratio** — mapped from brief.
5. **Brand guardrails** — inject brand colours/style; tell the image model NOT to render exact logo or exact price/date text (those are added by a designer — see §6).

---

## 3. Approaches

### Approach A — Type-driven (no analysis call)
Build the image prompt deterministically from the structured fields; image-gen directly.
- **Pros:** cheapest, fastest, predictable.
- **Cons:** dumb prompts, can't parse real scene count, no "should we even render" judgement. Doesn't match "let ChatGPT analyze & decide".

### Approach B — Analyze-then-render (AI visual director) ← matches your ask
gpt-4o produces the VisualPlan → gpt-image renders each prompt.
- **Pros:** smart, brand-aware prompts; parses true scene count; decides per output type; handles edge content gracefully.
- **Cons:** one extra gpt-4o call (cheap, ~1–2s); more moving parts.

### Approach C — Hybrid
`contentType` deterministically picks the *kind*; gpt-4o only writes the prompts + parses scenes.
- **Pros:** balance; removes the "wrong kind" risk.
- **Cons:** slightly less autonomous than B.

**Recommendation: B, guard-railed by C** — gpt-4o plans, but the *kind* defaults from `contentType` so it can't misroute (poster output never becomes a storyboard grid).

---

## 4. Storyboard grid — how it's made  ✅ LOCKED: G2 (single composite image)

One `images.generate` call renders the whole storyboard as a single multi-panel image, e.g. prompt:
> "A clean storyboard sheet, **5 numbered panels** in a 2-row grid, consistent art style and recurring characters across panels, each panel illustrating: (1) … (2) … . Leave a thin margin; cinematic, [brand mood]."

**Mitigations for G2's known weaknesses:**
- **Garbled in-image text** → instruct the model to keep panels *visual only* (minimal/no text in-image). The real **scene captions are rendered as clean HTML text below the image** (from the VisualPlan), so readability never depends on the image.
- **Panel/character drift** → prompt explicitly for "consistent character & art style across all panels".
- **One panel looks off** → "Regenerate" re-rolls the whole image (acceptable for a single-image model).

Result = one shareable storyboard image + a readable scene-caption list beneath it.
*(Fast-follow option: per-scene images for download — only if the team needs editable individual frames.)*

---

## 5. How the output appears (UI)

Only for **Poster / Storyboard / Video Script** outputs (Hook & Copy shows nothing). In the **RESULT** stage, below the text output, add a **Visual** panel:

- **Idle:** a card — "Jana visual untuk output ni" + **"Jana Visual"** button (user-triggered). Shows *what* + *estimated cost*: "1 imej storyboard 16:9 · ~RM0.42".
- **Planning:** "AI tengah rancang visual…" (gpt-4o director).
- **Rendering:** one spinner ("Melukis…") — single image either way now.
- **Done — Poster:** large image at the right aspect + **Download** + **Regenerate** + collapsible "prompt yang digunakan" + **actual cost** ("RM0.41 · gpt-image-2").
- **Done — Storyboard / Video:** the single composite storyboard image, with the **scene captions listed as clean text below** ("Scene 1 — …", "Scene 2 — …"). Download + Regenerate + cost.
- **Errors:** quota (402) → "OpenAI quota habis"; content-policy reject → "Visual ditolak, cuba ubah brief"; render fail → retry.
- History: the visual saves with the run → re-openable from the **Semakan Lepas** sidebar (HistoryModal shows the image).

---

## 6. Brand accuracy — important constraint (from PRD §15 "Logo Handling")
> Final logo / exact text placement should be done programmatically in an editor/compositor, **not** by the image model.

So: the AI image is a **concept / background visual**. We instruct gpt-image to leave clean space for logo + headline and **not** to render the real logo or exact price/date (it'll garble them). Brand *colours, mood, subject* go into the prompt; logo + final copy are overlaid later (manual now, compositor in a future phase). Set expectations in the UI: "Visual draf — logo & teks tepat ditambah oleh designer."

---

## 6b. Cost estimation & tracking  ✅ LOCKED (required)

Every generation shows its cost and is logged to a usage module (this is PRD §18).

**Pricing model (`src/lib/pricing.ts`):**
- gpt-4o (director call): input/output token rates → USD.
- gpt-image-2: per-image rate by size/quality → USD.
- `costMyr = costUsd × USD_TO_MYR` (rate from env/settings, editable later per PRD).

**Estimate before render:** poster/storyboard = 1 gpt-image call + 1 small gpt-4o call → show "~RMx" on the button. **Actual after render:** sum real token + image usage, show on the result, and write a log row.

**`APIUsageLog` model (PRD §17):**
```
id, userId, brandId, featureRunId?, module ("visual" | "copy"),
model, inputTokens, outputTokens, imageCount, imageSize,
costUsd, costMyr, createdAt
```
Logged on **every** gpt-4o and gpt-image call (copy generation too, not just visuals — so total AI spend is captured).

**Usage module — `/dashboard/usage`:**
- Totals: today / this month, by module, by brand, by user.
- Most expensive requests.
- The editable USD→MYR rate.
- Nav item under **Admin** (or its own Workspace item). Replaces the "Reports/usage" SOON gap nicely.

UI rule: never show a raw API key — only cost numbers (PRD security rule).

## 7. Edge cases & failure modes
- **Scene count unparseable** from output → fall back to brief `scenes` (3/5/7).
- **Image content-policy rejection** → surface, let user tweak brief/prompt and retry.
- **Quota / cost** → confirm before rendering an N-frame grid (e.g. "5 imej akan dijana"); log to APIUsageLog (images are the expensive part).
- **Latency** — gpt-image ~10–30s each; 7-scene grid could be 2–3 min → render sequentially with live progress, or parallel with a small cap. Consider not blocking: render in background, stream results.
- **Brand context incomplete** → still works (generic style), but flag "brand visual rules tak lengkap".
- **Text-in-image garbling** → covered by §6 (don't ask for exact text).
- **Hook & Copy** → visual is optional; gpt-4o may return `shouldRender:false` if copy is text-only (e.g. a plain announcement) → show "Tak perlu visual" instead of forcing one.
- **Role access** — creative + admin (poster/storyboard are creative outputs); marketing can still trigger the social_card for Hook&Copy.

---

## 8. Decisions — ✅ LOCKED
- [x] **Pipeline** — gpt-4o director (VisualPlan), kind guard-railed by output type.
- [x] **Visual outputs** — Poster, Storyboard, Video Script only. Hook & Copy = no image.
- [x] **Storyboard/Video** — one composite multi-panel image + scene captions as text below.
- [x] **Trigger** — user-clicks "Jana Visual" (cost-gated).
- [x] **Cost** — estimate on button + actual on result + log every call to `APIUsageLog`; `/dashboard/usage` module.
- [ ] **Storage** — files `public/uploads/generated/`; refs in `FeatureRun.output.image` (MVP) vs `GeneratedAsset` model. (recommend output JSON + disk for MVP)
- [ ] **USD→MYR rate** — env constant for MVP, editable in settings later? (recommend env now)
- [ ] **Model name** — `gpt-image-2` per CLAUDE.md; sizes 1024² / 1024×1536 (9:16) / 1536×1024 (16:9); A4→portrait. Confirm.

### Build surface (when approved)
- **`src/lib/visual.ts`** — `planVisual(output, brief, brand)` (gpt-4o → VisualPlan) + `renderImage(prompt, size)` (gpt-image-2) → save to disk; returns image ref + usage.
- **`src/lib/pricing.ts`** — token + image price tables, `estimate()` + `actual()` → USD/MYR.
- **`POST /api/generate/visual`** — `{ featureRunId }` → plan → render → save file → log `APIUsageLog` → return `{ image, captions, costMyr }`.
- **`GET /api/usage`** + **`/dashboard/usage`** page — totals by module/brand/user, top spends, rate.
- **Prisma:** `APIUsageLog` model; extend `FeatureRun.output` with `image` + `visualPlan`.
- **UI:** `VisualPanel` in `GenerationResult` (idle+estimate / planning / rendering / done+cost / error); HistoryModal shows the image; nav gets **Usage**.

---

## 9. Recommendation (one line)
gpt-4o **VisualPlan director** (type-guarded) → **one gpt-image-2 image** per visual output (poster, or single multi-panel storyboard + captions below), **user-triggered with cost shown and every call logged to a Usage module**; Hook & Copy stays text-only; logo/exact-text left to a later compositor.
