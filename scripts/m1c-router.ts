// Integration checks for Module 1 Phase C — router core + orchestration (DB-backed).
// Part A: recipe selection (lens-compat) + required-field map + gap-field sets.
// Part B: runIntake persistence + clarification branch, with classify/ingest INJECTED
//   (fake) so the orchestration + draft CreativeRun are exercised without the LLM.
// Run: DATABASE_URL=... npx tsx scripts/m1c-router.ts   (needs seeded recipes; exits 1 on fail)
import { prisma } from "@/lib/prisma";
import {
  selectRecipe, gapCheck, REQUIRED_FIELDS, runIntake,
  type ClassifyResult, type IntakeDeps,
} from "@/lib/router";
import { StudioError } from "@/lib/studio-error";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

async function expectStudioError(name: string, status: number, fn: () => Promise<unknown>) {
  try { await fn(); ok(`${name} (expected StudioError ${status})`, false); }
  catch (e) { ok(name, e instanceof StudioError && e.status === status); }
}

// Build injectable deps with a fixed classification + no-op ingest.
function deps(classification: ClassifyResult["classification"], ingestOverride?: IntakeDeps["ingest"]): IntakeDeps {
  return {
    classify: async () => ({ classification, usage: { model: "gpt-4o", inputTokens: 10, outputTokens: 10 } }),
    ingest: ingestOverride ?? (async () => ({ extraText: "", images: [], skipped: [] })),
  };
}
const cls = (over: Partial<ClassifyResult["classification"]>): ClassifyResult["classification"] => ({
  taskType: "poster", intent: "test intent", confidence: 0.9, suggestedLens: null, extracted: {}, questions: {}, ...over,
});

