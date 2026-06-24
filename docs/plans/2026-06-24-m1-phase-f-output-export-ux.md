# UX — Module 1 Phase F: Output / Export / Storage

> Date: 2026-06-24 · Route: feature · Branch: `feat/m1-phase-f-output-export`
> PRD: `docs/plans/2026-06-24-m1-phase-f-output-export-prd.md`

## No UI this phase

Phase F ships the **data + export layer only**. Like Phase E, there are **no pages/components** here — the UI is **Phase G (Task Workspace)**. This doc fixes the **contracts and shapes Phase G will consume**, plus where the actions land, so the UI work is drop-in.

## Lifecycle (where Phase F sits)

```
intake → router → confirm → worker: runRecipe → renderFromRun (image)   ← A–E (done)
                                              │
                                              ▼
                         [artifacts persisted on the run]
                                              │
        ┌─────────────────────────────────────┴───────────────────────────┐
        ▼                                                                   ▼
  GET /api/library  (Recent / Library list)              POST …/[runId]/export  (on-demand PDF)
        │                                                                   │
        ▼                                                                   ▼
  GET …/[runId]  via getRunArtifacts  ← Phase G result view consumes both
```

Export is **on-demand and re-invokable** (same reasoning as the Phase E render seam): nothing auto-generates the PDF; the user triggers it, and re-triggering replaces the prior PDF idempotently.

## Endpoint contracts (Phase G wires these)

### `GET /api/library?limit=&cursor=`
```jsonc
// 200 — newest first, only runs with ≥1 artifact, owner-scoped
[
  {
    "runId": "ckx...",
    "title": "Kempen Pendaftaran Tuisyen",
    "feature": "generate",
    "brandSlug": "sifututor",
    "status": "generated",
    "createdAt": "2026-06-24T07:48:00.000Z",
    "kinds": ["strategy","copy","social","image","pdf"],  // distinct types present
    "thumbnailPath": "/uploads/generated/xxx.png"          // first image, or absent
  }
]
// pagination: pass last item's runId as ?cursor= for the next page
```

### `GET /api/studio/[runId]` (via `getRunArtifacts`) — result view
```jsonc
// 200
{
  "run": { "id":"ckx...", "title":"...", "feature":"generate", "brandSlug":"sifututor", "status":"generated", "createdAt":"..." },
  "images": [ { "id":"...", "mediaPath":"/uploads/generated/xxx.png", "content": {...} } ],  // carousel / image-set
  "texts":  [ { "id":"...", "type":"strategy", "content": { "text":"..." } }, ... ],          // ordered
  "pdf":    { "id":"...", "mediaPath":"/uploads/exports/ckx.../plan.pdf" } | null,
  "costMyr": 0.42
}
// not owned / not found → 404
```

### `POST /api/studio/[runId]/export`
```jsonc
200 { "mediaPath": "/uploads/exports/ckx.../plan.pdf", "costMyr": 0.42 }  // exported
200 { "skipped": true, "reason": "no text artifacts to export" }          // nothing to export (e.g. poster-only) — NOT an error
404 { "error": "Run not found." }                                         // not owned / missing
502 { "error": "<reason>" }                                               // composition/write failed (retryable)
```

## Where the actions live (Phase G placement notes)

- **Library / Recent** — `GET /api/library` feeds the **Recent drawer** + **Library** nav item in the Task Workspace mockup (`studio-mockup.html`). List row = thumbnail (or kind-icon) + title + brand + `kinds` chips.
- **Result view** — after a run completes, `getRunArtifacts` renders: image-set (carousel), text artifacts (cards), per-run cost, and an **"Export PDF"** button.
- **Export PDF button** → `POST …/export`:
  - text-bearing run → returns `mediaPath`; UI offers **Download** (link to the public path) + shows a "PDF ready" state.
  - `skipped:true` → button hidden/disabled for poster-only runs (no text to export) — Phase G checks `texts.length` from `getRunArtifacts` to decide visibility.
  - 502 → toast "Export gagal, cuba lagi" (retryable).
- **Regenerate image** (Phase E seam) and **Export PDF** (Phase F seam) sit side by side on the result view — both are id-only, idempotent, re-invokable.

## States (for Phase G)

| State | Source | UI |
|-------|--------|----|
| empty Library | `GET /api/library` → `[]` | empty-state ("Belum ada output") |
| run has no text | `getRunArtifacts.texts == []` | Export PDF hidden |
| PDF not yet exported | `getRunArtifacts.pdf == null` | "Export PDF" CTA |
| PDF exists | `pdf.mediaPath` | "Download PDF" + "Re-export" |
| export in flight | POST pending | button spinner |
| export failed | 502 | retry toast |

## English UI note

Phase G UI copy is **English** (per revamp §Phase G). The **PDF document content** is in the brand's own language (Malay for SifuTutor/NakNgaji) because it reproduces the generated artifacts — that is content, not chrome.

## No new client state / no new components this phase
Nothing to build in `src/components` or `src/app/studio` now. Endpoints + libs only.
