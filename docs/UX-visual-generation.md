# UX Spec — Visual Generation

> Step 3 (ux) · 2026-06-15 · Reference mockup: `C:/Claude/temp/scis-visual-feature-mockup.html`
> Design system: v6 (Poppins + JetBrains Mono mono labels, `--brand` #3b4ee2, `--orange` #fd8549, white cards, `--line` borders).

---

## A. Visual panel (in `GenerationResult`, below the text output)

Renders only when output type ∈ {poster, storyboard, video_script}. Self-contained client component `VisualPanel` with its own state machine.

### States

| State | Trigger | Content |
|-------|---------|---------|
| **idle** | output is visual type | eyebrow "Visual" · h2 "Jana visual untuk output ni" · sub describing what (`1 imej storyboard 16:9 — 5 panel` / `1 poster 9:16`) · **orange "✨ Jana Visual" button** · `cost` muted "Anggaran ~RMx.xx" · legend about cost |
| **planning** | click Jana | 3-dot loader · "AI tengah rancang visual…" · sub "gpt-4o baca output → tentukan panel & gaya" |
| **rendering** | plan done | spinner (brand-blue top) · "Melukis…" · sub "gpt-image-2 · {aspect} · 15–30 saat" |
| **done-poster** | render done, kind=poster | badge cost (green) · Regenerate (ghost) · Download (primary) · image at brief aspect (max-w ~260px portrait) · draft note · collapsible "Prompt yang digunakan" |
| **done-storyboard** | render done, kind=storyboard | badge cost · Regenerate · Download · composite image (16:9 or 9:16, full width) · **scene captions list** (`Scene N — caption`, mono scene label brand-blue) · draft note |
| **none** | shouldRender=false | "Tiada visual diperlukan untuk output ni." |
| **error** | API error | red note: quota → "OpenAI quota habis"; policy → "Visual ditolak, cuba ubah brief"; generic → "Gagal jana visual. Cuba semula." · Retry button |

### Copy (BM, matches Studio's existing tone)
- Button: `✨ Jana Visual`
- Estimate: `Anggaran ~RM0.42`
- Legend: `Imej dijana bila anda klik (kos OpenAI). Logo & teks tepat ditambah oleh designer.`
- Draft note (warn box): `⚠ Visual draf — AI tinggalkan ruang untuk logo & teks. Logo, harga & tarikh ditambah oleh designer.`
- Storyboard captions header: `Scene captions`

### Components / tokens
- Panel = `v6-card` (white, `--line`, shadow), `p-5 sm:p-6`.
- Buttons: primary = `bg-[var(--brand)]`; the Jana button = `bg-[var(--orange)]` (action accent); ghost = `border-[var(--line-2)]`.
- Cost badge = green `--ok-soft/--ok` when shown as actual; estimate = muted mono.
- Image frame: `rounded-xl border border-[var(--line-2)]`, real `<img>` from saved path; aspect via `aspect-[9/16]` / `aspect-video`.
- Scene caption row: `border-b border-[var(--line)]`, label `mono text-[var(--brand)]`.
- Loading: spinner `border-2 border-[var(--line-2)] border-t-[var(--brand)]`.

### Behaviour
- "Jana Visual" → POST `/api/generate/visual` `{featureRunId}`; show planning then rendering (single request returns final; UI shows staged loader on a timer for feel).
- "Regenerate" → same call again (re-rolls). "Download" → anchor to image path with `download`.
- On success, dispatch `generation:complete` so Semakan Lepas refreshes.
- Persisted: on re-open of the run (HistoryModal), if `output.image` exists, show done state directly (no re-render).

---

## B. HistoryModal
- If the run's `output.image` exists, render the image (poster aspect or composite) + scene captions, above/below the existing text. Read-only (no Regenerate inside the modal for v1).

---

## C. Usage module — `/dashboard/usage`

Admin-only page (uses `requireAdmin`). Inside the dashboard shell.

- **Header card:** eyebrow "Admin · Usage" · h1 "AI usage & cost" · sub with current USD→MYR rate.
- **3 KPI cards** (`v6-card`): Today (MYR + count) · This month (MYR + module split) · Images generated (count + avg/image). Values mono.
- **2-column row:**
  - *Recent generations* — list: brand badge + type + model · cost (mono). Last ~10.
  - *By module* — Visual (images) MYR · Copy (gpt-4o) MYR · Signals (later) RM0.00.
- Legend: "Tiada API key didedahkan — kos sahaja."
- **Nav:** add **Usage** item under the sidebar **Admin** group (`/dashboard/usage`), admin-only (reuse the `admin` flag in `dashboardNav`).

---

## D. Responsive
- Visual panel: image scales to panel width; poster capped portrait; storyboard full-width.
- Usage KPIs: 3-col on desktop → stack on mobile; recent/by-module → stack.

---

## E. Empty / first-run
- Usage page with no logs yet: KPIs show RM0.00, recent list shows "Belum ada generation."
- Visual panel for a run generated before this feature: still shows idle (can generate now).
