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

## Active Task (update every session)

> Last updated: 2026-06-09

**Phase:** Harness setup — pre-development
**Next:** Create AGENTS.md → design doc → Next.js scaffold
**Blockers:** None
