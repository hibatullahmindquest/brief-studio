// Integration checks for Module 1 Phase B — Recipes admin CRUD (lib layer).
// Exercises create/list/update + step roleKey validation, duplicate-taskType 409,
// and the delete-guard (recipe referenced by a CreativeRun).
// Run: DATABASE_URL=... npx tsx scripts/m1b-recipes.ts   (exits 1 on any failure)
// Prerequisite: base experts seeded (scripts/seed-m1.ts).
import { prisma } from "@/lib/prisma";
import { AdminError } from "@/lib/admin/errors";
import { listRecipes, createRecipe, updateRecipe, deleteRecipe, type RecipeStep } from "@/lib/admin/recipes";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function expectAdminError(name: string, status: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(`${name} (expected AdminError ${status})`, false);
  } catch (e) {
    ok(name, e instanceof AdminError && e.status === status);
  }
}

async function main() {
  const tag = "zztest_task_" + Math.floor(Math.random() * 1e9);
  const userTag = "zztest_ruser_" + Math.floor(Math.random() * 1e9);
  let recipeId = "";
  let userId = "";

  // need two real experts for valid steps
  const experts = await prisma.expert.findMany({ where: { roleKey: { in: ["strategist", "copywriter"] } } });
  ok("base experts (strategist, copywriter) present for step refs", experts.length === 2);
  if (experts.length < 2) { console.log("\nSEED MISSING — run scripts/seed-m1.ts"); process.exit(1); }

  try {
    // create
    const created = await createRecipe({
      taskType: tag,
      group: "creative",
      outputFormat: "image",
      steps: [{ roleKey: "strategist" }, { roleKey: "copywriter", modelTier: "premium" }],
      lenses: ["marketing", "marketing", "  "], // dup + blank should be cleaned
    });
    recipeId = created.id;
    const createdSteps = created.steps as unknown as RecipeStep[];
    ok("create returns recipe", !!created.id && created.taskType === tag);
    ok("steps persisted in order with tier", createdSteps.length === 2 && createdSteps[0].roleKey === "strategist" && createdSteps[1].modelTier === "premium");
    ok("lenses deduped + blanks dropped", created.lenses.length === 1 && created.lenses[0] === "marketing");

    // list contains it
    const all = await listRecipes();
    ok("list includes created recipe", all.some((r) => r.id === recipeId));

    // update: reorder + change lenses
    const updated = await updateRecipe(recipeId, {
      steps: [{ roleKey: "copywriter" }, { roleKey: "strategist" }],
      lenses: ["social"],
    });
    const upSteps = updated.steps as unknown as RecipeStep[];
    ok("update reorders steps", upSteps[0].roleKey === "copywriter" && upSteps[1].roleKey === "strategist");
    ok("update changes lenses", updated.lenses.length === 1 && updated.lenses[0] === "social");

    // unknown roleKey rejected
    await expectAdminError("unknown roleKey in steps -> 400", 400, () => createRecipe({ taskType: tag + "_x", steps: [{ roleKey: "no_such_expert" }] }));
    // invalid group / outputFormat
    await expectAdminError("invalid group -> 400", 400, () => createRecipe({ taskType: tag + "_g", group: "nope" }));
    await expectAdminError("invalid outputFormat -> 400", 400, () => createRecipe({ taskType: tag + "_o", outputFormat: "gif" }));
    // duplicate taskType
    await expectAdminError("duplicate taskType -> 409", 409, () => createRecipe({ taskType: tag }));

    // delete-guard: create a CreativeRun referencing the recipe
    const user = await prisma.user.create({ data: { email: `${userTag}@test.local`, username: userTag, password: "x", name: "Recipe Verify" } });
    userId = user.id;
    const run = await prisma.creativeRun.create({ data: { userId, recipeId, feature: "poster", outputJson: "{}" } });
    await expectAdminError("delete blocked while referenced by a run -> 409", 409, () => deleteRecipe(recipeId));

    // remove the run, then delete succeeds
    await prisma.creativeRun.delete({ where: { id: run.id } });
    const del = await deleteRecipe(recipeId);
    ok("delete succeeds when unreferenced", del.id === recipeId);
    ok("recipe removed from DB", (await prisma.recipe.findUnique({ where: { id: recipeId } })) === null);
    recipeId = "";
  } finally {
    if (recipeId) await prisma.recipe.delete({ where: { id: recipeId } }).catch(() => {});
    await prisma.recipe.deleteMany({ where: { taskType: { startsWith: "zztest_task_" } } }).catch(() => {});
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
