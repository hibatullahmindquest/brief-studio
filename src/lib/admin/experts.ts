import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminError } from "./errors";

// Admin CRUD for Experts (system-prompt-bearing pipeline roles). Pure data layer:
// validation + referential guards live here so both the API route and the tsx
// verify script exercise the same logic. Routes only add auth + HTTP mapping.

export const MODEL_TIERS = ["fast", "standard", "premium"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

// lowercase slug, starts with a letter, letters/digits/underscore only.
const ROLE_KEY_RE = /^[a-z][a-z0-9_]*$/;

export type ExpertInput = {
  roleKey?: string;
  name?: string;
  systemPrompt?: string;
  modelTier?: string;
  enabled?: boolean;
};

export function listExperts() {
  return prisma.expert.findMany({ orderBy: { name: "asc" } });
}

function normalizeTier(tier: string | undefined, fallback: string = "standard"): string {
  if (tier === undefined) return fallback;
  if (!MODEL_TIERS.includes(tier as ModelTier)) throw new AdminError(400, `Invalid modelTier: ${tier}`);
  return tier;
}

export async function createExpert(input: ExpertInput) {
  const roleKey = (input.roleKey ?? "").trim();
  const name = (input.name ?? "").trim();
  if (!ROLE_KEY_RE.test(roleKey)) {
    throw new AdminError(400, "roleKey must be lowercase letters/digits/underscores and start with a letter");
  }
  if (!name) throw new AdminError(400, "name is required");
  const modelTier = normalizeTier(input.modelTier);

  try {
    return await prisma.expert.create({
      data: {
        roleKey,
        name,
        systemPrompt: (input.systemPrompt ?? "").trim(),
        modelTier,
        enabled: input.enabled ?? true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AdminError(409, `roleKey already exists: ${roleKey}`);
    }
    throw e;
  }
}

export async function updateExpert(id: string, input: ExpertInput) {
  if (!id) throw new AdminError(400, "id is required");

  const data: Prisma.ExpertUpdateInput = {};
  if (input.roleKey !== undefined) {
    const roleKey = input.roleKey.trim();
    if (!ROLE_KEY_RE.test(roleKey)) {
      throw new AdminError(400, "roleKey must be lowercase letters/digits/underscores and start with a letter");
    }
    data.roleKey = roleKey;
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AdminError(400, "name cannot be empty");
    data.name = name;
  }
  if (input.systemPrompt !== undefined) data.systemPrompt = input.systemPrompt.trim();
  if (input.modelTier !== undefined) data.modelTier = normalizeTier(input.modelTier);
  if (input.enabled !== undefined) data.enabled = input.enabled;

  try {
    return await prisma.expert.update({ where: { id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") throw new AdminError(409, "roleKey already exists");
      if (e.code === "P2025") throw new AdminError(404, "expert not found");
    }
    throw e;
  }
}

// Find recipes whose ordered steps reference this roleKey (soft reference inside Json).
async function recipesReferencingRoleKey(roleKey: string): Promise<string[]> {
  const recipes = await prisma.recipe.findMany({ select: { taskType: true, steps: true } });
  return recipes
    .filter((r) =>
      Array.isArray(r.steps) &&
      (r.steps as unknown[]).some(
        (s) => !!s && typeof s === "object" && (s as { roleKey?: unknown }).roleKey === roleKey,
      ),
    )
    .map((r) => r.taskType);
}

export async function deleteExpert(id: string) {
  if (!id) throw new AdminError(400, "id is required");
  const expert = await prisma.expert.findUnique({ where: { id } });
  if (!expert) throw new AdminError(404, "expert not found");

  const referencedBy = await recipesReferencingRoleKey(expert.roleKey);
  if (referencedBy.length > 0) {
    throw new AdminError(409, `Cannot delete — in use by recipe(s): ${referencedBy.join(", ")}`);
  }

  await prisma.expert.delete({ where: { id } });
  return { id };
}
