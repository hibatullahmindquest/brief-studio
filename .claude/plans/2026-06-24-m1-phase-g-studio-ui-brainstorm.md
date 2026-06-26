# Phase G — Studio UI (Task Workspace) · Brainstorm

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-g-studio-ui`
> The LAST Module 1 phase. Plan ref: `creative-hub/docs/archive/revamp/module-1-implementation.md §Phase G` + `studio-mockup.html`.

## TL;DR

Phase G builds **the page** — a single Studio Workspace driving the 5-step flow
**Describe → Understand → Visual → Generating → Result**, in **English chrome**,
wired to the Phase C–F contracts. But it is **not** a pure wiring job: the Explore
map found **three backend gaps** the screens cannot work without. Closing them is
in-scope (all thin, no migration).

---

## Context recap (what already exists)

- **Contracts shipped (A–F):** `POST /api/studio` (intake → `runId`+`lens`+`recipe`+`gaps`), `POST /api/studio/[runId]/confirm` (→ `jobId`, enqueues recipe job, idempotent `dedupeKey=runId`), `GET /api/studio/[runId]` (`getRunArtifacts`: images/texts/pdf/costMyr), `GET /api/library` (`listLibrary`: kinds[]+thumbnailPath+cursor), `POST /api/studio/[runId]/export` (PDF).
- **Seam built but NOT exposed:** `renderFromRun({runId,userId})` (`visual-render.ts`) — idempotent regenerate-image, only called from worker today.
- **Design system:** SCIS v6 tokens in `globals.css` (`--brand #3b4ee2`, `--orange`, teal sidebar `#00262a`, `editorial-*`/`v6-card` classes). Mockup CSS vars ≈ identical → direct mapping. `chat-ui.tsx` primitives reusable.
- **All current `src/components/studio/*` target OLD poster-era endpoints** (`visual-spec`, `confirm-spec`, `regenerate-text`, `run-output`, `/api/jobs`, `/api/generate*`, `/api/history`). They get replaced, not extended (keep only `chat-ui.tsx`).

## ⚠️ Backend gaps that MUST close (else screens can't function)

| # | Gap | Why needed | Fix (thin) |
|---|-----|-----------|-----------|
| G1 | **No recipe job-status endpoint.** `confirmRun` returns `jobId` but only legacy `GET /api/jobs` exists (feature-store, image-only shape). | The **Generating** screen needs to poll until the recipe job `succeeded`/`failed`. | Add `GET /api/studio/[runId]/status` → job-store latest job for run, returns `{status, resultKind, notices, retryable, reason}`. Owner-scoped. |
| G2 | **`getRunArtifacts` omits guardian/`contextUsed`.** | The **Result** "On-brand · Marketing" QA badge + notices come from `CreativeRun.contextUsed` (`{grounding, guardian, notices}`). | Extend `getRunArtifacts` to also `select` `contextUsed` and return it. Additive, no shape break. |
| G3 | **No regenerate-image route.** `renderFromRun` built re-invokable but unexposed. | The **Result** "↻ Variation" action. | Add `POST /api/studio/[runId]/render` → `renderFromRun`. Thin, maps skipped/ok/502. |
| G4 | **Gap questions hardcoded Malay** in `router.ts`. | Language must **mirror the user's brief** (English brief → English questions). | Generate gap questions in the input's language (the extraction step already sees the text). Small router tweak. |

All three: no schema change, no migration, deep-lib already exists → just thin routes + one additive read-layer field.

---

## Approaches (UI architecture)

### Approach A — Single-page client step-machine
One `StudioWorkspace.tsx` client component owns the whole flow as a state machine (`step`, `runId`, `intake`, `artifacts`), with brief-bar + stepper + recent-drawer as siblings reading shared state. Polls G1 during `generating`.
- **Pros:** matches mockup exactly (single page, cross-fade steps, brief bar fills progressively); trivial shared state; no reloads.
- **Cons:** one large client component; result not deep-linkable on its own; SSR lost for work panel.

### Approach B — Route-per-step (nested App Router)
`/studio` → `/studio/[runId]` → `/studio/[runId]/visual` → `/studio/[runId]/result`, each a server component fetching its data + small client islands.
- **Pros:** server-fetch per step, shareable URLs, native back-button, small bundles.
- **Cons:** breaks the single-page cross-fade mockup; transitions feel like reloads; brief-bar/stepper must re-derive each route.

