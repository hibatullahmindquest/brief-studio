# Phase H — Feedback loop wiring · Brainstorm

> Date: 2026-06-26 · Route: feature · Branch: `feat/m1-phase-h-feedback-loop`
> The FINAL Module 1 phase. Plan: `creative-hub/docs/archive/revamp/module-1-implementation.md §Phase H`.

## TL;DR

Capture the learning signal. Two pieces: **(1) persist 👍/👎** to `Artifact.feedback`
(the ResultView buttons are already rendered display-only), and **(2) wire the
"Take it further" chaining offer** (start a related run from this output). **No migration**
— `Artifact.feedback Int?` (1/-1/null) + `feedbackNote String?` exist from Phase A.

## Context (what's already in place)

- **Schema:** `Artifact.feedback` (1=up, -1=down, null), `Artifact.feedbackNote` — per-artifact.
- **UI stubs (Phase G `ResultView`):** one `FeedbackButtons` pair (display-only, in the actions row) + a static "Take it further" chip row ("Turn into a carousel / Make an IG Story video / Write more captions").
- **No artifacts API yet** — Phase H adds `POST /api/artifacts/[id]/feedback`.
- **Available recipes:** `poster`, `caption`, `marketing_plan` only (storyboard/video/carousel are NOT recipes yet — future milestones).
- **Read layer:** `getRunArtifacts` returns `ArtifactRow` **without** `feedback` — needs an additive field so the UI can show stored state on reopen.

---

## Part 1 — Feedback persistence

### Approaches (granularity)

**A — Per-run thumb (one click, applies to all artifacts)**
- One 👍/👎 for the whole result; writes `feedback` to every artifact in the run.
- Pros: lowest friction → highest adoption/signal volume; minimal UI (keep the single pair).
- Cons: can't tell *which* output was good (copy vs image); muddier signal.

**B — Per-artifact thumb *(recommended)***
- 👍/👎 on each copy block + the carousel image; each writes its own `Artifact.feedback`.
- Pros: exact mapping to the schema; richest signal (learn which expert/output type lands); the whole point of the phase ("learn signal").
- Cons: a bit more UI (buttons per block); slightly higher friction.

**C — Hybrid** — per-artifact on the image, one thumb for the copy set. Middle ground; more special-casing.

### Note (`feedbackNote`)
- Optional short note on 👎 (why it missed) — great signal, small inline input. **Recommend: include, lightweight** (appears only on thumbs-down; can skip).

### Read-layer gap-closer
- Add `feedback` (and `feedbackNote`?) to `getRunArtifacts`'s `ArtifactRow` so the result shows the current thumb state on reopen from Recent. Additive, no migration.

---

## Part 2 — "Take it further" chaining offer

### Approaches (scope)

**A — Full chaining (new run seeded from artifacts, server-side)**
- Clicking a chip creates a new `CreativeRun` from the current output (e.g. copy → storyboard brief), auto-selects the target recipe, lands the user mid-flow.
- Pros: seamless. Cons: complex (output→input mapping, recipe pick, skip-intake); **and the cool targets (storyboard/video/carousel) have no recipe yet** → can't actually build them.

**B — Light pre-fill (navigate to the front door, pre-seeded) *(recommended)***
- Clicking a chip stashes `{ text: <this run's copy>, type: <target> }` in `sessionStorage` and navigates to `/studio`; `StudioWorkspace` reads it on mount and pre-fills `StepDescribe`. The user reviews + sends as a normal new run.
- Pros: reuses the entire existing flow; trivial + low-risk; honest. Cons: not "one-click instant" — it's a head-start, not an auto-run.
- **Chips must reflect REAL recipes** — offer the other enabled taskTypes (e.g. from a poster → "Write captions"); drop carousel/video until those recipes exist.

**C — Defer chaining** — ship only feedback in Phase H; keep "Take it further" static or remove it. Deviates from the plan (which lists chaining as a Phase H task).

---

## Edge cases & failure modes

- **Feedback on a non-owned artifact** → 404/403 (owner-scope via `artifact.run.userId === user.id`).
- **Toggle** — click the active thumb again → clear to `null` (un-rate); switch thumb → overwrite.
- **Persisted state on reopen** — deep-link/Recent must show the stored thumb (needs `feedback` in `getRunArtifacts`).
- **No text run** (image-only) → feedback still works per artifact; chaining offer hidden if there's nothing to seed.
- **Chaining target = current type** → exclude it from the offered chips.
- **Long copy in `sessionStorage`** → fine (no URL length limit, unlike query params).
- **Role access** — any authenticated team member (their own runs); no admin gate.
- **OpenAI** — not involved in feedback (pure DB write); chaining only spends when the new run is actually sent.

## Key decisions (LOCKED by user)

- [x] **Feedback granularity → PER-RUN, one thumb** (not per-artifact). Real-world norm (ChatGPT/Claude = one 👍/👎 per response, small unobtrusive icons); per-artifact (4 button-pairs) is over-engineered for a 7-person internal team. Stored on **`CreativeRun.feedback`** (ALSO exists as `Int?` + `feedbackNote String?` — legacy from FeatureRun — so no writing to all artifacts; one clean row). `Artifact.feedback` stays available → going granular later is additive, no lock-in.
- [x] **Include `feedbackNote`** — optional short note on 👎 only.
- [x] **Chaining scope → light pre-fill (B).** Chip stashes `{ text: <this run's copy>, type: <target> }` in `sessionStorage`, navigates to `/studio`, `StudioWorkspace` pre-fills `StepDescribe`. Chips = REAL enabled recipes only (e.g. poster → "Write captions"); drop carousel/video.
- [x] **Prisma models affected → none.** Add `feedback`/`feedbackNote` to `getRunArtifacts` result (run-level) so the result shows stored thumb state on reopen. No migration.
- [x] **New routes → 1**: `POST /api/studio/[runId]/feedback` (owner-scoped, toggle 👍/👎/clear, optional note). Per-run, not `/api/artifacts/[id]` (the plan's filename) — honest mapping to a one-thumb-per-result UI. Chaining needs no new route (reuses `POST /api/studio`).
- [x] **UI states** — optimistic thumb with revert-on-error; persisted state from read layer; chaining chips only when there's seedable text.

## Recommendation (CONFIRMED)

**Per-run single thumb (small, unobtrusive, in the result header) on `CreativeRun.feedback`
+ optional note on 👎 + light pre-fill chaining.** Matches real-world feedback UX (not
over-engineered), clean storage, and reuses the whole flow for chaining. Going per-artifact
later is a small additive change.
