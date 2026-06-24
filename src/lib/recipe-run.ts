import { prisma } from "@/lib/prisma";
import { logUsage, sumRunCostMyr } from "@/lib/usage";
import {
  loadExpert,
  tierToModel,
  defaultExpertCall,
  type ExpertCall,
} from "@/lib/expert";
import { buildGrounding } from "@/lib/grounding";
import { RecipeConfigError } from "@/lib/studio-error";

// Module 1 Phase D — the recipe engine.
//
// runRecipe loops a recipe's ordered expert lineup. Each producing step is one LLM
// call (Expert systemPrompt + brand grounding + the running transcript of prior
// outputs) and writes one Artifact. The Brand Guardian step is QA (pass/flag/retry),
// not an artifact — its verdict lands in CreativeRun.contextUsed. Cost is logged per
// expert (module:"expert"). Generic across recipes; experts/recipes are read live.
//
// The LLM call + grounding are injected (defaults wired) so the engine is fully
// testable without OpenAI — the deterministic shell is the hard gate (house style).

const GUARDIAN = "brand_guardian";
const MAX_GUARDIAN_RETRIES = 1;

export type RecipeStep = { roleKey: string; modelTier?: string };

export type RunInput = {
  id: string;
  brandId: string | null;
  brandSlug: string;
  recipeId: string;
  lens: string;
  spec: unknown;
  feature: string;
  userId: string;
};

export type ArtifactOut = { type: string; content: { text: string } };
export type GuardianVerdict = {
  verdict: "pass" | "flag" | "retry" | "skipped";
  reasons: string[];
  retried?: boolean;
};
export type RecipeResult = {
  ok: true;
  artifacts: ArtifactOut[];
  guardian: GuardianVerdict;
  costMyr: number;
  status: "generated";
  notices: string[];
};

export type RecipeDeps = {
  callExpert?: ExpertCall;
  grounding?: typeof buildGrounding;
};

// Artifact.type per producing role.
function typeForRole(roleKey: string): string {
  switch (roleKey) {
    case "strategist": return "strategy";
    case "copywriter": return "copy";
    case "art_director": return "visual_direction";
    case "social": return "social";
    default: return "text";
  }
}

function parseSteps(raw: unknown): RecipeStep[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : null))
    .filter((s): s is Record<string, unknown> => !!s && typeof s.roleKey === "string" && (s.roleKey as string).length > 0)
    .map((s) => ({ roleKey: s.roleKey as string, modelTier: typeof s.modelTier === "string" ? (s.modelTier as string) : undefined }));
}

