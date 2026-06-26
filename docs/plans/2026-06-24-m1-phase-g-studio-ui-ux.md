# UX Spec — Phase G: Studio UI

> Route: feature · Branch: `feat/m1-phase-g-studio-ui`
> PRD: `docs/plans/2026-06-24-m1-phase-g-studio-ui-prd.md` · Mockup: `creative-hub/docs/archive/revamp/studio-mockup.html`
> Design system: SCIS v6 tokens in `src/app/globals.css` (`--brand #3b4ee2`, `--orange #fd8549`, teal sidebar `#00262a`, `editorial-*`/`v6-card`).

## Language rule (global)
- **Chrome = English, fixed.** Nav, buttons, step labels, badges, system messages.
- **AI content = mirror the brief's input language.** Gap questions (G4), generated copy, notices follow whatever language the user wrote the brief in. No language toggle.

## Layout (Cara C)

```
┌ top note bar (teal, mono) ───────────────────────────────────┐
├ sticky header: [≡ collapse] Studio        [◷ Recent] [avatar] ┤
├──────────┬──────────────────────────────────────┬────────────┤
│ NAV      │  breadcrumb: Studio › <step>          │  RECENT    │
│ Create*  │  ┌ stepper 1·2·3·4·5 ───────────────┐ │  (drawer,  │
│ Library  │  │ brief bar: Task Obj Angle Fmt …  │ │  closed by │
│ Calendar │  └──────────────────────────────────┘ │  default)  │
│ Campaigns│  ┌ WORK PANEL (cross-fade per step) ─┐ │            │
│ ──       │  │  [ active step component ]        │ │            │
│ Settings │  └──────────────────────────────────┘ │            │
└──────────┴──────────────────────────────────────┴────────────┘
```
- **Nav** (left): Create (active), Library, Calendar, Campaigns; divider; Settings group (Experts, Recipes, Brands, Team). Collapsible to 58px icon rail. Hidden < 920px (hamburger).
- **Recent drawer** (right): **closed by default**, ◷ toggles. Hidden < 1180px.
- **Work panel**: single column, steps cross-fade (`.step.show`); brief bar sits above it and persists across steps.

## Step screens

### 1 · Describe (front door / empty state)
- H1 "What do you want to make?" + large textarea (autofocus).
- Row of chips: **Upload brief** (file → `uploads[]`), **Paste URL** (→ `uploads[]`), and **quick-start types**: Poster · Carousel · Copywriting · Marketing plan · Ideas (single-select, prefills intent).
- Top-right of panel: **Lens** dropdown (Marketing/Social, role-limited) + **Brand** picker (chips from `/api/brand`).
- Primary **Send →** (brand pill, radius 999px). Disabled until text or upload present.
- Loading: button → spinner; on 502 → inline retryable banner "Couldn't read that — try again."

### 2 · Understand
- **Grounded banner**: intent line + lens (from `StudioResponse.intent`/`lens`).
- **Understand card**: Task · Recipe pipeline · Experts (chips) · Output format (from `recipe`).
- **Gap section** "I need to know (just N)":
  - `task_type` → clarify chips (pick the task type).
  - `clarification` → "No recipe for this yet" message + Back.
  - `platform` → multi-select chips; other fields → labeled free-text inputs.
  - Required fields marked; optional dimmed.
  - Question text in brief's language (G4).
- CTAs: **Run recipe →** (primary) / **Skip — use defaults** (secondary, only if no required gaps). Confirm 409+gaps → inline re-surface.

### 3 · Visual direction (image runs only)
- AI-suggested **direction / style / ratio** card; ratio chips 9:16·1:1·4:5·16:9 (AI-picked highlighted).
- Steer: **Describe yourself** (text) · **Regenerate suggestion**. (Use-reference deferred — Phase E lock.)
- Note line: "Logo + footer stamped automatically after generation."
- **⚡ Generate →** (orange pill) → Generating. Text-only runs skip this step entirely.

### 4 · Generating (poll)
- Spinner header "Your experts are working…".
- Expert checklist with waiting/running/done dots: Strategist → Copywriter → Art Director → Image gen → Brand overlay → Brand Guardian QA. (Best-effort from job status + notices; not per-expert granular.)
- Subtext "You can leave — we'll keep going."
- Poll `GET /api/studio/[runId]/status` ~1.5s. `failed`/502 → error card + **Retry**. Timeout (~40 polls / 60s) → "Still running — check Recent later" + Recent link.

### 5 · Result
- Success pill "**On-brand · <lens>**" (from `contextUsed.guardian`; if flagged → amber "Needs review · <reason>").
- Meta badges: Done · RM<cost> · <ratio>·<platform>.
- **Carousel** of `images[]` (arrows/dots) — omitted if none.
- **Copy block**: headline/CTA/caption/hashtags grouped from `texts[]` (strategy/copy/social). Copy-to-clipboard per block.
- Guardian **notices** list (if any).
- Action row: **👍 / 👎** (display-only, tooltip "Coming soon"), **↻ Variation** (→ render G3; `skipped`→toast), **💾 Save** (already persisted — confirms), **Export PDF** (→ export; **hidden when `texts[]` empty**; spinner→download link; skipped→toast).
- **Take it further →**: static next-step chips (Turn into Carousel / Make IG Story video / Write more captions) — non-wired this phase.

## Recent drawer
- Cards: thumbnail (`thumbnailPath` or placeholder), title, relative timestamp, mono badges (Draft / 🖼 / 📄 / RM<cost>). Newest first; "Load more" via cursor.
- Click → `/studio/[runId]`. Fresh run animates in (slide+fade). Empty → "No runs yet — describe something to start."

## Deep-link `/studio/[runId]`
- Server-rendered `ResultView` from `getRunArtifacts`. Has artifacts → result. Draft/no artifacts → resume into the flow at the right step. Not found/not owned → 404.

## States matrix
| Screen | Empty | Loading | Error |
|--------|-------|---------|-------|
| Describe | the front door itself | Send spinner | retryable banner |
| Understand | n/a | intake skeleton | confirm 409→inline gaps; 502→retry |
| Generating | n/a | checklist + spinner | failed/timeout card + Retry |
| Result | "No output" guard | artifact skeleton | 404 not-found page |
| Recent | "No runs yet" | card skeletons | "Couldn't load — retry" |

## Motion & depth
- Step cross-fade ~200ms; chips/buttons subtle scale on press; cards use `--shadow`; brief-bar chips fade from dimmed→solid as they fill.
- Respect `prefers-reduced-motion`.

## Accessibility
- Stepper = `aria-current` on active; gap inputs labeled; carousel keyboard-navigable; lens/brand pickers are real selects/listboxes; focus moves to new step heading on transition.

## Responsive
- ≥1180px: nav + work + recent (drawer toggled). 920–1180: nav + work, recent off. <920: hamburger nav overlay, work full-width.
