# Changelog — brief-studio

All notable changes to brief-studio are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added
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
