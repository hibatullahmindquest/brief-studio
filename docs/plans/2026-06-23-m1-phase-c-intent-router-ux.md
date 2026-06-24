# UX / API Contract — Module 1 Phase C: Intent Router

> Date: 2026-06-23 · Branch: `feat/m1-phase-c-intent-router`
> PRD: `docs/plans/2026-06-23-m1-phase-c-intent-router-prd.md`
> Phase C is **API + libs only** (no screens — the Task Workspace UI is Phase G). This doc is the
> wire contract + the lib function signatures the build step implements against.

---

## 1. Endpoint

`POST /api/studio` — the generic front door. Auth: `requireUser()` (any team member).

### Request body (JSON)
```ts
type StudioRequest = {
  brandSlug: string;            // "sifututor" | "nakngaji" — required, used for grounding + run.brandId
  text?: string;                // free-form describe/brief
  uploads?: string[];           // already-uploaded asset paths/urls (images → vision; .pdf/.docx → parsed)
  explicitLens?: "marketing" | "social";  // honoured only if user.team ∈ {multi, all}
};
```
Validation: at least one of `text` (non-empty after trim) **or** a usable `uploads` entry must be present, else `400`.

### Success response — `200`
```ts
type StudioResponse = {
  runId: string;                // the persisted draft CreativeRun id
  taskType: string;             // a member of enabled recipe taskTypes (e.g. "poster")
  lens: "marketing" | "social"; // resolved (deterministic, scope-enforced)
  intent: string;               // one-line classified purpose
  confidence: number;           // 0..1 (classifier self-report)
  recipe: RecipeRef | null;     // null when unmatched/ambiguous (see clarification)
  gaps: Gap[];                  // [] = ready to generate
  notices?: string[];           // non-fatal info, e.g. "skipped 1 unsupported attachment"
};

type RecipeRef = {
  id: string;
  taskType: string;
  group: string;                // "creative" | "copy" | "strategy" | ...
  outputFormat: string;         // "image" | "text" | "pdf" | "carousel"
};

type Gap = {
  field: string;                // stable snake_case key, also the CreativeRun.spec key
                                // required-field keys per type, OR "task_type"/"clarification"
  question: string;             // human-readable, brand/lens-aware prompt (LLM-phrased)
  required: boolean;            // true for missing required fields & clarifications
};
```

### Error responses
| Status | When | Body |
|--------|------|------|
| `400` | empty input, or invalid `explicitLens`, or missing `brandSlug`/unknown brand | `{ "error": "<reason>" }` |
| `401` | not authenticated | `{ "error": "Unauthorized" }` |
| `502` | OpenAI call failed/timed out (after `logError`) | `{ "error": "<retryable reason>", "retryable": true }` |
| `500` | only truly unexpected (unmapped) — should not happen on known paths | `{ "error": "Internal error" }` |

> Note: a **clarification** (ambiguous/low-confidence/no-recipe) is **NOT** an error — it returns `200` with `recipe:null` and a `gaps` entry. Only infra failures are non-2xx.

---

## 2. Response examples

### A. Clear poster brief, marketing member (roadmap acceptance #1)
Request:
```json
{ "brandSlug": "nakngaji", "text": "Ad poster untuk promo kelas mengaji online, target parents, untuk IG" }
```
Response `200`:
```json
{
  "runId": "ckxr…",
  "taskType": "poster",
  "lens": "marketing",
  "intent": "Paid IG poster promoting online Quran classes to parents",
  "confidence": 0.94,
  "recipe": { "id": "…", "taskType": "poster", "group": "creative", "outputFormat": "image" },
  "gaps": [
    { "field": "key_message", "question": "Apa satu mesej utama poster ni kena sampaikan?", "required": true }
  ]
}
```
(`objective` + `platform` extracted from the brief; `key_message` missing → one gap. When all three present → `gaps: []`.)

