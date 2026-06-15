# SCIS — SifuTutor Creative Intelligence System
## Product Requirements Document v2 (Clarity Pass)

> **Status:** Draft for review · **Date:** 2026-06-15 · **Classification:** Confidential — Internal
> **Builds on:** PRD v1.4 (Organic/Paid + Daily Signals + Admin Credentials + Brand Wizard)
> **What changed in v2:** comprehension rewrite — plain-language metric explainers, per-phase user outcomes, role/VPS detail moved to Appendix, design system aligned ("v6 palette on redesign clarity"), MVP scope sharpened around Meta sync → analytics → reports + lightweight signals.
> **Unchanged (still locked):** organic≠paid separation, evidence-based Daily Signals, paid = export only (no auto-launch), OpenAI + Meta APIs only, local-first → PM2 VPS.

---

## How to read this document

- **Sections 1–9** = the product. What it does and why. Written for marketing + creative readers.
- **Sections 10–12** = the MVP build plan. What ships first.
- **Appendix A–C** = ops detail (roles, credentials, VPS). Read only if you deploy or admin.

One rule throughout: **every number on screen carries a one-line "what this tells you" explainer.** No metric appears without its meaning. This is a hard UX requirement, not a nicety.

---

## 1. Executive summary

SCIS is an internal AI marketing + creative platform for the SifuTutor / NakNgaji team. It does three jobs:

1. **Pulls** owned Facebook, Instagram, and Meta Ads data into one place (cached, not live-fetched).
2. **Explains** what the numbers mean — split cleanly into **Organic** (engagement, reach, saves) and **Paid** (cost, CTR, fatigue) — and recommends the next action via **Daily Signals**.
3. **Creates** the content: posters, hooks, copy, storyboards, ad creative — using brand context + what's actually winning.

The product never mixes organic and paid decisions. A save-rate win and a low-CPL win mean different things and lead to different actions.

### The one-sentence pitch
> "Open SCIS in the morning, see what worked yesterday, get told what to make next, and make it — without opening Meta Ads Manager or a spreadsheet."

---

## 2. Decisions locked (do not re-debate)

| Area | Decision |
|------|----------|
| Module separation | Organic and Paid are separate modules, separate data, separate creation flows. |
| Daily Signals | Four labels only: **Scale Similar · Create Variation · Watch · Hold/Stop**. Always evidence-backed. |
| Paid launch | v1 **exports** ad packages + briefs. No automatic ad launch. Manual setup in Ads Manager. |
| Organic publish | Allowed with confirmation screens for risky actions. |
| Data freshness | Cache in Postgres. Show "last synced". Never live-call Meta on page load. |
| Periods | **T-1** (last 24–48h) · **T-7** (7-day trend) · **T-30** (proven-pattern baseline) · prior-period compare. |
| Reports | Daily / Weekly / Monthly, **calendar-aligned**, hybrid (data + AI narrative). |
| Credentials | Admin-only. Encrypted, masked, tested, audited. Secrets never returned to frontend. |
| Brand setup | Guided **Brand Guideline Wizard** with versioning. |
| External APIs | OpenAI + Meta only. |
| Timezone | **Asia/Kuala_Lumpur (MYT)** for all "yesterday / week / month" boundaries. Store UTC, render MYT. |

---

## 3. Problem statement

| Problem | Why it matters | SCIS response |
|---------|----------------|---------------|
| Organic + paid metrics get reviewed together | Reach, saves, CPL, CTR, frequency drive *different* decisions | Separate modules, dashboards, creation flows, library filters |
| Team knows what performed, not what to make next | Analytics alone don't become action | Daily Signals recommends Scale / Variation / Watch / Stop |
| "Top content" can mislead | Top reach ≠ useful; low CPL ≠ scalable if fatigue rising | Multi-signal scoring + evidence drawer |
| Ad fatigue is easy to miss | CPL creeps up after a creative saturates | Track frequency + CTR trend + CPL trend together |
| Winning patterns get lost after posting | Good ideas vanish into the feed | Save winners to Library, feed them back into Create |
| Content takes 3–7 days idea→output | Repeated manual research/briefing | Brief-driven AI generation with brand context baked in |

