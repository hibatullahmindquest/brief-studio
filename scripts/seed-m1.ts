/**
 * Module 1 Phase A — data-model seed.
 * Idempotent: upserts the two brands (enriched), the five base experts, and the
 * three base recipes. Safe to re-run.
 *
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" \
 *     npx tsx scripts/seed-m1.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Brands (enriched with Module 1 knowledge) ───────────────────────────────
const BRANDS = [
  {
    slug: "sifututor",
    name: "SifuTutor",
    tagline: "Belajar dengan sifu, capai keputusan cemerlang.",
    contentPillars: ["exam tips", "study motivation", "subject mastery", "parent trust"],
    audienceSegments: ["pelajar sekolah menengah", "ibu bapa", "guru tuisyen"],
    doNot: ["janji markah palsu", "rendahkan sekolah lain", "bahasa kasar"],
    signaturePhrases: ["Belajar dengan sifu", "Cemerlang itu satu tabiat"],
    religiousGuidelines: "",
    colors: ["#3b4ee2", "#fd8549"],
    fonts: ["Poppins"],
  },
  {
    slug: "nakngaji",
    name: "NakNgaji",
    tagline: "Mula mengaji, bila-bila masa, di mana-mana.",
    contentPillars: ["belajar al-Quran", "tajwid", "kisah inspirasi", "rutin harian Muslim"],
    audienceSegments: ["dewasa baru belajar mengaji", "ibu bapa untuk anak", "muallaf"],
    doNot: ["sentuh isu khilaf mazhab", "gambar tidak menutup aurat", "nada paksaan/ugutan"],
    signaturePhrases: ["Mula mengaji hari ini", "Tak pernah terlambat untuk belajar"],
    religiousGuidelines:
      "Patuh adab Islam: elak imej bernyawa yang tidak sesuai, jaga aurat, gunakan bahasa hormat untuk perkara agama, elak isu khilaf.",
    colors: ["#0e7c7b", "#fd8549"],
    fonts: ["Poppins"],
  },
];

// ── Base experts (admin-editable system prompts) ────────────────────────────
const EXPERTS = [
  {
    roleKey: "strategist",
    name: "Strategist",
    modelTier: "standard",
    systemPrompt:
      "You are a marketing strategist. Given the brief, brand knowledge, and lens, define the core angle, key message, audience insight, and the single most important takeaway. Output a tight strategic brief the rest of the team will build on.",
  },
  {
    roleKey: "copywriter",
    name: "Copywriter",
    modelTier: "standard",
    systemPrompt:
      "You are a senior copywriter. Using the strategist's angle and the brand voice, write the headline, body copy, and a clear call-to-action. Match the brand's signature phrases and tone. Never use anything from the brand's do-not list.",
  },
  {
    roleKey: "art_director",
    name: "Art Director",
    modelTier: "standard",
    systemPrompt:
      "You are an art director. Translate the copy and strategy into a concrete visual direction: composition, subject, mood, colour usage (from the brand palette), and layout notes for the image generator. Keep it on-brand and platform-appropriate.",
  },
  {
    roleKey: "social",
    name: "Social Media Expert",
    modelTier: "fast",
    systemPrompt:
      "You are a social media expert. Adapt the output for the target platform: caption framing, hashtag set, posting hook, and CTA softness appropriate to the lens (paid vs organic vs memo).",
  },
  {
    roleKey: "brand_guardian",
    name: "Brand Guardian",
    modelTier: "standard",
    systemPrompt:
      "You are the Brand Guardian (QA). Review the full output against the brand's do-not list, tone, and religious guidelines. Return pass / flag / retry with specific reasons. Block anything that violates the guidelines.",
  },
];

// ── Base recipes (ordered expert lineups) ───────────────────────────────────
const RECIPES = [
  {
    taskType: "poster",
    group: "creative",
    outputFormat: "image",
    lenses: ["marketing", "social"],
    steps: [
      { roleKey: "strategist" },
      { roleKey: "copywriter" },
      { roleKey: "art_director" },
      { roleKey: "social" },
      { roleKey: "brand_guardian" },
    ],
  },
  {
    taskType: "caption",
    group: "copy",
    outputFormat: "text",
    lenses: ["social", "marketing"],
    steps: [{ roleKey: "copywriter" }, { roleKey: "brand_guardian" }],
  },
  {
    taskType: "marketing_plan",
    group: "strategy",
    outputFormat: "pdf",
    lenses: ["marketing"],
    steps: [
      { roleKey: "strategist" },
      { roleKey: "copywriter" },
      { roleKey: "brand_guardian" },
    ],
  },
];

async function main() {
  for (const b of BRANDS) {
    const { slug, name, ...enrich } = b;
    await prisma.brand.upsert({
      where: { slug },
      update: enrich, // only fills the new M1 knowledge fields (added empty by migration)
      create: { slug, name, ...enrich },
    });
    console.log(`✔ brand ${slug}`);
  }

  for (const e of EXPERTS) {
    const { roleKey, ...rest } = e;
    await prisma.expert.upsert({
      where: { roleKey },
      update: rest,
      create: { roleKey, ...rest },
    });
    console.log(`✔ expert ${roleKey}`);
  }

  for (const r of RECIPES) {
    const { taskType, ...rest } = r;
    await prisma.recipe.upsert({
      where: { taskType },
      update: rest,
      create: { taskType, ...rest },
    });
    console.log(`✔ recipe ${taskType}`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
