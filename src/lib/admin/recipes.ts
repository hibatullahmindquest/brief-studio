import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminError } from "./errors";
import { MODEL_TIERS, type ModelTier } from "./experts";

// Admin CRUD for Recipes. A recipe is an ordered lineup of experts (steps) run to
// produce one task type's output. Step roleKeys are validated against the Expert
// table; deletes are blocked while referenced by a CreativeRun.

export const RECIPE_GROUPS = ["creative", "copy", "strategy", "intelligence", "compound"] as const;
export const OUTPUT_FORMATS = ["image", "text", "pdf", "carousel"] as const;

const TASK_TYPE_RE = /^[a-z][a-z0-9_]*$/;

export type RecipeStep = { roleKey: string; modelTier?: string };
export type RecipeInput = {
  taskType?: string;
  group?: string;
  steps?: unknown;
  outputFormat?: string;
  lenses?: unknown;
  enabled?: boolean;
};

export function listRecipes() {
  return prisma.recipe.findMany({ orderBy: { taskType: "asc" } });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

// Validate + normalize steps; every roleKey must exist in the Expert table.
async function normalizeSteps(value: unknown): Promise<RecipeStep[]> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new AdminError(400, "steps must be an array");
  const steps: RecipeStep[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") throw new AdminError(400, "each step must be an object");
    const roleKey = (raw as { roleKey?: unknown }).roleKey;
    if (typeof roleKey !== "string" || !roleKey.trim()) throw new AdminError(400, "each step needs a roleKey");
    const step: RecipeStep = { roleKey: roleKey.trim() };
    const tier = (raw as { modelTier?: unknown }).modelTier;
    if (tier !== undefined && tier !== null && tier !== "") {
      if (typeof tier !== "string" || !MODEL_TIERS.includes(tier as ModelTier)) {
        throw new AdminError(400, `invalid modelTier in step: ${String(tier)}`);
      }
      step.modelTier = tier;
    }
    steps.push(step);
  }
  const keys = [...new Set(steps.map((s) => s.roleKey))];
  if (keys.length > 0) {
    const found = await prisma.expert.findMany({ where: { roleKey: { in: keys } }, select: { roleKey: true } });
    const known = new Set(found.map((e) => e.roleKey));
    const unknown = keys.filter((k) => !known.has(k));
    if (unknown.length > 0) throw new AdminError(400, `unknown expert roleKey(s) in steps: ${unknown.join(", ")}`);
  }
  return steps;
}

function validateGroup(group: string | undefined): string {
  if (group === undefined || group === "") return "";
  if (!RECIPE_GROUPS.includes(group as (typeof RECIPE_GROUPS)[number])) throw new AdminError(400, `invalid group: ${group}`);
  return group;
}

function validateOutputFormat(fmt: string | undefined): string {
  if (fmt === undefined || fmt === "") return "";
  if (!OUTPUT_FORMATS.includes(fmt as (typeof OUTPUT_FORMATS)[number])) throw new AdminError(400, `invalid outputFormat: ${fmt}`);
  return fmt;
}

export async function createRecipe(input: RecipeInput) {
  const taskType = (input.taskType ?? "").trim();
  if (!TASK_TYPE_RE.test(taskType)) {
    throw new AdminError(400, "taskType must be lowercase letters/digits/underscores and start with a letter");
  }
  const group = validateGroup(input.group);
  const outputFormat = validateOutputFormat(input.outputFormat);
  const steps = await normalizeSteps(input.steps);
  const lenses = normalizeStringArray(input.lenses);

  try {
    return await prisma.recipe.create({
      data: {
        taskType,
        group,
        outputFormat,
        steps: steps as unknown as Prisma.InputJsonValue,
        lenses,
        enabled: input.enabled ?? true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AdminError(409, `taskType already exists: ${taskType}`);
    }
    throw e;
  }
}

export async function updateRecipe(id: string, input: RecipeInput) {
  if (!id) throw new AdminError(400, "id is required");

  const data: Prisma.RecipeUpdateInput = {};
  if (input.taskType !== undefined) {
    const taskType = input.taskType.trim();
    if (!TASK_TYPE_RE.test(taskType)) throw new AdminError(400, "invalid taskType");
    data.taskType = taskType;
  }
  if (input.group !== undefined) data.group = validateGroup(input.group);
  if (input.outputFormat !== undefined) data.outputFormat = validateOutputFormat(input.outputFormat);
  if (input.steps !== undefined) data.steps = (await normalizeSteps(input.steps)) as unknown as Prisma.InputJsonValue;
  if (input.lenses !== undefined) data.lenses = normalizeStringArray(input.lenses);
  if (input.enabled !== undefined) data.enabled = input.enabled;

  try {
    return await prisma.recipe.update({ where: { id }, data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") throw new AdminError(409, "taskType already exists");
      if (e.code === "P2025") throw new AdminError(404, "recipe not found");
    }
    throw e;
  }
}

export async function deleteRecipe(id: string) {
  if (!id) throw new AdminError(400, "id is required");
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) throw new AdminError(404, "recipe not found");

  const refCount = await prisma.creativeRun.count({ where: { recipeId: id } });
  if (refCount > 0) {
    throw new AdminError(409, `Cannot delete — referenced by ${refCount} creative run(s)`);
  }

  await prisma.recipe.delete({ where: { id } });
  return { id };
}
