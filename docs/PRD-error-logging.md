# PRD — Error Logging & Tracking

> Feature PRD · 2026-06-15 · Route: feature · Branch: `feat/visual-generation`
> Source: `.claude/plans/2026-06-15-error-logging-brainstorm.md`
> Small internal utility — UX folded into §4.

## 1. Overview
Persistent, admin-visible error logging. A never-throwing `logError()` normalizes any error (especially OpenAI `APIError`) into a rich `ErrorLog` row. Wired into the AI/integration catches so failures like "gagal jana visual" capture their real cause. Viewable at admin-only `/dashboard/settings/logs`.

## 2. Scope
**In:** `ErrorLog` model; `logError()` + `normalizeError()`; wiring into `/api/generate/visual`, `/api/generate`, `/api/meta/callback`; admin log page + Settings link + Admin nav item.
**Out:** resolve/clear actions, search, blanket route wrapper, alerting (all later).

## 3. Functional requirements
- **FR1** `ErrorLog` model: `id, source, level, message, code, httpStatus, detail, userId?, brandId?, featureRunId?, contextJson?, createdAt`.
- **FR2** `normalizeError(err)` → `{ message, code, status, type, stack, detail }`. For OpenAI `APIError`, pull `status/code/type` and the body `error.message`; concatenate stack + body into `detail` (cap ~8000 chars).
- **FR3** `logError({ source, error, httpStatus?, userId?, brandId?, featureRunId?, context? })` — computes the row, writes to DB; on any failure falls back to `console.error`; **never throws**. `context` is a caller-provided sanitized object (no secrets) → stored as `contextJson`.
- **FR4** Wire `logError` into the catch blocks of the visual route (plan + render), generate route, meta callback — with `source` like `visual.render`, `generate.copy`, `meta.callback` and a sanitized context (e.g. `{outputTypeId, aspect, size, model}`).
- **FR5** `/dashboard/settings/logs` (admin, `requireAdmin`): latest ~50 rows, filter by `source` + `level`, each row expandable to show `detail` + `contextJson`. Settings page gets an "Error logs →" link; Admin nav gets "Error Logs".
- **FR6** No secrets ever logged (no API keys/tokens; context is an allowlist).

## 4. UX
- **Log page** (`v6-card` list): header "Error logs" + count; filter chips (All / visual / copy / meta / error / warn); rows show `source` · `code`/`httpStatus` badge · `message` · relative time; click row → expand `detail` (mono, pre-wrap) + `contextJson`. Empty: "Tiada error direkod 🎉".
- **Severity colour:** error = `--stop`, warn = `--warn`.
- **Settings link card** + **Admin nav item** "Error Logs" (`admin:true`).

## 5. Data model
```
model ErrorLog {
  id           String   @id @default(cuid())
  source       String
  level        String   @default("error")
  message      String
  code         String   @default("")
  httpStatus   Int?
  detail       String   @default("")   // stack + OpenAI body, capped
  userId       String?
  brandId      String?
  featureRunId String?
  contextJson  String?                 // sanitized JSON
  createdAt    DateTime @default(now())
  @@index([source, createdAt])
  @@index([level, createdAt])
}
```

## 6. Acceptance criteria
- [ ] An OpenAI failure in the visual route writes an `ErrorLog` row with the real status/code/body in `detail`.
- [ ] `logError` never throws (logging failure can't break the user response).
- [ ] No secret/API key appears in any row.
- [ ] `/dashboard/settings/logs` lists rows, filters by source/level, expands detail — admin-only (non-admin redirected).
- [ ] Settings link + Admin nav item present.
- [ ] Verify gate green (lint + tsc + build).
