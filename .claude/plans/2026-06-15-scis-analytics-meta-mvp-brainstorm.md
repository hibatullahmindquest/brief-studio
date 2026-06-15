# Brainstorm — SCIS Analytics + Meta Sync + Reports MVP

> Date: 2026-06-15 · Source: PRD v1.4 (SifuTutor CIS) + v6 BrandColor mockup + redesigned dashboard mockup
> Goal: (1) improve PRD for comprehension, (2) align design, (3) plan MVP — Meta sync, organic/paid analytics (T-1/T-7), report generation.

---

## 0. What I read

- **PRD v1.4** (`SifuTutor_CIS_PRD_v1.4_...docx`) — 27 sections. Locks: organic/paid separation, Daily Signals decision engine (Scale Similar / Create Variation / Watch / Hold-Stop), Admin Credential vault, Brand Guideline Wizard, local-first → PM2 VPS, OpenAI + Meta only, paid = export package (no auto-launch).
- **v6 BrandColor mockup** — the styling you like. 8 sidebar modules (Today, Daily Signals, Organic, Paid, Research, Library + Admin: Settings, Debug). Editorial/dense: serif headings, mono labels, conic score rings, decision cards, signal tables with plain-language `<small>` explainers. Brand blue `#3b4ee2` = organic, orange `#fd8549` = paid, teal sidebar `#00262a`.
- **Redesigned dashboard** — the comprehension you prefer. SAME brand tokens, but: **flatter nav** (Home, Analytics, Create, Library, Research, Calendar, Settings — 7 items), Poppins sans (friendlier than serif), Tabler icons (`ti-*`) instead of unicode glyphs, organic/paid collapsed into ONE Analytics view with toggles instead of 2 heavy sidebar sections.

**The core tension:** v6 = beautiful but 8 dense modules. Redesign = same palette, far easier to scan, fewer entry points. You want v6's *skin* on the redesign's *skeleton*.

---

## 1. PRD improvement recommendations (clarity / comprehension)

The PRD is thorough but reads like a spec, not a map. Concrete upgrades:

| # | Problem in v1.4 | Improvement |
|---|------------------|-------------|
| 1 | **8 top-level modules** (Organic, Paid, Daily Signals separate) → cognitive load | Collapse nav to redesign's IA: **Home · Analytics · Create · Library · Research · Calendar · Settings**. Organic/Paid become a **segmented toggle inside Analytics + Create**, not 3 sidebar sections. Keeps the locked "organic≠paid" data separation while halving entry points. |
| 2 | Daily Signals described as engine + page + cards in 3 places → feels huge | Reframe Daily Signals as a **strip on Home + an "Insights" tab inside Analytics**, not its own module. Same evidence-drawer contract, lower perceived weight. |
| 3 | Jargon-first metric tables (CPL, frequency, save-rate) with no plain meaning at point of use | Adopt the v6 mockup's pattern: every metric row carries a one-line `<small>` "what this tells us" explainer. Already in mockup — promote to a PRD UX rule. |
| 4 | Roles (Hafiz/hibatullah, admin/audit) mixed into product spec | Move credential/role/VPS detail into an **Appendix**; keep sections 01–14 product-focused so marketing/creative readers aren't wading through PM2 notes. |
| 5 | Phases 0–5 are deliverable lists, no "what the user can do after each" | Add a one-line **user-facing outcome** per phase ("After Phase 2 you can see which post to repeat without opening Meta"). |
| 6 | "v1.4" title is a changelog, not a name | Rename doc to **SCIS PRD v2 — clarity pass**; keep changelog inside. |

These are doc edits — proposed, not yet applied. Confirm before I touch the PRD.

---

## 2. Design alignment recommendation

**Adopt:** redesign's skeleton (flat 7-item nav, Poppins, Tabler icons, Analytics-with-toggle) + v6's skin (color tokens, decision cards, score rings, signal tables, micro-copy explainers).

- Keep `--brand:#3b4ee2` (organic) / `--orange:#fd8549` (paid) / teal sidebar — both mockups already share these, so zero palette conflict.
- Headings: **Poppins** (redesign) over serif Fraunces (v6) → less editorial, faster to scan. Keep JetBrains Mono for metric values/labels (both use it).
- Icons: **Tabler** (redesign) over unicode glyphs (v6) → clearer, consistent.
- Reuse v6's **decision card + signal table + evidence drawer** components verbatim — they're the best part of v6 and survive the IA change.

Net: one design system = "v6 palette + redesign layout."

---

## 3. MVP scope (your 3 asks)

Maps to PRD **Phase 2 (Meta Data)** + a reporting slice. Daily Signals deferred to fast-follow.

### Approach A — Bolt onto existing brief-studio
Add Meta sync + Analytics + Reports as new routes in current app.
- **Pros:** one codebase, reuse auth/Brand/Prisma/FeatureRun, fastest path.
- **Cons:** brief-studio's GOALS.md is creative-gen focused; analytics bloats it; naming drift (brief-studio vs SCIS).

### Approach B — Restructure to full PRD SCIS (8 modules)
- **Pros:** matches PRD literally.
- **Cons:** contradicts your stated preference for the simpler redesign IA; heavy; over-builds before Meta data is even flowing.

