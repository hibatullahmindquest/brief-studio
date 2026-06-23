# Changelog — brief-studio

All notable changes to brief-studio are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added
- **Admin management UI (Module 1, Phase B)** (`feat/m1-phase-b-admin`): web admin for the creative-journey pipeline, all under `/dashboard/settings/*` with API under `/api/admin/*`. No schema change (all fields landed in Phase A). Pattern: deep lib `src/lib/admin/*` throws `AdminError{status}`; routes are a thin `assertAdmin` gate mapping via `adminErrorResponse`.
  - **Experts** (`/dashboard/settings/experts`, `/api/admin/experts`) — CRUD for the system-prompt roles the pipeline runs (roleKey, name, large `systemPrompt` editor, modelTier, enable/disable). Hard delete blocked (409) while the roleKey is referenced by any recipe's steps. Verified by `scripts/m1b-experts.ts` (9/9).
  - **Recipes** (`/dashboard/settings/recipes`, `/api/admin/recipes`) — CRUD for a task type's ordered expert lineup; `RecipeStepsBuilder` (reorder ▲▼, per-step tier override, ⚠ on disabled/unknown roleKey) + group/outputFormat/lenses. Step roleKeys validated against the Expert table; delete blocked (409) while referenced by a `CreativeRun`. Verified by `scripts/m1b-recipes.ts` (14/14).
  - **Team / Users** (`/dashboard/settings/users`, `/api/admin/users`) — assign `teamRole` / `team` (lens scope) / `isAdmin` per member with per-row Save; own row highlighted ("you"). PATCH whitelists assignment fields only (never password/email/username). **Last-admin guard** — blocks any change that would drop the admin count to 0 (409). Verified by `scripts/m1b-users.ts` (10/10).
  - **Brands enriched** — `PATCH /api/brand` (still admin-gated) now also accepts the M1 brand-knowledge fields (`contentPillars`, `audienceSegments`, `doNot`, `signaturePhrases`, `colors` `#rrggbb`, `fonts`, `religiousGuidelines`, `footer`, `logoPath`) alongside the existing poster-overlay furniture; logic extracted to `src/lib/admin/brands.ts` (`updateBrand`). New `BrandKnowledgeForm` (chip lists + native colour swatches) on the brands page. Verified by `scripts/m1b-brands.ts` (16/16).
  - **Settings hub** (`/dashboard/settings`) — admin surfaces shown as cards with live count badges (experts/recipes total·disabled, users·admins); the whole admin block is now gated behind `isAdmin` (previously the Meta/Brands/Logs cards leaked to non-admins).
- **Creative-journey data model (Module 1, Phase A)** (`feat/module-1-data-model`): the schema foundation for the intent-router creative journey — 7 entities per the LOCKED design (`module-1-design.md` §11). Migration `m1_creative_journey_data_model` is **fully additive** (no data loss).
  - **`FeatureRun` → `CreativeRun`** — renamed in-place via `@@map("FeatureRun")` (keeps the table — no data migration); adds `recipeId`, `lens`, `inputText`, `inputUploads[]`, `intent`, `spec` (Json), `contextUsed` (Json — grounding slot for M3/M4, empty now). Legacy columns (`feature`/`inputJson`/`outputJson`/`feedback`) kept for the current visual path. `src/lib/feature-store.ts` repointed to `prisma.creativeRun` (helper fn names unchanged).
  - **`Recipe`** (new) — a task type's ordered expert lineup (`taskType`, `group`, `steps` Json, `outputFormat`, `lenses[]`). **`Expert`** (new, design "Role/Expert") — admin-editable system prompts (`roleKey`, `name`, `systemPrompt`, `modelTier`, `enabled`). **`Artifact`** (new) — multi-output-per-run (`type`, `content` Json, `exportFormat`, `mediaPath`, `feedback`/`feedbackNote`), replacing the single `outputJson` blob going forward.
  - **`Brand`** enriched (additive): `contentPillars[]`, `audienceSegments[]`, `doNot[]`, `signaturePhrases[]`, `religiousGuidelines`, `logoPath`, `footer`, `colors[]`, `fonts[]`, `templates` (Json). **`User`** gains `team` (`single`|`multi`|`all`) lens scope.
  - **Seed** (`scripts/seed-m1.ts`, `npm run seed:m1`) — idempotent upsert of SifuTutor + NakNgaji (enriched), 5 base experts (Strategist/Copywriter/Art Director/Social/Brand Guardian), and 3 base recipes (poster/caption/marketing_plan).
  - Verified by `scripts/m1a-verify.ts` — ALL PASS (seed presence + CreativeRun↔Recipe↔Brand↔Artifact round-trip, Json/array round-trip, cascade delete); lint + tsc + build green. No UI/behaviour change yet (data layer only).
