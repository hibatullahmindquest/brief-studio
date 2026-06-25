# PRD — Phase G: Studio UI (Task Workspace)

> Module 1 finale · Route: feature · Branch: `feat/m1-phase-g-studio-ui`
> Brainstorm: `.claude/plans/2026-06-24-m1-phase-g-studio-ui-brainstorm.md`
> Plan ref: `creative-hub/docs/archive/revamp/module-1-implementation.md §Phase G` + `studio-mockup.html`

## 1. Summary

Build **the Studio page** — the front-to-back creative task workspace. A single,
smooth 5-step flow (**Describe → Understand → Visual → Generating → Result**) wired
to the Phase C–F backend contracts, with a progressive **brief bar**, a **Recent**
drawer (Library read-layer), **lean nav**, and full empty/loading/error states.
**English chrome; AI text mirrors the user's brief language.**

Architecture: **Cara C (hybrid)** — server-rendered shell (nav/header/brief-bar shell)
+ a client orchestrator island for the live flow + a **deep-link result route**
`/studio/[runId]` so Recent cards reopen past runs and results are shareable.

## 2. Goals / Non-goals

**Goals**
- The full 5-step flow works end-to-end against real contracts (intake → confirm → poll → result).
- Recent drawer lists real runs (`/api/library`) and opens any run as a full result page.
- Export PDF + Regenerate image actions work on the result.
- English chrome; AI questions/output mirror the brief's input language.

**Non-goals (this phase)**
- Feedback persistence (👍/👎 rendered but display-only → **Phase H**).
- Deleting the old poster-era endpoints/components (left dormant; follow-up cleanup).
- Calendar/Campaigns nav targets beyond linking to existing pages.
- New AI capabilities — Phase G is wiring + 4 thin gap-closers only.

## 3. Backend gap-closers (required; all thin, NO migration)

| ID | Change | File(s) | Contract |
|----|--------|---------|----------|
| **G1** | Recipe job-status endpoint for the Generating poll. | `src/app/api/studio/[runId]/status/route.ts` (new); reuses `job-store` `getLatestJobForRun` + owner check. | `GET /api/studio/[runId]/status` → `{ status: "queued"\|"processing"\|"succeeded"\|"failed", resultKind?: string, notices?: string[], retryable?: boolean, reason?: string }`. 401/404 owner-scoped. |
| **G2** | Surface guardian verdict + notices on the result read. | `src/lib/artifact-store.ts` (`getRunArtifacts` — add `contextUsed` to `select` + return). | `GET /api/studio/[runId]` result gains `contextUsed: { grounding?, guardian?, notices? } \| null`. Additive — no break. |
| **G3** | Expose the regenerate-image seam. | `src/app/api/studio/[runId]/render/route.ts` (new) → `renderFromRun({runId,userId})`. | `POST /api/studio/[runId]/render` → `{ mediaPath, ratio, costMyr }` \| `{ skipped, reason }` \| 404 \| 502. Owner-scoped, idempotent (seam already deletes prior image). |
| **G4** | Gap questions in the user's language. | `src/lib/router.ts` (gap-question generation). | Gap `question` strings generated in the **input brief's language** (extraction already sees the text). `field` keys unchanged. Existing m1c tests must still pass. |

## 4. Functional requirements

### FR-1 — Server shell + nav (Cara C)
- `src/app/studio/page.tsx` (server): renders top note bar, sticky header (sidebar collapse toggle, "Studio" logo, Recent toggle ◷, account avatar), **lean left nav** (Create·Library·Calendar·Campaigns·— ·Settings group), the brief-bar shell, and mounts the client `<StudioWorkspace>` island. `requireUser()` guards.
- Sidebar collapsible to icon rail; hidden < 920px. English labels.

### FR-2 — StudioWorkspace orchestrator (client island)
- State machine: `step ∈ {describe, understand, visual, generating, result}`, holds `runId`, `intake` (StudioResponse), `artifacts` (RunArtifacts), `jobStatus`.
- Cross-fade between steps; **5-step stepper** (done/now states) + **breadcrumb** "Studio › <step>".
- Drives the **brief bar**: chips (Task, Objective, Angle, Format, Style, Mood, Colors) fill progressively as steps advance; empty chips dimmed.

