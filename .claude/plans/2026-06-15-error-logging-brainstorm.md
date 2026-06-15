# Brainstorm — Error Logging & Tracking

> Date: 2026-06-15 · Trigger: "gagal jana visual" — the real cause is only in the server console (invisible later). Need persistent, admin-visible error logs so Claude can diagnose in a future session.

---

## 0. Why the visual gen failure is currently invisible

`/api/generate/visual` catch does `console.error(...)` then returns a generic "Gagal jana visual." The actual OpenAI error (status/code/body) is lost once the dev server scrolls or restarts. We can't diagnose what we can't see. **Fix: capture the real error to a persistent store with full detail.**

Likely real causes for the image failure (the log will tell us which): model id `gpt-image-2` not valid for the account, org not verified for image generation, image scope/billing missing, invalid `size` param, or response shape (b64 vs url). All of these surface in the OpenAI error body — which we must capture.

---

## 1. What to capture (the key part)

A central `logError()` that normalizes ANY error — especially OpenAI `APIError` — into a rich row:

| Field | Purpose |
|-------|---------|
| `source` | where it happened — e.g. `visual.render`, `visual.plan`, `generate.copy`, `meta.callback` |
| `level` | `error` \| `warn` |
| `message` | short human message |
| `code` | error code — `insufficient_quota`, `content_policy_violation`, HTTP status, etc. |
| `httpStatus` | status returned to the user |
| `detail` | **the full diagnostic** — stack + extracted OpenAI body (`status`, `code`, `type`, `error.message`). Capped ~8KB |
| `userId` / `brandId` / `featureRunId` | who/what context (nullable) |
| `contextJson` | **sanitized** request context — e.g. `{outputTypeId, aspect, size, model, promptChars}`. NEVER the API key, NEVER full secrets |
| `createdAt` | timestamp |

**OpenAI error extraction is the heart of this** — the SDK throws `APIError` with `.status/.code/.type/.message` and a `.error` body. A `normalizeError()` helper pulls all of it into `detail` so a later session reads the row and knows exactly why.

---

## 2. Approaches

### A — DB `ErrorLog` model + central `logError()` (recommend)
Store rows in Postgres; view in admin; query directly in a later session.
- **Pros:** persistent across restarts, queryable (`SELECT … FROM "ErrorLog"`), admin-viewable UI, structured.
- **Cons:** a DB outage can't self-log to DB → falls back to console. (App errors ≫ DB errors, so fine.)

### B — File-based JSONL (`logs/errors.jsonl`)
- **Pros:** survives DB outage; easy tail; PM2-friendly.
- **Cons:** no admin UI without parsing; harder to query/filter; Claude needs file access.

### C — Hybrid (DB primary + console fallback)
- DB is the source of truth + admin UI; `console.error` stays (PM2 captures on VPS) as a backstop when the DB write itself fails.
- **Pros:** best of both; minimal extra code (console already there).
- **Recommend C** — DB model + `logError()` that also `console.error`s, and never throws.

---

## 3. Where it appears (admin)
User wants it in **admin settings**. Plan:
- New page **`/dashboard/settings/logs`** (admin-only, `requireAdmin`).
- A **link card on the Settings page** ("Error logs →") + an **Admin nav item** "Error Logs" for quick access.
- UI: latest ~50 rows; **filter by source + level**; each row expandable to show `detail` (stack + OpenAI body) + `contextJson`. Newest first. Relative time.
- (Phase 2: mark resolved, clear old, search.)

---

## 4. Where we call logError()
A reusable helper, called in the catch blocks of the risky paths (wire now):
- `/api/generate/visual` — **the immediate need** (plan + render). Log BEFORE returning the mapped response.
- `/api/generate` (copy) catch.
- `/api/meta/callback` catch.
- Future: a thin route wrapper for blanket coverage (Phase 2). MVP = explicit calls in the AI/integration catches.

---

## 5. Edge cases & failure modes
- **logError must NEVER throw** — wrap the DB write in try/catch, fall back to `console.error`. A logging failure must not break the user response.
- **No secrets** — `contextJson` is an allowlist of safe fields; never spread `process.env`, never log the API key or raw tokens.
- **Large stacks** — cap `detail` (~8KB) to avoid bloating rows.
- **Sensitive context** — brief answers may appear; internal team data, acceptable, but keep context minimal/truncated.
- **Volume** — low (internal 7 users); no dedup/rate-limit for MVP. Add later if noisy.
- **Role** — admin-only view (logs can contain context); audit users see nothing here for v1.
- **DB down** — console fallback; the admin page shows "no logs / DB error" gracefully.

---

## 6. For Claude in a later session (the actual goal)
Once live, diagnosing = read the rows:
- Admin UI `/dashboard/settings/logs`, or
- `docker exec brief-studio-db psql … -c 'SELECT source, code, "httpStatus", message, left(detail,2000) FROM "ErrorLog" ORDER BY "createdAt" DESC LIMIT 20;'`

`source` + `code` categorize fast; `detail` has the OpenAI body for root cause. This is what lets me fix "gagal jana visual" next.

---

## 7. Key decisions
- [ ] **Storage** — DB + console fallback (Approach C)? (recommend yes)
- [ ] **Location** — `/dashboard/settings/logs`, linked from Settings + Admin nav item? (recommend yes)
- [ ] **Capture scope (MVP)** — wire the AI/integration catches now (visual, copy, meta), blanket wrapper later? (recommend yes)
- [ ] **Branch** — build on the current `feat/visual-generation` branch (it's unmerged + this directly debugs it, same PR)? (recommend yes)
- [ ] **Actions** — list + filter + expand for MVP; resolve/clear later? (recommend yes)

### Models / routes / files (if approved)
- **Prisma:** `ErrorLog` model + migration.
- **`src/lib/error-log.ts`** — `normalizeError(err)` (extracts OpenAI status/code/type/body) + `logError({source, error, httpStatus?, userId?, brandId?, featureRunId?, context?})` (never throws).
- **Wire:** `logError` into `/api/generate/visual`, `/api/generate`, `/api/meta/callback` catches.
- **API:** `GET /api/logs` (admin) — recent + filters. (Or page queries Prisma directly.)
- **UI:** `/dashboard/settings/logs` page (admin) + Settings link + Admin nav "Error Logs".

---

## 8. Recommendation (one line)
**Approach C** — a DB `ErrorLog` + a never-throwing `logError()` with rich OpenAI error extraction, wired into the visual/copy/meta catches, surfaced at admin-only `/dashboard/settings/logs`; build on `feat/visual-generation` so the next "jana imej" attempt captures its real cause for diagnosis.
