# Brainstorm — Module 1 Phase B (Admin: transparent & tunable)

> Date: 2026-06-22 · Route: feature · Branch: feat/m1-phase-b-admin
> Spec: creative-hub/docs/revamp/module-1-implementation.md §Phase B
> Acceptance: edit expert prompt → persisted · upload brand logo → stored · admin-only guarded

## Goal

Give admins a UI to **view/edit the system's brain** so experts/recipes/brands can be authored
*before* the generation spine (Phase D/E) consumes them. Four surfaces:
1. **Experts** CRUD + `systemPrompt` editor + `modelTier` + `enabled`
2. **Recipes** CRUD — ordered expert lineup per `taskType` + `outputFormat` + `lenses`
3. **Brands** editor — M1 enriched knowledge fields + logo/colors (logo upload already exists)
4. **Team assignment** per user (`team` single|multi|all, `teamRole`, `isAdmin`)

## Ground truth (from codebase map)

- **Greenfield:** no `/admin/*` path, no `/api/admin/*` routes yet.
- **Established pattern:** admin surfaces live under `/dashboard/settings/*`, gated by
  `requireAdmin()` (pages) / `assertAdmin()` (routes) in `src/lib/session.ts`.
- Existing: `/dashboard/settings/brands` (logo variants + footer + placement) via
  `PATCH /api/brand` + `POST /api/brand/logo`. Reusable: `BrandFurnitureForm.tsx`.
- Models already exist from Phase A: `Expert`(roleKey, name, systemPrompt, modelTier, enabled),
  `Recipe`(taskType, group, steps Json `[{roleKey,modelTier?}]`, outputFormat, lenses[], enabled),
  `Brand`(+ enriched M1 fields), `User`(team, teamRole, isAdmin). **No schema change needed.**
- No unit-test framework → verify via tsx integration scripts (`scripts/m1b-*.ts`) + lint + build.

---

## Decision 1 — Admin location

**Approach A — extend `/dashboard/settings/*` (RECOMMENDED)**
- New pages: `settings/experts`, `settings/recipes`, `settings/users`; extend `settings/brands`.
- New routes under `/api/admin/*`; brand stays on extended `/api/brand`.
- Pros: matches existing convention, reuses dashboard shell/header/nav, less surface area,
  brands editor already lives here. Carry-forward says "consolidate later" anyway.
- Cons: "settings" is a slightly humble home for the system brain.

**Approach B — new top-level `/admin` section (per design doc literal path)**
- Pros: clean separation, matches doc's `src/app/admin/*` wording.
- Cons: new shell/layout/nav, duplicates the settings gating, more work, splits admin UX in two.

→ **A.** Design doc paths are roadmap-level; existing convention + reuse wins. brief-studio is the
build ground (gets migrated to creative-hub later), so minimise new scaffolding.

## Decision 2 — Brand legacy vs new (M1 enriched) fields

Carry-forward (M1-A): legacy/new duplication (dontSay/doNot, logoUrl/logoPath, footer, colors)
is **intentional**, consolidate + backfill in a later phase.

**Approach A — editor writes the M1 enriched fields, leaves legacy overlay UI as-is (RECOMMENDED)**
- Add a "Brand Knowledge" form section editing: `contentPillars[]`, `audienceSegments[]`,
  `doNot[]`, `signaturePhrases[]`, `religiousGuidelines`, `colors[]`, `fonts[]`, `footer`,
  `logoPath`. Keep the existing logo-variant upload + placement UI untouched.
- Pros: these are exactly the grounding fields Phase D/E consume; no risky backfill now.
- Cons: two color fields visible (legacy primary/secondary + new colors[]) — acceptable, label clearly.

**Approach B — consolidate now (migrate legacy→new, drop legacy)**
- Cons: out of Phase B scope, risks the working poster overlay, contradicts carry-forward plan.

→ **A.** Edit the M1 grounding fields; defer consolidation.

## Decision 3 — Recipe `steps` editor UX

`steps` = ordered `[{ roleKey, modelTier? }]`.