### FR-3 — Step 1 Describe (front door)
- Big textarea "What do you want to make?"; **Upload brief** + **Paste URL** chips (uploads → `uploads[]`); quick-start type chips (Poster/Carousel/Copywriting/Marketing plan/Ideas) prefill intent; **Lens selector** (Marketing/Social — only lenses the user's role allows) → `explicitLens`; brand picker (`/api/brand`) → `brandSlug`; **Send →** calls `POST /api/studio`.
- On success → store `runId`+response, advance to Understand (or directly Visual/Generating if no gaps and recipe present — see flow rules).

### FR-4 — Step 2 Understand + gap
- Show grounded banner (intent/lens), the **understand card** (Task / Recipe pipeline / Experts chips / Output format from `recipe`), and the **gap section** ("I need to know") rendering `gaps[]`:
  - `field:"task_type"` (low confidence) → task-type clarify chips.
  - `field:"clarification"` (no recipe) → recipe-unavailable message.
  - `field:"platform"` → multi-select chips; other fields → free-text inputs.
  - Required vs optional indicated. Gap question text in brief's language (G4).
- **"Run recipe →"** → `POST /api/studio/[runId]/confirm` (after submitting answers via re-intake or confirm payload). If confirm returns **409 with `{gaps}`**, re-surface inline. **"Skip — use defaults"** allowed when no *required* gaps remain.

### FR-5 — Step 3 Visual direction
- Shown for runs whose recipe produces an image (poster/visual). AI-suggested direction/style/ratio card; ratio chips (9:16/1:1/4:5/16:9, AI-picked highlighted); steer = Describe-yourself / Regenerate-suggestion (Use-reference deferred per Phase E lock). Note: logo+footer auto-stamped post-generation.
- **⚡ Generate →** triggers confirm (if not already) → moves to Generating. Text-only runs skip this step.

### FR-6 — Step 4 Generating (poll)
- After confirm returns `jobId`, **poll `GET /api/studio/[runId]/status`** (G1) ~every 1.5s.
- Live expert checklist (Strategist → Copywriter → Art Director → Image gen → Brand overlay → Brand Guardian QA) with waiting/running/done states (derive from status/notices best-effort).
- On `succeeded` → fetch `GET /api/studio/[runId]` → Result. On `failed`/502 → error state + **Retry** (re-POST confirm; idempotent `dedupeKey=runId`). **Timeout** after ~N polls → "Still running — check Recent later" + link. User may leave; run continues server-side.

### FR-7 — Step 5 Result (+ deep-link route)
- Component `ResultView` consumes `RunArtifacts`: success pill ("On-brand · <lens>" from `contextUsed.guardian` — G2), meta badges (Done / RM cost / ratio·platform), **images carousel** (`images[]`), **copy block** (`texts[]` grouped strategy/copy/social), guardian notices.
- Actions: **👍/👎 (display-only)**, **↻ Variation** → `POST /api/studio/[runId]/render` (G3), **Export PDF** → `POST /api/studio/[runId]/export` (**hidden when `texts[]` empty**), **Take it further →** next-step offers (static this phase).
- **Deep-link route** `src/app/studio/[runId]/page.tsx` (server): `getRunArtifacts` → renders the same `ResultView`; 404 → not-found. Draft runs (no artifacts yet) → resume into the flow.

### FR-8 — Recent drawer
- Client island, **closed by default** (◷ toggles), hidden < 1180px. Fetches `GET /api/library` (cursor pagination). Cards: thumbnail (`thumbnailPath`), title, timestamp, mono badges (Draft / kinds incl 🖼/📄 / RM cost). Click → navigate to `/studio/[runId]`. Freshly-generated run animates in. Empty → "No runs yet."

## 5. Acceptance criteria

- **AC-1** Front door: a typed brief + brand + lens → `POST /api/studio` → advances with `runId`; uploads passed as `uploads[]`; notices surfaced.
- **AC-2** Gaps render correctly for all three `field` shapes (task_type chips, clarification message, platform multi-select, free-text); required vs optional honored.
- **AC-3** Confirm → poll → result happy path works end-to-end; Generating shows progress; on success the Result shows real images + copy + cost.
- **AC-4** Result QA pill reflects `contextUsed.guardian` (G2); guardian notices shown.
- **AC-5** Export PDF hidden when no text; visible + downloads when text present (200/skipped handled).
- **AC-6** ↻ Variation calls render (G3); `skipped` → toast; success → carousel updates.
- **AC-7** Recent drawer lists real runs from `/api/library`, closed by default; clicking a card opens `/studio/[runId]` with that run's result; draft resumes.
- **AC-8** Deep-link `/studio/[runId]` server-renders a past result; unknown/own-scoped → 404.
- **AC-9** Failure states: intake/confirm 502 → retryable banner + retry; job `failed` → retry; poll timeout → "check Recent" message. No raw 500s.
- **AC-10** Chrome is English; AI gap questions + output mirror the brief's input language (G4). m1c/m1d/m1e regression suites still pass.
- **AC-11** `npm run lint` + `tsc --noEmit` + `npm run build` clean; no schema change/migration.

## 6. Affected surface

**New (UI):** `src/app/studio/page.tsx` (rewrite), `src/app/studio/[runId]/page.tsx`, `src/components/studio/StudioWorkspace.tsx`, `StepDescribe`, `StepUnderstand`, `StepVisual`, `StepGenerating`, `ResultView`, `BriefBar`, `Stepper`, `RecentDrawer`, `StudioNav` (names indicative). Reuse `chat-ui.tsx` primitives + `globals.css` SCIS v6 tokens.
**New (API):** `api/studio/[runId]/status`, `api/studio/[runId]/render`.
**Edited (lib):** `artifact-store.ts` (G2), `router.ts` (G4).
**Retired (UI wiring):** old `StudioWizard`/`GuidedPosterFlow`/`ChatConversation`/`GenerationResult`/`VisualPanel`/`GenerationHistory`/`HistoryModal` removed from the studio page. **Old endpoints left dormant** (no delete this PR).

## 7. Risks

- **Stepper expert states** are best-effort (status endpoint reports job-level, not per-expert) → derive from `status`+`notices`; don't over-promise granularity.
- **G4 language** must not regress m1c router tests — keep `field` keys + thresholds; only the human-readable question string changes language.
- **Bundle size** — keep the orchestrator island lean; static chrome stays server-rendered.
- **Poll cost** — cap interval + timeout; stop on terminal status.
