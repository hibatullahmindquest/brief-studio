# Memory — brief-studio

Accumulated learnings across sessions. Newest first.
Add entries via `/bs-save-session` at end of each session.

---

## 2026-06-16 — Async worker (Approach B): web enqueues, worker process generates
**Context:** Built close-tab-safe visual generation. App is long-running Node (`next start`, NOT serverless — CLAUDE.md forbids Vercel/Edge), so a separate worker process is viable.
**Discovery:** Pattern = `GenerationJob` table is the only channel between web (enqueue) and worker (`npm run worker` = `tsx watch src/worker/index.ts`). Web does NO OpenAI work. Atomic claim via `updateMany WHERE status='queued'` (loser gets count 0). Watchdog sweeps `processing` older than `claimedAt+5min` → failed. The `kind` field on GenerationJob is future-proofing for async TEXT (bulk variations, Phase 2) — same worker, same queue.
**Impact:** Local = 2 terminals (`dev` + `worker`); VPS = same script under PM2 `scis-worker`, zero code change. Worker MUST run or visuals stick at "queued".
**Source:** built + live E2E proven (real OpenAI, RM0.30 poster).

## 2026-06-16 — tsx worker gotchas: top-level await + env-before-import
**Context:** Worker wouldn't boot.
**Discovery:** (1) tsx transforms a worker entry as CJS (no `"type":"module"`) → top-level `await import()` throws "Top-level await is currently not supported with the cjs output format". Use `import("./loop").catch(...)` instead. (2) Env must load BEFORE modules that read it at construct-time (Prisma client). Pattern: `process.loadEnvFile(".env.local")` (sync, Node 20.12+/22+) in a bootstrap entry, THEN dynamic-import the loop. (3) tsx resolves tsconfig `@/*` paths even from `src/worker` + `scripts/` — no extra config.
**Impact:** Worker entry = thin bootstrap (loadEnvFile + dynamic import); loop in a separate file.
**Source:** debugging (boot failures).

## 2026-06-16 — Windows: Prisma generate EPERM = a node process holds the engine DLL
**Context:** `npm run build` (runs `prisma generate`) failed `EPERM unlink query_engine-windows.dll.node`.
**Discovery:** ANY live node process holding the DLL blocks it — a running `next dev` OR a leftover `tsx` worker/script. `kill` in Git Bash often doesn't reap npm-spawned node children; use PowerShell `Stop-Process` on procs whose CommandLine matches the project. Stop dev + worker before any build/generate.
**Impact:** Build hygiene on Windows: kill stray project node procs first. Also logged to global KNOWLEDGE.md.
**Source:** debugging (recurred twice this session).

## 2026-06-16 — Cost/time data placement: persist into outputJson.image, not just the job
**Context:** Cost showed on the live card but not in Semakan Lepas.
**Discovery:** The live VisualPanel reads cost/time from `GET /api/jobs` (job row). History (HistoryModal) reads `FeatureRun.outputJson` — a totally separate source. Anything history must show (generatedMs, costMyr) has to be written into `outputJson.image` by the worker at persist time, NOT only kept on GenerationJob/APIUsageLog. Visual status badge is the exception — derived by joining the latest job at query time (`getRecentFeatureRuns`), one batched `findMany WHERE featureRunId IN (...)`.
**Impact:** When adding any per-run display field, decide its read-source: live card = job; history = outputJson.
**Source:** debugging (user reported missing cost).

## 2026-06-15 — gpt-image-2 only outputs 3 sizes (not true 9:16/16:9)
**Context:** Generated visual rendered cropped.
**Discovery:** gpt-image-2 supports only 1024×1024 (1:1), 1024×1536 (2:3), 1536×1024 (3:2). We labelled brief sizes 9:16/16:9 and set the CSS container to that ratio with `object-fit: cover` → mismatch (2:3≠9:16) cropped the image. Fix = display native ratio (no fixed aspect + no cover). True 9:16/16:9 needs a crop/pad/outpaint post-step (deferred, FUTURE plan).
**Impact:** Image-display code must use the real output ratio, not the requested social label.
**Source:** debugging (user reported crop).

## 2026-06-15 — gpt-5 reasoning model: low max_completion_tokens → empty content
**Context:** "Gagal jana visual" — empty image prompt.
**Discovery:** OPENAI_MODEL defaults to gpt-5 (reasoning). With `max_completion_tokens: 1500`, reasoning ate the budget → empty `content` → planVisual returned empty `imagePrompt` → gpt-image-2 threw `400 Invalid 'prompt': empty string`. Fix: 4000 tokens + deterministic fallback prompt + guard renderImage against empty. (generateCopy already used 5000.)
**Impact:** Reasoning models need generous completion budgets; always guard downstream against empty LLM output.
**Source:** debugging via the new ErrorLog.

## 2026-06-15 — Persistent error logging = fastest diagnosis
**Context:** Couldn't see why image gen failed.
**Discovery:** `ErrorLog` + `logError()` normalizes OpenAI APIError (status/code/type/body) into `detail`. The empty-prompt 400 was found instantly from one row. View at `/dashboard/settings/logs` (admin) or `SELECT ... FROM "ErrorLog"`.
**Impact:** Wire logError into every AI/integration catch; pays off immediately.
**Source:** built + used same session.

