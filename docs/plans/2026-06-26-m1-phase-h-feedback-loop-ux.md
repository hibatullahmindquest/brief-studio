# UX Spec — Phase H: Feedback loop wiring

> Route: feature · Branch: `feat/m1-phase-h-feedback-loop`
> PRD: `docs/plans/2026-06-26-m1-phase-h-feedback-loop-prd.md`
> All within `ResultView` (shared by the live flow + the deep-link `/studio/[runId]`). English chrome.

## Feedback (per-run, small + unobtrusive)

- **Placement:** the existing `FeedbackButtons` pair in the Result actions row (top-left of the action bar) — unchanged location, just made live. Two small icon buttons (👍 / 👎), ~36px, no labels.
- **States:**
  - *Neutral* — both outline/muted (`--line-2` border, `--muted`).
  - *Up active* — 👍 filled green (`--ok-soft` bg / `--ok`).
  - *Down active* — 👎 filled red (`--stop-soft` bg / `--stop`).
  - Initial state read from `run.feedback` (1 / -1 / null).
- **Interaction:**
  - Click an inactive thumb → set it (optimistic); the other clears.
  - Click the active thumb → clear to neutral (toggle off).
  - On error → revert to the prior state + a small inline toast ("Couldn't save — try again").
- **Note on 👎:** when 👎 is active, reveal a compact one-line input below the bar — placeholder "Optional: what missed? (brand, tone, accuracy…)", a small "Save" affordance (or save-on-blur). Saving writes `feedbackNote`. Hidden when not 👎; cleared when feedback clears or flips to 👍.
- **No empty/loading screen** — it's an inline control; just disable briefly during the write.

## "Take it further" (light pre-fill chaining)

- **Placement:** the existing "Take it further" eyebrow + chip row at the bottom of `ResultView`. Chips become **real buttons** (brand-soft hover), not the dimmed "coming soon" stubs.
- **Which chips:** the real enabled target recipes **≠ the current run's task type** — `poster` → "Make a poster", `caption` → "Write captions", `marketing_plan` → "Marketing plan". (Carousel / IG-Story-video dropped until those recipes exist.)
- **Visibility:** the whole row is hidden when there's no seedable text (e.g. an image-only run with no copy yet).
- **Interaction:** click → stash `{ text, type }` in `sessionStorage["studio:seed"]` (text = this run's copy joined) → navigate to `/studio`. The front door opens with the textarea **pre-filled** (seed text, target type as a quick-start hint); a subtle note "Continuing from a previous run". User edits + Send as normal. The seed is **read once then cleared** (a later manual visit isn't pre-filled).

## States matrix
| Element | Empty | Loading | Error |
|---|---|---|---|
| Feedback thumbs | neutral (no feedback yet) | briefly disabled during write | revert + inline toast |
| Note input | hidden unless 👎 | — | revert |
| Chaining chips | row hidden when no text | — | (navigation only) |

## Accessibility
- Thumb buttons: `aria-pressed` reflects active; `aria-label` "Good result" / "Needs work".
- Note input has a visible label/placeholder; chips are real `<button>`s.

## Motion
- Thumb fill transitions ~150ms; note input slides in; respect `prefers-reduced-motion` (already global).
