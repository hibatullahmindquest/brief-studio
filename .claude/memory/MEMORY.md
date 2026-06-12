# Memory — brief-studio

Accumulated learnings across sessions. Newest first.
Add entries via `/bs-save-session` at end of each session.

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
