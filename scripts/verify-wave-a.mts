// Verify Wave A: brand DNA + planSpec (director) + prompt builder + brand overlay.
// One cheap gpt-5 text call; overlay reuses an existing base image (no image-gen cost).
// Run: npx tsx scripts/verify-wave-a.mts
process.loadEnvFile(".env.local");

async function main() {
  const { getBrandContext } = await import("../src/lib/brand-context");
  const { planSpec, buildPosterPromptFromSpec } = await import("../src/lib/visual");
  const { applyBrandOverlay } = await import("../src/lib/visual-overlay");
  const { readFile, writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");

  const brand = await getBrandContext("sifututor");
  if (!brand) throw new Error("brand not found — is the DB seeded + running?");
  console.log("✓ brand DNA present:", brand.visualDna.slice(0, 60) + "…\n");

  const brief = "Poster commercial SifuTutor, angle cuti sekolah, untuk IG Story, audiens ibu bapa & pelajar sekolah.";
  console.log("BRIEF:", brief, "\n→ planSpec (gpt-5)…");
  const { spec, usage } = await planSpec({ brief, brand, outputTypeId: "poster", gaps: "style, mood" });
  console.log("✓ SPEC:");
  console.log("   angle    :", spec.angle);
  console.log("   objective:", spec.objective);
  console.log("   headline :", spec.headline);
  console.log("   accent   :", spec.accent);
  console.log("   cta      :", spec.cta);
  console.log("   style    :", spec.style, "| mood:", spec.mood, "| ratio:", spec.ratio);
  console.log("   styleOpts:", spec.styleOptions.join(", "));
  console.log("   (usage):", usage.model, usage.inputTokens, "in /", usage.outputTokens, "out\n");

  const prompt = buildPosterPromptFromSpec(spec, brand);
  console.log("✓ IMAGE PROMPT (first 240 chars):\n  " + prompt.slice(0, 240) + "…\n");
  const hasHeadline = spec.headline ? prompt.includes(spec.headline) : true;
  const hasReserve = /TOP-LEFT corner empty/.test(prompt) && /VERY BOTTOM empty/.test(prompt);
  console.log("  contains headline:", hasHeadline, "| reserves logo+footer zones:", hasReserve);

  // Overlay test — reuse an existing base image, stamp footer (no logo configured for sifututor).
  const OUT = "C:/claude/temp/verify-wave-a";
  await mkdir(OUT, { recursive: true });
  const baseSrc = "C:/claude/temp/sim-brief/01-base.png";
  try {
    const base = await readFile(baseSrc);
    const stamped = await applyBrandOverlay(base, {
      logoPath: null,
      footerLeft: "© 2025 Sifu & Edu Learning Sdn Bhd",
      footerRight: "Malaysia's leading private tutoring platform",
    });
    await writeFile(path.join(OUT, "overlay-footer.png"), stamped);
    console.log("\n✓ overlay stamped → " + OUT + "/overlay-footer.png");
  } catch (e) {
    console.log("\n(overlay test skipped — base image missing:", (e as Error).message + ")");
  }

  console.log("\nWAVE A VERIFY DONE.");
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
