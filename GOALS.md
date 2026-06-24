# brief-studio — Project Goals

> **ALWAYS READ THIS FIRST.** Prevents context loss across sessions.
> Update "Active Task" at the end of every session.

---

## Main Goal

**AI-powered creative workspace** yang mempercepatkan penghasilan output pasukan marketing dan creative — dari idea sampai poster, script, dan storyboard — dalam masa seminimum mungkin melalui proses briefing yang tersusun dan AI-assisted generation.

---

## Problem Statement

Penghasilan satu content hari ini mengambil masa **3–7 hari** dari idea ke output siap. Pasukan terpaksa spend masa untuk research, strategy, brief gathering, hooks, references, dan konsep — semua sebelum proses design atau editing boleh bermula.

Akibatnya:
- Masa terbuang pada proses perancangan yang berulang
- Brief yang tidak lengkap menyebabkan revision yang banyak
- Tiada sistem untuk rekod idea, output, dan konteks projek secara berpusat

---

## Success Criteria

| Siapa | Target |
|-------|--------|
| Graphic Designer | 10–15 poster yang memuaskan dalam sehari |
| Marketer | 50–100 variation ads / storyboard / video brief dalam sehari |

Output kena:
- Align dengan objective yang user nyatakan dalam brief
- Cukup lengkap untuk terus digunakan tanpa major revision
- Pasukan tidak perlu balik ke cara lama (email/WhatsApp/manual)

---

## Target Users

- **Internal sahaja** — 7 orang pasukan SifuTutor / NakNgaji
- **Team Marketing** (3 orang) — content plan, hooks, copywriting, ads angle
- **Team Creative** (4 orang) — poster, storyboard, video script, shooting plan
- Tiada hierarchy atau approval workflow — setiap user guna secara bebas

---

## Brands

| Brand | Casing |
|-------|--------|
| SifuTutor | Exactly as written |
| NakNgaji | Exactly as written |

Brand guidelines (warna, tone, audience, dont_say, tagline) editable via web UI oleh admin. Injected sebagai context ke setiap AI generation call.

---

## MVP — Phase 1 Features

| # | Feature | Output Type | AI Model |
|---|---------|-------------|----------|
| 1 | **Poster / Image Generation** | PNG image | gpt-image-2 |
| 2 | **Hook & Copywriting** | Text (copy variations) | gpt-4o |
| 3 | **Storyboard** | Structured text + image reference | gpt-4o + gpt-image-2 |
| 4 | **Video Script & Shooting Plan** | Structured text doc | gpt-4o |

**Brief intake flow:** Cara C — structured template questions sebagai base, AI boleh tambah follow-up questions bila perlu berdasarkan jawapan user.

**Feedback loop:** User boleh beri thumbs up/down + comment pada output untuk system kenalpasti sama ada output menepati requirement.

---

## Non-Goals (MVP)

- ❌ Bulk generation (5+ variations serentak) — Phase 2
- ❌ External users / client-facing portal
- ❌ Approval workflow / hierarchy
- ❌ Video editing atau rendering
- ❌ Direct social media publishing
- ❌ Billing atau subscription management

---

## Output Organisation

Interface seperti ChatGPT — **Recent Chats / Projects** view. Setiap session disimpan dan boleh diakses semula. Output diasingkan mengikut team role:

- **Team Marketing view** — hooks, copy, content plan, ads angle
- **Team Creative view** — poster, storyboard, script, shooting plan

---

## Architecture Decisions (do not re-debate)

| Decision | Rationale |
|----------|-----------|
| Next.js 15 App Router + TypeScript | Consistent dengan workspace stack |
| gpt-image-2 for images | Latest OpenAI model (April 2026), best quality |
| gpt-4o for text generation | Cost-effective, strong instruction-following |
| PostgreSQL for all data | Briefs, sessions, brand profiles, output history |
| Local filesystem for images (dev) | Simple, no S3 cost during development |
| Brief intake: Cara C (template + AI follow-up) | Predictable base + flexible for edge cases |

---

## What NOT To Do

- ❌ **DO NOT** commit `.env*`, API keys, atau brand data ke git
- ❌ **DO NOT** push ke `main` tanpa PR
- ❌ **DO NOT** mix brand profiles across generation calls
- ❌ **DO NOT** store generated images in DB — store path/URL only
- ❌ **DO NOT** skip brief validation sebelum trigger generation

---

## Automation Thresholds

Setiap session start, Claude kena check conditions ni. Kalau tercapai, bagitahu user sebelum sambung kerja.

