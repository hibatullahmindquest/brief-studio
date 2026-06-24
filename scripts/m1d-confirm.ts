// Module 1 Phase D — Prompt 5 checks: confirm trigger (DB-backed, no LLM).
// Exercises owner / state / recipe / gap guards + idempotent enqueue via confirmRun.
// Run: DATABASE_URL=... npx tsx scripts/m1d-confirm.ts   (needs seed-m1).
import { prisma } from "@/lib/prisma";
import { confirmRun } from "@/lib/studio-confirm";
import { StudioError } from "@/lib/studio-error";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function expectErr(name: string, status: number, fn: () => Promise<unknown>, extraKey?: string) {
  try { await fn(); ok(`${name} (expected ${status})`, false); }
  catch (e) {
    const isErr = e instanceof StudioError && e.status === status;
    const hasExtra = !extraKey || (e instanceof StudioError && !!e.extra && extraKey in e.extra);
    ok(name, isErr && hasExtra);
  }
}

async function draftPoster(userId: string, spec: Record<string, string>): Promise<string> {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const recipe = await prisma.recipe.findFirstOrThrow({ where: { taskType: "poster" } });
  const run = await prisma.creativeRun.create({
    data: { userId, brandId: brand.id, recipeId: recipe.id, feature: "poster", lens: "marketing", inputText: "t", spec, status: "draft", outputJson: "{}" },
    select: { id: true },
  });
  return run.id;
}

async function main() {
  const runIds: string[] = [];
  const u1 = await prisma.user.create({ data: { email: `m1dc_a_${Date.now()}@t.local`, username: `m1dc_a_${Date.now()}`, password: "x", name: "A", teamRole: "creative", team: "all" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `m1dc_b_${Date.now()}@t.local`, username: `m1dc_b_${Date.now()}`, password: "x", name: "B", teamRole: "creative", team: "all" }, select: { id: true } });
  const fullSpec = { objective: "drive signups", platform: "Instagram", key_message: "belajar dengan sifu" };

  try {
    // (a) complete-spec → enqueues; second call reuses
    const rA = await draftPoster(u1.id, fullSpec); runIds.push(rA);
    const res1 = await confirmRun({ id: u1.id }, rA);
    ok("(a) enqueues → status queued + jobId", res1.status === "queued" && !!res1.jobId && res1.reused === false);
    const res2 = await confirmRun({ id: u1.id }, rA);
    ok("(a) second confirm reuses same job (idempotent)", res2.reused === true && res2.jobId === res1.jobId);

    // (b) missing required field → 409 with gaps, no new job
    const rB = await draftPoster(u1.id, { objective: "x", platform: "IG" }); runIds.push(rB); // key_message missing
    await expectErr("(b) gaps remain → 409 with gaps", 409, () => confirmRun({ id: u1.id }, rB), "gaps");
    const jobsB = await prisma.job.count({ where: { featureRunId: rB } });
    ok("(b) no job enqueued when gaps remain", jobsB === 0);

    // (c) not owner → 403
    const rC = await draftPoster(u1.id, fullSpec); runIds.push(rC);
    await expectErr("(c) non-owner → 403", 403, () => confirmRun({ id: u2.id }, rC));

    // (d) already generated → 409
    const rD = await draftPoster(u1.id, fullSpec); runIds.push(rD);
    await prisma.creativeRun.update({ where: { id: rD }, data: { status: "generated" } });
    await expectErr("(d) already generated → 409", 409, () => confirmRun({ id: u1.id }, rD));

    // (e) missing run → 404
    await expectErr("(e) unknown run → 404", 404, () => confirmRun({ id: u1.id }, "does_not_exist_run_id"));
  } finally {
    if (runIds.length) {
      await prisma.job.deleteMany({ where: { featureRunId: { in: runIds } } });
      await prisma.creativeRun.deleteMany({ where: { id: { in: runIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
