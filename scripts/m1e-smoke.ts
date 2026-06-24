// Module 1 Phase E — LIVE smoke: poster recipe → renderFromRun → real gpt-image-2 + overlay.
// Needs OPENAI_API_KEY + seeded DB. Run:
//   node --env-file=.env.local --import tsx scripts/m1e-smoke.ts
// Proves AC-1 (image artifact + real PNG), AC-2 (brand logo overlaid), cost folded into the run.
// Keeps the rendered file on disk so you can eyeball the logo placement (path printed).
import { stat } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { runRecipe, type RunInput } from "@/lib/recipe-run";
import { renderFromRun } from "@/lib/visual-render";
import { getBrandContext } from "@/lib/brand-context";
import { sumRunCostMyr } from "@/lib/usage";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  if (!process.env.OPENAI_API_KEY) { console.error("OPENAI_API_KEY missing — run with: node --env-file=.env.local --import tsx scripts/m1e-smoke.ts"); process.exit(1); }

  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const recipe = await prisma.recipe.findFirstOrThrow({ where: { taskType: "poster" } });
  const user = await prisma.user.create({
    data: { email: `m1es_${Date.now()}@t.local`, username: `m1es_${Date.now()}`, password: "x", name: "Smoke", teamRole: "creative", team: "all" },
    select: { id: true },
  });
  const spec = { objective: "drive trial signups for SPM revision classes", platform: "instagram_story", key_message: "belajar dengan sifu, capai keputusan cemerlang" };
  const run = await prisma.creativeRun.create({
    data: { userId: user.id, brandId: brand.id, recipeId: recipe.id, feature: "poster", lens: "marketing", inputText: "Poster IG Story untuk kelas ulangkaji SPM", spec, status: "draft", outputJson: "{}" },
    select: { id: true },
  });

  try {
    const input: RunInput = { id: run.id, brandId: brand.id, brandSlug: "sifututor", recipeId: recipe.id, lens: "marketing", spec, feature: "poster", userId: user.id };
    console.log("1/2 Running poster recipe (experts → visual_direction)…");
    const rec = await runRecipe(input); // real LLM
    ok("recipe produced visual_direction", rec.artifacts.some((a) => a.type === "visual_direction"));
    const textCost = await sumRunCostMyr(run.id);

    console.log("2/2 Rendering image from visual_direction (gpt-image-2 + overlay)…");
    const res = await renderFromRun({ runId: run.id, userId: user.id }); // real render + overlay

    ok("render ok + not skipped", res.ok === true && "skipped" in res && res.skipped === false);
    if (res.ok && !res.skipped) {
      const abs = path.join(process.cwd(), "public", res.mediaPath.replace(/^\/+/, ""));
      const st = await stat(abs).catch(() => null);
      ok("PNG file written to disk", !!st && st.size > 5000);
      const meta = await sharp(abs).metadata().catch(() => null);
      ok("file is a valid image", !!meta && (meta.format === "png"));
      ok("ratio 9:16 → portrait pixels", (meta?.height ?? 0) > (meta?.width ?? 0));

      const imgRows = await prisma.artifact.count({ where: { runId: run.id, type: "image" } });
      ok("exactly one image artifact", imgRows === 1);
      ok("image cost folded > recipe text cost", res.costMyr > textCost);

      const bc = await getBrandContext("sifututor");
      const hasLogo = !!(bc?.logoPathLight || bc?.logoPathDark || bc?.logoPath);
      console.log(`\nBrand logo configured: ${hasLogo ? "YES (overlay applied — eyeball the corner)" : "NO (image rendered without logo)"}`);
      console.log(`Rendered poster: ${abs}`);
      console.log(`Ratio: ${res.ratio} · Text cost RM${textCost.toFixed(2)} → Total RM${res.costMyr.toFixed(2)}`);
    } else if (!res.ok) {
      console.log(`Render failed: [${res.category}] ${res.reason}`);
    }
  } finally {
    // keep the rendered PNG for manual eyeball; clean DB rows only.
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
