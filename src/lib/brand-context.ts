import { prisma } from "@/lib/prisma";

export type BrandContext = {
  id: string;
  name: string;
  slug: string;
  tone: string;
  primaryColor: string;
  secondaryColor: string;
  promptBlock: string;
  /** Visual style direction for image generation only (NOT copy). Distilled from the
   *  designer's real posters. Kept separate from promptBlock so it never pollutes copy gen. */
  visualDna: string;
  /** Brand furniture for the post-generation overlay (read at gen time). */
  logoPath?: string | null;       // legacy single logo (fallback)
  logoPathLight?: string | null;  // logo for light backgrounds
  logoPathDark?: string | null;   // logo for dark backgrounds
  footerLeft?: string | null;
  footerRight?: string | null;
};

// Per-brand visual DNA (extracted from real designer output, 2026-06-18 brainstorm).
// Editable later via brand guidelines; falls back to a neutral block for unknown brands.
const VISUAL_DNA: Record<string, string> = {
  sifututor:
    "SifuTutor visual style: royal cobalt blue (#2747DB) dominant background with subtle lighter-blue swirl shapes; " +
    "coral-orange (#F47C3C) and bright yellow (#FFE21F) accents; white. " +
    "Typography: BOLD heavy uppercase sans-serif headline + a handwritten SCRIPT italic accent keyword in coral-orange with a sticker drop-shadow. " +
    "Subjects: real Malaysian school students in neat uniforms, photographic cut-out sticker style with soft shadow, cheerful. " +
    "Playful elements: rounded speech bubbles, small yellow/orange sparkle accents. Friendly, youthful, trustworthy, education tone.",
  nakngaji:
    "NakNgaji visual style: green (#35be89) brand palette with white; warm, respectful Islamic tone; " +
    "clean friendly composition; subjects in modest Malaysian Muslim attire; calm, sincere, trustworthy mood; " +
    "BOLD headline + optional script accent; subtle decorative Islamic motifs (no faces of the Prophet, no haram imagery).",
};

const GENERIC_DNA =
  "Clean, friendly, professional marketing visual honouring the brand colours and tone; " +
  "bold readable headline, clear focal subject, uncluttered composition.";

export async function getBrandContext(slug: string): Promise<BrandContext | null> {
  const brand = await prisma.brand.findFirst({ where: { slug, isActive: true } });
  if (!brand) return null;

  const lines = [
    `Brand: ${brand.name}`,
    `Tagline: "${brand.tagline}"`,
    `Tone: ${brand.tone}`,
    `Target audience: ${brand.targetAudience}`,
    `Core offer: ${brand.coreOffer}`,
    `Key messages: ${brand.keyMessages}`,
    `Do NOT say or imply: ${brand.dontSay}`,
  ];

  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    tone: brand.tone,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    promptBlock: lines.join("\n"),
    visualDna: VISUAL_DNA[brand.slug] ?? GENERIC_DNA,
    logoPath: brand.logoUrl ?? null,
    logoPathLight: brand.logoUrlLight ?? null,
    logoPathDark: brand.logoUrlDark ?? null,
    footerLeft: brand.posterFooterLeft ?? null,
    footerRight: brand.posterFooterRight ?? null,
  };
}
