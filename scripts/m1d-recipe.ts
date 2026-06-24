// Module 1 Phase D — Prompt 3 checks: the recipe engine (DB-backed, INJECTED fake LLM).
// Exercises the full step loop / artifacts / guardian QA / retry / generic recipes
// without OpenAI. Run: DATABASE_URL=... npx tsx scripts/m1d-recipe.ts   (needs seed-m1).
import { prisma } from "@/lib/prisma";
import { runRecipe, type RunInput } from "@/lib/recipe-run";
import type { ExpertCall } from "@/lib/expert";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };
const types = (a: { type: string }[]) => a.map((x) => x.type).join(",");

// Fake LLM: guardian calls are detected by the verdict-JSON instruction in the system
// prompt. `verdict` controls what the guardian returns. Counts producing vs guardian calls.
function fakeCall(verdict: "pass" | "retry"): { call: ExpertCall; counts: { producing: number; guardian: number } } {
  const counts = { producing: 0, guardian: 0 };
  const call: ExpertCall = async ({ system }) => {
    const isGuardian = /"verdict"/.test(system);
    if (isGuardian) {
      counts.guardian++;
      // tokens large enough that per-row costMyr rounds above 0.00 (sumRunCostMyr sums rounded rows)
      return { text: JSON.stringify({ verdict, reasons: verdict === "retry" ? ["tone too aggressive"] : [] }), usage: { model: "gpt-4o", inputTokens: 1000, outputTokens: 1000 } };
    }
    counts.producing++;
    return { text: `output #${counts.producing}`, usage: { model: "gpt-4o", inputTokens: 1000, outputTokens: 1000 } };
  };
  return { call, counts };
}

async function seedDraftRun(userId: string, brandSlug: string, taskType: string, spec: Record<string, string>): Promise<RunInput> {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: brandSlug } });
  const recipe = await prisma.recipe.findFirstOrThrow({ where: { taskType } });
  const run = await prisma.creativeRun.create({
    data: {
      userId, brandId: brand.id, recipeId: recipe.id, feature: taskType, lens: "marketing",
      inputText: "test brief", spec, status: "draft", outputJson: "{}",
    },
    select: { id: true },
  });
  return { id: run.id, brandId: brand.id, brandSlug, recipeId: recipe.id, lens: "marketing", spec, feature: taskType, userId };
}

async function main() {
  const created: string[] = [];
  const user = await prisma.user.create({
    data: { email: `m1d_${Date.now()}@test.local`, username: `m1d_${Date.now()}`, password: "x", name: "M1D Test", teamRole: "creative", team: "all" },
    select: { id: true },
  });

  try {
    const posterSpec = { objective: "drive signups", platform: "Instagram", key_message: "belajar dengan sifu" };

    // ── Case 1: poster recipe, guardian pass ──
    const r1 = await seedDraftRun(user.id, "sifututor", "poster", posterSpec);
    created.push(r1.id);
    const f1 = fakeCall("pass");
    const res1 = await runRecipe(r1, { callExpert: f1.call });
    ok("poster: status generated", res1.status === "generated");
    ok("poster: 4 producing artifacts", res1.artifacts.length === 4);
    ok("poster: artifact order strategy,copy,visual_direction,social", types(res1.artifacts) === "strategy,copy,visual_direction,social");
    ok("poster: guardian verdict pass", res1.guardian.verdict === "pass");
    ok("poster: guardian called once", f1.counts.guardian === 1);
    ok("poster: 4 producing calls", f1.counts.producing === 4);
    ok("poster: cost logged (>0)", res1.costMyr > 0);

    // contextUsed persisted
    const run1 = await prisma.creativeRun.findUniqueOrThrow({ where: { id: r1.id }, select: { contextUsed: true, status: true } });
    const ctx = run1.contextUsed as { guardian?: { verdict?: string }; grounding?: { brandId?: string } } | null;
    ok("poster: contextUsed.guardian recorded", ctx?.guardian?.verdict === "pass");
    ok("poster: contextUsed.grounding recorded", !!ctx?.grounding?.brandId);
    // per-expert usage rows
    const usageCount = await prisma.aPIUsageLog.count({ where: { featureRunId: r1.id, module: "expert" } });
    ok("poster: 5 expert usage rows (4 producing + guardian)", usageCount === 5);

    // ── Case 2: idempotent re-run (no dupes) ──
    const f1b = fakeCall("pass");
    const res1b = await runRecipe(r1, { callExpert: f1b.call });
    ok("re-run: still 4 artifacts (deleted+recreated)", res1b.artifacts.length === 4);
    const dbCount = await prisma.artifact.count({ where: { runId: r1.id } });
    ok("re-run: DB has exactly 4 artifacts (no dupes)", dbCount === 4);

    // ── Case 3: guardian retry → producing steps run twice, then accept ──
    const r3 = await seedDraftRun(user.id, "sifututor", "poster", posterSpec);
    created.push(r3.id);
    const f3 = fakeCall("retry");
    const res3 = await runRecipe(r3, { callExpert: f3.call });
    ok("retry: producing ran twice (8 calls)", f3.counts.producing === 8);
    ok("retry: guardian called once", f3.counts.guardian === 1);
    ok("retry: marked retried", res3.guardian.retried === true);
    ok("retry: accepted → status generated", res3.status === "generated");
    ok("retry: final still 4 artifacts", res3.artifacts.length === 4);

    // ── Case 4: caption recipe is generic (copywriter + guardian) → 1 copy artifact ──
    const r4 = await seedDraftRun(user.id, "sifututor", "caption", { objective: "engage", platform: "IG", key_message: "mula mengaji" });
    created.push(r4.id);
    const f4 = fakeCall("pass");
    const res4 = await runRecipe(r4, { callExpert: f4.call });
    ok("caption: 1 producing artifact", res4.artifacts.length === 1);
    ok("caption: artifact type is copy", types(res4.artifacts) === "copy");
    ok("caption: guardian still ran", f4.counts.guardian === 1);
  } finally {
    // cleanup
    if (created.length) {
      await prisma.aPIUsageLog.deleteMany({ where: { featureRunId: { in: created } } });
      await prisma.artifact.deleteMany({ where: { runId: { in: created } } });
      await prisma.creativeRun.deleteMany({ where: { id: { in: created } } });
    }
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
