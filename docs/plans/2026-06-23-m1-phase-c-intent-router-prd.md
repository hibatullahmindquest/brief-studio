# PRD — Module 1 Phase C: Intent Router

> Date: 2026-06-23 · Branch: `feat/m1-phase-c-intent-router` · Route: feature
> Source brainstorm: `.claude/plans/2026-06-23-m1-phase-c-intent-router-brainstorm.md`
> Roadmap: `creative-hub/docs/revamp/module-1-implementation.md` §Phase C
> Deps: Phase A (data model) + Phase B (admin) — DONE & merged. Feeds Phase D (recipe engine).

---

## 1. Executive Summary

**Problem.** Today the only structured entry into generation is the bespoke poster flow (`/api/studio/visual-spec`). There is no generic front door that takes a free-form brief (optionally with attachments) and figures out *what* the user wants — which task type, under which interpretation lens, against which recipe — before any expert pipeline runs.

**Solution.** A single front-door endpoint `POST /api/studio` that turns raw input (describe text + image + PDF/docx) into an **understood task**: `{ task_type, lens, recipe, gaps }`, persisted as a **draft `CreativeRun`**. One gpt-4o structured-output call classifies the task type and extracts known brief fields; deterministic code resolves the lens (scope-enforced), looks up the recipe (lens-compatible), and computes what's still missing. The result hands a clean, validated draft to Phase D.

**Success Criteria (measurable).**
1. Both roadmap acceptance cases pass: `"Ad poster … IG"` → `{task: poster, lens: marketing, recipe: poster, gaps incl. any missing required field}`; a marketing-plan brief → `{task: marketing_plan, lens: marketing, recipe: marketing_plan}`.
2. Classification correct on **≥ 9/10** of a fixed 10-brief benchmark (`scripts/m1c-router.ts` + a labelled fixture set).
3. Lens resolution is **100% deterministic**: identical `(user, explicitLens?)` → identical lens; scope rules never violated (no `single` user gets a non-default lens).
4. Gap-check is **deterministic**: for a given `(taskType, extracted-fields)` the *set* of missing `field`s is reproducible (only the question wording is LLM-generated).
5. Every request persists exactly one draft `CreativeRun` and returns its `runId`; no orphaned/duplicate runs on a single call.
6. `lint` + `tsc --noEmit` + `npm run build` green; `scripts/m1c-router.ts` PASS.

---

## 2. User Experience & Functionality

### Personas
- **Marketing member** (`teamRole=marketing`, `team=single`) — types a brief, expects it understood as a marketing-lens task.
- **Creative member** (`teamRole=creative`, `team=single`) — same, defaults to social lens.
- **HOD / Admin** (`team=multi` / `all`) — may override the lens explicitly.
- (Phase C is API + libs only; the UI that calls it is Phase G. This PRD covers behaviour, not screens.)

### User Stories & Acceptance Criteria

**US-1 — Classify a typed brief.**
*As a team member, I want to type a brief and have the system identify the task type + recipe, so I don't pick from menus.*
- AC1: `POST /api/studio` with `{ brandSlug, text }` returns `200 { runId, taskType, lens, recipe:{id,taskType,outputFormat,group}, gaps[] }`.
- AC2: `taskType` is always a member of the set of **enabled** recipe `taskType`s (never hallucinated/disabled).
- AC3: A draft `CreativeRun` is persisted with `status="draft"`, `inputText`, `lens`, `intent`, `recipeId` (null if unmatched — see US-5), `spec` = extracted known fields.

**US-2 — Lens resolved by scope.**
*As the system, I resolve the interpretation lens deterministically and never exceed the user's scope.*
- AC1: lens set = exactly `{marketing, social}`.
- AC2: `explicitLens` honoured only if user `team ∈ {multi, all}`; a `single` user always gets their teamRole default (marketing→`marketing`, creative→`social`), even if `explicitLens` is sent.
- AC3: an invalid `explicitLens` value → `400`.

**US-3 — Attachments enrich the brief.**
*As a team member, I want to attach a reference image or a brief document and have it factored into classification.*
- AC1: image uploads are passed to gpt-4o as multimodal input; PDF/docx are parsed to text and appended to the raw brief.
- AC2: an unparseable/missing attachment is **skipped + logged**, never fails the request.
- AC3: URL/video attachments are out of scope (ignored with a logged note).