**Approach A — structured row builder (RECOMMENDED)**
- Rows = ordered experts. Each row: expert dropdown (enabled experts only) + optional tier
  override select + remove. Add-row + up/down reorder. `lenses` = multi-select chips,
  `outputFormat` = select, `group` = select, `taskType` = text (unique), `enabled` toggle.
- Pros: prevents malformed JSON / unknown roleKeys; readable; validates referential integrity.
- Cons: more component code than a textarea.

**Approach B — raw JSON textarea**
- Pros: trivial. Cons: error-prone, no validation, bad admin UX.

→ **A** for the steps lineup; keep the rest as plain selects/chips. Server still re-validates.

## Decision 4 — Delete semantics (referential safety)

- `Recipe.recipeId` is referenced by `CreativeRun` (nullable, no cascade).
- `Expert.roleKey` is referenced *softly* inside `Recipe.steps` Json (no FK).

**Rule (RECOMMENDED):**
- Primary lifecycle = `enabled` toggle (soft disable), not delete.
- Allow hard DELETE **only when not referenced**: block deleting an Expert whose `roleKey`
  appears in any Recipe's steps (409 + message); block deleting a Recipe referenced by any
  CreativeRun (or allow + null the FK — but block is safer for MVP).
- Users are never deleted here (assignment only).

## Decision 5 — Sub-task ordering (build sequence)

Recipes editor depends on the expert list existing → **Experts first**.
1. **Experts CRUD** (+ systemPrompt editor, tier, enabled) → `/api/admin/experts`
2. **Recipes CRUD** (lineup builder using experts) → `/api/admin/recipes`
3. **Brands enriched editor** (extend page + `/api/brand` PATCH)
4. **Team assignment** (users list + `/api/admin/users` PATCH)
5. Settings hub: add nav links to the 3 new pages.

Each sub-task: route + page + tsx verify script, reviewed incrementally (per-prompt loop).

---

## Edge cases / failure modes

- **Duplicate keys:** `roleKey` / `taskType` are `@unique` → catch P2002, return 409 friendly msg.
- **Empty systemPrompt:** allowed by schema default `""` but warn — an enabled expert with empty
  prompt produces junk in Phase D. Soft-warn in UI, don't hard-block.
- **Recipe with disabled/unknown expert in steps:** validate roleKey exists on save; warn (not block)
  if a referenced expert is currently `enabled=false`.
- **Logo upload** failure modes already handled (PNG sig check, sharp re-encode, 2MB) — reuse.
- **colors[] / fonts[]** bad input: validate hex for colors (`#rrggbb`), trim blanks, dedupe.
- **Non-admin access:** every page `requireAdmin()`, every route `assertAdmin()` → 401/403.
- **Concurrent edits:** last-write-wins (no optimistic lock) — acceptable for 7-person internal tool.
- **Self-demotion:** admin removing own `isAdmin` could lock out admin — guard: block demoting the
  last remaining admin / your own admin flag (warn + block).

## Key decisions checklist

- [x] Approach: A (extend /dashboard/settings/*) + structured recipe builder + soft-disable-first
- [x] Prisma models affected: **none** (all exist from Phase A) — no migration
- [x] New API routes: `/api/admin/experts`, `/api/admin/recipes`, `/api/admin/users`;
      extend `PATCH /api/brand` for enriched fields
- [x] New pages: `settings/experts`, `settings/recipes`, `settings/users`; extend `settings/brands`
- [x] UI states: loading (saving spinner), error (inline msg), empty (no experts/recipes yet → CTA)
- [x] Verify: `scripts/m1b-*.ts` tsx integration per sub-task + lint + tsc + build

## Recommendation

Build under `/dashboard/settings/*` reusing the existing admin gating + form patterns, in the
order **Experts → Recipes → Brands enriched → Teams**, with a structured recipe-lineup builder and
soft-disable-first lifecycle (guarded hard delete). No schema change. Verify each sub-task with a
tsx integration script + lint/build before moving on.

→ Confirm approach, then proceed to PRD.
