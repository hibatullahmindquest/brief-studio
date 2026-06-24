# PRD — Module 1 Phase F: Output / Export / Storage

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-f-output-export`
> Brainstorm: `.claude/plans/2026-06-24-m1-phase-f-output-export-brainstorm.md`
> Plan ref: `creative-hub/docs/archive/revamp/module-1-implementation.md` §Phase F

## 1. Summary

Get Module-1 run outputs **out of the database and into the user's hands**: a clean artifact read-layer (Library + Recent over `Artifact` rows) and an on-demand **PDF export** of text/plan runs. Mirrors the Phase E render seam — a standalone, idempotent, owner-scoped, inject-the-IO library + thin route. **No UI** (that is Phase G). **No schema migration** (the `Artifact` model already carries `type:"pdf"`, `exportFormat`, `mediaPath`).

## 2. Background / why

- Multi-artifact **persist** is already done upstream: `runRecipe` (Phase D) writes `strategy`/`copy`/`visual_direction`/`social` artifacts (`content:{text}`); `renderFromRun` (Phase E) writes the `image` artifact (`mediaPath`, `exportFormat:"png"`).
- But there is **no way to read those artifacts as a list** and **no export**. Today's `/api/history` → `getRecentFeatureRuns` is legacy: it filters `feature:"generate"` and parses `outputJson`/`inputJson`, so artifact-based Module-1 runs are invisible.
- Phase F closes that gap so Phase G (UI) has data + endpoints to wire.

## 3. Scope

### In scope
1. **Artifact read-layer** — list runs that have artifacts (Recent/Library) + fetch one run's artifacts grouped (image-set / text / pdf), owner-scoped.
2. **PDF export** — compose a run's user-facing **text** artifacts into a brand-styled PDF (pdf-lib), persist as a `pdf` Artifact + file on disk, idempotent + re-invokable.
3. **Endpoints** — `GET /api/library` (list) + `POST /api/studio/[runId]/export` (export one run).

### Out of scope (deferred)
- All UI / pages / components → **Phase G**.
- 👍/👎 feedback wiring → **Phase H**.
- Editing artifacts; bulk export; ZIP of an image set; per-output-type access gating (owner-scope only this phase).
- Migrating the legacy `/api/history` path to artifacts (left untouched).

## 4. Decisions (locked in brainstorm)

| # | Decision |
|---|----------|
| D1 | **Approach A** — on-demand export seam + artifact read-layer (not eager-in-worker, not listing-only). |
| D2 | **PDF engine = `pdf-lib`** (pure-JS, no browser, KVM8-friendly). Renderer **injected** for testability. |
| D3 | New **artifact-based** read layer (`artifact-store.ts` + `GET /api/library`); legacy `getRecentFeatureRuns`/`/api/history` untouched. |
| D4 | Export = re-invokable seam `exportRunToPdf({runId,userId})`; idempotent **`pdf`-type-only** delete before rewrite. |
| D5 | PDF composes user-facing **text** artifacts: `strategy`, `copy`, `social`, `text`. **Exclude** `visual_direction` (internal render instruction) and `image` (media). Poster runs already satisfy "image + copy stored". |
| D6 | Exports stored at `public/uploads/exports/<runId>/plan.pdf`. No migration. |
| D7 | **No UI** this phase. |

## 5. Functional requirements

### FR-1 — Artifact read-layer (`src/lib/artifact-store.ts`)
- `getRunArtifacts(runId, userId)` → owner-scoped; returns the run's artifacts grouped:
  `{ run: {id,title,feature,brandSlug,status,createdAt}, images: Artifact[], texts: Artifact[], pdf: Artifact|null, costMyr }`.
  - `images` = all `type:"image"` ordered by `createdAt` (carousel / image-set).
  - `texts` = user-facing text types (`strategy`,`copy`,`social`,`text`) ordered by `createdAt`.
  - `pdf` = latest `type:"pdf"` (or null).
  - `costMyr` via existing `sumRunCostMyr(runId)`.
  - Run not owned / not found → `null` (route maps to 404).
- `listLibrary(userId, { limit=20, cursor? })` → owner-scoped, newest first, **only runs that have ≥1 artifact**. Cursor-paginated (mirror `getRecentFeatureRuns` cursor style). Each item: `{ runId, title, feature, brandSlug, status, createdAt, kinds: string[], thumbnailPath?: string }` where `kinds` = distinct artifact types present and `thumbnailPath` = first image `mediaPath` if any. One batched query for artifacts across the page (no N+1).

### FR-2 — PDF composition + export seam (`src/lib/export-pdf.ts`)
- Pure composer `buildPlanPdf({ run, texts, brand }) → Promise<Buffer>` using `pdf-lib`:
  - Brand bar (primaryColor) with brand name + "Marketing Plan"; doctype label (secondaryColor/accent); run title; meta line (brand · platform/ratio from `spec` · date).
  - One section per text artifact, heading derived from its `type` (`strategy`→"Strategi", `copy`→"Copy", `social`→"Caption Sosial", `text`→"Nota"); body word-wrapped; A4; footer from brand `footerLeft`/`footerRight` (fallback brand name).
  - Brand furniture optional — missing colors/footer never block (sensible defaults).
  - Date is **injected** (caller passes it) — no `new Date()` inside the pure composer.
- `exportRunToPdf({ runId, userId, deps? }) → Promise<ExportOutcome>`:
  - Owner-scoped load of run (`findFirst {id,userId}`) → not found ⇒ `{ok:false, retryable:false, category:"not_found"}`.
  - Load user-facing text artifacts (FR-1 set). **None ⇒ `{ok:true, skipped:true, reason}`** (mirror render skip-gate — nothing to export, e.g. a poster-only run).
  - Load brand via `getBrandContext(slug)`.
  - **Idempotent:** `deleteMany({ runId, type:"pdf" })` (pdf-type only — text/image safe) before writing.
  - Compose buffer (injected `build` default = `buildPlanPdf`), write to `public/uploads/exports/<runId>/plan.pdf` via injected `write` (default `fs/promises.writeFile`, `mkdir -p` the dir).
  - Persist `Artifact { type:"pdf", mediaPath:"/uploads/exports/<runId>/plan.pdf", exportFormat:"pdf", content:{ sections: string[] } }`.
  - Success ⇒ `{ok:true, skipped:false, mediaPath, costMyr}` (`sumRunCostMyr` — PDF adds **no** AI cost; reflects existing run cost).
  - Composition/write failure ⇒ caught, `logError({source:"export.pdf",...})`, `{ok:false, retryable:true, reason, category:"render"}`. Run + other artifacts stay intact.
- `mediaPath` is **server-generated** from `runId` (no user input in the path → no traversal). `<runId>` is a cuid (safe charset).

### FR-3 — Endpoints (thin routes)
- `GET /api/library?limit=&cursor=` → `requireUser()` → `listLibrary(user.id, …)` → JSON. (limit clamped ≤50, mirror history.)
- `POST /api/studio/[runId]/export` → `requireUser()` → `exportRunToPdf({runId, userId:user.id})`:
  - `ok && !skipped` → 200 `{ mediaPath, costMyr }`.
  - `ok && skipped` → 200 `{ skipped:true, reason }` (nothing to export — not an error).
  - `!ok && category==="not_found"` → 404.
  - `!ok` otherwise → 502 `{ error: reason }`.
- Both routes owner-scoped via the lib (no cross-user access).

### FR-4 — Storage & housekeeping
- Export dir `public/uploads/exports/` — add to `.gitignore` (alongside existing `public/uploads/...` rules) so generated PDFs never get committed. Keep a `.gitkeep` if needed for the dir to exist on deploy.

## 6. Acceptance criteria

- **AC-1** A run with text artifacts → `POST …/export` writes `public/uploads/exports/<runId>/plan.pdf`, returns `mediaPath`, and a single `pdf` Artifact row exists (re-export replaces it, never duplicates). *(marketing_plan → downloadable PDF stored)*
- **AC-2** `GET /api/library` lists that run with `kinds` incl `"pdf"` and a `thumbnailPath` when an image exists; excludes runs with no artifacts; owner-scoped (other users' runs absent). *(stored + listed)*
- **AC-3** A poster run (image + copy) appears in Library as an image-set + text, `getRunArtifacts` groups them correctly. *(poster → image + copy stored)*
- **AC-4** Re-running `export` on the same run leaves exactly one `pdf` artifact and does not touch `image`/text artifacts (idempotent, type-scoped).
- **AC-5** Exporting a run with **no text artifacts** returns `{skipped:true}` and writes nothing.
- **AC-6** Export/list of a run not owned by the caller → 404 / absent (owner scope).
- **AC-7** `buildPlanPdf` produces a valid non-empty PDF buffer (starts `%PDF`), brand colors/footer applied, all section headings present. Pure (date injected).
- **AC-8** No schema migration; `lint` + `tsc` + `build` green; m1d-recipe + m1e-* regressions still pass.

## 7. Test plan (verify scripts — house style, injected IO)

- `scripts/m1f-pdf.ts` — pure `buildPlanPdf`: valid `%PDF` buffer, headings present, brand colors/footer applied, empty-texts handled, date injected (no `new Date` in composer).
- `scripts/m1f-export.ts` — `exportRunToPdf` with **injected build+write** (no real fs/pdf): happy path (artifact written, mediaPath shape), idempotent re-export (one pdf, text/image untouched), skip-gate (no text artifacts), owner scope, failure isolation (build throws → run intact, `{ok:false,retryable}`).
- `scripts/m1f-library.ts` — `listLibrary` + `getRunArtifacts` against seeded runs: grouping (images/texts/pdf), excludes artifact-less runs, cursor pagination, owner scope, no N+1 (batched).
- **Live smoke** `scripts/m1f-smoke.ts` — real recipe text run → real `exportRunToPdf` → real `plan.pdf` on disk, opens/valid; appears in `listLibrary`. (No OpenAI needed beyond the run itself.)

## 8. Risks / notes

- **pdf-lib fonts:** StandardFonts (Helvetica) only — no embedded brand font, limited glyph set. Acceptable per sample review; Malay text (no exotic glyphs) renders fine. Emoji unsupported → strip/skip in composer.
- **Legacy history divergence:** two listing paths now exist (legacy `outputJson` vs new artifact). Intentional; Phase G consumes the new one. Document so it is not mistaken for a bug.
- **Deferred (carry):** headline≠brand-name fix; image-set ZIP; feedback (H); UI (G).

## 9. Files

- New: `src/lib/artifact-store.ts`, `src/lib/export-pdf.ts`, `src/app/api/library/route.ts`, `src/app/api/studio/[runId]/export/route.ts`, `scripts/m1f-{pdf,export,library,smoke}.ts`.
- Edit: `.gitignore` (exports dir), `package.json` (+`pdf-lib`), `CHANGELOG.md`.
- **No** `prisma/schema.prisma` change.
