// Module 1 Phase D — Prompt 6 LIVE smoke: real poster recipe end-to-end via runRecipe.
// Needs OPENAI_API_KEY + seeded DB. Run:
//   node --env-file=.env.local --import tsx scripts/m1d-smoke.ts
// Proves AC-1 (spec+copy artifacts), AC-2 (per-expert cost), AC-3 (guardian verdict).
import { prisma } from "@/lib/prisma";
import { runRecipe, type RunInput } from "@/lib/recipe-run";
import { sumRunCostMyr } from "@/lib/usage";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error("OPENAI_API_KEY missing — run with: node --env-file=.env.local --import tsx scripts/m1d-smoke.ts"); process.exit(1); }

  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const recipe = await prisma.recipe.findFirstOrThrow({ where: { taskType: "poster" } });
  const user = await prisma.user.create({
    data: { email: `m1ds_${Date.now()}@t.local`, username: `m1ds_${Date.now()}`, password: "x", name: "Smoke", teamRole: "creative", team: "all" },
    select: { id: true },
  });
  const spec = { objective: "drive trial signups for SPM revision classes", platform: "Instagram", key_message: "belajar dengan sifu, capai keputusan cemerlang" };
  const run = await prisma.creativeRun.create({
    data: { userId: user.id, brandId: brand.id, recipeId: recipe.id, feature: "poster", lens: "marketing", inputText: "Poster IG untuk kelas ulangkaji SPM", spec, status: "draft", outputJson: "{}" },
    select: { id: true },
  });

  try {
    const input: RunInput = { id: run.id, brandId: brand.id, brandSlug: "sifututor", recipeId: recipe.id, lens: "marketing", spec, feature: "poster", userId: user.id };
    console.log("Running poster recipe live (5 experts)…\n");
    const res = await runRecipe(input); // real defaultExpertCall

    const types = res.artifacts.map((a) => a.type);
    ok("status generated", res.status === "generated");
    ok("has strategy + copy + visual_direction", ["strategy", "copy", "visual_direction"].every((t) => types.includes(t)));
    ok("every artifact has non-empty text", res.artifacts.every((a) => a.content.text.trim().length > 0));
    ok("guardian verdict ∈ pass/flag/retry", ["pass", "flag", "retry"].includes(res.guardian.verdict));
    const cost = await sumRunCostMyr(run.id);
    ok("per-run cost > 0", cost > 0);
    const expertRows = await prisma.aPIUsageLog.count({ where: { featureRunId: run.id, module: "expert" } });
    ok("expert usage rows logged (>=5)", expertRows >= 5);

    console.log("\n── Output preview ──");
    for (const a of res.artifacts) console.log(`\n[${a.type}]\n${a.content.text.slice(0, 400)}`);
    console.log(`\nGuardian: ${res.guardian.verdict}${res.guardian.reasons.length ? " — " + res.guardian.reasons.join("; ") : ""}`);
    console.log(`Total cost: RM${cost.toFixed(2)} · expert calls logged: ${expertRows}`);
  } finally {
    await prisma.aPIUsageLog.deleteMany({ where: { featureRunId: run.id } });
    await prisma.artifact.deleteMany({ where: { runId: run.id } });
    await prisma.creativeRun.delete({ where: { id: run.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