function formatSpec(spec: unknown): string {
  if (!spec || typeof spec !== "object") return "";
  return Object.entries(spec as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string" && v.trim() !== "")
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`)
    .join("\n");
}

function parseVerdict(text: string): GuardianVerdict {
  try {
    // tolerate a fenced/parenthesised reply — grab the first {...} object
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text) as { verdict?: unknown; reasons?: unknown };
    const v = parsed.verdict;
    const verdict = v === "pass" || v === "flag" || v === "retry" ? v : "flag";
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r): r is string => typeof r === "string")
      : [];
    return { verdict, reasons };
  } catch {
    return { verdict: "flag", reasons: ["guardian reply could not be parsed"] };
  }
}

export async function runRecipe(run: RunInput, deps: RecipeDeps = {}): Promise<RecipeResult> {
  const callExpert = deps.callExpert ?? defaultExpertCall;
  const groundingFn = deps.grounding ?? buildGrounding;

  const recipe = await prisma.recipe.findUnique({
    where: { id: run.recipeId },
    select: { steps: true, outputFormat: true, taskType: true },
  });
  if (!recipe) throw new RecipeConfigError(`recipe not found: ${run.recipeId}`);

  const steps = parseSteps(recipe.steps);
  if (steps.length === 0) throw new RecipeConfigError(`recipe ${recipe.taskType} has no steps`);

  const grounding = await groundingFn(run.brandSlug, run.lens, run.spec);
  if (!grounding) throw new RecipeConfigError(`no grounding for brand: ${run.brandSlug}`);

  const specText = formatSpec(run.spec);
  const notices: string[] = [];
  // Producing steps run in recipe order; the Brand Guardian is QA and always runs LAST
  // (after every producing step), regardless of where an admin placed it in steps[] —
  // QA must see the full output. Only the first guardian step is honoured.
  const producing = steps.filter((s) => s.roleKey !== GUARDIAN);
  const guardianStep = steps.find((s) => s.roleKey === GUARDIAN) ?? null;

  // Run all producing steps in order, writing one Artifact each, building a transcript.
  // extraGuidance carries the Guardian's reasons on a retry pass.
  async function runProducing(extraGuidance?: string): Promise<{ transcript: string; artifacts: ArtifactOut[] }> {
    // idempotent: clear any artifacts from a prior attempt before (re)writing
    await prisma.artifact.deleteMany({ where: { runId: run.id } });
    const transcriptParts: string[] = [];
    const artifacts: ArtifactOut[] = [];
    for (const step of producing) {
      const expert = await loadExpert(step.roleKey);
      if (!expert) { notices.push(`skipped disabled/missing expert: ${step.roleKey}`); continue; }
      const model = tierToModel(step.modelTier ?? expert.modelTier);
      const system = `${expert.systemPrompt}\n\n${grounding!.expertBlock}`;
      const userParts = [
        specText ? `Brief:\n${specText}` : "",
        transcriptParts.length ? `Work so far:\n${transcriptParts.join("\n\n")}` : "",
        extraGuidance ? `Brand Guardian feedback to address:\n${extraGuidance}` : "",
      ].filter(Boolean);
      const { text, usage } = await callExpert({ system, user: userParts.join("\n\n") || "(no brief provided)", model });
      transcriptParts.push(`## ${expert.name}\n${text}`);
      const out: ArtifactOut = { type: typeForRole(step.roleKey), content: { text } };
      await prisma.artifact.create({ data: { runId: run.id, type: out.type, content: out.content } });
      artifacts.push(out);
      await logUsage({
        userId: run.userId, brandId: run.brandId, featureRunId: run.id,
        module: "expert", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      });
    }
    return { transcript: transcriptParts.join("\n\n"), artifacts };
  }

  async function runGuardian(transcript: string): Promise<GuardianVerdict> {
    if (!guardianStep) return { verdict: "skipped", reasons: [] };
    const expert = await loadExpert(guardianStep.roleKey);
    if (!expert) { notices.push("brand guardian missing/disabled — QA skipped"); return { verdict: "skipped", reasons: [] }; }
    const model = tierToModel(guardianStep.modelTier ?? expert.modelTier);
    const system = `${expert.systemPrompt}\n\n${grounding!.guardrailBlock}\n\nReply with ONLY JSON: {"verdict":"pass"|"flag"|"retry","reasons":["..."]}`;
    const { text, usage } = await callExpert({ system, user: `Review this output against the rules:\n\n${transcript}`, model });
    await logUsage({
      userId: run.userId, brandId: run.brandId, featureRunId: run.id,
      module: "expert", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
    });
    return parseVerdict(text);
  }

  let { transcript, artifacts } = await runProducing();
  if (artifacts.length === 0) throw new RecipeConfigError(`recipe ${recipe.taskType} has no enabled producing experts`);

  const guardian = await runGuardian(transcript);
  let retried = false;

  if (guardian.verdict === "retry") {
    for (let i = 0; i < MAX_GUARDIAN_RETRIES; i++) {
      const r2 = await runProducing(guardian.reasons.join("; "));
      transcript = r2.transcript;
      artifacts = r2.artifacts;
      retried = true;
    }
    // accept regardless after the bounded retry (no further guardian call)
  }

  const guardianOut: GuardianVerdict = { ...guardian, retried };
  const contextUsed = {
    grounding: { brandId: grounding.brandId, lens: run.lens },
    guardian: guardianOut,
    notices: [...new Set(notices)], // a retry pass re-pushes the same skip notices — dedupe
  };
  await prisma.creativeRun.update({
    where: { id: run.id },
    data: { status: "generated", contextUsed },
  });

  const costMyr = await sumRunCostMyr(run.id);
  return { ok: true, artifacts, guardian: guardianOut, costMyr, status: "generated", notices: [...new Set(notices)] };
}
