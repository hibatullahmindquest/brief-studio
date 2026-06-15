# SCIS MVP — Implementation Plan

> Source: `docs/PRD-v2.md` §10–13 · Brainstorm: `.claude/plans/2026-06-15-scis-analytics-meta-mvp-brainstorm.md`
> Date: 2026-06-15 · Route: feature · Stack: Next.js 16 App Router, Prisma 4.16, Postgres 16, OpenAI v6
> Order: **P1 Schema → P2 Meta OAuth → P3 Sync → P4 Analytics → P5 Signals → P6 Reports**
> This doc details **P1 + P2** to executable depth; P3–P6 are outlined and get their own detail pass before execution.

---

## Grounding facts (from codebase)

- **Session is stateless HMAC cookie** (`src/lib/session.ts`). `getCurrentUser()` returns `{id,email,name,username}` only — **no `isAdmin`/`teamRole`**. Admin-gating needs a DB lookup → add `requireAdmin()`.
- **Prisma 4.16.2** — `String` JSON fields are used elsewhere (`FeatureRun.inputJson` is `String?`). Keep that convention: store JSON as `String` (stringified), not native `Json`, to match existing code style. *(Decision D1 — confirm or switch to native `Json`.)*
- **No Graph OAuth exists.** `Stats.igAccessToken` etc. are unused stubs; `/api/instagram/rescrape` is scraping. Build OAuth fresh; ignore the Stats stubs.
- **No encryption lib** — tokens must be encrypted at rest (PRD). Add `src/lib/crypto.ts` (AES-256-GCM, Node `crypto`, key from env).
- **No date/PDF lib** — P6 will add one; not needed for P1/P2.
- Env placeholders already exist: `META_APP_ID`, `META_APP_SECRET`, `SESSION_SECRET`.

---

## Decisions to confirm before coding

- **D1 — JSON storage:** stringified `String` (matches existing `FeatureRun`) vs native Prisma `Json`. → *Recommend `String`* for consistency + Prisma 4 stability.
- **D2 — Connection table shape:** PRD lists 3 tables (`MetaPageConnection`, `InstagramConnection`, `MetaAdAccountConnection`). → *Recommend one unified `MetaConnection` with a `type` field* (page | instagram | ad_account) to cut surface. Flagged as a deliberate deviation from PRD §11.
- **D3 — Graph API version:** pin `v21.0` in a constant. Confirm or bump.
- **D4 — Token encryption key:** new env `META_TOKEN_KEY` (32-byte, base64). Generate with `openssl rand -base64 32`. App refuses to store tokens if unset.

---

## P1 — Schema & foundations

**Goal:** Prisma models for Meta connections + organic/paid snapshots + signals + reports, plus the crypto + admin-guard primitives. Migration applies clean. No UI yet.

### P1.1 — Add encryption helper
**File:** `src/lib/crypto.ts` (new)
- `encrypt(plaintext: string): string` → AES-256-GCM, returns `iv.tag.ciphertext` (base64url, dot-joined).
- `decrypt(blob: string): string` → reverse.
- Key from `process.env.META_TOKEN_KEY` (base64 → 32 bytes). Throw clear error if missing/wrong length.
- Pure Node `crypto`; no deps.

### P1.2 — Add admin guard
**File:** `src/lib/session.ts` (edit)
- Add `getCurrentUserWithRole()` — looks up `isAdmin`/`teamRole` from DB by session id.
- Add `requireAdmin()` — `redirect("/login")` if not logged in; throw/403 path for API use (return a helper `assertAdmin()` that throws `Response 403` for route handlers).

### P1.3 — Prisma models
**File:** `prisma/schema.prisma` (edit) — append:

