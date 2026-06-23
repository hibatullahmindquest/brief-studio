# PRD — Module 1 Phase B: Admin (transparent & tunable)

> Date: 2026-06-22 · Route: feature · Branch: `feat/m1-phase-b-admin`
> Brainstorm: `.claude/plans/2026-06-22-m1-phase-b-admin-brainstorm.md`
> Roadmap: `creative-hub/docs/revamp/module-1-implementation.md` §Phase B (path now LOCKED there)

## 1. Summary

Build the admin surfaces that let admins author and tune **the system's brain** — the experts,
recipes, brand knowledge, and team assignments — before the Module 1 generation spine (Phases
D/E) consumes them. All four models already exist (Phase A); this phase is **UI + API only, no
schema change**.

## 2. Problem / why now

Phase D (recipe engine) and Phase E (visual) read experts' `systemPrompt`, recipe `steps`, and
brand grounding fields. Without an editor those are seed-only and untunable. Phase B unblocks
D/E by making the brain editable, and delivers the Module 1 acceptance criterion *"editing an
expert prompt in admin changes output."*

## 3. Scope

### In scope
1. **Experts** — list, create, edit, delete(guarded), enable/disable; `systemPrompt` editor, `modelTier`.
2. **Recipes** — list, create, edit, delete(guarded), enable/disable; structured expert-lineup
   builder (`steps`), `taskType`, `group`, `outputFormat`, `lenses[]`.
3. **Brands (enriched)** — edit M1 grounding fields; reuse existing logo-variant upload + colors.
4. **Teams** — per-user assignment of `team` (single|multi|all), `teamRole`, `isAdmin`.
5. Settings hub nav links to the three new pages.

### Out of scope (deferred)
- Consolidating legacy↔new Brand fields (carry-forward: later phase).
- Brand `templates` Json editor (structured templates) — defer to a later phase; show read-only count.
- User create/delete (assignment only; users created via signup/seed).
- Recipe versioning / audit history.
- Dedicated top-level `/admin` section (using `/dashboard/settings/*` per LOCKED decision).

## 4. Decisions (locked)

| # | Decision |
|---|----------|
| D1 | Admin lives under `/dashboard/settings/{experts,recipes,users,brands}`. **Logged deviation** from doc's `src/app/admin/*` → reuse existing gating; doc updated to lock new path. |
| D2 | Brand editor writes **M1 enriched fields** (`contentPillars`, `audienceSegments`, `doNot`, `signaturePhrases`, `religiousGuidelines`, `colors`, `fonts`, `footer`, `logoPath`); legacy overlay UI untouched. |
| D3 | Recipe `steps` edited via **structured row builder** (expert dropdown + optional tier + reorder), not raw JSON. Server re-validates. |
| D4 | Lifecycle = **soft-disable first** (`enabled`); hard DELETE allowed **only when unreferenced** (Expert blocked if its `roleKey` is in any Recipe step; Recipe blocked if referenced by any CreativeRun). |
| D5 | Build order: **Experts → Recipes → Brands → Teams**. |
| D6 | No Prisma migration. Verify via `scripts/m1b-*.ts` tsx integration + lint + tsc + build. |

## 5. Users & access

- **Admin only.** Every page `requireAdmin()`; every route `assertAdmin()` → 401/403.
- Non-admin marketing/creative users never see these pages or hit these routes.

## 6. Functional requirements

### 6.1 Experts (`/dashboard/settings/experts`, `/api/admin/experts`)
- **List:** all experts (enabled + disabled), showing roleKey, name, modelTier, enabled, prompt length.
- **Create:** roleKey (unique, slug), name, systemPrompt (textarea), modelTier (select fast|standard|premium), enabled (default true).
- **Edit:** all fields except roleKey is editable but uniqueness enforced; large `systemPrompt` editor.
- **Delete:** guarded — 409 if roleKey present in any `Recipe.steps`.
- **API:** `GET` (list), `POST` (create), `PATCH ?id=` (update), `DELETE ?id=` (guarded). Catch P2002 → 409 "roleKey already exists".