**US-4 — Gap-check tells me what's missing.**
*As a team member, I want to know what info is still needed before generating.*
- AC1: per-task-type **required fields** (see §4) are compared to extracted fields; each missing one yields `{ field, question, required:true }`.
- AC2: when no required field is missing and a recipe matched, `gaps` is `[]` (ready to generate).
- AC3: question wording is human-readable, brand/lens-aware; the `field` keys are stable/deterministic.

**US-5 — Ambiguous input asks for clarification (no guessing).**
*As a team member, when my brief is ambiguous, I want to be asked rather than get the wrong task.*
- AC1: when classification confidence is low, or the classified taskType has no enabled+lens-compatible recipe, the response sets `recipe:null` and includes a `gaps` entry `{ field:"task_type"|"clarification", question, required:true }`.
- AC2: the draft `CreativeRun` is still created (`recipeId=null`) so the clarification can resume against it.
- AC3: response stays `200` (a clarification is a normal outcome, not an error).

**US-6 — Failures are clean.**
- AC1: empty input (no text AND no usable uploads) → `400` before any LLM call.
- AC2: OpenAI error/timeout → `logError("studio.classify", …)` + `502` with a retryable reason; never a raw `500`.
- AC3: unauthenticated → `401`; any authenticated team member is authorised (no admin gate).

