// Module 1 Phase G — Prompt 4 checks: applyAnswers gap-answer merge (DB-backed, NO OpenAI).
//   field-gap fill → gaps clear · partial fill re-surfaces · task_type re-pick re-selects recipe
//   · clarification when no recipe · owner scope (403) · draft guard (409).
// Run: DATABASE_URL=... npx tsx scripts/m1g-answers.ts
import { prisma } from "@/lib/prisma";
import { applyAnswers } from "@/lib/studio-answers";
import { StudioError } from "@/lib/studio-error";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function seedDraft(userId: string, brandId: string, feature: string, recipeId: string | null, spec: Record<string, string> = {}): Promise<string> {
  const run = await prisma.creativeRun.create({
    data: { userId, brandId, feature, recipeId, lens: "marketing", title: "G answers", inputText: "b", spec, status: "draft", outputJson: "{}" },
    select: { id: true },
  });
  return run.id;
}

async function expectStudioError(fn: () => Promise<unknown>, status: number, label: string) {
  try { await fn(); ok(label, false); }
  catch (e) { ok(label, e instanceof StudioError && e.status === status); }
}

async function main() {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const poster = await prisma.recipe.findFirstOrThrow({ where: { taskType: "poster" } });
  const ts = Date.now();
  const u1 = await prisma.user.create({ data: { email: `m1ga_a_${ts}@t.local`, username: `m1ga_a_${ts}`, password: "x", name: "A", teamRole: "marketing", team: "all" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `m1ga_b_${ts}@t.local`, username: `m1ga_b_${ts}`, password: "x", name: "B", teamRole: "marketing", team: "all" }, select: { id: true } });
  const runIds: string[] = [];

  try {
    // ── field-gap fill clears the gaps ──
    const r1 = await seedDraft(u1.id, brand.id, "poster", poster.id, {}); runIds.push(r1);
    const partial = await applyAnswers({ id: u1.id }, r1, { answers: { objective: "trial signups" } });
    ok("partial fill leaves remaining required gaps", partial.gaps.length === 2 && partial.gaps.every((g) => g.required));
    ok("partial fill keeps poster recipe", partial.recipe?.taskType === "poster");
    const full = await applyAnswers({ id: u1.id }, r1, { answers: { platform: "Instagram", key_message: "Daftar sekarang" } });
    ok("full fill clears all gaps", full.gaps.length === 0);
    ok("result.spec carries merged answers (for the summary)", full.spec.objective === "trial signups" && full.spec.platform === "Instagram" && full.spec.key_message === "Daftar sekarang");
    const persisted = await prisma.creativeRun.findUniqueOrThrow({ where: { id: r1 }, select: { spec: true } });
    ok("answers persisted to spec (merged across calls)", (persisted.spec as Record<string, string>).objective === "trial signups" && (persisted.spec as Record<string, string>).platform === "Instagram");

    // ── task_type re-pick re-selects the recipe ──
    const r2 = await seedDraft(u1.id, brand.id, "unknown", null, {}); runIds.push(r2);
    const picked = await applyAnswers({ id: u1.id }, r2, { taskType: "poster" });
    ok("task_type re-pick selects poster recipe", picked.recipe?.taskType === "poster" && picked.taskType === "poster");
    ok("re-pick surfaces the new recipe's field gaps", picked.gaps.length === 3 && picked.gaps.every((g) => !["task_type", "clarification"].includes(g.field)));

    // ── clarification when the task type has no recipe ──
    const r3 = await seedDraft(u1.id, brand.id, "unknown", null, {}); runIds.push(r3);
    const clar = await applyAnswers({ id: u1.id }, r3, { taskType: "no_such_task" });
    ok("no recipe → single clarification gap", clar.recipe === null && clar.gaps.length === 1 && clar.gaps[0].field === "clarification");

    // ── owner scope + draft guard ──
    const r4 = await seedDraft(u1.id, brand.id, "poster", poster.id, {}); runIds.push(r4);
    await expectStudioError(() => applyAnswers({ id: u2.id }, r4, { answers: { objective: "x" } }), 403, "owner-scoped (non-owner → 403)");
    await expectStudioError(() => applyAnswers({ id: u1.id }, "no-such-run", {}), 404, "missing run → 404");

    const r5 = await prisma.creativeRun.create({ data: { userId: u1.id, brandId: brand.id, feature: "poster", recipeId: poster.id, lens: "marketing", title: "done", inputText: "b", spec: {}, status: "generated", outputJson: "{}" }, select: { id: true } });
    runIds.push(r5.id);
    await expectStudioError(() => applyAnswers({ id: u1.id }, r5.id, { answers: { objective: "x" } }), 409, "non-draft run → 409 (only drafts editable)");
  } finally {
    if (runIds.length) await prisma.creativeRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