- **Generic worker / job queue (Module 0)** (`feat/module-0-generic-queue`): the poster-only job queue becomes a generic worker substrate any module can ride. The `GenerationJob` model is evolved in place into a generic `Job` (`@@map("GenerationJob")` keeps the table — no data migration) with `kind` (generate | meta_sync | analyze | video | signal | export), `lane` (interactive | background), JSON `payload`, `dedupeKey`, `attempts`/`maxAttempts`, `scheduledAt`, and a generic `result` — `featureRunId`/`userId` are now nullable for system jobs. Migration `generic-job-queue`.
  - `enqueue({ kind, … })` with `dedupeKey` idempotency (reuses an active job); `enqueueVisualJob` kept as a thin wrapper (one active generate per run). Lane-scoped `claimNextJob(lane)` (race-safe), `markFailedOrRetry` (re-queue with exponential backoff 30s→10min, else terminal), `sweepStaleJobs` routes stuck jobs back through the retry path.
  - Worker dispatcher (`src/worker/dispatch.ts`) maps `kind`→handler; `generate` wraps the existing poster pipeline. Worker loop is lane-aware via `WORKER_LANE`; new `worker:interactive` / `worker:background` scripts (KVM8 runs two PM2 processes). Helpers `src/lib/job-kinds.ts` (lane map) + `src/lib/job-backoff.ts`.
  - Verified by `scripts/m0-verify.ts` (dedupe, lane isolation, success, retry+backoff, terminal, non-retryable) — ALL PASS; lint + build green.
- **Manual logo placement (size + corner)** (`feat/visual-intake-overhaul`): each brand can set the poster logo **size** (`sm`/`md`/`lg`) and **corner** (`tl`/`tr`/`tc`) from the admin furniture form; saved via `PATCH /api/brand`, applied at stamp time. New `Brand.logoSize` / `logoCorner` columns (migration `add_brand_logo_placement`). The luminance sample box follows the chosen corner so the contrasting variant is still picked correctly.

### Changed
- **Poster logo overlay — placement & contrast fixes** (`feat/visual-intake-overhaul`):
  - **Trim transparent margin** off the uploaded logo PNG before stamping, so the real mark sits flush at the corner instead of floating inward; corner padding tightened (3.3% → 2.5%).
  - **Robust variant auto-pick** — luminance is now sampled from a small clean corner box (not the full footprint, which the rendered headline was polluting and flipping the choice).
  - **Stronger top-left reservation** in the image prompt — hard-reserve the top-left ~28%×16% and place the headline in the center / lower-center, so the stamped logo no longer collides with the rendered headline.

### Added
- **Light/dark brand logo variants with auto-pick** (`feat/visual-intake-overhaul`): a brand can now hold two transparent logo PNGs — one for light backgrounds (dark-ink logo) and one for dark backgrounds (light/white logo). At stamp time the overlay samples the mean luminance of the top-left logo zone and stamps the contrasting variant automatically (falls back to whichever variant exists, then the legacy single logo). New `Brand.logoUrlLight` / `logoUrlDark` columns (migration `add_brand_logo_variants`); `POST /api/brand/logo` takes a `variant` (`light`|`dark`) and stores `<slug>-logo-<variant>.png`; admin form (`/dashboard/settings/brands`) now has two upload slots each previewed on a representative background.
- **Conversational Studio — single-chat flow** (`feat/visual-intake-overhaul`): the Studio entry is now one chat instead of separate picker screens. AI greets → pick **brand** (chips) → pick **output** (chips); Poster continues into the guided brief/Creative Spec inside the same conversation, other output types run their Q&A as chat bubbles. Auto-copy (caption/CTA/hashtags/strategy note) is generated alongside the poster and shown under it.
  - New shared chat primitives (`chat-ui.tsx`: `ChatBubble`/`Chip`/`CustomChip`/`TypingDots`), `ChatConversation` (generic per-output Q&A as bubbles), and `GuidedPosterFlow` `embedded` mode.
  - Replaces the old picker components (`BrandPicker`, `OutputTypePicker`, `ConversationStep`, `BriefReview` — removed).

### Changed
- **Studio result no longer nests card-in-card** — once the poster reaches the generate/result phase, the chat collapses into a compact breadcrumb (`Brand / Output · ↻ Mula semula`) and the wrapper card is dropped, so the poster + copy panels render as clean standalone cards instead of nested inside the chat shell.

### Removed
- Dead Studio picker components (`BrandPicker`, `OutputTypePicker`, `ConversationStep`, `BriefReview`) superseded by the conversational chat flow.

