// Validate the brand-furniture overlay (P7) + settings (P8) on a real rendered
// poster — no new image-gen cost. Configures SifuTutor footers + a placeholder
// logo, then stamps the most recent generated poster.
// Run: npx tsx scripts/test-overlay-live.mts <renderedPosterPath>
process.loadEnvFile(".env.local");

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { applyBrandOverlay } = await import("../src/lib/visual-overlay");
  const sharp = (await import("sharp")).default;
  const { readFile, writeFile, mkdir } = await import("node:fs/promises");
  const path = await import("node:path");

  const src = process.argv[2];
  if (!src) throw new Error("Pass the rendered poster path as arg 1.");

  // 1) Make a placeholder transparent-PNG logo (white pill wordmark) + persist furniture.
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120">
    <rect x="0" y="0" width="420" height="120" rx="26" fill="#ffffff"/>
    <text x="210" y="78" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="800" fill="#2747DB">SifuTutor</text>
  </svg>`;
  const logoBuf = await sharp(Buffer.from(logoSvg)).png().toBuffer();
  const brandDir = path.join(process.cwd(), "public", "uploads", "brand");
  await mkdir(brandDir, { recursive: true });
  const logoUrl = "/uploads/brand/sifututor-logo.png";
  await writeFile(path.join(process.cwd(), "public", logoUrl.replace(/^\/+/, "")), logoBuf);

  await prisma.brand.update({
    where: { slug: "sifututor" },
    data: { logoUrl, posterFooterLeft: "© 2026 SifuTutor", posterFooterRight: "www.sifututor.com" },
  });
  console.log("✓ furniture set: logo", logoUrl, "+ footers");

  // 2) Stamp the rendered poster.
  const stamped = await applyBrandOverlay(await readFile(src), {
    logoPath: logoUrl, footerLeft: "© 2026 SifuTutor", footerRight: "www.sifututor.com",
  });
  const out = path.join(path.dirname(src), "overlay-test.png");
  await writeFile(out, stamped);
  console.log("✓ stamped poster:", out);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("\n✗ FAILED:", e); process.exit(1); });
