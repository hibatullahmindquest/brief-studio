# Changelog — brief-studio

All notable changes to brief-studio are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

### Added
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

### Changed
- `generateCopy` now returns `{ copy, usage }` so token usage can be logged
- `saveFeatureRun` returns the created run (for usage `featureRunId` + client run id)

### Fixed
- **Visual generation "empty prompt" failure** — the gpt-5 director sometimes returned no `imagePrompt` (reasoning truncation at 1500 tokens), and the empty string was passed to gpt-image-2 → `400 Invalid 'prompt'`. Fixed: bumped director budget to 4000 tokens, added a deterministic brand-aware fallback prompt, and guarded `renderImage` against empty prompts. (Diagnosed via the new error log.)

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