### Added (visual intake)
- **Visual intake overhaul — guided poster brief → Creative Spec → generate** (`feat/visual-intake-overhaul`): the Poster output now uses a guided flow instead of the scripted Q&A:
  - Free-text brief + objective chips → AI synthesises a **Creative Spec** (angle, objective, style, mood, headline, accent, CTA, concept, ratio) anchored to the brief's angle
  - Editable **headline / accent / CTA** rendered verbatim into the image, each with **↻ Jana semula** (single-field regenerate); style/mood/ratio pickable via chips; concept/angle editable
  - **Sahkan Idea → Generate Poster** gate; spec persists as a **Draft** so it can be edited/generated later
  - Text rendered in-image by gpt-image-2 with reserved top-left (logo) + bottom (footer) zones; per-brand **visual DNA** injected
  - **Brand furniture overlay** — transparent logo (top-left) + footer bar (bottom) stamped post-render from brand settings (sharp), read at generation time
  - Admin **brand furniture settings** at `/dashboard/settings/brands` — PNG logo upload (`POST /api/brand/logo`) + footer text (`PATCH /api/brand`)
  - **Semakan Lepas Draft state** — `○ Draft` rows with **Edit** (reopen spec) / **Generate** (enqueue) actions
  - New endpoints: `GET/POST/PUT /api/studio/visual-spec`, `POST /api/studio/regenerate-text`, `POST /api/studio/confirm-spec` (creative/admin gated; admin-only for brand furniture)
  - Run cost rolls up spec-synthesis + regenerations + image render into one `costMyr`
  - Phase 1 = poster only (variations, true 9:16 crop/pad, storyboard/script intake deferred)
- **Semakan Lepas visual indicator + generation time** — each history row now shows a visual-status badge — `🖼 Ada visual` (with `⏱ Ns` generation time), `⏳ Tengah jana…`, `✗ Gagal`, or `○ Belum jana` (Hook & Copy text-only runs show no badge). Status is derived from the latest `GenerationJob` per run (one batched query, no migration); the worker now records render duration into `outputJson.image.generatedMs`, also shown as a `⏱` chip in the run detail modal. Old runs gracefully omit the time.
- **Async visual generation (close-tab-safe + resumable)** — visual generation now runs in a separate worker process instead of the web request, so closing the tab no longer drops a generation:
  - `GenerationJob` model + queue (`queued → processing → succeeded → failed`); the image still lives in `FeatureRun.outputJson` (job tracks process + cost only)
  - `POST /api/generate/visual` now **enqueues** a job and returns `{ jobId }` immediately (idempotent — one active job per run); `GET /api/jobs?featureRunId=` polls status / resumes
  - Worker (`npm run worker` → `src/worker/index.ts`): atomic job claim, runs gpt-4o director → gpt-image-2, persists result + logs usage; watchdog marks `processing` jobs stale after 5 min
  - `VisualPanel` submits → polls every 2s → resumes any in-flight/finished job on mount; shows a "boleh tutup tab" note + a worker-down hint if queued > 60s
  - Shared `src/lib/visual-job.ts` (`runVisualJob`) + `src/lib/job-store.ts`; `tsx` dev dependency
  - Local-first; VPS PM2 `scis-worker` deploy deferred (needs root setup)
- **Generate visual later** — a saved run whose image wasn't generated yet can now produce it from the Semakan Lepas history: HistoryModal shows the "Jana Visual" panel (reusing the existing `featureRunId`-based route) for poster/storyboard/video runs without an image. Solves closing the tab before pressing Jana Visual.
- **Error logging & tracking** — `ErrorLog` model + never-throwing `logError()` that normalizes any error (esp. OpenAI `APIError` — captures status/code/type/body into `detail`). Wired into `/api/generate/visual`, `/api/generate`, and `/api/meta/callback` catches with sanitized context. Admin-only viewer at `/dashboard/settings/logs` (filter by source/level, expand for full stack + OpenAI body) + Settings link + Admin nav item. No secrets logged.
- **Visual generation from Studio output** — gpt-4o "visual director" plans a visual from the text output, gpt-image-2 renders one image per visual output:
  - Poster output → a single poster image (aspect from the brief)
  - Storyboard / Video Script output → one composite multi-panel storyboard image + scene captions shown as text
  - Hook & Copy stays text-only (no image)
  - `VisualPanel` in the result: idle + cost estimate → planning → rendering → done (Download / Regenerate) / skipped / error
  - Brand-aware prompts; logo + exact price/date left to a designer ("visual draf")
