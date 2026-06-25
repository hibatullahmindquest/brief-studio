import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { resolveLens, type Lens } from "./lens";
import { getClient } from "./openai";
import { getBrandContext } from "./brand-context";
import { ingestUploads, safePublicPath } from "./ingest";
import { logUsage } from "./usage";
import { StudioError } from "./studio-error";

// Intent router — deterministic core (Phase C, part 1):
//   selectRecipe  : taskType + lens → the enabled, lens-compatible Recipe (or null)
//   REQUIRED_FIELDS: what makes a brief "complete" per task type (gap-check basis)
//   gapCheck      : missing required fields → gaps. Field detection is deterministic;
//                   only the question wording is delegated.
// Part 2 (Prompt 4): classify() — the single gpt-4o structured-output call that picks
//   the task type (enum-constrained) AND extracts known fields AND drafts gap questions.
// runIntake() (orchestration + persistence) lands in Prompt 5.

export type RecipeRef = {
  id: string;
  taskType: string;
  group: string;
  outputFormat: string;
};

export type Gap = {
  field: string; // stable snake_case key (also the CreativeRun.spec key) or "task_type"/"clarification"
  question: string; // human-readable, brand/lens-aware (LLM-phrased in part 2)
  required: boolean;
};

// Below this classification confidence the router does NOT guess a recipe — it returns a
// task_type clarification gap instead (PRD US-5, "don't guess"). Clear briefs land ~0.9–1.0;
// genuinely ambiguous input lands ~0.4–0.6, so 0.7 separates cleanly.
export const CLARIFY_THRESHOLD = 0.7;

// LOCKED (PRD §4, "sederhana per-type"). Keys are snake_case and double as spec keys.
export const REQUIRED_FIELDS: Record<string, string[]> = {
  poster: ["objective", "platform", "key_message"],
  caption: ["objective", "platform", "key_message"],
  marketing_plan: ["objective", "audience", "timeframe"],
};

// Return the enabled recipe whose taskType matches AND whose lenses[] includes the
// resolved lens; otherwise null (→ the route turns this into a clarification gap).
export async function selectRecipe(taskType: string, lens: Lens): Promise<RecipeRef | null> {
  if (!taskType) return null;
  const recipe = await prisma.recipe.findFirst({
    where: { taskType, enabled: true, lenses: { has: lens } },
    select: { id: true, taskType: true, group: true, outputFormat: true },
  });
  return recipe;
}

const hasValue = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";

export type GapCtx = { taskType: string; lens: Lens; brandSlug: string };

// Phrase the human question for each missing field. Injected so gap-field detection is
// testable without an LLM; the real brand/lens-aware phrasing is wired in part 2.
export type GapPhraser = (fields: string[], ctx: GapCtx) => Promise<Record<string, string>>;

const stubPhraser: GapPhraser = async (fields) =>
  Object.fromEntries(fields.map((f) => [f, `Sila berikan: ${f}.`]));

export async function gapCheck(
  taskType: string,
  extracted: Record<string, string>,
  ctx: GapCtx,
  phraser: GapPhraser = stubPhraser,
): Promise<Gap[]> {
  const required = REQUIRED_FIELDS[taskType] ?? [];
  const missing = required.filter((f) => !hasValue(extracted?.[f]));
  if (missing.length === 0) return [];
  const questions = await phraser(missing, ctx);
  return missing.map((f) => ({ field: f, question: questions[f] ?? `Sila berikan: ${f}.`, required: true }));
}

// Build a phraser from questions the classify call already drafted — so gap wording is
// LLM-authored without spending a second call. Falls back to a templated question.
export function phraserFromQuestions(questions: Record<string, string>): GapPhraser {
  return async (fields) =>
    Object.fromEntries(fields.map((f) => [f, questions?.[f] ?? `Sila berikan: ${f}.`]));
}

// ── Part 2: classification (single gpt-4o structured-output call) ──────────────

// All brief fields the classifier may extract / draft questions for (union of every
// taskType's required set — keeps the prompt stable as task types come and go).
const ALL_FIELDS = ["objective", "platform", "key_message", "audience", "timeframe"] as const;