```prisma
model MetaConnection {
  id           String   @id @default(cuid())
  brand        Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId      String
  type         String   // "page" | "instagram" | "ad_account"
  externalId   String   // page_id | ig_user_id | ad_account_id (act_ prefix kept)
  name         String   @default("")
  tokenEnc     String?  // encrypted long-lived/page token (null for ad_account if it inherits)
  tokenExpiry  DateTime?
  scopes       String   @default("")
  status       String   @default("connected") // connected | needs_reauth | error
  lastError    String?
  lastSyncedAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([brandId, type, externalId])
  @@index([brandId, type])
}

model OrganicPost {
  id          String   @id @default(cuid())
  brand       Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId     String
  platform    String   // "facebook" | "instagram"
  metaPostId  String
  type        String   @default("")  // image | video | carousel | reel | story
  caption     String   @default("")
  thumbnailUrl String?
  permalink   String?
  publishedAt DateTime?
  createdAt   DateTime @default(now())
  snapshots   OrganicMetricSnapshot[]
  @@unique([brandId, metaPostId])
  @@index([brandId, platform, publishedAt])
}

model OrganicMetricSnapshot {
  id          String   @id @default(cuid())
  post        OrganicPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId      String
  dateRange   String   // "t1" | "t7" | "t30"
  reach       Int      @default(0)
  impressions Int      @default(0)
  likes       Int      @default(0)
  comments    Int      @default(0)
  shares      Int      @default(0)
  saves       Int      @default(0)
  profileActions Int   @default(0)
  engagementRate Float @default(0)
  score       Float    @default(0)
  metricsJson String?  // raw extras
  syncedAt    DateTime @default(now())
  @@unique([postId, dateRange])
  @@index([postId, dateRange])
}

model AdCreative {
  id          String   @id @default(cuid())
  brand       Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId     String
  metaAdId    String
  campaignId  String   @default("")
  adsetId     String   @default("")
  name        String   @default("")
  copyJson    String?
  thumbnailUrl String?
  createdAt   DateTime @default(now())
  snapshots   AdMetricSnapshot[]
  @@unique([brandId, metaAdId])
  @@index([brandId, campaignId])
}

model AdMetricSnapshot {
  id          String   @id @default(cuid())
  ad          AdCreative @relation(fields: [adId], references: [id], onDelete: Cascade)
  adId        String
  dateRange   String   // "t1" | "t7" | "t30"
  spend       Float    @default(0)
  impressions Int      @default(0)
  reach       Int      @default(0)
  clicks      Int      @default(0)
  results     Int      @default(0)  // leads/conversions
  ctr         Float    @default(0)
  cpc         Float    @default(0)
  cpm         Float    @default(0)
  cpl         Float    @default(0)
  frequency   Float    @default(0)
  metricsJson String?
  syncedAt    DateTime @default(now())
  @@unique([adId, dateRange])
  @@index([adId, dateRange])
}

model DailySignal {
  id            String   @id @default(cuid())
  brand         Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId       String
  channel       String   // "organic" | "paid"
  signalType    String
  decisionLabel String   // "scale_similar" | "create_variation" | "watch" | "hold_stop"
  confidence    String   @default("low") // low | medium | high
  score         Float    @default(0)
  evidenceJson  String   @default("[]")
  recommendation String  @default("")
  suggestedActions String @default("[]")
  generatedAt   DateTime @default(now())
  @@index([brandId, channel, generatedAt])
}

model Report {
  id          String   @id @default(cuid())
  brand       Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)
  brandId     String
  periodType  String   // "daily" | "weekly" | "monthly"
  periodStart DateTime
  periodEnd   DateTime
  dataJson    String   // structured snapshot payload used for the narrative
  narrative   String   @default("")
  exportPath  String?
  createdAt   DateTime @default(now())
  @@index([brandId, periodType, periodStart])
}
```
- **Brand back-relations:** add `metaConnections MetaConnection[]`, `organicPosts OrganicPost[]`, `adCreatives AdCreative[]`, `dailySignals DailySignal[]`, `reports Report[]` to `model Brand`.

### P1.4 — Migrate
```bash
docker start brief-studio-db
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" npx prisma migrate dev --name scis_meta_analytics
npx prisma generate
```

### P1.5 — Env
- `.env.example` (edit): add `META_TOKEN_KEY=""`, `META_GRAPH_VERSION="v21.0"`, `META_REDIRECT_URI="http://localhost:3000/api/meta/callback"`.
- `.env.local` (local, gitignored): set real `META_TOKEN_KEY` (`openssl rand -base64 32`), `META_APP_ID`, `META_APP_SECRET`.

### P1 verification
- `npx prisma migrate dev` applies with no drift.
- `npm run lint` + `tsc --noEmit` clean.
- `node -e "require('./src/lib/crypto')..."` round-trip encrypt/decrypt (or a tiny script in `scripts/`).
- **Done when:** migration committed, crypto round-trips, `requireAdmin` compiles.

---

## P2 — Meta OAuth connect flow

**Goal:** an admin connects a brand's Meta assets (1 FB Page + its IG account + ad accounts) via Facebook Login; tokens stored encrypted; `MetaConnection` rows created; Settings shows connection status.

### P2.1 — Meta client lib
**File:** `src/lib/meta.ts` (new)
- `GRAPH = https://graph.facebook.com/${META_GRAPH_VERSION}`.
- `oauthUrl(state)` → `https://www.facebook.com/${ver}/dialog/oauth?...` with scopes:
  `pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights, ads_read, read_insights, business_management`.
- `exchangeCode(code)` → short-lived token.
- `exchangeLongLived(token)` → 60-day token.
- `getPages(userToken)` → `/me/accounts` (id, name, access_token).
- `getIgAccount(pageId, pageToken)` → `/{pageId}?fields=instagram_business_account{id,username}`.
- `getAdAccounts(userToken)` → `/me/adaccounts?fields=account_id,name`.
- All wrapped with error normalisation (capture Graph `error.message`/code).

### P2.2 — State signing (CSRF)
- Reuse HMAC pattern from `session.ts`: `signState({brandId,userId,nonce})` / `verifyState`. Short TTL. Put in `src/lib/meta-state.ts` or inside `meta.ts`.

### P2.3 — Connect route
**File:** `src/app/api/meta/connect/route.ts` (new) — `GET`
- `assertAdmin()`. Read `?brandId=`. Validate brand exists.
- Build signed `state`, redirect to `oauthUrl(state)`.

