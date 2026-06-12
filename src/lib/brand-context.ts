import { prisma } from "@/lib/prisma";

export type BrandContext = {
  id: string;
  name: string;
  slug: string;
  tone: string;
  primaryColor: string;
  secondaryColor: string;
  promptBlock: string;
};

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
  };
}