### Approach C — Hybrid: server shell + client orchestrator island + deep-link result *(recommended)*
Server `page.tsx` renders static chrome (top note, header, sidebar nav, brief bar shell); a client `StudioWorkspace` **island** runs the live 5-step flow (matches mockup); **Recent drawer** is its own client island on `/api/library`; the **Result** screen is a shared `ResultView` component that the live flow renders inline AND a server route `/studio/[runId]` deep-links to (so Recent cards + abandoned drafts reopen).
- **Pros:** mockup's single-page flow preserved; static chrome SSR'd; result deep-linkable/shareable; Recent cards open past runs; incremental.
- **Cons:** a little extra wiring to share `ResultView` between island and deep-link route.
- **Brand impact:** lens selector + brand chips feed intake; brand context already injected server-side; guardian verdict surfaced on result (via G2).

---

## Edge cases & failure modes

- **Low intake confidence** (`confidence < 0.7`) → gap `field:"task_type"` sentinel → Understand screen shows task-type clarify chips, not a free-text gap.
- **No recipe for taskType+lens** → gap `field:"clarification"` → show recipe-unavailable message.
- **Gaps non-empty** → Understand gap section (required vs optional); platform = multi-select chips; others = free-text. "Run recipe →" calls confirm; **confirm can still 409 with `{gaps}`** if required missing → re-surface inline.
- **Recipe job fails** (`failed`/502) → Generating error state + Retry → re-POST confirm (idempotent `dedupeKey=runId`, returns `reused`).
- **Poll timeout** (job still processing after N tries) → "Still running — check Recent later" + link; don't hang.
- **Poster run, no text artifacts** → hide Export PDF (export already skip-gates); Result shows carousel only.
- **marketing_plan run, no image** → Result shows texts + PDF, no carousel.
- **Regenerate image when no `visual_direction`** → `renderFromRun` returns `skipped` → toast "No visual direction to regenerate."
- **Incomplete brand context** → intake still works (neutral default); guardian may flag → shown on result.
- **Abandon mid-brief** → run stays `draft`; appears in Recent as `Draft`; deep-link `/studio/[runId]` resumes.
- **Role access** — any authenticated team member; lens scope enforced server-side (`resolveLens`); UI lens selector offers only allowed lenses (marketing/social).
- **Empty states** — front door is the empty state; Recent drawer empty → "No runs yet."

---

## Key decisions

- [x] **UI architecture → Approach C** (server shell + client orchestrator island + deep-link result).
- [x] **Close G1/G2/G3 in this phase** — required for screens; all thin/additive, no migration.
- [x] **Polling → client poll of new `GET /api/studio/[runId]/status`** (no websockets; reuse job-store). Interval ~1.5s, cap with timeout fallback.
- [x] **Old components → replace.** Build fresh Phase G components; retire old studio page wiring; **keep `chat-ui.tsx` primitives**.
- [x] **Old API endpoints → leave dormant** (don't delete this PR — keeps it focused/reviewable; flag a follow-up cleanup). New UI simply stops calling them.
- [x] **Prisma models affected → none.** G2 selects existing `CreativeRun.contextUsed`. No migration.
- [x] **New routes → 2** (`GET /api/studio/[runId]/status`, `POST /api/studio/[runId]/render`) + 1 read-layer extension (`getRunArtifacts` returns `contextUsed`).
- [x] **Architecture → Cara C confirmed by user** (mockup shown: `C:\claude\temp\phase-g-approaches-explained.html`).
- [x] **Language → AI mirrors the brief's input language** (Malay→Malay, English→English, mix→follow). **Chrome stays English.** No toggle. → requires a **small router tweak**: gap questions currently hardcoded Malay (`router.ts`) must be generated in the user's input language. Folded into Phase G as a gap-closer (G4).
- [x] **Feedback 👍/👎 → display-only this phase, wire in Phase H** (user confirmed).
- [x] **Recent drawer → closed by default** (toggle opens); hidden < 1180px (user confirmed).

## Recommendation

**Build Approach C + close gaps G1–G3.** It is the only approach that both matches
`studio-mockup.html` (single-page cross-fade flow, progressive brief bar) and gives
deep-linkable/resumable runs for the Recent drawer. The three backend gaps are small,
additive, and unavoidable — fold them into Phase G as contract gap-closers. Feedback
👍/👎 is the natural Phase H seam; recommend rendering the buttons now but wiring them
in Phase H (display-only this phase) to keep scope contained.