## 2026-06-15 — Prisma accessor + Windows DLL lock + client/server boundary
**Discovery:** (1) Prisma camelCases models → `prisma.aPIUsageLog`, `prisma.errorLog` (first letter lowercased). (2) Windows: a running `next dev` holds `query_engine-windows.dll.node` → `prisma generate` EPERM; stop dev before migrate/generate. (3) `visual.ts` imports `fs/promises` → can't be imported by a `"use client"` component; replicate tiny helpers (visualKind) client-side, import only pure libs (pricing); `import type {…}` from a server lib is erased → safe in client. (4) `react-hooks/purity` flags `Date.now()` in a server-component render body → put time logic in lib functions.
**Impact:** Avoids repeated build/lint failures.
**Source:** debugging.

## 2026-06-15 — Real NakNgaji Meta data was in marketing-ai-agent's LOCAL docker pg
**Discovery:** That project's `SUPABASE_URL` was a local Docker Postgres DSN (`db:5432`), not cloud. Real NakNgaji paid data (17,055 daily rows, RM520k, Jan'25–May'26) + a **non-expiring BM System User token** ("Analytics") lived in the `marketing-ai-agent_pgdata` volume. Imported via `scripts/import-meta-history.ts`. node-pg parses DATE (OID 1082) at local midnight → day shifts on UTC+8; fix = `types.setTypeParser(1082, v=>v)` + build UTC date.
**Impact:** System-user token (non-expiring) is simplest Meta auth for an internal tool; data is reusable.
**Source:** investigation + ETL.

## 2026-06-15 — /api/generate/visual is featureRunId-based → "generate later" is free
**Discovery:** The visual route loads brand/brief/output from DB by `featureRunId` only — never needs live wizard state. Surfacing `VisualPanel` in HistoryModal made "generate image later from a saved run" a pure UI-reuse job, zero backend change.
**Impact:** Keep generation endpoints DB-keyed (not session-coupled) → enables history/Library reuse + future async jobs.
**Source:** design + build.

---

## 2026-06-12 — browser_screenshot tidak share cookie dengan browser_run

**Context:** Cuba screenshot Studio page (authenticated) guna Playwright MCP tools.
**Discovery:** `mcp__browser__browser_screenshot` dan `mcp__browser__browser_run` adalah browser instances berasingan — cookie/session dari `browser_run` tidak persist ke `browser_screenshot`. Workaround: login via fetch API dalam same `browser_run` session sebelum navigate, guna evaluate untuk inspect DOM.
**Impact:** Untuk screenshot authenticated pages, kena login dan navigate dalam satu `browser_run` call chain. `browser_screenshot` hanya berguna untuk public pages.
**Source:** Observed semasa debug UI overlap issue.

## 2026-06-12 — Fixed drawer bertindan dengan nav header

**Context:** GenerationHistory slide-over drawer `top-0 z-40` tapi nav header `fixed top-0 z-50 h-[73px]`.
**Discovery:** Drawer header tertutup di belakang nav. Fix: `top-[73px] h-[calc(100vh-73px)]` untuk drawer, `inset-x-0 top-[73px] bottom-0` untuk backdrop. Nilai 73px dari `getBoundingClientRect()` pada header element.
**Impact:** Semua fixed panels/drawers kena offset 73px dari top. Kalau header height berubah, kena update semua arbitrary values.
**Source:** Observed via DOM inspection dalam browser_run.

## 2026-06-12 — gh branch protection via API

**Context:** GitHub warning master branch tidak protected selepas PR created.
**Discovery:** `gh api repos/<owner>/<repo>/branches/master/protection --method PUT --input -` dengan JSON body. `required_pull_request_reviews` mesti object (bukan null). `required_status_checks: null` untuk skip CI requirement.
**Impact:** Branch protection boleh set terus via CLI tanpa masuk GitHub settings UI.
**Source:** Observed during PR creation workflow.

## 2026-06-11 — Prisma DLL lock on Windows blocks `npm run build`

**Context:** Running full build gate selepas implement history sidebar.
**Discovery:** `npm run build` runs `prisma generate && next build`. Bila dev server sedang running, Prisma cuba unlink `query_engine-windows.dll.node` tapi fail (EPERM) sebab DLL locked oleh process lain. Workaround: run `npx next build` terus — Prisma client dah generated, Next.js build sendiri berjalan clean.
**Impact:** Jangan panik bila `npm run build` fail dengan EPERM. Check dev server running dulu. `npx next build` confirm code betul.
**Source:** Observed during Task 6 quality gate.

## 2026-06-11 — History sidebar: inline collapsible → slide-over drawer upgrade

**Context:** Implement history sidebar untuk Studio page.
**Discovery:** Plan asal (inline collapsible panel bawah wizard) fully implemented dan working. Tapi selepas user review prototype, decided upgrade ke slide-over drawer pattern (macam Linear/Vercel) yang lebih modern — fixed right panel, slide animation, search, infinite scroll via Intersection Observer, cursor-based pagination.
**Impact:** Branch `feat/history-sidebar` ada 6 commits (collapsible version). Next session kena replace `GenerationHistory.tsx` dengan `HistoryDrawer.tsx` dan update `/api/history` untuk cursor pagination sebelum buat PR.
**Source:** User decision selepas tengok HTML prototype di `C:\claude\temp\history-drawer-prototype.html`.

## 2026-06-11 — generation:complete custom event pattern untuk cross-component communication

**Context:** StudioWizard (deep component) perlu notify GenerationHistory (sibling, bukan parent) bila generation selesai.
**Discovery:** `window.dispatchEvent(new CustomEvent("generation:complete"))` dalam StudioWizard, dan `window.addEventListener("generation:complete", handler)` dalam GenerationHistory. Clean tanpa prop drilling atau global state. Works across any component tree depth.
**Impact:** Pattern boleh reuse untuk event-driven refresh lain dalam app (e.g. notify nav badge, dashboard stats).
**Source:** Implemented in Task 5.
