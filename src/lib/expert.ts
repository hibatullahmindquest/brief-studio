import { prisma } from "@/lib/prisma";
import { getClient } from "@/lib/openai";

// Module 1 Phase D — expert primitives:
//   tierToModel  : an Expert's modelTier → a concrete, PRICED model name
//   loadExpert   : the live, enabled Expert for a roleKey (admin-editable)
//   ExpertCall   : the single LLM call as an injectable dependency, so the recipe
//                  engine stays testable without OpenAI (inject-the-IO house style)

export type ExpertRow = {
  id: string;
  roleKey: string;
  name: string;
  systemPrompt: string;
  modelTier: string;
};

// Tier → concrete model. MUST resolve to a model present in pricing.ts TEXT_RATES
// (gpt-4o / gpt-5) so cost logging is accurate, not a fallback guess.
// Env-overridable per tier for tuning without a code change.
export function tierToModel(tier: string | null | undefined): string {
  switch (tier) {
    case "premium":
      return process.env.OPENAI_MODEL_PREMIUM ?? "gpt-5";
    case "fast":
      return process.env.OPENAI_MODEL_FAST ?? "gpt-4o";
    case "standard":
    default:
      return process.env.OPENAI_MODEL_STANDARD ?? "gpt-4o";
  }
}

export async function loadExpert(roleKey: string): Promise<ExpertRow | null> {
  if (!roleKey) return null;
  return prisma.expert.findFirst({
    where: { roleKey, enabled: true },
    select: { id: true, roleKey: true, name: true, systemPrompt: true, modelTier: true },
  });
}

export type ExpertCallArgs = { system: string; user: string; model: string };
export type ExpertCallUsage = { model: string; inputTokens: number; outputTokens: number };
export type ExpertCallResult = { text: string; usage: ExpertCallUsage };
export type ExpertCall = (args: ExpertCallArgs) => Promise<ExpertCallResult>;

// The real expert call. Prose out (no response_format) — the engine handles any
// structured parsing (e.g. the Brand Guardian verdict). Throws on API errors; the
// engine treats a throw as a retryable failure so Module 0 backoff re-runs the job.
export const defaultExpertCall: ExpertCall = async ({ system, user, model }) => {
  const client = getClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_completion_tokens: 5000,
  });
  return {
    text: response.choices[0]?.message?.content?.trim() ?? "",
    usage: {
      model,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    },
  };
};
