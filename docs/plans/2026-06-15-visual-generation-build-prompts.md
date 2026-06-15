# Build Prompts — Visual Generation

> Step 4 (build-prompts) · feature `feat/visual-generation`
> Sources: `docs/PRD-visual-generation.md`, `docs/UX-visual-generation.md`
> Execution: per-prompt loop — implement one prompt → `/bs-review` → user confirms "next". Verify/review/release-notes/commit gates run after the last prompt.

Grounding facts:
- OpenAI lib `src/lib/openai.ts` uses `client.chat.completions.create` (model from `OPENAI_MODEL`, default "gpt-5"); response carries `usage.prompt_tokens/completion_tokens`.
- `generateCopy` does NOT currently return usage → BP3 exposes it.
- `/api/generate` POST returns the output but NOT the FeatureRun id → BP5 adds `id` so the client can target the visual route.
- Images saved to `public/uploads/generated/` (local FS, per CLAUDE.md). FeatureRun `output` is a stringified-JSON `String` → image refs go in there, no schema change for the image.

---

## BP1 — Schema: APIUsageLog + migration
**Files:** `prisma/schema.prisma`, migration
- Add `APIUsageLog` model (per PRD §5) + `User.apiUsageLogs APIUsageLog[]` back-relation.
- `npx prisma migrate dev --name api_usage_log` + generate (stop dev server first to avoid the Windows DLL lock).
**Acceptance:** migration applies; `prisma generate` clean; tsc clean.

## BP2 — Pricing lib
**Files:** `src/lib/pricing.ts` (new), `.env.example`
- Price tables: gpt-4o input/output per-1K-token USD; gpt-image-2 per-image USD by size (1024², 1024×1536, 1536×1024).
- `USD_TO_MYR` from `process.env.USD_TO_MYR` (default 4.70). Add to `.env.example`.
- `estimateVisual(kind, size): {usd, myr}` (1 image + small director allowance).
- `actualFromUsage({model, inputTokens, outputTokens, imageCount, imageSize}): {usd, myr}`.
- `sizeForAspect(aspect): "1024x1024"|"1024x1536"|"1536x1024"`.
**Acceptance:** unit-callable; numbers sane; tsc + lint clean.

## BP3 — Usage logging + wire copy generation
**Files:** `src/lib/usage.ts` (new), `src/lib/openai.ts`, `src/app/api/generate/route.ts`
- `logUsage(row)` → writes one `APIUsageLog` (computes MYR via pricing).
- `generateCopy` → also return `usage` ({inputTokens, outputTokens}) alongside copy (refactor return to `{copy, usage}` or add out-param; update caller).
- In `/api/generate` POST: after generateCopy, `logUsage({module:"copy", model, tokens, userId, brandId, featureRunId})`.
**Acceptance:** generating copy writes a usage row with MYR cost; existing flow unaffected; tsc + lint clean.

## BP4 — Visual lib (gpt-4o director + gpt-image render)
**Files:** `src/lib/visual.ts` (new)
- `planVisual(output, briefAnswers, brand, outputTypeId): VisualPlan` — gpt-4o, JSON response, kind defaulted from outputTypeId (poster→poster, storyboard/video_script→storyboard, hook_copy→none). Returns `{shouldRender, kind, aspect, brandNotes, imagePrompt, scenes[]}` + usage. Scene count parsed from output text, fallback to brief `scenes`.
- `renderImage(prompt, size): {path, usage}` — `client.images.generate({model:"gpt-image-2", prompt, size, n:1})`, decode b64/url, write to `public/uploads/generated/<runId>-<ts>.png`, return public path.
- Prompt builder injects brand colours/tone + "consistent style across panels, minimal in-image text, leave space for logo, do NOT render exact price/date/logo".
**Acceptance:** `planVisual` returns valid VisualPlan for each type; `renderImage` saves a file + returns path; quota/policy errors thrown typed; tsc + lint clean.

## BP5 — API route `/api/generate/visual` + return runId from generate
**Files:** `src/app/api/generate/visual/route.ts` (new), `src/app/api/generate/route.ts` (return `id`), `src/lib/feature-store.ts` (helper to load run + update output if needed)
- `POST /api/generate/visual {featureRunId}`: auth (creative|admin via role lookup); load run + brand; `planVisual`; if `!shouldRender` return `{shouldRender:false}`; else `renderImage`; merge `image`+`visualPlan` into FeatureRun.output (stringified); `logUsage` ×2 (director + render); return `{image, scenes, kind, aspect, costMyr}`.
- `/api/generate` POST also returns saved `id`.
- Errors: 402 quota, 422 policy (retryable), 404 run, 403 role.
**Acceptance:** end-to-end call on a real run returns image path + cost; 2 usage rows logged; bad role → 403; tsc + lint clean.

## BP6 — VisualPanel + integrate into GenerationResult
**Files:** `src/components/studio/VisualPanel.tsx` (new), `src/components/studio/GenerationResult.tsx`, `src/components/studio/StudioWizard.tsx` (pass featureRunId + outputTypeId)
- StudioWizard: capture `id` from generate response → pass to GenerationResult.
- VisualPanel: render only for poster/storyboard/video_script. State machine (idle+estimate / planning / rendering / done-poster / done-storyboard / none / error) per UX spec. Estimate via pricing on mount. Jana → POST visual; staged loader; show image + captions + actual cost; Download + Regenerate. Dispatch `generation:complete` on success.
- Hook & Copy → no panel.
**Acceptance:** matches mockup states; poster shows single image; storyboard shows composite + captions; cost shown; verify gate green.

## BP7 — HistoryModal shows saved image
**Files:** `src/components/studio/HistoryModal.tsx`, `src/lib/feature-store.ts` (include image in HistoryRun if needed)
- If run output has `image`, render it (+ captions) in the modal.
**Acceptance:** a run with a visual shows its image in Semakan Lepas; tsc + lint clean.

## BP8 — Usage module
**Files:** `src/app/api/usage/route.ts` (new), `src/app/dashboard/usage/page.tsx` (new), `src/app/dashboard/usage/usage-view.tsx` (if client bits), `src/lib/dashboard-data.ts` (nav)
- `GET /api/usage` (admin): totals (today/month, by module), recent rows, rate. No keys.
- `/dashboard/usage` page (`requireAdmin`): KPI cards, recent generations, by-module, rate — per UX §C, v6 styling.
- Add **Usage** nav item under Admin (`admin:true`).
**Acceptance:** page shows real logged costs; admin-only; non-admin redirected; verify gate green.

---

## After BP8 — gates (unskippable)
6. **verify** — `npm run lint` + `npx tsc --noEmit` + `npm run build` (zero errors).
7. **review** — `/bs-review` (spec compliance + code quality: route auth, Prisma, error handling, no secret leakage).
8. **release-notes** — CHANGELOG `[Unreleased] › Added: AI visual generation + usage tracking`.
9. **commit** — atomic per BP ideally; then PR.

## Suggested execution order
BP1 → BP2 → BP3 → BP4 → BP5 (backend complete + testable) → BP6 → BP7 → BP8 (UI complete). Review checkpoint after each.