| Condition | Threshold | Action bila tercapai |
|-----------|-----------|---------------------|
| Files dalam `docs/plans/` | > 5 | Upgrade `bs-save-session` — tambah deferred decision review step |
| Items dalam Deferred Decisions | > 10 | Pindahkan ke fail berasingan `docs/DECISIONS.md` |
| Items dalam Future Plans (KIV) | > 15 | Kategorikan mengikut phase (Phase 2, Phase 3, Someday) |
| Working sessions (anggaran) | > 20 | Cadangkan setup claude-mem memory folder untuk project ni |

---

## Deferred Decisions (revisit after MVP validated)

Keputusan ini sengaja ditangguhkan — bukan dilupakan. Revisit selepas Studio MVP divalidate dengan team.

| Decision | MVP (sekarang) | Phase 2 (selepas validate) |
|----------|---------------|---------------------------|
| **Studio location** | `/studio` dalam Dashboard sidebar (`/dashboard`) | Promote ke top-level section berasingan — Studio jadi landing utama, Dashboard jadi monitoring |
| **Conversation engine** | Scripted question trees (static per output type) | True AI conversation — AI decide soalan seterusnya berdasarkan jawapan sebelum (`POST /api/studio/next-question`) |
| **Output scope** | Satu output per session | Campaign-based — multiple outputs linked ke satu brief/campaign |
| **Team handoff** | Tiada — sorang guna sorang | Marketing buat brief → Creative ambil brief yang sama → generate poster/storyboard |
| **Output lifecycle** | Generate → papar → habis | Draft → Review → Approved → Archived |
| **Brief persistence** | Tiada — fresh start setiap kali | Brief disimpan, boleh reuse dan fork |

---

## Future Plans (KIV)

Features yang dah dibincangkan tapi keluar dari MVP scope:

| Feature | Nota |
|---------|------|
| **Brief template library** | Saved briefs untuk reuse — macam Jasper |
| **Variation count** | Generate 3/5/10 variations serentak — macam AdCreative.ai |
| **History sidebar** | Phase 1: collapsible panel bawah wizard (done when built). Phase 2: 2-panel Studio layout (macam ChatGPT) — remind user once history panel validated by team |
| **Bulk generation** | 5+ variations serentak |
| **Feedback loop** | Thumbs up/down pada output untuk train quality |
| **Admin UI untuk brand** | Edit brand guidelines via web form (bukan seed script) |

---

## Plans Archive

Semua implementation plans disimpan di `docs/plans/`:

| Plan | Scope |
|------|-------|
| `2026-06-11-studio-wizard.md` | Studio conversation wizard — brand picker → output type → Q&A → brief review → generate |

---

## Active Task (update every session)

> Last updated: 2026-06-23 (session 6)

**⚠️ DEPLOYMENT PLAN (do not re-debate):** brief-studio is the **build/prototype ground**. Once a feature is validated here, it is **migrated into `creative-hub`** — creative-hub is the product that runs on **KVM8**. brief-studio itself is **NOT** deployed to KVM8. (Earlier "deploy brief-studio to KVM8" notes are obsolete.)