### B. Marketing-plan brief (roadmap acceptance #2)
Request:
```json
{ "brandSlug": "sifututor", "text": "Tolong rangka marketing plan untuk back-to-school campaign, sasaran ibu bapa murid sekolah rendah, untuk 6 minggu sebelum sesi persekolahan" }
```
Response `200`:
```json
{
  "runId": "ckxs…",
  "taskType": "marketing_plan",
  "lens": "marketing",
  "intent": "6-week back-to-school marketing plan targeting primary-school parents",
  "confidence": 0.91,
  "recipe": { "id": "…", "taskType": "marketing_plan", "group": "strategy", "outputFormat": "text" },
  "gaps": []
}
```
(`objective`, `audience`, `timeframe` all present → ready.)

### C. Ambiguous input → clarification (no guess)
Request:
```json
{ "brandSlug": "nakngaji", "text": "buat sesuatu untuk raya" }
```
Response `200`:
```json
{
  "runId": "ckxt…",
  "taskType": "poster",
  "lens": "social",
  "intent": "Unclear — Raya-themed content, format not specified",
  "confidence": 0.38,
  "recipe": null,
  "gaps": [
    { "field": "task_type", "question": "Nak buat apa untuk Raya — poster, caption, atau marketing plan?", "required": true }
  ]
}
```
(Low confidence → `recipe:null`, clarification gap. Draft run still created with `recipeId=null` so the answer resumes against it.)

### D. Creative member, image attached, social lens (default)
Request:
```json
{ "brandSlug": "sifututor", "text": "macam ni tapi versi kita", "uploads": ["/uploads/ref/comp-ad.png"] }
```
- `lens` resolves to `social` (creative default; user is `single` so `explicitLens` ignored even if sent).
- The image is sent to gpt-4o vision; classification reflects what's in it.

---

## 3. Lib function signatures (build targets)

```ts
// src/lib/lens.ts
export const LENSES = ["marketing", "social"] as const;
export type Lens = (typeof LENSES)[number];
// deterministic; throws a 400-mapped error on invalid explicit value
export function resolveLens(
  user: { teamRole: string; team: string },
  explicit?: string,
): Lens;

// src/lib/ingest.ts
export type IngestResult = { extraText: string; images: string[]; skipped: string[] };
export async function ingestUploads(paths: string[]): Promise<IngestResult>;

// src/lib/router.ts
export type Classification = {
  taskType: string;
  intent: string;
  confidence: number;
  suggestedLens: Lens | null;
  extracted: Record<string, string>;
};
export async function classify(args: {
  text: string; images: string[]; brandSlug: string; enabledTaskTypes: string[];
}): Promise<Classification>;

export async function selectRecipe(taskType: string, lens: Lens): Promise<RecipeRef | null>;

export const REQUIRED_FIELDS: Record<string, string[]>; // { poster:[…], caption:[…], marketing_plan:[…] }
export async function gapCheck(
  taskType: string,
  extracted: Record<string, string>,
  ctx: { brandSlug: string; lens: Lens },
): Promise<Gap[]>;
```

### Behaviour rules (contract)
- `resolveLens`: `single` → teamRole default (marketing→`marketing`, creative→`social`), ignoring `explicit`. `multi`/`all` → `explicit` if a valid `Lens`, else teamRole default. Invalid `explicit` string (not in `LENSES`) → throw (route maps to `400`).
- `selectRecipe`: returns the enabled recipe whose `taskType` matches **and** whose `lenses[]` contains `lens`; otherwise `null` (→ clarification).
- `gapCheck`: confidence below threshold (build-time const, e.g. `< 0.5`) is handled in the route → forces a `task_type` clarification gap and `recipe:null` regardless of field extraction. When confident: missing required fields (per `REQUIRED_FIELDS[taskType]`) → one gap each; LLM only phrases `question`.
- The draft `CreativeRun` write: `{ createdBy:user.id, brandId, recipeId|null, lens, inputText:text, inputUploads:uploads, intent, spec: extracted, status:"draft", feature: taskType (legacy col), outputJson:"{}" }` (legacy required cols satisfied per M1-A carry-forward).

---

## 4. States (consumer-facing, for Phase G later)
Documented now so the contract supports them; not built this phase.
- **ready** — `recipe != null && gaps.length === 0` → UI can offer "Generate".
- **needs-info** — `recipe != null && gaps.length > 0` → UI asks the gap questions.
- **needs-clarification** — `recipe == null` → UI asks the `task_type`/`clarification` question.
- **error** — non-2xx → UI shows retry (502) or fix-input (400) message.
