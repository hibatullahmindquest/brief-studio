# Build Prompts — Module 1 Phase B: Admin

> Date: 2026-06-22 · Branch: `feat/m1-phase-b-admin`
> PRD: `docs/plans/2026-06-22-m1-phase-b-admin-prd.md` · UX: `...-ux.md`
> Loop per prompt: **write verify script (red) → implement (green) → `/bs-review` → user says "next"**.
> No schema change. Verify via tsx scripts (`scripts/m1b-*.ts`) + lint + tsc + build.
> Stop dev + worker before any `npm run build` (Windows EPERM on Prisma DLL).

Build order follows dependencies: **Experts → Recipes → Brands → Teams → Settings hub.**

---

## Prompt 1 — Experts API + verify

**Files:** `src/app/api/admin/experts/route.ts`, `scripts/m1b-experts.ts`.

1. `scripts/m1b-experts.ts` (red first): asserts create → list → patch(systemPrompt persists) →
   duplicate roleKey returns 409 → delete-guard (insert a Recipe whose steps reference the roleKey,
   expect DELETE 409) → delete when unreferenced succeeds. Use a temp roleKey (`__test_*`), clean up.
2. `route.ts`:
   - `GET` → all experts ordered by name (enabled + disabled).
   - `POST` → create {roleKey, name, systemPrompt, modelTier, enabled}; trim; default tier "standard".
   - `PATCH ?id=` → update provided fields (roleKey uniqueness enforced).
   - `DELETE ?id=` → block (409 + reason) if roleKey appears in any `Recipe.steps`; else delete.
   - All: `assertAdmin()`; catch Prisma P2002 → 409 "roleKey already exists".
**Done when:** `scripts/m1b-experts.ts` PASS.

## Prompt 2 — Experts admin page + UI

**Files:** `src/app/dashboard/settings/experts/page.tsx` (`requireAdmin`),
`src/components/admin/ExpertsAdmin.tsx`, shared `src/components/admin/{ChipListInput,InlineConfirm,SaveBar}.tsx`
(build here, reuse later).

- List per UX §1 (name/roleKey/tier/prompt-length/enabled/actions).
- Inline editor panel: name, roleKey (slug + warn on edit), modelTier segmented, enabled switch,
  large monospace `systemPrompt` textarea + char counter + empty-while-enabled warning.
- Create / edit / delete (InlineConfirm) / enable toggle wired to `/api/admin/experts`.
- States: loading skeleton, empty CTA, saving spinner, ok/err inline.
**Done when:** lint+tsc+build green; manual: create+edit+disable+delete an expert in UI.

## Prompt 3 — Recipes API + verify

**Files:** `src/app/api/admin/recipes/route.ts`, `scripts/m1b-recipes.ts`.

1. `scripts/m1b-recipes.ts` (red): create with steps `[{roleKey},{roleKey,modelTier}]` →
   list → patch (reorder + lenses persist) → unknown roleKey in steps rejected (400) →
   duplicate taskType 409 → delete-guard (create a CreativeRun with recipeId → DELETE 409) →
   delete unreferenced succeeds. Clean up temp rows.
2. `route.ts`:
   - `GET`/`POST`/`PATCH ?id=`/`DELETE ?id=`, `assertAdmin()`.
   - Validate `steps`: array of `{roleKey, modelTier?}`; every roleKey must exist in Expert table
     (else 400 with list of bad keys). Serialise as given.
   - `outputFormat`/`group`/`lenses[]` accepted; P2002 → 409 "taskType already exists".
   - DELETE blocked (409) if referenced by any `CreativeRun.recipeId`.
**Done when:** `scripts/m1b-recipes.ts` PASS.

## Prompt 4 — Recipes admin page + steps builder

**Files:** `src/app/dashboard/settings/recipes/page.tsx` (`requireAdmin`),
`src/components/admin/RecipesAdmin.tsx`, `src/components/admin/RecipeStepsBuilder.tsx`.

- List per UX §2. Editor: taskType, group select, outputFormat select, lenses chip-multiselect,
  enabled, **RecipeStepsBuilder** (ordered rows: expert select + tier override + reorder ▲▼ + remove;
  red ⚠ on disabled/unknown roleKey; "+ Add expert"). Serialise rows → steps Json (omit tier when inherit).
- Reuse ChipListInput/InlineConfirm/SaveBar. Fetch experts list for the dropdown.
**Done when:** lint+tsc+build green; manual: build a poster recipe lineup, save, reload persists order.

## Prompt 5 — Brands enriched: API + form

**Files:** extend `src/app/api/brand/route.ts` (PATCH), extend
`src/app/dashboard/settings/brands/page.tsx`, new `src/components/admin/BrandKnowledgeForm.tsx`,
`scripts/m1b-brands.ts`.

1. `scripts/m1b-brands.ts` (red): PATCH a brand with enriched fields → re-read persists;
   invalid hex in colors rejected; arrays trimmed/deduped/blank-dropped.
2. Extend `PATCH /api/brand` (keep existing overlay fields working) to accept + validate
   `contentPillars[]`, `audienceSegments[]`, `doNot[]`, `signaturePhrases[]`, `colors[]` (hex `#rrggbb`),
   `fonts[]`, `religiousGuidelines`, `footer`, `logoPath`. `assertAdmin()` already present.
3. `BrandKnowledgeForm.tsx` (chip lists + swatches + textareas) added below existing Logo & Overlay
   section; two-color helper note. Logo upload flow untouched.
**Done when:** `scripts/m1b-brands.ts` PASS; lint+tsc+build green; manual edit persists.

## Prompt 6 — Users (Teams): API + verify

**Files:** `src/app/api/admin/users/route.ts`, `scripts/m1b-users.ts`.

1. `scripts/m1b-users.ts` (red): list → patch team/teamRole/isAdmin persists →
   last-admin demotion blocked (409) → granting admin to a second user then demoting first succeeds.
2. `route.ts`: `GET` (list: id,name,email,teamRole,team,isAdmin), `PATCH ?id=` (only those
   assignment fields — never password/email/username). Last-admin guard: count admins; block if
   this PATCH would drop admins to 0. `assertAdmin()`.
**Done when:** `scripts/m1b-users.ts` PASS.

## Prompt 7 — Users admin page

**Files:** `src/app/dashboard/settings/users/page.tsx` (`requireAdmin`),
`src/components/admin/UsersAdmin.tsx`.

- Table per UX §4: teamRole select, team select, isAdmin toggle, per-row Save. Self-row highlighted.
- Last-admin guard surfaced inline on 409.
**Done when:** lint+tsc+build green; manual assignment persists.

## Prompt 8 — Settings hub nav + counts

**Files:** `src/app/dashboard/settings/page.tsx`, `dashboard-data.ts` (or nav source).

- Add Experts / Recipes / Users cards with count badges (experts, recipes, users; note disabled count).
- Ensure each card admin-gated visibility consistent with existing Brands/Meta/Logs cards.
**Done when:** hub shows all admin surfaces; lint+tsc+build green.

---

## After all prompts → resume feature route

verify (gate) → review (gate, `/bs-review`) → release-notes (`/bs-release-notes`) →
commit (`/bs-commit`) → push (ask permission) → PR (pin fork:
`gh pr create --repo hibatullahmindquest/brief-studio --base master`).
