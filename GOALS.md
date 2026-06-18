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

> Last updated: 2026-06-16

**Phase:** Async visual generation + Semakan Lepas status/cost/time — **PR #6 OPEN** (awaiting review/merge).
**Task:** Built Approach B async generation (worker process) + history indicators. PR #6 → https://github.com/hibatullahmindquest/brief-studio/pull/6 (base `master`, head `fix/history-cost-display`, pinned to fork). Bundles 4 stacked commits:
- `039ba5a` async visual generation via worker (GenerationJob + `npm run worker` + `GET /api/jobs`; enqueue replaces sync; 5-min watchdog; close-tab-safe + resumable)
- `37aff00` Semakan Lepas visual indicator (🖼/⏳/✗/○) + generation time (`outputJson.image.generatedMs`)
- `861666d` fix: timer resumes from real `createdAt`; live "Tengah jana" badge (`generation:start` + poll-while-generating)
- `9e0994e` fix: cost (`costMyr`) persisted to `outputJson.image` → shown in HistoryModal
**Status:** All 4 tasks shipped through full workflow (verify+review+release-notes+commit each). Live E2E proven with real OpenAI (RM0.30 poster, image on disk via `scripts/test-async-visual.ts`). lint+tsc+build green; worker boots clean.
**Next:** Await PR #6 review/merge. After merge: delete the 4 stacked branches; **VPS deploy** (Hafiz/root: `pm2 start npm --name scis-worker -- run worker:start` + chown `/var/www/brief-studio` — code unchanged from local). hibatullah has SSH to KVM8 but no sudo / no /var/www write.
**Blockers:** None. (Local dev: keep `npm run dev` + `npm run worker` both running for visuals to generate.)
**Reminder:** repo is a FORK — always `gh pr create --repo hibatullahmindquest/brief-studio --base master` (guard hook enforces this).