### Approach C — Hybrid (recommended)
Adopt redesign IA, build ONLY the Meta+Analytics+Reports slice now, defer Daily Signals decision engine.
- Nav this round: **Home · Analytics · Reports · Settings** (Create/Library/Research already exist or come later).
- **Pros:** matches your design + scope preferences exactly; ships measurable value; signals layer slots in later on top of the same snapshot tables.
- **Cons:** Meta OAuth + token storage + rate limits are real work; need encrypted token handling per PRD.

**Recommendation: Approach C.**

### MVP feature breakdown (Approach C)

**3a. Meta sync layer**
- Connect flow: Meta App (App ID/Secret) → OAuth → per-brand: 1 FB Page + 1 IG + 2–3 ad accounts.
- Sync mode: **manual "Sync now" button + last-synced timestamp now; PM2 cron worker later.** No live API call on page load (PRD rule).
- Cache everything in Postgres. Idempotent upsert keyed by `meta_post_id` / `(ad_id, date_range)`.

**3b. Analytics (organic/paid split, T-1 / T-7)**
- One **Analytics** page, segmented toggle: **Organic | Paid**.
- Period toggle: **T-1 (last 24–48h)**, **T-7 (7d)**, with **T-30** as baseline for deltas.
- Organic view: reach, engagement rate, saves, shares, comments, early velocity, best posting time. Top content table.
- Paid view: spend, CPL/CPA, CTR, CPC, CPM, result volume, frequency, fatigue flag (freq↑ + CTR↓). Top creative table.
- Every metric shows delta vs prior equivalent period + the `<small>` explainer.

**3c. Report generation (daily / weekly / monthly, calendar-aligned)**
- Periods: **Daily** (yesterday), **Weekly** (last 7 / ISO week), **Monthly** (last full **calendar month**).
- Output: **hybrid** — data tables (from snapshots) + AI narrative summary (gpt-4o) that reads the numbers and writes "what happened / what to do." Organic and paid summarized separately.
- Export: Markdown + PDF; saved to a `Report` table + Library.
- Timezone: **Asia/Kuala_Lumpur (MYT)** fixed for "yesterday" / week / month boundaries.

---

## 4. Edge cases & failure modes

- **Brand context incomplete** → analytics still renders from Meta data; Create stays blocked until brand guideline exists.
- **Meta API fails / rate-limited** → graceful error, keep last cached data, show last-synced time, retry path. Never blank the dashboard.
- **Token expired (Meta ~60-day)** → flag re-auth to admin; audit/debug user sees "needs reconnect" status only, can't fix.
- **Empty ad account / no paid data** → honest empty state; do NOT fabricate paid metrics or signals.
- **Small sample** (few leads / low spend) → label "Watch / not enough data"; never claim "Scale" from tiny numbers (PRD result-volume rule).
- **Mid-sync interruption** → idempotent upserts; partial sync resumable; mark snapshot `synced_at`.
- **Report over partially-synced period** → label "partial — still syncing," show coverage %.
- **Timezone drift** (server UTC vs MYT) → all period math in MYT; store UTC, render MYT.
- **Role access** → only admin connects Meta / sees credential values; audit/debug sees masked health only (PRD locked).
- **AI report hallucination** → narrative must only cite numbers present in the snapshot payload; pass structured data, forbid invented figures (evidence rule).

---

## 5. Key decisions — CONFIRMED (2026-06-15)

- [x] **Scope identity** — **Full SCIS product.** Organic/Paid stay as separate proper modules (matches "split organic/paid better lain2 module"). Apply comprehension layer (v6 skin + redesign clarity: Poppins, Tabler icons, plain-language metric explainers) ON TOP of the full module structure — clarity is visual/copy, not module-collapse.
- [x] **Daily Signals** — **Include lightweight version.** Rule-based threshold engine (Scale Similar / Create Variation / Watch / Hold-Stop) + evidence drawer + Home signal strip this MVP. No ML. Reuses snapshot tables.
- [x] **Report style** — **Hybrid** (data tables + gpt-4o narrative, organic/paid separated, MD + PDF export).
- [x] **PRD** — **Produce revised PRD v2** at `docs/PRD-v2.md`.
- [ ] **Token storage** — env-bootstrap + encrypted per-brand OAuth tokens now; full `AppCredential` vault fast-follow. (recommend; confirm at plan time)
- [ ] **Sync trigger** — manual "Sync now" MVP, PM2 cron worker fast-follow. (recommend; confirm at plan time)

### Prisma models needed (new)
`MetaPageConnection`, `InstagramConnection`, `MetaAdAccountConnection`, `OrganicPost`, `OrganicMetricSnapshot`, `AdCreative`, `AdMetricSnapshot`, `Report` (+ reuse `Brand`, `User`, `FeatureRun`). `AppCredential`/`CredentialAuditLog`/`DailySignal` deferred.

### New API routes
`/api/meta/connect` (OAuth), `/api/meta/sync`, `/api/analytics` (organic|paid, period), `/api/reports` (generate/list/export).

---

## 6. Recommendation (one line)

Build **Approach C**: v6-palette-on-redesign-IA, ship Meta sync → organic/paid Analytics (T-1/T-7) → calendar-aligned daily/weekly/monthly reports, defer the Daily Signals decision engine to a fast-follow that reuses the same snapshot tables.