---

## 4. Product model — Organic vs Paid

The single most important concept. Two channels, two mindsets.

| Dimension | **Organic** | **Paid** |
|-----------|-------------|----------|
| Core question | What should we make more of for engagement + presence? | What ad/offer angle do we vary, continue, or stop for cheap results? |
| Metric family | Reach, engagement, saves, shares, comments, profile actions, best time | Spend, CPL/CPA, CTR, CPC, CPM, result volume, frequency, fatigue |
| Creation output | Caption, carousel, reel storyboard, hashtags, organic poster | Primary text, headline, description, CTA, offer angle, ad visual, ad package |
| Main action | Create similar, schedule, publish, export | Create variations, export package, mark for test, refresh, compare |
| Publishing | Publish/schedule via Meta **after confirmation** | **No auto-launch.** Export package → manual Ads Manager |

**Core UX rule:** entry point matters. Someone making an organic post must NOT land in the ad-creative brief flow. Shared engine behind the scenes; different UI + prompt schema in front.

---

## 5. Daily Signals — the decision layer

Not another report page. It reads the latest organic + paid metrics, compares against baseline, and answers one question: **should we make more of this, vary it, wait, or stop?**

### The four labels

| Label | Meaning | Typical action |
|-------|---------|----------------|
| **Scale Similar** | Strong evidence — repeat the topic/hook/format/offer | Generate 2–5 similar → Create/Calendar |
| **Create Variation** | Promising base, needs a new hook/visual/angle/CTA | Generate alternatives, keep the proven element |
| **Watch** | Mixed signals or sample too small | Keep tracking, show next check time, don't overreact |
| **Hold / Stop** | Weak, fatigued, or too costly/risky | Don't repeat now — archive insight or pivot angle |

### What drives each (with the plain-language explainer that appears on screen)

**Organic**

| Signal | What it tells you (shown on screen) | Scale when |
|--------|--------------------------------------|------------|
| Save rate | "People found it useful enough to keep." | Above 7/30-day baseline or repeatedly high for the format |
| Share rate | "Valuable enough to send to someone." | Above baseline + comments not negative |
| Engagement rate | "Not just seen — it got a response." | Above baseline after normalising by reach |
| First 24–48h velocity | "Fast early traction = hook worth repeating." | Early reach/interactions beat recent same-format posts |
| Comment quality | "Real questions/intent beat empty reactions." | Genuine interest, questions, useful pain points |
| Profile/link actions | "Attention turned into deeper interest." | Profile visits / link clicks / DMs above baseline |

**Paid**

| Signal | What it tells you (shown on screen) | Rule |
|--------|--------------------------------------|------|
| CPL/CPA vs target | "Are results cost-efficient?" | Scale if below target / 30-day median **with enough volume** |
| CTR vs median | "Does the hook + creative pull clicks?" | High CTR → make variations even if CPL needs work |
| Result volume | "Is the sample big enough to trust?" | Don't scale from tiny lead counts → label Watch |
| Frequency | "Has the audience seen it too often?" | Freq↑ while CTR↓ → variation, not scale |
| CTR trend | "Is the creative getting weaker?" | Declining 2–3 days → fatigue |
| CPL trend | "Is cost efficiency stable?" | CPL↑ while spend continues → refresh or hold |

### MVP signal engine (lightweight — confirmed in scope)
- **Rule-based thresholds**, no ML. Each signal compares snapshot value vs baseline and emits a label.
- Appears as a **signal strip on Home** + an **Insights tab inside each module**.
- Every signal card shows: label, score/health, evidence metrics, recommended action, **direct CTA** (Create similar / Create variation / View evidence / Open in Library).
- **Evidence drawer** shows: source post/ad, platform, date range, baseline comparison, last synced.
- **Hard rule:** no recommendation without evidence. Generic AI advice is blocked or labelled "brainstorming only."

---

## 6. Modules & navigation

Full SCIS module set. Visual design follows the **clarity system** (Section 9) so 8 entries stay scannable, not heavy.

