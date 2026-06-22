// Integration checks for the Module 1 Phase A data model against the local dev DB.
// Verifies the seed rows exist and the new relations (CreativeRun↔Recipe,
// CreativeRun↔Artifact, via the @@map'd FeatureRun table) round-trip.
// Run: DATABASE_URL=... npx tsx scripts/m1a-verify.ts   (exits 1 on any failure)
// Prerequisite: run scripts/seed-m1.ts first.
import { prisma } from "@/lib/prisma";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  // 1) Brands seeded + enriched
  const sifu = await prisma.brand.findUnique({ where: { slug: "sifututor" } });
  const nak = await prisma.brand.findUnique({ where: { slug: "nakngaji" } });
  ok("brand sifututor present", !!sifu);
  ok("brand nakngaji present", !!nak);
  ok("nakngaji has religiousGuidelines", !!nak && nak.religiousGuidelines.length > 0);
  ok("brand enrich arrays populated", !!sifu && sifu.contentPillars.length > 0 && sifu.doNot.length > 0);

  // 2) Experts seeded (5 base roles)
  const roles = ["strategist", "copywriter", "art_director", "social", "brand_guardian"];
  const experts = await prisma.expert.findMany({ where: { roleKey: { in: roles } } });
  ok("5 base experts present", experts.length === 5);
  ok("experts have system prompts", experts.every((e) => e.systemPrompt.length > 0));

  // 3) Recipes seeded (3 base task types) with ordered steps
  const poster = await prisma.recipe.findUnique({ where: { taskType: "poster" } });
  const caption = await prisma.recipe.findUnique({ where: { taskType: "caption" } });
  const plan = await prisma.recipe.findUnique({ where: { taskType: "marketing_plan" } });
  ok("recipe poster present", !!poster);
  ok("recipe caption present", !!caption);
  ok("recipe marketing_plan present", !!plan);
  const posterSteps = (poster?.steps as { roleKey: string }[] | undefined) ?? [];
  ok("poster recipe has 5 ordered steps", posterSteps.length === 5 && posterSteps[0].roleKey === "strategist");

  // 4) Relation round-trip: User → CreativeRun (→ Recipe) → Artifact, then cascade delete.
  const tag = "m1test:" + Math.floor(Math.random() * 1e9);
  const user = await prisma.user.create({
    data: { email: `${tag}@test.local`, username: tag, password: "x", name: "M1 Verify" },
  });
  try {
    const run = await prisma.creativeRun.create({
      data: {
        userId: user.id,
        brandId: nak?.id ?? null,
        recipeId: poster?.id ?? null,
        feature: "poster",
        outputJson: "{}",
        lens: "marketing",
        inputText: "verify brief",
        inputUploads: ["a.png", "b.png"],
        intent: "promo poster",
        spec: { headline: "test", platform: "instagram" },
        // contextUsed omitted → stays NULL (Prisma 4 rejects explicit null on Json; use Prisma.DbNull to force)
        artifacts: {
          create: [{ type: "image", content: { url: "/tmp/x.png" }, exportFormat: "png", mediaPath: "/tmp/x.png" }],
        },
      },
      include: { artifacts: true, recipe: true, brand: true },
    });
    ok("CreativeRun writes via @@map FeatureRun table", !!run.id);
    ok("CreativeRun→Recipe relation resolves", run.recipe?.taskType === "poster");
    ok("CreativeRun→Brand relation resolves", run.brand?.slug === "nakngaji");
    ok("CreativeRun→Artifact relation (1 artifact)", run.artifacts.length === 1 && run.artifacts[0].type === "image");
    ok("Json spec round-trips", (run.spec as { headline?: string })?.headline === "test");
    ok("String[] inputUploads round-trips", run.inputUploads.length === 2);

    // cascade delete: removing the run removes its artifacts
    await prisma.creativeRun.delete({ where: { id: run.id } });
    const orphan = await prisma.artifact.count({ where: { runId: run.id } });
    ok("deleting run cascades artifacts", orphan === 0);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
