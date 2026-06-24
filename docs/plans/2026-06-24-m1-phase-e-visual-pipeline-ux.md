# UX / Integration Contract — Module 1 Phase E: Visual Pipeline

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-e-visual-pipeline`
> PRD: `docs/plans/2026-06-24-m1-phase-e-visual-pipeline-prd.md`

**No end-user UI this phase** (Studio UI = Phase G). This doc is the integration/lifecycle
contract — how the render seam lives inside the existing worker flow and what downstream
(Phase G) will read.

## 1. Lifecycle — where render slots in

```
POST /api/studio/[runId]/confirm   (Phase D — unchanged)
        │  enqueue kind="generate" dedupeKey=runId
        ▼
worker generate handler  (worker/handlers/generate.ts)
        │
        ├─ run has recipeId? ── yes ─► runRecipe()              (Phase D — text artifacts)
        │                                  │ writes strategy/copy/visual_direction/social
        │                                  ▼
        │                              visual_direction artifact present?
        │                                  │ yes
        │                                  ▼
        │                              renderFromRun({runId,userId})   ◄── NEW (Phase E)
        │                                  │ resolve contract → render → overlay
        │                                  │ write `image` Artifact (mediaPath)
        │                                  │ log image usage → re-sum cost
        │                                  ▼
        │                              HandlerResult { artifacts(+image), costMyr, guardian }
        │
        └─ no recipeId ──► runVisualJob()  (legacy poster — UNCHANGED)
```

- Render is the **last step** of an image-producing recipe run, but lives in its **own lib fn**
  (not inside `runRecipe`). Text artifacts are already committed before render starts.
- Text-only recipes (marketing_plan, caption) → no `visual_direction` artifact → render is a
  **no-op** (`skipped:true`).

## 2. Independently re-invokable (the decouple requirement)

`renderFromRun({ runId, userId })` takes **only a run id** — it reads the current
`visual_direction` artifact + brand furniture **live** and (re)produces the image. Therefore:

- **Regenerate image only** (future Phase G button) → call `renderFromRun` again on the same run.
  Idempotent: it deletes the prior `image` artifact and writes a fresh one. **Text untouched.**
- **Edit/regenerate text only** (future) → re-run producing experts / edit a text artifact
  **without** calling `renderFromRun` → the existing image stays. (Phase E just guarantees the
  seam is callable in isolation; the edit-text flow itself is later.)
- Latest-logo guarantee: because furniture is read live each call, AC-3 (change admin logo →
  next render uses it) holds for both the first render and any re-render.

## 3. Artifact shape downstream (what Phase G renders)

Per run, after an image recipe:

| Artifact.type | content | mediaPath | meaning |
|---------------|---------|-----------|---------|
| `strategy` | `{text}` | — | Strategist |
| `copy` | `{text}` | — | Copywriter |
| `visual_direction` | `{text}` | — | Art Director (the render contract source) |
| `social` | `{text}` | — | Social (if in lineup) |
| **`image`** | `{ratio, prompt}` | `/uploads/generated/<id>.png` | **rendered poster (Phase E)** |

`CreativeRun.contextUsed` still carries `{grounding, guardian, notices}`. A render notice/failure
is appended to `notices` so the poll/result view can show "image failed, text ready".

## 4. States (for the eventual UI, documented now)

- **loading** — job queued/processing (existing job status).
- **text-ready, image-pending** — recipe text artifacts written, render in progress (single-shot
  worker: brief window).
- **complete** — `image` artifact present + `mediaPath` resolves.
- **image-failed** — text artifacts present, no `image` artifact, notice in `contextUsed.notices`
  with the classified reason (moderated/quota/timeout/system). Text output is still usable.
- **skipped (text-only recipe)** — no image expected; not an error.

## 5. No new endpoints this phase
Render rides the existing confirm→enqueue→worker path. The standalone `renderFromRun` is a lib
fn; exposing it via an endpoint (e.g. `POST /api/studio/[runId]/render`) is Phase G's call.