async function main() {
  const runIds: string[] = [];
  let userId = "";

  try {
    // ── Part A: deterministic core ──
    const pomkt = await selectRecipe("poster", "marketing");
    ok("poster+marketing → poster recipe", !!pomkt && pomkt.taskType === "poster" && pomkt.outputFormat === "image");
    ok("poster+social → poster recipe", !!(await selectRecipe("poster", "social")));
    ok("marketing_plan+social → null (lens-incompatible)", (await selectRecipe("marketing_plan", "social")) === null);
    ok("unknown taskType → null", (await selectRecipe("does_not_exist", "marketing")) === null);

    ok("poster required fields", sameSet(REQUIRED_FIELDS.poster, ["objective", "platform", "key_message"]));
    ok("marketing_plan required fields", sameSet(REQUIRED_FIELDS.marketing_plan, ["objective", "audience", "timeframe"]));

    const ctx = { taskType: "poster", lens: "marketing" as const, brandSlug: "nakngaji" };
    ok("poster missing key_message → one gap",
      sameSet((await gapCheck("poster", { objective: "x", platform: "IG" }, ctx)).map((g) => g.field), ["key_message"]));
    ok("poster complete → no gaps",
      (await gapCheck("poster", { objective: "x", platform: "IG", key_message: "y" }, ctx)).length === 0);
    ok("marketing_plan missing audience+timeframe",
      sameSet((await gapCheck("marketing_plan", { objective: "x" }, { ...ctx, taskType: "marketing_plan" })).map((g) => g.field), ["audience", "timeframe"]));

    // ── Part B: runIntake orchestration + persistence ──
    const tag = "zztest_studio_" + Math.floor(Math.random() * 1e9);
    const u = await prisma.user.create({
      data: { email: `${tag}@example.test`, username: tag, name: "Studio Tester", password: "x", teamRole: "marketing", team: "single" },
    });
    userId = u.id;
    const mktUser = { id: u.id, teamRole: "marketing", team: "single" }; // lens → marketing

    // B1 — confident + complete → recipe matched, no gaps, draft persisted
    const r1 = await runIntake(mktUser, { brandSlug: "nakngaji", text: "promo" },
      deps(cls({ taskType: "poster", confidence: 0.95, intent: "promo poster", extracted: { objective: "promo", platform: "IG", key_message: "daftar" } })));
    runIds.push(r1.runId);
    ok("B1 recipe matched (poster)", r1.recipe?.taskType === "poster");
    ok("B1 no gaps (complete)", r1.gaps.length === 0);
    ok("B1 lens resolved marketing", r1.lens === "marketing");
    const run1 = await prisma.creativeRun.findUnique({ where: { id: r1.runId } });
    ok("B1 draft persisted", run1?.status === "draft" && run1?.recipeId === r1.recipe?.id && run1?.lens === "marketing");
    ok("B1 spec persisted from extracted", JSON.stringify(run1?.spec)?.includes("daftar") === true);
    ok("B1 inputText persisted", run1?.inputText === "promo" && run1?.feature === "poster");

    // B2 — confident but missing a required field → gap returned (LLM-drafted question via questions map)
    const r2 = await runIntake(mktUser, { brandSlug: "nakngaji", text: "promo" },
      deps(cls({ taskType: "poster", confidence: 0.9, extracted: { objective: "promo", platform: "IG" }, questions: { key_message: "Apa mesej utama?" } })));
    runIds.push(r2.runId);
    ok("B2 gap on key_message", sameSet(r2.gaps.map((g) => g.field), ["key_message"]));
    ok("B2 gap question from classify questions", r2.gaps[0]?.question === "Apa mesej utama?");
    ok("B2 recipe still matched", r2.recipe?.taskType === "poster");

    // B3 — low confidence → clarification, recipe null, run persisted with recipeId null
    const r3 = await runIntake(mktUser, { brandSlug: "nakngaji", text: "buat sesuatu" },
      deps(cls({ taskType: "poster", confidence: 0.3, questions: { task_type: "Nak buat apa?" } })));
    runIds.push(r3.runId);
    ok("B3 recipe null (low confidence)", r3.recipe === null);
    ok("B3 task_type clarification gap", r3.gaps[0]?.field === "task_type" && r3.gaps[0]?.question === "Nak buat apa?");
    const run3 = await prisma.creativeRun.findUnique({ where: { id: r3.runId } });
    ok("B3 draft persisted with recipeId null", run3?.status === "draft" && run3?.recipeId === null);

    // B4 — lens-incompatible recipe → clarification (creative single user → social lens, marketing_plan serves marketing only)
    const creativeUser = { id: u.id, teamRole: "creative", team: "single" }; // lens → social
    const r4 = await runIntake(creativeUser, { brandSlug: "nakngaji", text: "rangka plan" },
      deps(cls({ taskType: "marketing_plan", confidence: 0.95, extracted: { objective: "x", audience: "y", timeframe: "z" } })));
    runIds.push(r4.runId);
    ok("B4 lens social, recipe null (marketing_plan lens-incompat)", r4.lens === "social" && r4.recipe === null);
    ok("B4 clarification gap", r4.gaps[0]?.field === "clarification");

    // B5 — empty input (no text, ingest empty) → 400
    await expectStudioError("B5 empty input → 400", 400, () =>
      runIntake(mktUser, { brandSlug: "nakngaji" }, deps(cls({}))));

    // B6 — invalid explicit lens (multi user) → 400
    await expectStudioError("B6 invalid explicit lens → 400", 400, () =>
      runIntake({ id: u.id, teamRole: "marketing", team: "multi" }, { brandSlug: "nakngaji", text: "x", explicitLens: "boss" }, deps(cls({}))));

    // B7 — notices when an attachment is skipped
    const r7 = await runIntake(mktUser, { brandSlug: "nakngaji", text: "promo", uploads: ["/x/bad.zip"] },
      deps(cls({ extracted: { objective: "o", platform: "p", key_message: "k" } }),
        async () => ({ extraText: "", images: [], skipped: ["/x/bad.zip"] })));
    runIds.push(r7.runId);
    ok("B7 notices on skipped upload", (r7.notices?.length ?? 0) === 1);
  } finally {
    if (runIds.length) {
      await prisma.aPIUsageLog.deleteMany({ where: { featureRunId: { in: runIds } } }).catch(() => {});
      await prisma.creativeRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {});
    }
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { username: { startsWith: "zztest_studio_" } } }).catch(() => {});
  }

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
