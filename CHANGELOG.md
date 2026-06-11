# Changelog — brief-studio

All notable changes to brief-studio are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [Unreleased]

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