**Phase:** **Revamp execution** (plan: `creative-hub/docs/revamp/`). Module 0 ✅ merged. Module 1: Phase A ✅ merged · **Phase B (Admin) ✅ MERGED (PR #15 → `4b757a8`)** · **Phase C (Intent Router) ✅ DONE — PR #16 OPEN (awaiting merge).**
**Task:** Module 1 Phase C — Intent Router: `POST /api/studio` turns raw input (text + image + PDF/docx) into `{taskType, lens, recipe, gaps}` + persists a draft `CreativeRun`. Feature route COMPLETE (all 10 steps). Task file: `.claude/tasks/m1-phase-c-intent-router.json`.
**Status:** Branch **`feat/m1-phase-c-intent-router`** committed (`8842928`, 19 files) + pushed → **PR #16** https://github.com/hibatullahmindquest/brief-studio/pull/16 (pinned fork, base `master`). Built `src/lib/{lens,ingest,router,studio-error}.ts` + `POST /api/studio` (thin). Zero schema/seed change. Verify gate green (lint+tsc+build). Tests: `m1c-lens` 9/9 · `m1c-ingest` (+traversal) · `m1c-router` 26/26 · live `m1c-classify` PASS · `m1c-benchmark` 10/10 · `m1c-smoke` both roadmap cases E2E. Review PASS (fixed 1 CRITICAL: path-traversal/LFI in uploads → `safePublicPath` guard). Deps added: `pdf-parse`, `mammoth`.
**LOCKED decisions (Phase C):** Lens set = **`marketing` + `social`** (`social_memo` PARKED — Future/KIV, non-breaking to add: enum + ≥1 recipe with it in `lenses[]`). Upload ingest = text + image + PDF/docx (URL/video/OCR deferred, seam in `ingest.ts`). Clarify threshold = **0.7** (clear ~0.9–1.0, ambiguous ~0.3–0.6). Deep-lib + thin-route carried from Phase B (`runIntake` lib; route = thin `getCurrentUser`+HTTP map). `safePublicPath` confines upload reads to `/public`.
**Next (resume here):** (1) **Merge PR #16** when reviewed — `gh pr merge 16 --repo hibatullahmindquest/brief-studio --squash --delete-branch` (PIN FORK — guard hook enforces). Then `git checkout master && git pull` + delete local branch. (2) Then **Module 1 Phase D — Recipe engine** (`module-1-implementation.md` §Phase D): run the experts in the recipe the router selected (rides Module 0 queue — `kind="generate"`, recipe_id + spec), worker runs steps sequentially (each = LLM call: role system_prompt + grounding + prior outputs), Brand Guardian QA, per-expert cost log. Files: `src/worker/handlers/generate.ts` (expand) + `src/lib/{recipe-run,grounding,expert}.ts`. (3) Optional non-blocking: dedupe the two `getBrandContext` calls per intake request (pass brand into `classify`).
**Carry-forward (M1-A, still active):** Expert model named `Expert` (roleKey), not `Role`. Legacy/new Brand field duplication intentional → consolidate later. `CreativeRun.outputJson` still required (pass `"{}"`). Prisma 4: omit nullable Json (or `Prisma.DbNull`) — never literal `null`.
**Blockers:** None. **Env:** Docker Desktop + `brief-studio-db` running. Dev server + worker **STOPPED** (killed for the build — restart with `npm run dev` / `npm run worker:interactive` as needed). Stop them before any `npm run build`/`prisma generate` (Windows EPERM on Prisma DLL — today 3 zombie `next dev` procs caused it; kill stray brief-studio node procs first).

**Skills housekeeping (2026-06-22):** Installed Matt Pocock skills pack (`skills add mattpocock/skills`). External packs kept **local-only** (gitignored: `.claude/skills/*` except `bs-*`, + `skills-lock.json`, + `.agents/`); project `bs-*` skills stay tracked. To use them: `/reload-plugins` then `/teach` etc. (most have `disable-model-invocation: true` → user-invoke only). gitignore rule committed on both `master` (`26ea9b2`) and feat (`dc5fc55`); both UNPUSHED.

---
**— Earlier: Visual Intake Overhaul (Phase 1: poster) — SHIPPED TO `master` via PR #12. History below. Deferred: migrate feature → creative-hub; headline≠brand-name fix. —**

**MERGE STATE (2026-06-19):** Today's 4 commits (`a636d33` chat rewrite, `757bb2c` logo variants, `bffbe59` placement+overlay fixes, `0bea3eb` test scripts) merged to `master` via **PR #12** (`gh pr merge 12 --repo hibatullahmindquest/brief-studio --merge` → merge commit `7b22fba`). NOTE: PR #11 was already squash-merged yesterday (`e00ff44`); the branch was kept + committed on, so today's work needed a fresh clean branch (cherry-picked off `master`) → PR #12, not a re-merge of #11. Old branches `feat/visual-intake-overhaul` + `feat/studio-chat-and-brand-logos` deleted (local + remote). Only `master` remains.
**What it is:** guided brief (free-text angle) → editable Creative Spec (headline/accent/CTA, each ↻ regenerate) → Sahkan → Generate. Render-in-image (gpt-image-2) + brand DNA + logo/footer overlay from brand settings. Draft lifecycle. Plans in `.claude/plans/` + `docs/plans/`. Mockup: `C:\claude\temp\studio-flow-approaches.html` (tab C).
**Shipped & in PR #11 (commit `a9eba6d`, pinned to fork):**
- Wave A (`ceada13`,`118c3f0`): schema/status, brand visualDna, planSpec/regenerateSpecText, render-in-image prompt, sharp overlay.
- Wave B (`a9eba6d`): P8 brand furniture admin (`POST /api/brand/logo` + `PATCH /api/brand` + `/dashboard/settings/brands` + `BrandFurnitureForm`); P9 `GuidedPosterFlow` (brief→spec→generate, `visual-spec` GET/POST/PUT); P10 Semakan Lepas Draft state (○Draft + Edit/Generate); P11 cost rollup (`sumRunCostMyr`).
- Verified: lint+tsc+build green; review PASS; **live E2E poster verified** (gpt-5 spec → gpt-image-2 → logo+footer overlay; RM0.42; draft→generated). Scripts: `scripts/live-poster-e2e.mts`, `scripts/test-overlay-live.mts`.
**COMMITTED this session (`71e19e7`, branch `feat/visual-intake-overhaul`, lint+tsc+build green):**
- Conversational Studio chat rewrite: `chat-ui.tsx` (ChatBubble/Chip/CustomChip/TypingDots) + `ChatConversation.tsx` (non-poster Q&A as bubbles) + `GuidedPosterFlow` `embedded` mode + `StudioWizard` chat shell. Auto copy-gen with poster (`runVisualJob` → gpt-4o `generateCopy`; `CopyResult` + `GET /api/studio/run-output`).
- **UI usability fix**: poster result no longer nests card-in-card — on the generate/result phase the chat collapses to a compact breadcrumb (`Brand / Output · ↻ Mula semula`) and the wrapper card is dropped, so VisualPanel + CopyResult render as standalone cards. Done via `GuidedPosterFlow onPhaseChange` → `StudioWizard` `collapsed` state.
- Removed dead pickers (BrandPicker, OutputTypePicker, ConversationStep, BriefReview). `.gitignore` now ignores `public/uploads/brand/*` (runtime logo uploads) + `.gitkeep`.
- NOT committed (left in working tree on purpose): GOALS/MEMORY/task json (session bookkeeping), `docs/reports/` PDF, `scripts/*e2e*.mts` test scripts.
**ALSO committed (`c413586`):** Light/dark brand logo variants + luminance auto-pick. `Brand.logoUrlLight`/`logoUrlDark` (migration `add_brand_logo_variants`); overlay samples luminance → stamps contrasting logo (fallback: other variant → legacy `logoUrl`). Upload route takes `variant` (light|dark); admin form has 2 slots.
**ALSO committed (`5c8e141`) — poster overlay fixes + manual logo placement:**
- Manual per-brand logo **size** (`sm`/`md`/`lg`) + **corner** (`tl`/`tr`/`tc`) — admin furniture form chips, `PATCH /api/brand` validates, migration `add_brand_logo_placement`. `Brand.logoSize`/`logoCorner`. Luminance sample box follows the chosen corner.
- Overlay fixes (root cause: gpt-image-2 ignored the reserved corner): (a) **trim** transparent margin off the logo PNG so it sits flush (pad 3.3%→2.5%); (b) sample luminance from a small **clean corner box** not the headline-polluted footprint (was flipping variant); (c) image prompt now **hard-reserves top-left ~28%×16%** + headline center/lower-center.
- `.gitignore`: `public/uploads/brand/*`, `docs/reports/*.pdf`. Report README tracked.
**Logos:** user uploaded BOTH SifuTutor variants via admin (dark-bg = white wordmark+icon; light-bg = black wordmark). Verified placement on blue bg (white variant, snug corner).
**DEFERRED by user (revisit):** headline currently echoes brand name → brand shows twice (rendered headline + logo). Fix = spec-synthesis prompt makes headline the campaign message, not brand name. NOT done.
**Next (resume here):** (1) **Migrate feature → creative-hub** — port the visual-intake Studio (conversational chat flow + guided poster brief/Creative Spec) + brand-logo system (variants, placement, overlay) into `creative-hub`, which is the product on KVM8. brief-studio is the build ground only. (2) Optional: headline≠brand-name fix (see DEFERRED). (3) Phase 1 = poster only; variations / true 9:16 crop-pad / storyboard+script intake still deferred.
**Blockers:** None. Dev + worker STOPPED this session (safe for build/prisma). On `master`, clean working tree except recovery files (GOALS/MEMORY/task json — uncommitted by design).
**Reminder:** repo is a FORK — always `gh pr create/merge --repo hibatullahmindquest/brief-studio --base master` (guard hook enforces).
**Reports:** `docs/reports/brief-studio-status-2026-06-19.pdf` (today, 3-section; gitignored). Built via `creative-hub/.claude/skills/report/build.ps1` (headless Edge). Yesterday: `...-2026-06-18.pdf`.
