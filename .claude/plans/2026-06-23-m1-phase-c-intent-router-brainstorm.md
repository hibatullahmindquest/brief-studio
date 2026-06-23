# Brainstorm — Module 1 Phase C: Intent Router

> Date: 2026-06-23 · Branch: `feat/m1-phase-c-intent-router` · Route: feature
> Plan: `creative-hub/docs/revamp/module-1-implementation.md` §Phase C
> Deps: Phase A (data model) + Phase B (admin) — DONE & merged (PR #15). Feeds Phase D (recipe engine).

## Goal (one line)

Raw input (describe text + optional uploads) → **understood task**: `{ task_type, lens, recipe, gaps }`, persisted as a draft `CreativeRun` ready for Phase D to execute.

## What already exists (grounding)

- **`CreativeRun`** has the exact slots the router fills: `lens`, `inputText`, `inputUploads[]`, `intent`, `spec` (Json), `recipeId`, `status` (`draft`→`confirmed`→`generated`). No schema change needed.
- **`Recipe`**: `taskType` (unique), `group`, `steps[]`, `outputFormat`, `lenses[]`, `enabled`. Router selects a row; lenses[] gates lens-compat.
- **`User.team`** = lens scope: `single` (locked) | `multi` (HOD, can pick) | `all` (admin, any).
- **`lens`** values seen in schema: `marketing` | `social` | `social_memo` (interpretation context — NOT the same as `teamRole`).
- `src/lib/openai.ts` (gpt-4o client), `src/lib/brand-context.ts` (brand → prompt block), `src/lib/error-log.ts` (never-throw `logError`).
- Existing `/api/studio/{visual-spec,confirm-spec,regenerate-text,run-output}` = the OLD poster guided flow. Phase C adds a NEW generic front door `POST /api/studio`; old flow stays until Phase D/E/G supersede it.

## Scope shape

```
POST /api/studio  (front door)
  auth (any team member)
  → resolveLens(user, explicitLens?)        src/lib/lens.ts
  → ingestUploads(inputUploads[])            src/lib/ingest.ts  → appended raw brief text
  → classify(rawBrief, brand, enabledRecipes) src/lib/router.ts → { taskType, intent, confidence }
  → selectRecipe(taskType, lens)             (deterministic DB lookup, lens-compat check)
  → gapCheck(recipe, extracted)              src/lib/router.ts → gaps[]
  → persist draft CreativeRun
  → return { runId, taskType, lens, recipe:{id,taskType,outputFormat,group}, gaps[] }
```

---

## Key open questions → approaches

### Q1 — Upload parsing depth for MVP

**Approach A — text + native image multimodal (RECOMMEND).** Accept `inputText` + already-uploaded image paths; pass images to gpt-4o vision directly. NO doc/OCR/video. The plan's acceptance examples are text-only; gpt-4o handles images natively with zero new deps.
- Pros: zero native deps, ships fast, covers the 80% (text brief + a reference image). Pure-TS → fully tsx-testable.
- Cons: PDF/docx/URL/video briefs not parsed yet.

**Approach B — + document parsing.** Add `pdf-parse`/`mammoth` to extract text from PDF/docx uploads.
- Pros: covers "here's my brief doc". Cons: more deps, more parse-failure surface.

**Approach C — full (OCR + URL/video via yt-dlp+ffmpeg).** As the plan lists.
- Pros: complete. Cons: native binaries on KVM8, heavy, high risk, slow. The plan itself lists multi-platform/heavy items as "out of scope → later".

→ **A for MVP.** `ingest.ts` exposes `ingestUploads()` with a clean seam so B/C slot in later without touching the router. Log + skip unparseable uploads (don't fail the request).

### Q2 — Lens resolution

**Approach A — deterministic: explicit > default > teamRole-derived (RECOMMEND).** `resolveLens(user, explicitLens?)`:
- `explicitLens` honoured only if the user's `team` scope allows it (`single` → locked to their default; `multi`/`all` → may pick).
- else account default (`UserPreference` — add a `defaultLens`? or derive from `teamRole`: marketing→`marketing`, creative→`social`). MVP: derive from teamRole, no new column.
- No LLM probe.
- Pros: deterministic, testable, no extra LLM call. Cons: a brief that "smells" like another lens isn't auto-detected.

**Approach B — + LLM probe fallback.** If no explicit/default, LLM infers lens from the brief.
- Pros: smarter. Cons: more magic + failure surface; lens is low-cardinality so a default is usually fine.

→ **A for MVP.** Picker UI (HOD/admin) is Phase G; Phase C just needs `resolveLens` to accept an optional explicit lens + enforce scope.
→ **DECISION NEEDED:** canonical lens value set + teamRole→lens default map (see Decisions).

### Q3 — Classification + recipe selection

**Approach A — LLM classifies into an enum; code resolves the recipe (RECOMMEND).** Fetch enabled recipes from DB → pass their `taskType` list (+ short description/group) into a gpt-4o **structured-output** call → returns `{ taskType (enum), intent, confidence, reasoning }`. Code then `prisma.recipe.findUnique({ taskType })`, validates `enabled` + `lenses` contains resolved lens.
- Pros: LLM constrained to real, enabled task types (no hallucinated ids); recipe selection is a deterministic, testable DB lookup; lens-compat enforced in code.
- Cons: two-step (classify → lookup), but that's the clean seam.

**Approach B — LLM returns recipeId directly.** Give it the recipe rows, it picks the id.
- Cons: id hallucination, tighter coupling, recipe metadata leaks into the prompt.

→ **A.** Structured output (JSON schema / tool-call) so the model must return a valid enum member. Low confidence or no-enum-match → treated as a clarification gap, not an error.

### Q4 — Gap-check output format

**Approach A — code-defined required fields per taskType/group + LLM phrases the questions (RECOMMEND hybrid).** A small in-code map (e.g. `poster` needs `platform`, `objective`, `headline_intent`; `marketing_plan` needs `objective`, `audience`, `timeframe`) — compare to what `classify` extracted → for each missing field emit `{ field, question, required }`. LLM (same call) extracts known fields + drafts the human question text.
- Pros: deterministic gap SET (testable: "poster brief w/o platform → gap includes platform"), flexible question wording. No schema change.
- Cons: required-fields map lives in code (acceptable for MVP; could become a `Recipe.requiredFields` column later).

**Approach B — pure-LLM gap-check.** LLM decides what's missing.
- Pros: zero hardcoding. Cons: non-deterministic → hard to TDD; gaps drift run-to-run.

→ **A (hybrid).** Deterministic field set drives TDD; LLM only phrases. Gaps returned as `gaps: [{ field, question, required }]`; empty array = ready to generate.

### Q5 — Does Phase C persist, or just analyze?

**RECOMMEND: persist a draft `CreativeRun`** (`status="draft"`) with `lens/inputText/inputUploads/intent/recipeId/spec(partial)`, return its `runId`. Phase D picks up the draft. Matches the existing draft lifecycle; gives Phase D a clean handoff + lets the UI resume. (Alternative — stateless analyze then a separate confirm — adds a round-trip with no MVP benefit.)

---

## Edge cases & failure modes

- **OpenAI fails/times out** → `logError("studio.classify", …)`, return 502 with retryable reason. Never 500 raw.
- **No matching/enabled recipe** for the classified taskType (or lens-incompat) → return `{ taskType, recipe:null, gaps:[clarification] }` (200, "couldn't match a recipe — clarify"), NOT an error.
- **Low classification confidence / ambiguous input** → emit a clarification gap instead of guessing.
- **Brand context incomplete** → classify still runs; missing brand knowledge surfaces as gaps (e.g. no audience segments → ask).
- **Upload unparseable / missing file** → skip it, log, proceed text-only (don't fail).
- **Empty input (no text, no uploads)** → 400 before any LLM call.
- **User abandons** → draft CreativeRun lingers; reuse/cleanup is a later concern (note for Phase F/G).
- **Access** — any authenticated team member; lens scope enforced by `User.team`. No admin gate (this is the product front door, not admin).
- **Cost** — one gpt-4o call per request; log via existing `usage`/`pricing` libs (tag `studio.classify`).

## Brand context impact

Classification is brand-aware: inject `brand-context.ts` block so "poster for raya promo" classifies with NakNgaji vs SifuTutor framing. Brand is read from DB by the run's `brandId` — never hardcoded. Lens + brand together shape both recipe selection and gap questions.

---

## Key decisions (LOCKED 2026-06-23)

- [x] **D1** Upload depth = **text + native image multimodal + document parsing (PDF/docx)**. Video/URL + OCR deferred (seam kept in `ingest.ts`). Docs via a light parser (`pdf-parse`/`mammoth` or similar) → extracted text appended to the raw brief; parse failure = skip + log, never fail the request.
- [x] **D2** Lens = **A (deterministic resolve)**, canonical set = **`marketing` · `social`** (2 only — matches the seeded recipes exactly).
  - **Definitions:** `marketing` = paid/campaign/strategy framing · `social` = organic publish-ready content.
  - **Default map (no `defaultLens` column — derive from teamRole):** marketing→`marketing`, creative→`social`.
  - **Scope:** `single` locked to its teamRole default; `multi` (HOD) / `all` (admin) may pick either lens. Picker UI = Phase G.
  - **`social_memo` = PARKED (idea only, not this phase)** — see Future/KIV. Adding it later is non-breaking: enum string + ≥1 recipe with it in `lenses[]`.
- [x] **D3** Classify = **A (LLM enum classify → code recipe lookup)**, gpt-4o structured output, constrained to enabled `taskType`s. Classifier may emit a likely `lens` only as a *suggestion*; final lens = `resolveLens` (deterministic, scope-enforced) — LLM never overrides scope.
- [x] **D4** Gap-check = **A (code-defined required fields per taskType, lens-aware + LLM phrasing)**; gaps = `[{field,question,required}]`. Required-field map in code (no schema change).
- [x] **D5** Persistence = **persist draft `CreativeRun`** (`status="draft"`), return `runId` + analysis.
- [x] **D6** New route `POST /api/studio`; libs `src/lib/{lens,ingest,router}.ts`. Old `/api/studio/*` poster flow untouched this phase.
- [x] **D7** No Prisma **schema** change, and **no data/seed change** (2 lenses already match seeded recipes). Relies on Phase A fields only.
- [x] **D8** Testability: `lens.ts` (resolve + scope), recipe-selection, gap-field logic = pure/DB → tsx verify `scripts/m1c-router.ts` (asserts: 2-lens resolve + scope enforcement; "poster…IG"→recipe `poster`; marketing-plan brief→`marketing_plan`; gap sets per taskType). LLM classify asserted loosely (enum membership + gaps present) / mocked; live smoke separate.

## Future / KIV (deferred this phase)

- **`social_memo` lens** — internal memo/brief interpretation for the social team (NOT publish-ready: a strategic summary + directive notes a human expands into posts). To add later (non-breaking): (1) add `social_memo` to the lens enum; (2) seed/admin a dedicated memo recipe (`taskType:"social_memo"`, `group:"strategy"`, `outputFormat:"text"`, `lenses:["social_memo"]`, `steps:[strategist, social]`); (3) explicit-pick only (no teamRole default; `multi`/`all` scope); (4) its own required-field set (objective/audience/key_points — no platform/headline). Expert prompts already reference "paid vs organic vs memo", so they're partly ready.
- Document parsing beyond PDF/docx; URL/video ingest (yt-dlp+ffmpeg); OCR.

## Recommendation

Ship the **deterministic-shell + single-LLM-call** router: `resolveLens` (deterministic) → `ingestUploads` (text+image only) → one gpt-4o structured-output call that **classifies into an enabled-taskType enum AND extracts known spec fields** → code does recipe lookup (lens-compat) + computes gaps against a code-defined required-field map → persist draft `CreativeRun`. Everything except the one LLM call is deterministic and TDD-able; uploads/lens-probe have clean seams for later. Matches the plan's acceptance examples with the least new surface and zero schema change.

**Confirm D1–D8 (esp. D2 lens set) before moving to PRD.**