### P2.4 — Callback route
**File:** `src/app/api/meta/callback/route.ts` (new) — `GET`
- Verify `state` (CSRF + extract brandId/userId). Handle `?error=` (user denied) → redirect to Settings with message.
- `exchangeCode` → `exchangeLongLived`.
- `getPages` → for the chosen/first page: upsert `MetaConnection{type:"page"}` with encrypted page token.
- `getIgAccount` → upsert `MetaConnection{type:"instagram"}` (token = page token, encrypted).
- `getAdAccounts` → upsert each `MetaConnection{type:"ad_account"}` (token = user long-lived, encrypted).
- Set `tokenExpiry`, `scopes`, `status:"connected"`.
- Redirect `→ /settings?meta=connected`.
- **Idempotent** via `@@unique([brandId,type,externalId])` upsert.

### P2.5 — Status + disconnect
**File:** `src/app/api/meta/status/route.ts` (new) — `GET` returns masked connection health per brand (type, name, status, tokenExpiry, lastSyncedAt) — **never the token**. Audit users may call this (read-only, masked).
**File:** `src/app/api/meta/disconnect/route.ts` (new) — `POST`, admin-only, deletes connections for a brand (confirmation modal in UI).

### P2.6 — Settings UI (minimal)
**File:** `src/app/settings/meta/page.tsx` (or extend existing Settings)
- Per brand: "Connect Meta" button (admin) → `GET /api/meta/connect?brandId=`.
- Connection cards: Page / Instagram / Ad accounts with status pill + last-synced. Masked, no tokens.
- "Sync now" button stub (wired in P3). Disconnect with confirm modal.

### P2 verification
- Local: set Meta app to **Development mode**, add `localhost` redirect URI in Meta App dashboard.
- Click Connect → FB login → redirected back → `MetaConnection` rows exist, `tokenEnc` is ciphertext (verify with a query — must NOT be readable).
- `GET /api/meta/status` returns masked data, no token.
- Audit/non-admin user blocked from `connect`/`disconnect`, allowed `status`.
- `npm run lint` + `tsc` clean.
- **Done when:** a brand shows "connected" with page + IG + ≥1 ad account, tokens encrypted, status masked.

### P2 edge cases to handle now
- User denies permission → graceful redirect, no rows.
- Page has no linked IG business account → store page + ad accounts, mark IG "not_linked", don't fail whole flow.
- No ad accounts → connect succeeds with page+IG only.
- `META_TOKEN_KEY` unset → refuse to store, clear error to admin.
- State expired/tampered → 400, restart flow.

---

## P3–P6 — Outlines (detail later)

### P3 — Sync layer
- `POST /api/meta/sync?brandId=` (admin) — pull organic posts + insights (FB Page + IG media + insights) and ad metrics (`/act_x/insights` with `date_preset`/`time_range` for t1/t7/t30). Idempotent upsert into snapshot tables, stamp `syncedAt` + `MetaConnection.lastSyncedAt`. Compute `engagementRate`, derived `cpl`, `frequency`.
- Graceful partial-sync + rate-limit handling. Returns counts.
- *Fast-follow:* PM2 cron worker.

### P4 — Analytics
- `GET /api/analytics?channel=&period=` — read snapshots, compute deltas vs prior period (t7 vs prior 7, etc.).
- Pages: `/organic` + `/paid` overviews — top content/creative tables, metric cards w/ explainers, fatigue flag (paid: freq↑ & CTR↓/CPL↑). Period toggle T-1/T-7.
- Apply design system (Poppins + Tabler + v6 palette + per-metric `<small>` explainer).

### P5 — Daily Signals (lightweight, rule-based)
- `src/lib/signals.ts` — threshold rules per PRD §5 tables → emit `DailySignal` rows with evidence.
- `GET /api/signals` + Home strip + evidence drawer + per-module Insights tab.
- Hard rule: no card without evidence.

### P6 — Reports
- Add date lib (`date-fns` or Intl) + PDF (`@react-pdf/renderer` or md→pdf). *(Decision at P6.)*
- `POST /api/reports` — assemble snapshot payload for period (MYT, calendar-aligned monthly) → gpt-4o narrative (organic/paid separate, evidence-bound) → save `Report` + export MD/PDF.
- Reports page: generate + history + export.

---

## Cross-cutting

- **Security:** tokens encrypted (P1.1), never in responses/logs (P2.5), admin-gated writes, audit read-only masked. No `.env*` committed.
- **Timezone:** all period boundaries MYT; store UTC.
- **Commit cadence:** atomic per sub-phase. Gates per `RULES.md`: `/bs-verify` (lint+tsc+build) → `/bs-review` → `/bs-release-notes` → `/bs-commit`. No push to `master`; branch `feat/scis-meta-analytics`.
- **GOALS.md:** update Active Task at session end.

---

## Suggested first execution slice
P1.1 → P1.2 → P1.3 → P1.4 (schema + crypto + admin guard + migration), commit, then P2.1–P2.4 (OAuth connect+callback), commit. Verify each with lint/tsc/migrate before moving on.
