import { prisma } from "@/lib/prisma";
import { selectRecipe, gapCheck, type Gap, type RecipeRef, type GapPhraser } from "@/lib/router";
import type { Lens } from "@/lib/lens";
import { StudioError } from "@/lib/studio-error";

// Module 1 Phase G — answer the intake gaps (deep lib).
// The Understand step collects the user's answers to the gaps the router raised. There is no
// other path to write them into the draft run, so this merges the answers (and an optional
// task-type re-pick) into CreativeRun.spec, re-selects the recipe when the task type changes,
// persists, and returns the REMAINING gaps. confirmRun then validates the now-complete spec.
// Idempotent: re-applying the same answers is a no-op beyond the write.

export type ApplyAnswersInput = { answers?: Record<string, string>; taskType?: string };
export type ApplyAnswersResult = { runId: string; recipe: RecipeRef | null; gaps: Gap[]; taskType: string; spec: Record<string, string> };

// spec keys the UI may set via gap answers (field detection in gapCheck only reads REQUIRED_FIELDS;
// ratio/angle are free extras the experts + visual-direction read). Sentinels are never written.
const ACCEPTED_FIELDS = new Set(["objective", "platform", "key_message", "audience", "timeframe", "ratio", "angle"]);

// Fallback question wording is a humanised field label; the UI prefers the original intake
// question text (keyed by field) and only falls back to this for fields with no prior question.
const humanize = (f: string) => f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const labelPhraser: GapPhraser = async (fields) => Object.fromEntries(fields.map((f) => [f, humanize(f)]));

export async function applyAnswers(user: { id: string }, runId: string, input: ApplyAnswersInput): Promise<ApplyAnswersResult> {
  const id = (runId ?? "").trim();
  if (!id) throw new StudioError(400, "runId is required");

  const run = await prisma.creativeRun.findUnique({
    where: { id },
    select: { id: true, userId: true, recipeId: true, lens: true, feature: true, status: true, spec: true, brand: { select: { slug: true } } },
  });
  if (!run) throw new StudioError(404, "Run not found");
  if (run.userId !== user.id) throw new StudioError(403, "Not your run");
  if (run.status !== "draft") throw new StudioError(409, `Run already ${run.status}`); // only drafts are editable

  const lens = (run.lens ?? "marketing") as Lens;
  const brandSlug = run.brand?.slug ?? "";

  // task-type re-pick (answering a task_type / clarification gap) → re-select the recipe.
  const taskType = (input.taskType ?? "").trim() || run.feature;
  let recipe: RecipeRef | null;
  if (taskType !== run.feature || !run.recipeId) {
    recipe = await selectRecipe(taskType, lens);
  } else {
    recipe = await prisma.recipe.findUnique({ where: { id: run.recipeId }, select: { id: true, taskType: true, group: true, outputFormat: true } });
  }

  // merge accepted answer fields into spec
  const spec: Record<string, string> = run.spec && typeof run.spec === "object" && !Array.isArray(run.spec) ? { ...(run.spec as Record<string, string>) } : {};
  for (const [k, v] of Object.entries(input.answers ?? {})) {
    if (ACCEPTED_FIELDS.has(k) && typeof v === "string" && v.trim()) spec[k] = v.trim();
  }

  await prisma.creativeRun.update({
    where: { id },
    data: { feature: taskType, recipeId: recipe?.id ?? null, spec },
  });

  // remaining gaps. No recipe for the chosen task type → a clarification gap (mirror runIntake).
  let gaps: Gap[];
  if (!recipe) {
    gaps = [{ field: "clarification", question: `No recipe for "${taskType}" on the ${lens} lens — describe the output you want.`, required: true }];
  } else {
    gaps = await gapCheck(taskType, spec, { taskType, lens, brandSlug }, labelPhraser);
  }

  return { runId: id, recipe, gaps, taskType, spec };
}
