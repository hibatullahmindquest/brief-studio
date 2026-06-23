# UX Spec — Module 1 Phase B: Admin

> Date: 2026-06-22 · Branch: `feat/m1-phase-b-admin`
> PRD: `docs/plans/2026-06-22-m1-phase-b-admin-prd.md`
> Design system: v6 light (bg `#f2f5fd`, white cards, ink `#00262a`, brand `#3b4ee2`,
> orange `#fd8549` for paid/destructive accents). Fonts: Poppins + JetBrains Mono.
> Shell: `dashboard-shell` + existing `/dashboard/settings/*` layout. English-ish admin labels OK
> (admin is internal); user-facing studio is the English-locked surface (Phase G), not this.

## Navigation

Settings hub (`/dashboard/settings`) gains three cards in the existing grid:
`Experts · Recipes · Users` (alongside Brands, Meta, Logs). Each card: icon + title +
one-line description + count badge (e.g. "5 experts · 1 disabled").

Breadcrumb on each sub-page: `Settings / <Surface>`. Page title + short subtitle +
primary action button top-right (`+ New Expert`, `+ New Recipe`).

## Shared patterns

- **List + drawer/inline-edit:** each surface = a table/list of rows; create/edit opens an
  inline expanding panel or a right-side drawer (reuse whichever the brands page already uses;
  if none, inline expanding card under the row). No modal libraries — plain panels.
- **Save affordance:** primary button shows spinner + "Saving…" while POST/PATCH in flight;
  on success → green inline "Saved" toast/line that fades; on error → red inline message with
  the server text (e.g. "roleKey already exists").
- **Empty state:** centered card — icon + "No experts yet" + `+ Create the first expert` CTA.
- **Destructive:** Delete = orange/red text button → inline confirm ("Delete <name>? This can't be
  undone.") with Cancel/Delete. If guarded 409 → show the reason ("In use by recipe: poster").
- **Enabled toggle:** switch on each row; disabled rows render at 60% opacity with a "disabled" pill.

## 1. Experts — `/dashboard/settings/experts`

**List columns:** Name · roleKey (mono) · Tier (pill) · Prompt (length, e.g. "412 chars") ·
Enabled (toggle) · actions (Edit / Delete).

**Editor panel fields (top→bottom):**
- `name` — text input.
- `roleKey` — slug input, mono; helper "unique, lowercase, e.g. `art_director`". On edit, warn
  "changing roleKey can break recipes that reference it."
- `modelTier` — segmented control: Fast / Standard / Premium.
- `enabled` — switch.
- `systemPrompt` — **large monospace textarea** (min ~14 rows, auto-grow), char counter below;
  soft warning chip if empty + enabled ("Empty prompt — output will be poor").
- Footer: Cancel · Save.

## 2. Recipes — `/dashboard/settings/recipes`

**List columns:** Task type (mono) · Group (pill) · Output (pill) · Steps (count + tiny expert
chips preview) · Lenses (chips) · Enabled (toggle) · actions.

**Editor panel:**
- `taskType` — slug input (unique); `group` — select (creative/copy/strategy/intelligence/compound);
  `outputFormat` — select (image/text/pdf/carousel); `enabled` — switch.
- `lenses` — multi-select chip input (marketing/social/social_memo/… free-add + suggestions).
- **Steps builder (the core widget):**
  ```
  Expert lineup (runs in order)
  ┌─────────────────────────────────────────────┐
  │ ⠿ 1  [Strategist ▾]   tier:[inherit ▾]   ✕  │
  │ ⠿ 2  [Copywriter ▾]   tier:[premium ▾]   ✕  │
  │ ⠿ 3  [Art Director ▾] tier:[inherit ▾]   ✕  │
  │ + Add expert                                 │
  └─────────────────────────────────────────────┘
  ```
  - Each row: drag handle (or ▲▼ buttons) for reorder, expert `<select>` (enabled experts;
    a saved step whose roleKey is now disabled/unknown shows red "⚠ disabled/unknown" but stays
    editable), optional tier override select (`inherit` = use expert's own tier), remove ✕.
  - "+ Add expert" appends a row.
- Footer: Cancel · Save. Save serialises rows → `steps` Json `[{roleKey, modelTier?}]`
  (omit `modelTier` when "inherit").

## 3. Brands — `/dashboard/settings/brands` (extend existing page)

Keep the existing **Logo & Overlay** section (variant upload, placement chips, footer L/R) as-is.
Add a new section below it per brand:

**Brand Knowledge (M1 grounding)** — array/chip editors + textareas:
- `contentPillars[]` — chip list ("+ add pillar").
- `audienceSegments[]` — chip list.
- `doNot[]` — chip list (red-tinted chips; this is the structured do-not).
- `signaturePhrases[]` — chip list.
- `colors[]` — chip list of hex swatches; each chip shows the colour; invalid hex rejected inline.
- `fonts[]` — chip list.
- `religiousGuidelines` — textarea (shown prominently for NakNgaji).
- `footer` — text input (canonical footer).
- `logoPath` — text input (canonical asset path; helper notes the variant upload above is the
  primary logo flow).
- Footer: Save (PATCH /api/brand). Two-color note: small helper "Legacy primary/secondary colours
  are used by the poster overlay; the palette above feeds AI grounding."

## 4. Users (Teams) — `/dashboard/settings/users`

**List columns:** Name · Email · Team role (select: marketing/creative) · Team scope
(select: single/multi/all) · Admin (toggle) · (no delete).
- Inline edit: changing any select/toggle PATCHes immediately (optimistic + revert on error),
  or a per-row Save button — pick per-row Save for clarity (avoids accidental admin grants).
- **Last-admin guard:** if the toggle would remove the final admin → blocked, red inline
  "At least one admin required."
- Self-row highlighted ("you").

## States summary (all surfaces)

| State | Treatment |
|-------|-----------|
| Loading list | skeleton rows |
| Empty | centered CTA card |
| Saving | button spinner + disabled |
| Save ok | green inline "Saved", fades |
| Validation/server error | red inline message (server text) |
| Guarded delete (409) | inline reason, item not removed |
| Non-admin | page: redirect (`requireAdmin`); API: 403 |

## Component inventory (build)

- `ExpertsAdmin.tsx` (list + editor panel) · `RecipesAdmin.tsx` (+ `RecipeStepsBuilder`) ·
  brand knowledge section into existing `BrandFurnitureForm.tsx` or sibling `BrandKnowledgeForm.tsx` ·
  `UsersAdmin.tsx`. Shared bits: `ChipListInput`, `InlineConfirm`, `SaveBar` (extract if reused ≥2×).
