# Brief Studio — Product Requirements

> Extracted from SifuTutor CIS PRD v1.2 (June 2026). Internal use only.
> Full PRD kept offline. This file captures development-relevant requirements only.
> Update this file when PRD is revised.

---

## Confirmed Decisions (do not re-debate)

| Area | Decision |
|------|----------|
| Stack | Next.js + Tailwind + PostgreSQL + PM2 on KVM8 VPS |
| Deployment | Local dev → local testing → VPS staging via PM2. No Docker. |
| External APIs | OpenAI API + Meta Graph/Ads API only. No paid search APIs. |
| Brands | Two brand workspaces: SifuTutor + NakNgaji |
| AI models | gpt-4o (copy/analysis), gpt-image-2 (images) |
| Storage | Local filesystem. No S3/R2 in v1. |
| Publishing | Draft/export first. Publish/schedule added after stable. |
| Cost tracking | Track OpenAI usage and estimate cost. No hard budget enforced. |
| Brand guidelines | Editable via Settings UI — not seeded/hardcoded. |
| Logo handling | Upload in Settings. Overlay logo programmatically for final visuals. |
| Approval flow | None in v1. Trusted users create/export/publish by role. |

---

## User Roles

| Role | Access |
|------|--------|
| Super Admin | Full access — brands, users, settings, Meta, publishing, cost dashboard |
| Admin (`admin`) | Already in brief-studio — maps to Super Admin |
| Marketing (`marketing`) | hooks, copy, content plan, virality, ideas |
| Creative (`creative`) | poster, storyboard, video script, shooting plan |

---

## Modules

### Create (= Studio in brief-studio)

Brief-driven creative workspace. Core flow:

1. User writes or answers brief questions
2. AI converts raw brief into structured fields: goal, audience, topic/offer, platform, format, tone, assets, CTA, deadline
3. AI generates: caption, hook, CTA, ad copy, carousel outline, reel script, image brief
4. Quick actions on output: make shorter / more BM / more Bahasa Rojak / more parent-focused / more student-focused / turn into ad copy / turn into carousel / send to Calendar / save to Library
5. Brand check before output saved/exported — checks tone rules, banned phrases, CTA bank, approved samples

**Layout:** Three-panel — brief/chat | generated variants | preview + brand check

**Missing in brief-studio now:**
- Quick actions on generated output
- Brand check against tone rules / banned phrases
- Structured brief fields (goal, audience, platform, etc.) — currently free-form Q&A

---

### Library (= History in brief-studio)

Saved outputs with search, filter, and versioning.

**Required fields per output:**
- Brand, user, content type, prompt used, brief reference, model, created date
- Version history (OutputVersion)

**Required UI:**
- Search by keyword
- Filter by brand / type / date / platform / campaign tag / status
- Preview drawer (click card → see full output)
- Version drawer (see output history)
- "Reopen in Create" — load output back into Studio for iteration
- "Send to Calendar" or "Export package"

**Missing in brief-studio now:**
- Filter by brand, type, date
- Version history
- "Reopen in Create" action
- Export package

---

### Settings

Brand configuration — editable via UI, not seeded.

**Brand Identity:**
- Brand name, category, primary market
- Logo upload (multiple variants)
- Brand colours, font references

**Reference Assets:**
- Approved photos, rejected photos, environment/product references
- Used as creative references and optional image generation assets

**Tone & Language:**
- Language mode: BM / English / Bahasa Rojak / mixed
- Formal vs casual toggle
- Emoji rules
- Sample approved captions (for brand check reference)

**Do / Do Not Rules:**
- Banned phrases list
- Sensitive topics list
- Required messages / disclaimers
- CTA rules and CTA bank
- Claim restrictions

**Audience & Offer Bank:**
- Audience segments with pain points
- Active offers / promotions
- Exam/subject context (SifuTutor)

**Meta Connections:**
- Facebook Page (one per brand)
- Instagram account (one per brand)
- Ad accounts (two to three per brand)

**Missing in brief-studio now:**
- Entire Settings module (brand currently static/seeded)

---

### Home (= Dashboard in brief-studio)

Daily operating view.

**Required cards:**
- Today's drafts
- Scheduled posts (count + next scheduled time)
- Recent outputs (last 5 from Library)
- Cost summary (today + this month, in MYR)
- Quick create button → Studio

**Missing in brief-studio now:**
- Cost summary widget
- Drafts count
- Recent outputs from Library

---

### Insights (partially in brief-studio via PostForge)

Cached Meta metrics — not live API on every page load.

