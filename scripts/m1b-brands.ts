// Integration checks for Module 1 Phase B — Brands enriched admin update (lib layer).
// Exercises enriched-knowledge persistence, array trim/dedupe/blank-drop, hex colour
// validation, that the existing overlay fields still work, plus slug guards.
// Run: DATABASE_URL=... npx tsx scripts/m1b-brands.ts   (exits 1 on any failure)
// Uses a throwaway brand row (zztest-*) so real brands are never mutated.
import { prisma } from "@/lib/prisma";
import { AdminError } from "@/lib/admin/errors";
import { updateBrand } from "@/lib/admin/brands";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function expectAdminError(name: string, status: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(`${name} (expected AdminError ${status})`, false);
  } catch (e) {
    ok(name, e instanceof AdminError && e.status === status);
  }
}

async function main() {
  const rand = Math.floor(Math.random() * 1e9);
  const slug = `zztest-brand-${rand}`;
  const name = `zztest_brand_${rand}`;
  let brandId = "";

  try {
    const brand = await prisma.brand.create({ data: { name, slug } });
    brandId = brand.id;

    // enriched arrays persist + trimmed/deduped/blanks dropped
    const updated = await updateBrand({
      slug,
      contentPillars: [" Tuisyen ", "Tuisyen", "Peperiksaan", "  "],
      audienceSegments: ["Ibu bapa", "Pelajar"],
      doNot: ["Jangan janji A+", " Jangan janji A+ "],
      signaturePhrases: ["Belajar tanpa stress"],
      fonts: ["Poppins", "Poppins", "Inter"],
      colors: ["#3B4EE2", "#3b4ee2", "#FD8549", "  "],
      religiousGuidelines: "  Patuh syariah  ",
      footer: "  www.sifututor.com  ",
      logoPath: " /uploads/brand/x.png ",
    });

    ok("contentPillars trimmed + deduped + blanks dropped", JSON.stringify(updated.contentPillars) === JSON.stringify(["Tuisyen", "Peperiksaan"]));
    ok("doNot deduped after trim", JSON.stringify(updated.doNot) === JSON.stringify(["Jangan janji A+"]));
    ok("fonts deduped", JSON.stringify(updated.fonts) === JSON.stringify(["Poppins", "Inter"]));
    ok("colors lowercased + deduped + blanks dropped", JSON.stringify(updated.colors) === JSON.stringify(["#3b4ee2", "#fd8549"]));
    ok("religiousGuidelines trimmed", updated.religiousGuidelines === "Patuh syariah");
    ok("footer trimmed", updated.footer === "www.sifututor.com");
    ok("logoPath trimmed", updated.logoPath === "/uploads/brand/x.png");

    // re-read confirms persistence (not just the returned object)
    const reread = await prisma.brand.findUnique({ where: { slug }, select: { contentPillars: true, colors: true, footer: true } });
    ok("re-read persists arrays", JSON.stringify(reread?.contentPillars) === JSON.stringify(["Tuisyen", "Peperiksaan"]) && JSON.stringify(reread?.colors) === JSON.stringify(["#3b4ee2", "#fd8549"]));

    // empty footer clears to null
    const cleared = await updateBrand({ slug, footer: "   " });
    ok("blank footer clears to null", cleared.footer === null);

    // invalid hex rejected
    await expectAdminError("invalid hex colour -> 400", 400, () => updateBrand({ slug, colors: ["#fff"] }));
    await expectAdminError("non-hex colour -> 400", 400, () => updateBrand({ slug, colors: ["red"] }));
    // non-array for an array field rejected
    await expectAdminError("non-array contentPillars -> 400", 400, () => updateBrand({ slug, contentPillars: "Tuisyen" as unknown }));

    // existing overlay fields still work
    const overlay = await updateBrand({ slug, posterFooterLeft: "© 2026", logoSize: "lg", logoCorner: "tr" });
    ok("overlay fields still update", overlay.posterFooterLeft === "© 2026" && overlay.logoSize === "lg" && overlay.logoCorner === "tr");
    await expectAdminError("invalid logoSize -> 400", 400, () => updateBrand({ slug, logoSize: "huge" }));

    // slug guards
    await expectAdminError("missing slug -> 400", 400, () => updateBrand({ footer: "x" }));
    await expectAdminError("unknown slug -> 404", 404, () => updateBrand({ slug: "zztest-no-such-brand", footer: "x" }));
  } finally {
    if (brandId) await prisma.brand.delete({ where: { id: brandId } }).catch(() => {});
    await prisma.brand.deleteMany({ where: { slug: { startsWith: "zztest-brand-" } } }).catch(() => {});
  }

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
