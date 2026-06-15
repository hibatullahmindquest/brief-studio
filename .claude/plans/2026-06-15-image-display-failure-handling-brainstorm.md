# Brainstorm — Image Display + Generation Failure/Moderation Handling

> Date: 2026-06-15 · Image gen now works (empty-prompt fix). Two issues: (1) rendered thumbnail is cropped; (2) how mature generators handle failure + moderation, and how ours should.

---

## PART 1 — Cropping

### Root cause (found in code)
`VisualPanel` renders the `<img>` with:
```
aspectRatio: ASPECT_RATIO[image.aspect]   // "9:16" → 9/16 = 0.5625
objectFit: "cover"                        // crops to FILL the box
```
But the actual image from gpt-image-2 for `9:16` is **1024×1536 = 2:3 = 0.667**. The container is 0.5625, the image is 0.667 → `cover` scales to fill the narrower box → **crops top/bottom**. Same for `16:9` (container 1.778 vs real 1536×1024 = 3:2 = 1.5).

**The mismatch is the bug: we label sizes 9:16 / 16:9 but gpt-image-2 only outputs 1:1, 2:3, 3:2.** "9:16"/"16:9" are approximations.

### How mature tools (Flow / Kling / Higgsfield) handle it
- They expose **only the ratios the model actually supports**, or they **post-process** (crop / pad / outpaint) to hit exact platform ratios (9:16, 16:9). Higgsfield/Flow commonly outpaint to the target social ratio.
- **Result/detail view shows the image at native ratio, uncropped** (`object-fit: contain` / natural size) + a Download of the original. **Gallery thumbnails** may use `cover` for a uniform grid, but always link to the uncropped original.
- They never silently crop the asset the user downloads.

### Approaches
**A — Display native, no crop (quick fix)** · `object-fit: contain` (or natural `height:auto`) + set container to the *true* ratio (1:1 / 2:3 / 3:2). Nothing crops; labels become honest ("Portrait 2:3", "Landscape 3:2", "Square").
- Pros: 1-file fix, accurate, downloadable original is the full image. Cons: not exactly 9:16/16:9 for social.

**B — Keep social-ratio intent + outpaint/crop to exact 9:16/16:9 (Phase 2)** · generate at nearest supported size, then pad/outpaint or smart-crop to the target. Mature-tool behaviour.
- Pros: true platform ratios. Cons: extra processing (sharp/outpaint), cost, complexity.

**C — Hybrid** · A now (honest native display, no crop) + label with social *intent* ("for Story · 2:3") + B as a later "fit to 9:16" action.

**Recommend C** — fix the crop now via A's native display + honest ratio labels; defer exact-ratio outpaint (B) to a later phase.

---

## PART 2 — Failure & moderation handling

### How mature tools do it
- **Async job model:** submit → `task_id` → status `queued → processing → succeeded | failed`. **`failed` carries a `reason`/`error_code`** (e.g. `content_moderation`, `risk_control`, `sensitive_words`, `nsfw`).
- **Moderation = immediate terminal failure with a clear reason** shown to the user — not a generic crash. Often **no credit charged** for moderated/failed gens.
- **Failed gens return structured status** (failed + reason), surfaced inline (a red "failed" card with the reason) and often **kept in history** so the user sees what happened.
- They distinguish **terminal** (moderation, invalid input → "edit your prompt") vs **retryable** (timeout, server error, rate limit → "retry").

### Our current state (synchronous, already partial)
- We map: **402 quota**, **422 content-policy/moderation** ("Visual ditolak, cuba ubah brief"), **500 generic**. `VisualPanel` shows the message + retry. So we already do "failed with reason" at a basic level.
- **Gap 1 — guessed error codes.** We mapped `content_policy_violation` / `moderation_blocked` from memory. We don't yet know the *exact* code gpt-image-2 throws on moderation → a real moderation hit might fall into generic 500 ("Gagal jana visual") instead of the clear 422 reason. **The new ErrorLog will reveal the real code** (trigger a moderated prompt once → read the row → map it correctly). Nice synergy.
- **Gap 2 — no retryable-vs-terminal distinction in UI.** Moderation shouldn't show a plain "retry" (same brief = same block); should say "ubah brief". Timeout/quota = retryable. We partly do this (422 message says ubah brief) but it's not formalised.
- **Gap 3 — failed gens not recorded as user-visible records.** They go to ErrorLog (admin) + a transient UI error. Mature tools keep a failed entry. (Optional — ErrorLog may be enough for an internal tool.)
- **Cost on failure:** image cost is logged only *after* `renderImage` succeeds → moderated/failed render logs **no image cost** (correct; OpenAI doesn't bill rejected). Director (gpt-4o) cost is logged (it ran). ✓ matches mature-tool "don't charge for moderated."

### Approaches
**A — Harden the synchronous flow (recommend now)**
- Use ErrorLog to discover gpt-image's real moderation/error codes → map them precisely to a 422 "moderated" reason.
- Add a **terminal vs retryable** classification → UI shows "ubah brief" (terminal) vs "cuba semula" (retryable).
- Clear reason text per case (moderated / quota / timeout / invalid / server).
- Pros: small, matches mature UX without infra. Cons: still synchronous (fine for 1 image).

**B — Async job model (Phase 2, aligns with PRD `scis-worker`)**
- submit → job → poll status → succeeded/failed(reason). Needed only when gens get long or batched.
- Pros: true mature-tool model, survives page close. Cons: infra (job table, worker, polling) — overkill for one synchronous image now.

**Recommend A now, B when generation moves to background.**

---

## Edge cases
- gpt-image returns a size that doesn't match the requested one → native display (contain) is robust regardless.
- Moderation on the **prompt** (gpt-4o director) vs the **image** (gpt-image) — different calls; log `source` distinguishes (`visual.plan` vs `visual.render`). Currently both share one catch (`visual.render`) — could split source for clarity.
- Partial/whitespace image (corrupt) → already guarded; show error.
- A genuinely empty/again-empty director → fallback prompt covers it.
- Cost: never charge/log image cost on a failed render (already correct).

## Key decisions
- [ ] **Cropping** — Approach C: native uncropped display + honest ratio labels now; outpaint-to-exact-ratio later? (recommend yes)
- [ ] **Failure** — Approach A: precise moderation-code mapping (via ErrorLog) + terminal/retryable UI? (recommend yes)
- [ ] **Record failed gens** in history (user-visible) or keep ErrorLog-only for now? (recommend ErrorLog-only for MVP)
- [ ] **Split error source** `visual.plan` vs `visual.render`? (recommend yes — trivial, improves diagnosis)
- [ ] Exact social-ratio outpaint/crop — defer to Phase 2? (recommend yes)

### Build surface (if approved)
- `VisualPanel`: `object-fit: contain` + true ratio (1:1/2:3/3:2), honest labels; HistoryModal same.
- `pricing.ts`/`visual.ts`: keep size mapping but treat labels as intent; expose true ratio to the UI.
- `visual` route: precise error-code → reason mapping (terminal vs retryable), split `source` for plan vs render; return `{ failed, reason, retryable }` shape.
- (Later) outpaint/crop service; async job model.

## Recommendation (one line)
Fix the crop now by displaying the image at its **true native ratio, uncropped** (honest labels), and **harden failure handling** with precise moderation-code mapping (discovered via ErrorLog) + a terminal-vs-retryable reason in the UI; defer exact-social-ratio outpainting and the async job model to a later phase.
