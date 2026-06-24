// End-to-end smoke for Module 1 Phase C (OPENAI-gated — skips without a key).
// Runs the FULL runIntake pipeline (live classify + persistence) for the 2 roadmap
// acceptance briefs and prints the StudioResponse. Cleans up the draft runs it creates.
// Run: DATABASE_URL=... OPENAI_API_KEY=... npx tsx scripts/m1c-smoke.ts
import { prisma } from "@/lib/prisma";
import { runIntake } from "@/lib/router";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("SKIP — no OPENAI_API_KEY (smoke is LLM-gated)");
    process.exit(0);
  }

  const tag = "zztest_smoke_" + Math.floor(Math.random() * 1e9);
  const u = await prisma.user.create({
    data: { email: `${tag}@example.test`, username: tag, name: "Smoke Tester", password: "x", teamRole: "marketing", team: "all" },
  });
  const user = { id: u.id, teamRole: "marketing", team: "all" };
  const runIds: string[] = [];

  try {
    const r1 = await runIntake(user, { brandSlug: "nakngaji", text: "Ad poster untuk promo kelas mengaji online, target parents, untuk IG" });
    runIds.push(r1.runId);
    console.log("ACCEPTANCE #1 (poster):");
    console.log(JSON.stringify(r1, null, 2));

    const r2 = await runIntake(user, { brandSlug: "sifututor", text: "Tolong rangka marketing plan untuk back-to-school campaign, sasaran ibu bapa murid sekolah rendah, untuk 6 minggu sebelum sesi persekolahan" });
    runIds.push(r2.runId);
    console.log("\nACCEPTANCE #2 (marketing_plan):");
    console.log(JSON.stringify(r2, null, 2));

    const okShape =
      r1.taskType === "poster" && r1.recipe?.taskType === "poster" &&
      r2.taskType === "marketing_plan" && r2.recipe?.taskType === "marketing_plan";
    console.log(`\n${okShape ? "SMOKE PASS — both shapes match the roadmap acceptance" : "SMOKE FAIL — shapes did not match"}`);
    process.exitCode = okShape ? 0 : 1;
  } finally {
    if (runIds.length) {
      await prisma.aPIUsageLog.deleteMany({ where: { featureRunId: { in: runIds } } }).catch(() => {});
      await prisma.creativeRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {});
    }
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