export type Classification = {
  taskType: string; // a member of the enabled taskTypes (enum-constrained)
  intent: string;
  confidence: number; // 0..1
  suggestedLens: Lens | null; // suggestion only — resolveLens is authoritative
  extracted: Record<string, string>;
  questions: Record<string, string>; // field → Malay question, for fields not extracted
};
export type ClassifyUsage = { model: string; inputTokens: number; outputTokens: number };
export type ClassifyResult = { classification: Classification; usage: ClassifyUsage };

export async function listEnabledTaskTypes(): Promise<string[]> {
  const rows = await prisma.recipe.findMany({ where: { enabled: true }, select: { taskType: true } });
  return rows.map((r) => r.taskType);
}

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
};

// Read a /public image path → a base64 data URL for the vision call. null on failure.
async function imageDataUrl(p: string): Promise<string | null> {
  try {
    const mime = IMAGE_MIME[path.extname(p).toLowerCase()];
    if (!mime) return null;
    const safe = safePublicPath(p); // path-traversal guard — escapes /public → reject
    if (!safe) return null;
    const buf = await readFile(safe);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Exported for unit testing the language-mirror contract (G4). The clarifying questions
// must follow the brief's own language, not a fixed one.
export function buildSystemPrompt(brandPromptBlock: string, taskTypes: string[]): string {
  return [
    "You are the intake router for a Malaysian creative studio. Read the user's brief (and any image) and decide what they want to make.",
    "Respond with ONLY valid JSON (no markdown), matching exactly:",
    "{",
    `  "taskType": one of [${taskTypes.map((t) => `"${t}"`).join(", ")}],`,
    '  "intent": "<one-line purpose, English>",',
    '  "confidence": <number 0..1, how sure you are of taskType>,',
    '  "suggestedLens": "marketing" | "social" | null,',
    `  "extracted": { ${ALL_FIELDS.map((f) => `"${f}": "<value or empty string>"`).join(", ")} },`,
    '  "questions": { "<field>": "<short question in the SAME LANGUAGE as the user\'s brief>" }',
    "}",
    "Rules: pick the single best taskType from the list. `confidence` reflects how clearly the OUTPUT FORMAT is determined:",
    "set it at or below 0.4 when the brief does NOT name or strongly imply a specific output (e.g. 'poster'/image, 'caption'/post, 'marketing plan', or a platform like IG for a visual) — even though you still guess the closest taskType.",
    "Fill `extracted` only with values clearly present in the brief; leave a field as \"\" if absent.",
    "For each field you left empty that matters, add a short question to `questions` (key = field name) — write it in the SAME LANGUAGE the user wrote their brief in (Malay brief → Malay question, English brief → English question, mixed → follow their lead).",
    "marketing = paid/campaign framing; social = organic publish-ready content.",
    "",
    "## Brand",
    brandPromptBlock,
  ].join("\n");
}

export async function classify(args: {
  text: string;
  images?: string[];
  brandSlug: string;
  enabledTaskTypes: string[];
}): Promise<ClassifyResult> {
  const brand = await getBrandContext(args.brandSlug);
  if (!brand) throw new StudioError(400, `Unknown brand: ${args.brandSlug}`);

  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-4o";

  const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
  for (const img of args.images ?? []) {
    const url = await imageDataUrl(img);
    if (url) imageParts.push({ type: "image_url", image_url: { url } });
  }

  const userContent = [
    { type: "text" as const, text: args.text || "(no text provided — infer from the attached image)" },
    ...imageParts,
  ];

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: buildSystemPrompt(brand.promptBlock, args.enabledTaskTypes) },
      { role: "user", content: userContent },
    ],
    max_completion_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content?.trim() || "{}";
  let parsed: Partial<Classification> = {};
  try { parsed = JSON.parse(raw) as Partial<Classification>; } catch { parsed = {}; }

  const conf = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
  const sug = parsed.suggestedLens === "marketing" || parsed.suggestedLens === "social" ? parsed.suggestedLens : null;
  const cleanRecord = (o: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (typeof v === "string" && v.trim()) out[k] = v.trim();
      }
    }
    return out;
  };

  return {
    classification: {
      taskType: typeof parsed.taskType === "string" ? parsed.taskType : "",
      intent: typeof parsed.intent === "string" ? parsed.intent : "",
      confidence: conf,
      suggestedLens: sug,
      extracted: cleanRecord(parsed.extracted),
      questions: cleanRecord(parsed.questions),
    },
    usage: {
      model,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

// ── Part 3: orchestration (Prompt 5) ───────────────────────────────────────────
// runIntake = the whole front-door pipeline as one testable function. The route is a
// thin auth+HTTP wrapper around it. classify/ingest are injectable so persistence and
// the clarification branch can be exercised deterministically without the LLM.

export type RunUser = { id: string; teamRole: string; team: string };
export type IntakeBody = { brandSlug: string; text?: string; uploads?: string[]; explicitLens?: string };

export type StudioResponse = {
  runId: string;
  taskType: string;
  lens: Lens;
  intent: string;
  confidence: number;
  recipe: RecipeRef | null;
  gaps: Gap[];
  notices?: string[];
};

export type IntakeDeps = {
  classify: typeof classify;
  ingest: typeof ingestUploads;
};
const defaultDeps: IntakeDeps = { classify, ingest: ingestUploads };

export async function runIntake(user: RunUser, body: IntakeBody, deps: IntakeDeps = defaultDeps): Promise<StudioResponse> {
  const brandSlug = (body.brandSlug ?? "").trim();
  if (!brandSlug) throw new StudioError(400, "brandSlug is required");

  // lens first — deterministic, throws 400 on an invalid explicit value
  const lens = resolveLens(user, body.explicitLens);

  const ingest = await deps.ingest(body.uploads);
  const text = (body.text ?? "").trim();
  const combined = [text, ingest.extraText].filter(Boolean).join("\n\n");
  if (!combined && ingest.images.length === 0) throw new StudioError(400, "Provide a brief (text or a usable attachment)");

  const brand = await getBrandContext(brandSlug);
  if (!brand) throw new StudioError(400, `Unknown brand: ${brandSlug}`);

  const enabledTaskTypes = await listEnabledTaskTypes();
  const { classification: c, usage } = await deps.classify({ text: combined, images: ingest.images, brandSlug, enabledTaskTypes });

  // resolve recipe + gaps
  let recipe: RecipeRef | null = null;
  let gaps: Gap[];
  if (c.confidence < CLARIFY_THRESHOLD) {
    gaps = [{ field: "task_type", question: c.questions.task_type ?? "Nak buat apa — poster, caption, atau marketing plan?", required: true }];
  } else {
    recipe = await selectRecipe(c.taskType, lens);
    if (!recipe) {
      gaps = [{ field: "clarification", question: c.questions.clarification ?? `Tiada recipe untuk "${c.taskType}" pada lens ${lens}. Boleh perjelaskan output yang dikehendaki?`, required: true }];
    } else {
      gaps = await gapCheck(c.taskType, c.extracted, { taskType: c.taskType, lens, brandSlug }, phraserFromQuestions(c.questions));
    }
  }

  const run = await prisma.creativeRun.create({
    data: {
      userId: user.id,
      brandId: brand.id,
      recipeId: recipe?.id ?? null,
      feature: c.taskType || "unknown", // legacy required col — mirror the classified task type
      lens,
      inputText: combined,
      inputUploads: body.uploads ?? [],
      intent: c.intent,
      spec: c.extracted, // Json (object, never null — Prisma 4 safe)
      status: "draft",
      outputJson: "{}", // legacy required col (M1-A carry-forward)
    },
    select: { id: true },
  });

  // cost logging is best-effort — must never break the response
  try {
    await logUsage({ userId: user.id, brandId: brand.id, featureRunId: run.id, module: "router", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
  } catch { /* logged elsewhere; ignore */ }

  return {
    runId: run.id,
    taskType: c.taskType,
    lens,
    intent: c.intent,
    confidence: c.confidence,
    recipe,
    gaps,
    notices: ingest.skipped.length ? [`skipped ${ingest.skipped.length} unsupported attachment(s)`] : undefined,
  };
}
