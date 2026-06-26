# Build Prompts — Phase G: Studio UI

> Route: feature · Branch: `feat/m1-phase-g-studio-ui`
> PRD: `...-prd.md` · UX: `...-ux.md`
> Loop per prompt: **implement → `/bs-review` → user confirms "next"**.
> House style: deep-lib + thin-route + inject-the-IO. English chrome; AI text mirrors brief language. NO schema change/migration.

Order: backend gap-closers FIRST (so the UI wires to real contracts), then shell, then steps, then drawer/deep-link, then retire-old + polish.

---

## P0 — Backend gap-closers (G1–G4) + tests
**Goal:** the 4 thin contract gaps the UI depends on.
- **G1** `GET /api/studio/[runId]/status` (new route): auth → owner-scoped latest job via `job-store`; return `{ status, resultKind?, notices?, retryable?, reason? }`. 401/404.
- **G2** extend `getRunArtifacts` (`artifact-store.ts`): add `contextUsed` to the `CreativeRun` select; return `contextUsed: {grounding?,guardian?,notices?} | null`. Additive — existing m1f-library/m1f-smoke must still pass.
- **G3** `POST /api/studio/[runId]/render` (new route) → `renderFromRun({runId,userId})`; map `{mediaPath,ratio,costMyr}` / `{skipped,reason}` / 404 / 502.
- **G4** `router.ts`: generate gap `question` strings in the **input brief's language** (keep `field` keys + `CLARIFY_THRESHOLD` + required-field map unchanged).
**Test:** `scripts/m1g-gaps.ts` — status endpoint shape (queued/processing/succeeded/failed + owner 404), getRunArtifacts returns contextUsed (present + null), render route maps outcomes (mock seam), G4 language mirror (Malay brief→Malay Q, English brief→English Q) with m1c router assertions still green. **Regression:** m1c/m1d/m1e/m1f all pass.

## P1 — Shell + nav + globals tokens
**Goal:** server-rendered chrome.
- Rewrite `src/app/studio/page.tsx` (server, `requireUser`): top note bar, sticky header (collapse toggle, Studio logo, ◷ Recent toggle, avatar), lean left **StudioNav** (Create·Library·Calendar·Campaigns·—·Settings group), brief-bar shell, mounts `<StudioWorkspace>`.
- `StudioNav` (client for collapse state) — English labels; links Library→/studio? Calendar/Campaigns→existing pages.
- Add any missing SCIS v6 utility classes to `globals.css` (stepper, brief-chip, drawer). Reuse existing tokens.
**Test:** build + visual (renders, nav collapses, responsive ≥/< 920px).

## P2 — Orchestrator: StudioWorkspace + Stepper + BriefBar
**Goal:** the state machine + progress chrome (no per-step content yet — stubs).
- `StudioWorkspace.tsx` (client island): `step` machine, holds `runId/intake/artifacts/jobStatus`; cross-fade; breadcrumb.
- `Stepper.tsx` (1·2·3·4·5 with done/now), `BriefBar.tsx` (chips fill from intake/spec; dimmed when empty).
**Test:** build; step transitions via temporary dev buttons; brief chips fill from mock intake.

## P3 — Step 1 Describe (intake wiring)
**Goal:** front door → `POST /api/studio`.
- `StepDescribe.tsx`: textarea, Upload/Paste-URL chips (→ uploads[]), quick-start type chips, Lens dropdown (role-limited), Brand picker (`/api/brand`), Send →.
- On success store response, advance (Understand if gaps/recipe pending; else next). 502 → retryable banner.
**Test:** live or mocked intake call returns runId; uploads passed; lens/brand wired.

## P4 — Step 2 Understand + gap
**Goal:** render `recipe` + `gaps[]`, confirm.
- `StepUnderstand.tsx`: grounded banner, understand card (task/recipe/experts/output), gap section (task_type chips / clarification msg / platform multi-select / free-text), required vs optional.
- Run recipe → submit answers + `POST /api/studio/[runId]/confirm`; 409+gaps → inline. Skip-defaults when no required gaps. Question text in brief language (G4).
**Test:** all three gap `field` shapes render; confirm returns jobId → advance; 409 re-surfaces.

## P5 — Step 3 Visual direction
**Goal:** image-run visual confirm.
- `StepVisual.tsx`: direction/style/ratio card, ratio chips (AI-picked highlighted), Describe-yourself / Regenerate-suggestion, ⚡ Generate →. Text-only runs skip this step (orchestrator routing).
**Test:** shown for poster recipe, skipped for text recipe; Generate → Generating.

## P6 — Step 4 Generating (poll G1)
**Goal:** poll to completion.
- `StepGenerating.tsx`: expert checklist (best-effort from status/notices), poll `GET /api/studio/[runId]/status` ~1.5s; succeeded→fetch artifacts→Result; failed/502→Retry (re-confirm idempotent); timeout→"check Recent".
**Test:** mocked status progression queued→processing→succeeded drives UI; failed shows retry; timeout path.

## P7 — Step 5 Result + ResultView + actions
**Goal:** the result, shared with deep-link.
- `ResultView.tsx` (consumes `RunArtifacts`+`contextUsed`): QA pill (guardian G2), meta badges, images carousel, copy block (grouped texts, copy-to-clipboard), notices.
- Actions: 👍/👎 (display-only), ↻ Variation (`POST .../render` G3; skipped→toast; success→refresh carousel), Export PDF (`POST .../export`; **hidden when texts empty**; download; skipped→toast), static "Take it further".
**Test:** renders images+copy+cost+guardian; export hidden with no text; render updates carousel; export downloads.

## P8 — Recent drawer + deep-link route
**Goal:** library read + reopen.
- `RecentDrawer.tsx` (client island, **closed default**, hidden <1180px): `GET /api/library` cursor paging; cards (thumb/title/time/badges); click→`/studio/[runId]`; fresh animates in; empty state.
- `src/app/studio/[runId]/page.tsx` (server): `getRunArtifacts`→`ResultView`; draft→resume; 404.
**Test:** drawer lists real library runs; card opens deep-link; deep-link server-renders result; 404 on bad id.

## P9 — Retire old wiring + states/motion polish
**Goal:** clean studio surface.
- Remove old components from the studio page (StudioWizard/GuidedPosterFlow/ChatConversation/GenerationResult/VisualPanel/GenerationHistory/HistoryModal). Keep `chat-ui.tsx`. **Leave old API endpoints dormant** (no delete). Delete now-orphaned component files only if nothing else imports them.
- Final states/motion/a11y pass per UX (empty/loading/error, reduced-motion, focus management, responsive).
**Test:** no dead imports; lint/tsc/build clean; manual run of full flow.

## P10 — Live smoke (optional, end-to-end)
**Goal:** confidence on real contracts.
- `scripts/m1g-smoke.ts`: seed→intake→confirm→poll status→getRunArtifacts(+contextUsed)→export→render, asserting each contract. (Live AI per MEMORY: `node --env-file=.env.local --import tsx`, sandbox off, retry first ECONNRESET.)

---
**Gates after build:** verify (lint+tsc+build, all m1* regression) → review (2-stage) → release-notes → commit → push (PR pinned to fork).
**Env reminder:** stop dev + worker before any build/prisma (Windows EPERM); start `brief-studio-db` for live scripts.