- **AI cost tracking** — `APIUsageLog` model logs every gpt-4o and gpt-image-2 call (tokens / image / USD + MYR); copy generation logged too
- **Usage module** — `/dashboard/usage` (admin): today / month cost KPIs, recent generations, by-module breakdown, USD→MYR rate
- **`pricing.ts`** — token + image rate tables, `estimateVisual` / `actualFromUsage`, `USD_TO_MYR` env
- **`POST /api/generate/visual`** + **`GET /api/usage`**; `/api/generate` now returns the run id
- Saved visuals reappear in the Semakan Lepas history (HistoryModal)

### Fixed
- **Cost missing in Semakan Lepas** — the RM cost showed on the live output card (read from the job) but not in the history detail, because cost was never stored in the run output. The worker now writes `costMyr` into `outputJson.image` (alongside `generatedMs`), and HistoryModal shows an RM chip next to the time. Old runs omit it gracefully.
- **Visual timer restarted at 0s on resume** — reopening a run mid-generation reset the elapsed counter to 0; it now anchors to the job's real enqueue time (`GET /api/jobs` returns `createdAt`) so it shows true elapsed.
- **"Tengah jana" never appeared in Semakan Lepas** — the history list only refreshed on completion, so the live generating window was skipped (it jumped straight to "Ada visual"). VisualPanel now fires a `generation:start` event on submit and the list polls page 1 every 3s while any run is generating, so the badge shows ⏳ then flips to 🖼/✗ on its own.

### Changed
- **Visual generation is now asynchronous** — `POST /api/generate/visual` no longer runs OpenAI inside the request (it enqueues); the synchronous plan→render-in-request path was removed. The worker (`npm run worker`) must be running for visuals to generate
- `generateCopy` now returns `{ copy, usage }` so token usage can be logged
- `saveFeatureRun` returns the created run (for usage `featureRunId` + client run id)

### Fixed
- **Visual generation "empty prompt" failure** — the gpt-5 director sometimes returned no `imagePrompt` (reasoning truncation at 1500 tokens), and the empty string was passed to gpt-image-2 → `400 Invalid 'prompt'`. Fixed: bumped director budget to 4000 tokens, added a deterministic brand-aware fallback prompt, and guarded `renderImage` against empty prompts. (Diagnosed via the new error log.)
- **Cropped generated image** — the result container forced a 9:16/16:9 ratio with `object-fit: cover`, but gpt-image-2 outputs 1:1/2:3/3:2 → top/bottom got cropped. Now displays the image at its native ratio, uncropped (VisualPanel + HistoryModal). (Exact social-ratio crop/pad deferred — see FUTURE plan.)
- **Vague visual failure message** — errors are now categorized (moderated / quota / timeout / api_error / system) with a clear reason and a retryable-vs-terminal action ("Cuba semula" vs "ubah brief"); error source split into `visual.plan` / `visual.render` for diagnosis.

## [0.2.0] - 2026-06-11

### Added
- **Studio Wizard** — conversation-driven brief intake wizard at `/studio`
  - Brand picker: loads SifuTutor + NakNgaji from DB, colour-coded cards
  - Output type picker: Hook & Copy, Poster, Storyboard, Video Script — grouped by team
  - Scripted Q&A (ConversationStep): one question at a time, chips + textarea, skip for optional
  - Brief review (BriefReview): summary of all answers with per-answer edit/jump back
  - Generation spinner → result display (primaryPost, caption, CTA, hashtags, strategyNote)
  - Regenerate and "+ Baru" reset from result screen
  - Progress bar with 4 steps: Brand → Output → Brief → Review
- **Brand context injection** (`src/lib/brand-context.ts`): loads brand from DB by slug, builds `promptBlock` string injected as system prompt context into every AI call
- **Conversation engine** (`src/lib/conversation-engine.ts`): question trees for all 4 output types (20 questions total)
- **`GET /api/brand`**: returns active brands for brand picker
- **`briefAnswers` in generation API**: brief Q&A answers passed into AI prompt as structured context
- **Studio nav item**: Studio added to sidebar navigation
- **Brand seed data**: `scripts/seed-brands.ts` seeds SifuTutor and NakNgaji brand guidelines

### Fixed
- ConversationStep state (textValue/selected) now resets between questions via `key={question.id}` — prevents Q1 text bleeding into Q2 if Q2 is chips-only
- Removed unused `answers` prop from GenerationResult component

## [0.1.0] - 2026-06-10

### Added
- Forked from postforge-ai (mouadhhhallem/postforge-ai, MIT License)
- Removed Stripe billing, checkout, pricing, and offerings pages
- Added PostgreSQL migration baseline
- Project identity established: brief-studio for SifuTutor/NakNgaji internal team