| Module | Purpose | Key screens |
|--------|---------|-------------|
| **Today (Home)** | Morning overview | Organic Pulse, Paid Pulse, Daily Signals strip, Creative Queue |
| **Daily Signals** | The decision layer | Organic signals, Paid signals, decision cards, evidence drawer |
| **Organic Marketing** | Organic performance + creation | Overview (T-1/T-7), Create Organic, Calendar, Posts |
| **Paid Marketing** | Paid performance + ad creation | Overview (T-1/T-7), Create Ad, Campaign Briefs, Creative Tests |
| **Research** | Source analysis + idea discovery | Manual URL, Video Analyzer, RSS, Saved Research |
| **Reports** | Generated daily/weekly/monthly reports | Generate, history, export (MD/PDF) |
| **Library** | Archive + reuse, context-tagged | All, Organic, Paid, Assets, Research |
| **Settings** | Brand, integrations, credentials, cost | Brand Wizard, Meta Connection, OpenAI, Usage, Users |
| *Debug/Audit* (admin) | Ops visibility, safe tests | Logs, Sync Meta Now, Test OpenAI, system health |

**Home requirements**
- Organic Pulse and Paid Pulse shown **separately**, first screen.
- Daily Signals summary: top Scale Similar, top Create Variation, top Watch, any Hold/Stop warning.
- Creative Queue split: Organic Drafts | Paid Ad Packages.
- Every card has a direct CTA.

---

## 7. Meta data requirements (the sync layer)

Meta integration powers organic + paid insights. **Cache in Postgres, refresh on schedule or manual sync, never live-call on page load.** Every dashboard shows last-synced time.

| Data area | Required data | Powers |
|-----------|---------------|--------|
| FB Page / IG organic | post ID, type, caption, thumbnail, created time, reach/views, engagement, likes, comments, shares, saves, link/profile actions | Top content, organic signals, Create recommendations |
| Meta Ads | campaign/adset/ad IDs, spend, impressions, reach, frequency, CPM, clicks, CPC, CTR, results/leads, CPL/CPA, creative/copy fields | Paid signals, fatigue warnings, ad variations |
| Comments | text, timestamp, post ID, simple sentiment/intent label | Comment-quality signal, idea mining |
| Sync metadata | last sync time, API errors, rate-limit warnings, account mapping | Debug/Audit + user trust |

**Date ranges:** T-1 (24–48h, where fresh) · T-7 (trend) · T-30 (baseline) · prior equivalent period (WoW/MoM).

**Sync design (MVP):** manual **"Sync now"** button + last-synced timestamp. PM2 cron worker = fast-follow. Idempotent upsert keyed by `meta_post_id` and `(ad_id, date_range)` so re-sync is safe and interruptions resume.

---

## 8. Analytics & reports

### 8.1 Analytics (per module, organic + paid split)
- **Period toggle:** T-1 · T-7 (T-30 used for deltas/baseline).
- **Organic Overview:** top content by reach/engagement/saves/shares/comments/velocity; best format + best posting time (from cached history); recommended actions from signals.
- **Paid Overview:** top creative by CPL/CPA, CTR, result volume, creative score; **fatigue warnings** (freq↑ + CTR↓ or CPL↑); recommended ad actions.
- Every metric: value + delta vs prior period + the one-line explainer.

### 8.2 Reports (hybrid — confirmed)
- **Periods:** Daily (yesterday) · Weekly (last 7 / ISO week) · Monthly (**last full calendar month**, MYT).
- **Output:** data tables from snapshots **+ gpt-4o narrative** that reads the numbers and writes "what happened / what to do." Organic and paid summarised **separately**.
- **Guardrail:** narrative may only cite numbers present in the snapshot payload. Invented figures forbidden (same evidence rule as signals).
- **Export:** Markdown + PDF. Saved to `Report` table + Library.

---

## 9. Design system — "v6 palette on redesign clarity"

Two reference mockups reconciled into one system.

**Skin (from v6 BrandColor):**
- Palette: organic `--brand:#3b4ee2` · paid `--orange:#fd8549` · teal sidebar `#00262a` · status ok/warn/stop greens-ambers-reds.
- Components kept verbatim: decision cards, score rings, signal tables, evidence drawer.
- Mono (JetBrains Mono) for metric values + labels.

