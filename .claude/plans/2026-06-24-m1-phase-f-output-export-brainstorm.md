# Brainstorm — Module 1 Phase F: Output / Export / Storage

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-f-output-export`
> Plan ref: `creative-hub/docs/archive/revamp/module-1-implementation.md` §Phase F

## Goal (from revamp doc)

**Artifacts OUT.** Files: `src/lib/{artifact-store,export-pdf}.ts`, `public/uploads/...`.
Tasks: multi-artifact persist · export PDF (marketing plan) via puppeteer · image set (carousel) · save to Library + Recent list.
**Acceptance:** `marketing_plan` → downloadable PDF stored + listed; poster → image + copy stored.

## What already exists (grounding)

- **Schema is export-ready — NO migration.** `Artifact.type` enumerates `"pdf"`; `exportFormat` (`"png"|"pdf"|...`) and `mediaPath` columns already exist. `Artifact` belongs to a `CreativeRun` (cascade delete), indexed `[runId, createdAt]`.
- **Multi-artifact persist is largely DONE upstream.** Phase D `runRecipe` writes `strategy`/`copy`/`visual_direction`/`social` artifacts; Phase E `renderFromRun` writes the `image` artifact (`mediaPath`, `exportFormat="png"`). So "persist" = verify + a clean read layer, not new write code.
- **⚠️ Current history listing is LEGACY.** `getRecentFeatureRuns` (`feature-store.ts`) filters `feature:"generate"` and parses `outputJson`/`inputJson` (old visual-intake shape). It does **NOT** read `Artifact` rows → new Module-1 recipe runs are invisible to today's `/api/history`. Phase F needs an **artifact-based read layer**; leave the legacy path untouched (house rule: don't break the old visual path).
- **PDF generation tool: NONE installed.** Only `pdf-parse` (reads uploaded PDFs, not generate). Decision needed.
- **House style (locked across B–E):** deep-lib + thin-route + inject-the-IO; owner-scoped; idempotent (type-only delete before rewrite); brand furniture read LIVE via `getBrandContext`; no AI cost unless an AI call is made.
- **Image storage:** `public/uploads/generated/` (KVM8 native, no Docker, no Vercel APIs).

---

## Approaches

### Approach A — On-demand export seam + artifact read-layer  ★ RECOMMENDED
- **How:** Two new deep libs mirroring Phase E's `renderFromRun` shape.
  - `src/lib/artifact-store.ts` — `listLibrary(userId,{cursor,limit})` + `getRunArtifacts(runId,userId)`: reads `Artifact` rows, groups into image-set (carousel) / text / pdf, owner-scoped.
  - `src/lib/export-pdf.ts` — `exportRunToPdf({runId,userId,deps})`: composes a brand-styled HTML from the text artifacts → PDF (renderer **injected**) → writes file under `public/uploads/exports/` → idempotent `pdf` Artifact (delete prior `pdf`-type only, mirror render). No AI call → no cost row.
  - Thin endpoints: `GET /api/library` (new, artifact-based) + `POST /api/studio/[runId]/export`.
- **Pros:** exact house pattern; testable WITHOUT a browser (inject fake renderer); export is re-invokable & decoupled (regenerate PDF independently — same reasoning that decoupled render in Phase E); PDF built only when asked (cheap); hits both acceptance criteria.
- **Cons:** export needs an explicit call (fine — Phase G wires the button).
- **Brand impact:** PDF template pulls logo/colors/footer from `getBrandContext` (same source as overlay).

### Approach B — Eager export in the worker
- **How:** after `runRecipe`, auto-generate the PDF for text/plan runs (symmetric with Phase E auto-render).
- **Pros:** artifact always ready to download.
- **Cons:** spends work on every run even if never downloaded; PDF goes stale if artifacts edited; **contradicts the Phase E decision** to keep heavy output as a re-invokable seam, not coupled to generation. Heavier worker. **Reject.**

### Approach C — Listing now, defer PDF to Phase G
- **How:** build only the artifact read-layer; push PDF into Phase G.
- **Cons:** guts Phase F — its headline acceptance is "marketing_plan → downloadable PDF". Violates "normal Module 1 order". **Reject.**

---

## Sub-decision: PDF engine (no tool installed)

| Option | How | Trade-off |
|--------|-----|-----------|
| **A1 puppeteer-core + installed Chrome/Edge** ★ | HTML template → PDF via puppeteer-core driving the system browser (no bundled chromium download) | Matches doc ("via puppeteer"); rich brand-styled layout; **needs a Chrome/Edge present** — flag for KVM8 (native node, no Docker). Set executablePath via env. |
| A2 pure-JS (`pdf-lib`/`pdfkit`) | Build PDF programmatically | No browser dep; but manual layout = ugly for a rich marketing plan; lots of code. |
| A3 port creative-hub headless-Edge report builder | Reuse `creative-hub/.claude/skills/report/build.ps1` pattern | That's a PS1/skill in another repo, Windows-Edge specific — not portable to KVM8 Linux. |

**LOCKED → A2 `pdf-lib`** (user decision 2026-06-24). Pure-JS, zero native deps, zero system package, no browser — installs as a normal `package.json` dependency so KVM8 `npm install`/`npm ci` carries it automatically (no manual/server-side install, unlike puppeteer). Renderer still **injected** so the seam is testable without producing a real PDF. Side-by-side samples (`docs/reports/pdf-sample-optionA-puppeteer.pdf` vs `…-optionB-pdflib.pdf`) confirmed pdf-lib quality is sufficient for the marketing_plan. If richer layout ever needed, swap the injected renderer to puppeteer with no caller change.

---

## Edge cases & failure modes

- **No artifacts on the run** → export returns `{skipped}` (mirror render skip-gate); listing omits empty runs.
- **Re-export** → idempotent: delete prior `pdf`-type artifact before rewrite (text/image artifacts untouched).
- **Browser missing / PDF render fails** → classified (non-retryable: no browser; retryable: timeout) → notice, run stays intact. Don't crash the endpoint.
- **Brand furniture incomplete** → PDF renders with whatever exists (logo optional); never blocks.
- **Owner scope** → export + listing only over the caller's own runs (`findFirst {id,userId}`), same as `renderFromRun`.
- **Abandoned/draft run** → export only runs with artifacts (status `generated`); drafts skipped.
- **Poster path** → "image + copy stored" already satisfied by D+E; Phase F just lists them as a grouped image-set + copy.
- **Many images** → carousel = group `image`-type artifacts by `runId` ordered by `createdAt`.

## Role access
Owner-scoped for MVP (every user exports/sees their own runs); admin inherits all. Matches the rest of Module 1. Marketing + creative both export their own outputs — no per-type gate this phase.

---

## Key decisions to lock

- [ ] **D1 Approach A** — on-demand export seam + artifact read-layer (reject eager-worker B, listing-only C).
- [x] **D2 PDF engine** — **A2 `pdf-lib`** (pure-JS, no browser, KVM8-friendly; renderer injected). LOCKED.
- [ ] **D3 New artifact-based read layer** (`artifact-store.ts` + `GET /api/library`); leave legacy `getRecentFeatureRuns`/`/api/history` untouched.
- [ ] **D4 Export = re-invokable seam** `exportRunToPdf({runId,userId})` + thin `POST /api/studio/[runId]/export`; idempotent `pdf`-type-only delete.
- [ ] **D5 PDF scope = text/plan runs** (marketing_plan/strategy/copy/social composed); poster runs already satisfy "image + copy stored".
- [ ] **D6 Storage** — exports → `public/uploads/exports/<runId>/...`; keep separate from generated renders. No migration (schema ready).
- [ ] **D7 No UI this phase** — UI is Phase G; F delivers the data/export layer + endpoints only.

## Recommendation

**Approach A + PDF via puppeteer-core/system browser (injected renderer).** It is the consistent house pattern (deep-lib, thin-route, inject-IO, idempotent, owner-scoped), keeps export decoupled and re-invokable like the Phase E render seam, is testable without a browser, and delivers both acceptance criteria. The one open fork worth a user call is **D2 (PDF engine)** and **D6 (exports storage path)**.
