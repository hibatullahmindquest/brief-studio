# Build Prompts — Module 1 Phase F: Output / Export / Storage

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-f-output-export`
> PRD: `docs/plans/2026-06-24-m1-phase-f-output-export-prd.md` · UX: `…-ux.md`
> House style: deep-lib + thin-route + inject-the-IO; owner-scoped; idempotent (type-only delete); no `new Date()` in pure code; verify scripts red-first.

Build order: **P0 dep → P1 pure PDF composer → P2 export seam → P3 read-layer → P4 endpoints → P5 live smoke.**
Each lib prompt ships with its verify script (run before moving on). Endpoints last (thin, no logic to test beyond wiring).

---

## P0 — Dependency + storage

- `npm install pdf-lib` (prod dep). Confirm it lands in `package.json` dependencies.
- `.gitignore`: ensure `public/uploads/exports/` is ignored (add alongside existing `public/uploads/...` rules). Add `public/uploads/exports/.gitkeep` if the dir must exist on deploy.
- No schema change. Do NOT run `prisma generate`/`build` with dev/worker running (Windows EPERM).

**Done when:** `pdf-lib` resolves (`node -e "require('pdf-lib')"`), exports dir ignored (`git check-ignore`).

---

## P1 — Pure PDF composer (`src/lib/export-pdf.ts`, part 1) + `scripts/m1f-pdf.ts`

Write the **pure** composer first (no fs, no db, no Date):

```ts
export type PlanText = { type: string; text: string };
export type PlanBrand = { name: string; primaryColor: string; secondaryColor: string; footerLeft?: string; footerRight?: string };
export type PlanMeta = { title: string; brandName: string; platform?: string; dateLabel: string }; // dateLabel INJECTED
export async function buildPlanPdf(args: { meta: PlanMeta; texts: PlanText[]; brand: PlanBrand }): Promise<Buffer>;
```
- pdf-lib A4; brand bar (primaryColor) + brand name + "Marketing Plan"; doctype label; title; meta line (`brandName · platform · dateLabel`).
- One section per text; heading from `type`: `strategy`→"Strategi", `copy`→"Copy", `social`→"Caption Sosial", default→"Nota". Word-wrap body to page width; paginate if it overflows (add page, reset y).
- Footer from `footerLeft`/`footerRight`, fallback brand name.
- **Strip non-Latin-1/emoji** before drawing (StandardFonts Helvetica can't encode them) — `sanitize(s)` replacing unencodable chars with "" or a space.
- Pure: `dateLabel` passed in; no `new Date()`.

`scripts/m1f-pdf.ts` (red first):
- buffer starts with `%PDF`; non-empty.
- all section headings present (decode check: PDF text ops contain headings) OR assert page count / byte size > threshold per section.
- empty `texts` → still a valid (cover-only) PDF buffer.
- emoji/unicode input does not throw (sanitized).
- no `new Date` reference in the file (grep guard in the script or manual).

**Done when:** `node --import tsx scripts/m1f-pdf.ts` → all pass.

---

## P2 — Export seam (`src/lib/export-pdf.ts`, part 2) + `scripts/m1f-export.ts`

```ts
export type ExportDeps = {
  build?: (args:{meta;texts;brand}) => Promise<Buffer>;   // default buildPlanPdf
  write?: (absPath: string, data: Buffer) => Promise<void>; // default mkdir -p + writeFile
};
export type ExportOutcome =
  | { ok:true; skipped:true; reason:string }
  | { ok:true; skipped:false; mediaPath:string; costMyr:number }
  | { ok:false; retryable:boolean; reason:string; category:string };