### Non-Goals (this phase)
- No expert pipeline / generation (that's Phase D) — Phase C only *understands* and persists a draft.
- No `social_memo` lens (parked — see brainstorm Future/KIV).
- No URL/video ingest, no OCR.
- No UI / Task Workspace (Phase G).
- No Prisma schema change, no seed change.
- No changes to the existing `/api/studio/{visual-spec,confirm-spec,regenerate-text,run-output}` poster flow.

---

## 3. AI System Requirements

**Model.** `gpt-4o` (text + vision) via `src/lib/openai.ts`. One call per request.

**Call shape.** Structured output (JSON-schema / tool-call) returning:
```
{
  taskType: enum(<enabled recipe taskTypes>),   // constrained
  intent: string,                                // one-line purpose
  confidence: number(0..1),
  suggestedLens: enum("marketing","social") | null,  // suggestion only; resolveLens decides
  extracted: { [field]: string }                 // known brief fields (objective, platform, key_message, audience, timeframe, …)
}
```
- The enum of `taskType`s is built at request time from enabled recipes — the model cannot pick a disabled/nonexistent type.
- `suggestedLens` never overrides `resolveLens` (scope is authoritative).
- A second, cheap step (same call) drafts gap **questions** for missing fields; field *detection* is deterministic code.

**Brand grounding.** Inject `brand-context.ts` block (read from DB by `brandSlug`/`brandId`) so classification + gap questions are brand-aware. Never hardcode brand values.

**Cost.** Log the call via existing `usage`/`pricing` libs, tagged `studio.classify`. Budget: one gpt-4o call (+vision tokens when an image is attached) per request.

**Evaluation Strategy.**
- **Deterministic units** (`scripts/m1c-router.ts`, tsx, live DB): lens resolve + scope matrix (marketing/creative × single/multi/all × explicit/none); recipe lookup incl. lens-incompat → null; gap-field sets per taskType for crafted extracted-field inputs; draft persistence (exactly one run, correct fields).
- **Classification benchmark**: a fixture of **10 labelled briefs** (covering poster/caption/marketing_plan, marketing & social lenses, 2 ambiguous) → assert `taskType` membership + correct match on ≥ 9, and that both ambiguous cases produce a clarification gap. LLM-dependent assertions are loose (enum membership, gap presence) to avoid flakiness; exact wording not asserted.
- **Live smoke** (separate, needs `OPENAI_API_KEY`): run the 2 roadmap acceptance briefs end-to-end through the route.

---

## 4. Technical Specifications

### Architecture / data flow
```
POST /api/studio
  body: { brandSlug, text?, uploads?: string[], explicitLens? }
  1. requireUser()                              (any team member)
  2. validate: text OR uploads present          else 400
  3. resolveLens(user, explicitLens?)           src/lib/lens.ts   (deterministic, scope-enforced)
  4. ingestUploads(uploads)                      src/lib/ingest.ts → { extraText, images[], skipped[] }
  5. classify(rawText+extraText, images, brand, enabledRecipes)  src/lib/router.ts → LLM structured output
  6. selectRecipe(taskType, lens)               src/lib/router.ts (DB lookup; enabled + lenses∋lens; else null)
  7. gapCheck(taskType, extracted)              src/lib/router.ts (required-field map + LLM question phrasing)
  8. persist draft CreativeRun                   (status="draft")
  9. → 200 { runId, taskType, lens, recipe|null, gaps[] }
```

### Modules (new)
- **`src/lib/lens.ts`** — `LENSES = ["marketing","social"] as const`; `resolveLens(user, explicit?)` with scope rules + teamRole default map; throws `400`-style error on invalid explicit value. Pure (no DB) → unit-testable.
- **`src/lib/ingest.ts`** — `ingestUploads(paths: string[]) → { extraText, images, skipped }`. Images pass through (paths for the vision call); `.pdf`/`.docx` parsed to text (light parser); unknown/failed → `skipped` (logged). Clean seam for future URL/video/OCR.
- **`src/lib/router.ts`** — `classify(...)` (the LLM call), `selectRecipe(taskType, lens)` (Prisma lookup), `REQUIRED_FIELDS` map + `gapCheck(taskType, extracted)`. Recipe lookup + gap-field logic are deterministic/DB → testable independent of the LLM.
- **`src/app/api/studio/route.ts`** — thin orchestration + auth + HTTP/error mapping (reuse `error-log.ts`). NEW file at the existing `/api/studio` segment root (siblings are subfolders, so no collision).

### Required-field map (LOCKED — "sederhana per-type")
| taskType | required fields |
|----------|-----------------|
| `poster` | `objective`, `platform`, `key_message` |
| `caption` | `objective`, `platform`, `key_message` |
| `marketing_plan` | `objective`, `audience`, `timeframe` |
- Unknown taskType (shouldn't occur — enum-constrained) → treated as US-5 clarification.
- Field keys are snake_case and stable; they are also the keys written into `CreativeRun.spec`.

### Integration points
- **DB (Prisma):** read enabled `Recipe`s (taskType enum + lens compat); read `Brand` by slug for grounding; create `CreativeRun` draft. No migration.
- **Auth:** `requireUser()` (session lib). `User.team` drives lens scope.
- **OpenAI:** `openai.ts` gpt-4o; `usage`/`pricing` for cost logging; `error-log.ts` for failures.

### Security & Privacy
- No new secrets. Brand data read from DB, never hardcoded, never logged in full.
- Uploads referenced by path only (already-uploaded assets); no blob in DB.
- Authenticated-only; no privilege escalation (lens scope can only *narrow* to the user's allowance).
- LLM input is the user's own brief + their brand context; no cross-brand leakage (single `brandId` per call).

---

## 5. Risks & Roadmap

### Phased rollout
- **MVP (this phase):** text + image + PDF/docx → classify → recipe → gaps → draft run, 2 lenses. Verified by `m1c-router.ts` + 10-brief benchmark + live smoke.
- **v1.1 (later):** `social_memo` lens + dedicated memo recipe; lens picker UI (lands with Phase G).
- **v2.0 (later):** URL/video ingest (yt-dlp+ffmpeg), OCR, richer per-recipe required fields (possible `Recipe.requiredFields` column).

### Technical risks
- **Classification drift / ambiguity** → mitigated by enum-constrained output + clarification-gap path (no silent wrong guess) + benchmark gate.
- **LLM latency/cost** (esp. with images) → one call only; cost logged; vision tokens accepted as the price of multimodal briefs.
- **Doc-parse fragility** (PDF/docx) → failures are non-fatal (skip + log); never blocks the request.
- **Recipe/lens mismatch in data** → `selectRecipe` returns null → clarification, never a crash. (Seed already aligns: poster/caption serve both lenses, marketing_plan serves marketing.)
- **Test flakiness from LLM** → deterministic assertions for the code path; loose (membership/presence) assertions for LLM output; exact wording never asserted.

---

## Open items carried to UX / build-prompts
- Exact request/response TypeScript types + error JSON shape (UX step).
- `classify` prompt + JSON schema wording (build step).
- The 10-brief benchmark fixture contents (build step).
- Choice of PDF/docx parser dependency (build step — prefer zero-native-dep pure-JS).
