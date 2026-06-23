// Integration checks for Module 1 Phase B — Experts admin CRUD (lib layer).
// Exercises the same functions the API route calls: create/list/update + the
// duplicate-roleKey 409 and the delete-guard (roleKey referenced in a Recipe).
// Run: DATABASE_URL=... npx tsx scripts/m1b-experts.ts   (exits 1 on any failure)
import { prisma } from "@/lib/prisma";
import { AdminError } from "@/lib/admin/errors";
import { listExperts, createExpert, updateExpert, deleteExpert } from "@/lib/admin/experts";

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
  const tag = "zztest_expert_" + Math.floor(Math.random() * 1e9);
  const recipeTag = "zztest_recipe_" + Math.floor(Math.random() * 1e9);
  let expertId = "";

  try {
    // create
    const created = await createExpert({ roleKey: tag, name: "Test Expert", systemPrompt: "hello", modelTier: "fast" });
    expertId = created.id;
    ok("create returns expert", !!created.id && created.roleKey === tag && created.modelTier === "fast");

    // list contains it
    const all = await listExperts();
    ok("list includes created expert", all.some((e) => e.id === expertId));

    // update persists systemPrompt
    await updateExpert(expertId, { systemPrompt: "updated prompt" });
    const reread = await prisma.expert.findUnique({ where: { id: expertId } });
    ok("update persists systemPrompt", reread?.systemPrompt === "updated prompt");

    // validation: bad roleKey
    await expectAdminError("create rejects bad roleKey", 400, () => createExpert({ roleKey: "Bad Key!", name: "x" }));
    // validation: bad tier
    await expectAdminError("create rejects bad modelTier", 400, () => createExpert({ roleKey: tag + "_b", name: "x", modelTier: "ultra" }));

    // duplicate roleKey -> 409
    await expectAdminError("duplicate roleKey -> 409", 409, () => createExpert({ roleKey: tag, name: "dup" }));

    // delete-guard: create a recipe referencing the roleKey, expect delete 409
    await prisma.recipe.create({
      data: { taskType: recipeTag, group: "creative", steps: [{ roleKey: tag }], outputFormat: "image", lenses: [] },
    });
    await expectAdminError("delete blocked while referenced -> 409", 409, () => deleteExpert(expertId));

    // remove the reference, then delete succeeds
    await prisma.recipe.delete({ where: { taskType: recipeTag } });
    const del = await deleteExpert(expertId);
    ok("delete succeeds when unreferenced", del.id === expertId);
    const gone = await prisma.expert.findUnique({ where: { id: expertId } });
    ok("expert removed from DB", gone === null);
    expertId = "";
  } finally {
    // cleanup any leftovers from a mid-run failure
    if (expertId) await prisma.expert.delete({ where: { id: expertId } }).catch(() => {});
    await prisma.recipe.deleteMany({ where: { taskType: recipeTag } }).catch(() => {});
    await prisma.expert.deleteMany({ where: { roleKey: { startsWith: "zztest_expert_" } } }).catch(() => {});
  }

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