export async function exportRunToPdf(args:{ runId:string; userId:string; deps?:ExportDeps }): Promise<ExportOutcome>;
```
- Owner-scoped run load (`findFirst {id,userId}`, select id/title/spec/brand.slug). Not found → `{ok:false,retryable:false,category:"not_found"}`.
- Load user-facing text artifacts: `type IN ("strategy","copy","social","text")` ordered `createdAt asc`, map to `{type, text: content.text}`. **Empty → `{ok:true,skipped:true,reason:"no text artifacts to export"}`** (no write).
- Brand via `getBrandContext(slug)` → map to `PlanBrand` (name/colors/footer). Missing brand → still export with neutral defaults (do not hard-fail; brand is furniture).
- **Idempotent:** `deleteMany({runId, type:"pdf"})` before write (pdf-type only).
- `mediaPath = "/uploads/exports/<runId>/plan.pdf"`; abs via `path.join(process.cwd(),"public",...)`; `dateLabel` computed in the seam (here `new Date` is allowed — it is IO-adjacent, not the pure composer) and passed to build.
- try: `buf = await build({...})` → `await write(abs, buf)` → `prisma.artifact.create({type:"pdf", mediaPath, exportFormat:"pdf", content:{sections: texts.map(t=>t.type)}})` → `costMyr = await sumRunCostMyr(runId)` → `{ok:true,skipped:false,mediaPath,costMyr}`.
- catch: `logError({source:"export.pdf",error,featureRunId:runId,userId,...})` → `{ok:false,retryable:true,reason,category:"render"}`. Run + other artifacts intact.

`scripts/m1f-export.ts` (injected build+write, no real fs/pdf, seeded DB):
- happy: pdf artifact created, mediaPath shape `/uploads/exports/<runId>/plan.pdf`, write called with abs path + buffer.
- idempotent: export twice → exactly one pdf artifact; text + image artifacts untouched (count before==after).
- skip-gate: run with no text artifacts → `{skipped:true}`, write NOT called, no pdf artifact.
- owner scope: other user's runId → `{ok:false,category:"not_found"}`.
- failure isolation: `build` throws → `{ok:false,retryable:true}`, no pdf artifact, text artifacts intact.

**Done when:** `node --import tsx scripts/m1f-export.ts` (with `DATABASE_URL`) → all pass.

---

## P3 — Read-layer (`src/lib/artifact-store.ts`) + `scripts/m1f-library.ts`

```ts
export async function getRunArtifacts(runId:string, userId:string): Promise<RunArtifacts | null>;
export async function listLibrary(userId:string, opts?:{limit?:number; cursor?:string}): Promise<LibraryItem[]>;
```
- `getRunArtifacts`: owner-scoped run; pull artifacts; group `images`(type image), `texts`(strategy/copy/social/text), `pdf`(latest type pdf|null); `costMyr=sumRunCostMyr`. Not owned → null.
- `listLibrary`: `creativeRun.findMany({where:{userId}, orderBy createdAt desc, take limit(≤50), cursor})`; then **one** `artifact.findMany({where:{runId in ids}})` (no N+1); build items, **drop runs with 0 artifacts**; `kinds`=distinct types; `thumbnailPath`=first image mediaPath.

`scripts/m1f-library.ts` (seeded DB):
- grouping correct (images/texts/pdf separated; visual_direction excluded from texts).
- artifact-less run excluded from `listLibrary`.
- cursor pagination returns next page, no overlap.
- owner scope (other user's run absent / getRunArtifacts→null).
- single artifact query for a multi-run page (assert call count via a counting wrapper, or inspect query plan manually — at minimum no per-run loop in code).

**Done when:** `node --import tsx scripts/m1f-library.ts` → all pass.

---

## P4 — Endpoints (thin)

- `src/app/api/library/route.ts` — `GET`: `requireUser()` → parse `limit`(≤50)/`cursor` → `listLibrary` → JSON.
- `src/app/api/studio/[runId]/export/route.ts` — `POST`: `requireUser()` → `exportRunToPdf({runId, userId:user.id})` → map outcome to 200/200-skipped/404/502 (per UX contract).
- `src/app/api/studio/[runId]/route.ts` — if a GET result endpoint does not already exist, add `GET` → `getRunArtifacts(runId, user.id)` → 404 on null. (Check existing routes under `studio/[runId]/` first — `run-output` exists but is legacy-shaped; add the artifact GET without breaking it.)
- Follow existing route patterns (`requireUser`, `NextResponse.json`). No business logic in routes.

**Done when:** `tsc --noEmit` clean; routes appear in `next build` route tree (run at the verify gate, not now if dev/worker up).

---

## P5 — Live smoke (`scripts/m1f-smoke.ts`)

- Use an existing seeded recipe text run (or run one) that has `strategy`/`copy`/`social` artifacts.
- Call real `exportRunToPdf({runId,userId})` (real pdf-lib + real fs) → assert `public/uploads/exports/<runId>/plan.pdf` exists, valid `%PDF`, size > a few KB.
- Call `listLibrary(userId)` → the run present with `kinds` incl `"pdf"`.
- Eyeball the PDF (open it) — brand bar, sections, footer.
- Run with sandbox considerations per env notes (no OpenAI needed unless generating a fresh run).

**Done when:** smoke passes + PDF eyeballed on-brand.

---

## Gates after build
verify (lint+tsc+build, + m1d/m1e regression) → `/bs-review` (stage1 spec, stage2 quality — check path-traversal-safe mediaPath, owner scope, idempotent type-only delete, no double cost) → `/bs-release-notes` → `/bs-commit` → push (ask) → PR (pin fork `--repo hibatullahmindquest/brief-studio --base master`).