**Required:**
- Sync owned FB Page + IG + Meta Ads metrics into PostgreSQL cache
- Show last sync timestamp
- KPI cards: reach, impressions, engagement, clicks, spend, CPM, CPC, CTR, conversions
- Top posts + top ads
- AI-generated insight with evidence: source metric, post/ad name, date range, comparison baseline
- "Recommended actions" section

**Missing:**
- AI-generated insight with evidence references
- Cached metrics sync (currently pulls live?)

---

### Research (not in brief-studio)

Content opportunity inbox. Manual-first, no paid search API.

**v1 scope:**
- Manual URL summariser — paste URL, extract readable content, summarise, score relevance, suggest content angles
- RSS monitor — add RSS feeds per brand, store + summarise new items on request
- Video analyser — public URL (via yt-dlp on VPS) + uploaded video (via ffmpeg)
- Trend brief — combine saved research + recent performance + user brief → top content opportunities

**Out of scope for now.** Flag when Library + Settings are stable.

---

### Calendar (partially in brief-studio via PostForge)

**Required workflow:**
- Draft — save inside system for review
- Export package — caption + image + storyboard + notes bundled for manual posting
- Publish now — direct Meta API publish (add after draft/export stable)
- Schedule — queue for future Meta API publish (after publish now stable)

**Status badges:** Draft / Ready / Exported / Scheduled / Published / Failed

---

## Core Data Models

Models to add or extend in Prisma schema:

| Model | Key Fields | Purpose |
|-------|-----------|---------|
| `Brand` (extend) | `logoPath`, `toneJson`, `doNotJson`, `audienceJson`, `ctaBankJson` | Brand guidelines editable in Settings |
| `BrandAsset` | `brandId`, `type`, `filePath`, `metadataJson`, `usageNotes` | Logo, ref photos, approved/rejected examples |
| `OutputVersion` | `outputId` (FeatureRun), `versionNumber`, `content`, `notes`, `createdAt` | Version history for Library |
| `APIUsageLog` | `userId`, `brandId`, `module`, `provider`, `model`, `operation`, `inputTokens`, `outputTokens`, `estimatedCostUsd`, `createdAt` | Token usage + cost tracking per call |
| `ResearchItem` | `brandId`, `type`, `title`, `summary`, `sourceUrl`, `relevanceScore`, `createdAt` | URL/RSS/video research inbox |

Existing models in brief-studio that map correctly:
- `FeatureRun` → Output (maps to Library entries)
- `Campaign` → Campaign tracker
- `CalendarEvent` → Calendar
- `Stats` → Insights metrics cache (may need extending)

---

## UX Requirements

| Area | Requirement |
|------|-------------|
| Navigation | Simple sidebar: Home, Create (Studio), Calendar, Insights, Research, Library, Settings |
| Brand switcher | Always visible in sidebar/header |
| Create screen | Three-panel: brief/chat + generated variants + preview/brand check |
| Insights screen | Top wins, top drops, recommended actions + evidence drawer. Avoid metric overload. |
| Research screen | Inbox style: URL input, RSS list, video upload, saved items |
| Library screen | Searchable list with preview drawer + version drawer |
| Calendar screen | Status badges per post |
| Design feel | Clean card-based, lots of whitespace, dark-mode (already in brief-studio) |

---

## Usage Tracking Requirements

Track per OpenAI call:
- Brand, user, module, model, operation, input tokens, output tokens
- Estimated USD cost using stored pricing settings
- MYR conversion using manually editable exchange rate (no external API)

Display:
- Daily + monthly cost summary
- Breakdown by module: Studio, Research, Insights, Image Generation, Video Analysis

---

## Out of Scope (v1)

- Docker / Coolify / Dokploy
- External search APIs (Serper, Brave, etc.)
- Cloud storage (R2/S3)
- TikTok / YouTube / LinkedIn integrations
- Automated ad campaign launching
- AI video generation
- Team approval workflow
- Public SaaS / multi-tenant
- Native mobile app

---

## Phase Roadmap

| Phase | Scope |
|-------|-------|
| Phase 0 | Auth, PostgreSQL schema, brand workspace, storage, UI shell ✅ |
| Phase 1 | Studio (Create), output Library, brand asset upload, usage logging |
| Phase 2 | Meta connection, metrics cache, Research module (URL/RSS/video) |
| Phase 3 | VPS staging deployment + PM2 verification |
| Phase 4 | Internal pilot — two real brands, real Meta connections |
| Phase 5 | Publish now + schedule via Meta API |

**Current position: Phase 1** — Studio wizard done, Library (history) in progress.