**Skeleton (from redesigned dashboard):**
- **Poppins** for headings (over serif) — friendlier, faster to scan.
- **Tabler icons** (over unicode glyphs) — clear, consistent.
- Calmer card density; action-oriented, not editorial.

**Non-negotiable UX rules:**
- Every metric row carries its `<small>` "what this tells you" explainer.
- Confirmation modals on: publish, schedule, export paid package, delete, overwrite, restore, disconnect.
- Platform previews: FB feed, IG 1:1, IG 4:5, Story/Reel 9:16, + ad previews for paid.
- Laptop-first, mobile-comfortable (filters → bottom sheets, drawers → full-screen).
- English UI; generated content = BM / EN / Rojak per brand/brief.

---

## 10. MVP scope (this build)

The slice that ships first, in order.

| # | Deliverable | User outcome |
|---|-------------|--------------|
| 1 | **Meta sync layer** — OAuth connect (1 FB Page + 1 IG + 2–3 ad accounts/brand), manual Sync now, cached snapshots | "I connected our accounts and pulled real numbers in." |
| 2 | **Organic Analytics** — Overview, T-1/T-7, top content, explainers | "I can see which posts worked yesterday and this week." |
| 3 | **Paid Analytics** — Overview, T-1/T-7, CPL/CTR/frequency, fatigue flag | "I can see ad cost + spot fatigue without Ads Manager." |
| 4 | **Lightweight Daily Signals** — rule-based labels, Home strip, evidence drawer | "It tells me what to make next, with proof." |
| 5 | **Reports** — daily/weekly/monthly, calendar-aligned, hybrid, MD/PDF | "I get a written summary I can paste into the team chat." |

**In scope:** the above + brand context loaded into prompts (for the Create CTAs).
**Deferred (fast-follow):** PM2 cron auto-sync, full `AppCredential` vault, ML-scored signals, video/RSS research, editor/compositor, organic publish/schedule.

---

## 11. Data models (MVP)

New (Prisma):
- `MetaPageConnection`, `InstagramConnection`, `MetaAdAccountConnection` — per-brand, encrypted OAuth token metadata.
- `OrganicPost`, `OrganicMetricSnapshot` (`post_id`, `date_range`, `metrics_json`, `score`, `synced_at`).
- `AdCreative`, `AdMetricSnapshot` (`ad_id`, `date_range`, `spend`, `ctr`, `cpl`, `frequency`, `metrics_json`, `synced_at`).
- `DailySignal` (`brand_id`, `channel`, `signal_type`, `decision_label`, `score`, `evidence_json`, `recommendation_json`).
- `Report` (`brand_id`, `period_type`, `period_start`, `period_end`, `data_json`, `narrative`, `export_path`).

Reuse: `Brand`, `User`, `FeatureRun`, `Campaign`, `CalendarEvent`.
Deferred: `AppCredential`, `CredentialAuditLog`, `BrandGuidelineVersion`, `ResearchItem`.

**DailySignal JSON contract**
```json
{
  "channel": "organic | paid",
  "decision_label": "Scale Similar | Create Variation | Watch | Hold / Stop",
  "confidence": "low | medium | high",
  "evidence": [
    {"source_type": "post | ad", "source_id": "...", "metric": "save_rate", "value": 0.08, "baseline": 0.04}
  ],
  "recommendation": "Create 3 similar carousels using the same parent-checklist angle.",
  "suggested_actions": ["create_similar", "create_variation", "view_evidence", "save_to_library"]
}
```

---

## 12. API routes (MVP)

| Route | Purpose |
|-------|---------|
| `POST /api/meta/connect` | OAuth start/callback — store encrypted token per brand/account |
| `POST /api/meta/sync` | Pull organic + paid snapshots, idempotent upsert, stamp `synced_at` |
| `GET /api/analytics?channel=organic\|paid&period=t1\|t7` | Cached metrics + deltas |
| `GET /api/signals?brand=&channel=` | Rule-based signal cards + evidence |
| `POST /api/reports` · `GET /api/reports` | Generate (data+AI narrative) / list / export |

---

## 13. Edge cases & failure modes

