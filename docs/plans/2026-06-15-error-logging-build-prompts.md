# Build Prompts — Error Logging

> Step 4 · feature `feat/visual-generation` · Source: docs/PRD-error-logging.md
> Per-prompt loop: implement → /bs-review → "next". Gates after the last BP.

## BP1 — ErrorLog model + migration
**Files:** `prisma/schema.prisma`, migration
- Add `ErrorLog` model (PRD §5) — no relations (loose userId/brandId/featureRunId, like APIUsageLog).
- `migrate dev --name error_log` (stop dev first) + generate.
**Acceptance:** migration applies; tsc clean.

## BP2 — error-log lib
**Files:** `src/lib/error-log.ts` (new)
- `normalizeError(err)` → `{message, code, status, type, stack, detail}`; extracts OpenAI `APIError` fields (`status`, `code`, `type`, `error?.message` / response body); `detail` = stack + JSON of OpenAI body, capped 8000 chars.
- `logError({source, error, httpStatus?, userId?, brandId?, featureRunId?, context?})` — builds row, `prisma.errorLog.create`; wrap in try/catch → fallback `console.error`; **never throws**. `context` → `JSON.stringify` into `contextJson` (caller passes only safe fields).
**Acceptance:** callable; never throws even if DB down; tsc + lint clean.

## BP3 — wire into catches
**Files:** `src/app/api/generate/visual/route.ts`, `src/app/api/generate/route.ts`, `src/app/api/meta/callback/route.ts`
- visual route: in catch, `await logError({source:"visual.render", error, httpStatus, userId:user.id, brandId:brand?.id, featureRunId, context:{outputTypeId, aspect, size, model:"gpt-image-2"}})` before returning the mapped response. (Also covers plan failures — same catch.)
- generate route: catch → `logError({source:"generate.copy", ...})`.
- meta callback: catch → `logError({source:"meta.callback", ...})`.
**Acceptance:** a forced failure writes a row; existing behaviour unchanged; tsc + lint clean.

## BP4 — admin log viewer
**Files:** `src/app/dashboard/settings/logs/page.tsx` (new), `src/app/dashboard/settings/logs/logs-view.tsx` (client, filter+expand), `src/lib/error-log.ts` (add `getRecentErrors(opts)`), `src/app/dashboard/settings/page.tsx` (link card), `src/lib/dashboard-data.ts` (Admin nav "Error Logs")
- `getRecentErrors({source?, level?, limit=50})` server query.
- Page `requireAdmin` → passes rows to a client view with filter chips + expandable detail (per PRD §4, v6 styling).
- Settings link card "Error logs →"; Admin nav item (`admin:true`).
**Acceptance:** lists rows, filters, expands detail; admin-only; verify gate green.

## After BP4 — gates
verify (lint+tsc+build) → review → release-notes (CHANGELOG) → commit. Then **re-test image generation** so the real failure is captured + diagnose.

## Order
BP1 → BP2 → BP3 (logging live) → BP4 (viewer). Review each.