### 6.2 Recipes (`/dashboard/settings/recipes`, `/api/admin/recipes`)
- **List:** all recipes, showing taskType, group, outputFormat, step count, lenses, enabled.
- **Create/Edit:** taskType (unique), group (select), outputFormat (select image|text|pdf|carousel),
  lenses[] (multi-select chips), enabled, and **steps builder**:
  - ordered rows; each = expert dropdown (enabled experts; warn if a saved step points to a now-disabled/unknown roleKey) + optional tier override + remove; add-row + up/down reorder.
- **Validation (server):** every step.roleKey must exist; warn (not block) if referenced expert disabled.
- **Delete:** guarded — 409 if referenced by any `CreativeRun`.
- **API:** `GET`/`POST`/`PATCH ?id=`/`DELETE ?id=`. P2002 → 409 "taskType already exists".

### 6.3 Brands enriched (`/dashboard/settings/brands` — extend, `PATCH /api/brand` — extend)
- Add a **"Brand Knowledge"** section to the existing brands page:
  - text-list editors (chip/array) for `contentPillars`, `audienceSegments`, `doNot`,
    `signaturePhrases`, `colors` (hex-validated), `fonts`; textarea `religiousGuidelines`;
    text `footer`; text `logoPath` (canonical asset path; logo *upload* stays as the existing variant flow).
- Existing logo-variant upload + placement + footerLeft/Right untouched.
- **API:** extend `PATCH /api/brand` to accept + validate the enriched fields (already `assertAdmin`).
  Validate: colors are `#rrggbb`; trim/dedupe arrays; drop blanks.

### 6.4 Teams (`/dashboard/settings/users`, `/api/admin/users`)
- **List:** all users — name, email, teamRole, team, isAdmin.
- **Edit (inline):** set `team` (single|multi|all), `teamRole` (marketing|creative), `isAdmin` toggle.
- **Guard:** block removing `isAdmin` from the **last remaining admin** (and from self if you are the last) → 409.
- **API:** `GET` (list), `PATCH ?id=` (assignment fields only — never password/email).

### 6.5 Settings hub
- Add nav cards/links: Experts, Recipes, Users (alongside existing Brands, Meta, Logs).

## 7. Non-functional

- **Validation:** server is source of truth; client validation is convenience only.
- **Errors:** inline messages; 401/403/409 surfaced as friendly text.
- **States:** empty (no experts/recipes → CTA to create), loading (saving spinner), error (inline).
- **Consistency:** v6 light design system; reuse dashboard shell + `BrandFurnitureForm` patterns.
- **Prisma 4 gotchas:** omit nullable Json (no literal `null`); arrays default `[]`.

## 8. Data model (no change — reference)

`Expert`(roleKey✦, name, systemPrompt, modelTier, enabled) · `Recipe`(taskType✦, group, steps Json
`[{roleKey,modelTier?}]`, outputFormat, lenses[], enabled) · `Brand`(+ enriched M1 fields) ·
`User`(team, teamRole, isAdmin). ✦ = `@unique`.

## 9. Acceptance criteria

- [ ] Admin edits an expert `systemPrompt` → persists (verify by reload + script).
- [ ] Admin creates/edits a recipe with an ordered expert lineup → persists; steps validated.
- [ ] Admin edits brand knowledge fields (pillars/doNot/colors/...) → persists; logo upload still works.
- [ ] Admin assigns a user's team/teamRole/isAdmin → persists; last-admin demotion blocked.
- [ ] Hard-delete blocked when referenced (expert-in-recipe, recipe-in-run) → 409.
- [ ] All pages/routes admin-gated (non-admin → redirect/403).
- [ ] `scripts/m1b-*.ts` integration scripts PASS · `npm run lint` · `npx tsc --noEmit` · `npm run build` green.

## 10. Risks

- **Soft roleKey refs in `steps` Json** can dangle if an expert is renamed/deleted — mitigated by
  delete guard + save-time validation + UI warning on disabled/unknown step.
- **Two color sources** (legacy primary/secondary + new `colors[]`) — label clearly; consolidate later.
- **Windows EPERM** on build if dev/worker hold the Prisma query engine DLL — stop dev+worker before build.

## 11. Out-of-scope follow-ups (KIV)

- Legacy↔new Brand field consolidation + backfill.
- Brand `templates` structured editor.
- Recipe step "test run" preview (depends on Phase D engine).