- Meta API down / rate-limited → keep cached data, show last-synced, retry path. Never blank the dashboard.
- Token expired (~60-day) → flag re-auth to admin; audit user sees "needs reconnect" only.
- Empty ad account → honest empty state; never fabricate paid metrics/signals.
- Small sample (few leads / low spend) → "Watch / not enough data," never "Scale."
- Mid-sync interruption → idempotent upserts, resumable, `synced_at` stamped.
- Report over partial period → label "partial — still syncing," show coverage %.
- Timezone → all period math in MYT; store UTC, render MYT.
- AI narrative/signal → only cite numbers in the payload; invented figures forbidden.
- Role access → only admin connects Meta / sees credentials; audit sees masked health.

---

## 14. Phased roadmap (with user outcomes)

| Phase | Ships | After this phase you can… |
|-------|-------|---------------------------|
| **P0 — Foundation** | Auth, roles, brand context, schema, design system, module shells | "Log in and navigate the real SCIS layout." |
| **P1 — Meta sync** | OAuth, Sync now, snapshot tables | "Pull our real FB/IG/Ads numbers into SCIS." |
| **P2 — Analytics** | Organic + Paid overviews, T-1/T-7, explainers | "See what worked without opening Meta." |
| **P3 — Signals** | Rule-based labels, Home strip, evidence drawer | "Be told what to make next, with proof." |
| **P4 — Reports** | Daily/weekly/monthly hybrid, MD/PDF export | "Generate a summary to share with the team." |
| **P5 — VPS** | PM2 deploy, env, Meta callback (see Appendix C) | "Use it on the staging domain." |

Fast-follow after MVP: cron auto-sync · credential vault · ML signals · research/video · editor/compositor · organic publishing.

---

## Appendix A — Roles & access control

| User / role | Access | Restrictions |
|-------------|--------|--------------|
| **Hafiz** — admin/whole | Full app + VPS + credentials + secrets | None within authorised admin context |
| **hibatullah** — audit/debug | View logs/status, run allowed debug tests, view **masked** credential health | Cannot view/edit token values, publish, delete, or change critical settings |
| App Admin | Brands, users, settings, credential vault, Meta connections, cost dashboard | Trusted users only |
| App Audit/Debug | Full logs, status, debug tests, usage, masked health, read-only data | No secrets, no disconnect/publish/delete |

**Escalation rule:** anything needing sudo/root, package install, PM2 startup/save, reverse-proxy, env secrets, DB roles, firewall/SSL/domain, or file permissions → flagged **Requires Hafiz/admin**.

## Appendix B — Admin credentials (deferred to fast-follow)

Full `AppCredential` vault: add/update/test/rotate/disable OpenAI key + Meta app credentials from Settings. Encrypted at rest, masked metadata only (last-4, last-tested, status), every change audited via `CredentialAuditLog`. Secrets never returned to frontend/logs/exports. **MVP uses env-bootstrap + encrypted per-brand OAuth tokens; vault comes after.**

## Appendix C — VPS validation (after local dev)

Existing PM2 VPS (`scis-app`, optional `scis-worker`). Validate post-development: PM2 health, env/encryption key, OpenAI + Meta credential status, redirect URI, Postgres migrations, storage permissions, Meta callback URL, yt-dlp/ffmpeg paths. Separate Deployment Runbook labels each task by access level. No Docker required.

---

## Appendix D — Acceptance criteria (MVP)

- [ ] Brand switch shows Organic and Paid clearly separated.
- [ ] Home shows Organic Pulse, Paid Pulse, Daily Signals strip, Creative Queue.
- [ ] Meta "Sync now" pulls organic + paid snapshots; last-synced visible; re-sync idempotent.
- [ ] Analytics shows T-1 + T-7 for organic and paid, with deltas + explainers.
- [ ] Paid shows fatigue flag when frequency rises while CTR falls / CPL rises.
- [ ] Daily Signals produces Scale/Variation/Watch/Hold-Stop with evidence (source, range, value, baseline).
- [ ] No signal/report cites a number absent from the snapshot payload.
- [ ] Reports generate daily/weekly/monthly (calendar-aligned, MYT), hybrid, export MD/PDF.
- [ ] Only admin connects Meta; audit user sees masked status only.
