// Live E2E smoke test for the visual-intake pipeline (Phase 1 poster):
//   planSpec (gpt-5) → FeatureRun draft → runVisualJob (gpt-image-2 render +
//   brand logo/footer overlay + persist + cost rollup).
// Exercises real OpenAI calls. Run: npx tsx scripts/live-poster-e2e.mts
process.loadEnvFile(".env.local");

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { getBrandContext } = await import("../src/lib/brand-context");
  const { planSpec } = await import("../src/lib/visual");
  const { runVisualJob } = await import("../src/lib/visual-job");
  const { logUsage } = await import("../src/lib/usage");
  const { access } = await import("node:fs/promises");
  const path = await import("node:path");

  // Owner for the run (any user; runVisualJob is ownership-scoped to this id).
  const user = await prisma.user.findFirst({ where: { OR: [{ isAdmin: true }, { teamRole: "creative" }] } })
    ?? await prisma.user.findFirst();
  if (!user) throw new Error("No user in DB — create one (scripts/create-admin.ts).");
  console.log("owner user:", user.email ?? user.id);

  const brand = await getBrandContext("sifututor");
  if (!brand) throw new Error("Brand sifututor not found — seed the DB.");
  console.log("brand furniture:");
  console.log("   logo  :", brand.logoPath ?? "(none — logo overlay will be skipped)");
  console.log("   footerL:", brand.footerLeft ?? "(none)");
  console.log("   footerR:", brand.footerRight ?? "(none)");

  const brief = "Poster commercial SifuTutor, angle cuti sekolah, untuk IG Story, audiens ibu bapa & pelajar sekolah. Objektif: Pendaftaran.";
  console.log("\nBRIEF:", brief, "\n→ planSpec (gpt-5)…");
  const { spec, usage } = await planSpec({ brief, brand, outputTypeId: "poster" });
  console.log("✓ SPEC:", { angle: spec.angle, headline: spec.headline, accent: spec.accent, cta: spec.cta, ratio: spec.ratio, style: spec.style, mood: spec.mood });

  const run = await prisma.creativeRun.create({
    data: {
      userId: user.id,
      brandId: brand.id,
      feature: "generate",
      subtype: "Poster",
      inputJson: JSON.stringify({ brandSlug: "sifututor", brandId: brand.id, contentType: "Poster", visualSpec: spec }),
      outputJson: "{}",
      status: "draft",
    },
  });
  console.log("\n✓ draft run created:", run.id);

  await logUsage({
    userId: user.id, brandId: brand.id, featureRunId: run.id,
    module: "visual", model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
  });

  console.log("→ runVisualJob (gpt-image-2 render + overlay)… this takes ~15–40s");
  const t0 = Date.now();
  const result = await runVisualJob({ featureRunId: run.id, userId: user.id });
  console.log(`\n✓ runVisualJob done in ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log("result:", JSON.stringify(result, null, 2));

  if (!result.ok || !("image" in result)) throw new Error("Generation did not produce an image — see result above.");

  const abs = path.join(process.cwd(), "public", result.image.urlPath.replace(/^\/+/, ""));
  await access(abs);
  const fresh = await prisma.creativeRun.findUnique({ where: { id: run.id }, select: { status: true, outputJson: true } });
  console.log("\n✓ image on disk:", abs);
  console.log("✓ run status   :", fresh?.status, "(expected: generated)");
  console.log("✓ costMyr      : RM", result.costMyr);
  console.log("\nOpen the poster to eyeball headline/accent/CTA + logo top-left + footer bar:");
  console.log("  ", abs);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("\n✗ FAILED:", e); process.exit(1); });
