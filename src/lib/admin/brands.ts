import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdminError } from "./errors";

// Admin update for a brand. Covers the existing poster-overlay furniture
// (footer text, logo size/corner) AND the Module 1 enriched brand-knowledge
// fields that ground the expert pipeline. Validation lives here so the API route
// and the tsx verify script exercise the same logic (route only adds auth).

const LOGO_SIZES = ["sm", "md", "lg"];
const LOGO_CORNERS = ["tl", "tr", "tc"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export type BrandUpdateInput = {
  slug?: string;
  // poster overlay (existing)
  posterFooterLeft?: string;
  posterFooterRight?: string;
  logoSize?: string;
  logoCorner?: string;
  // M1 brand knowledge
  contentPillars?: unknown;
  audienceSegments?: unknown;
  doNot?: unknown;
  signaturePhrases?: unknown;
  colors?: unknown;
  fonts?: unknown;
  religiousGuidelines?: string;
  footer?: string;
  logoPath?: string;
};

// trim, drop blanks, dedupe — order preserved.
function normalizeStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new AdminError(400, `${field} must be an array`);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

// each entry must be a #rrggbb hex; normalized to lowercase, deduped, blanks dropped.
function normalizeColors(value: unknown): string[] {
  if (!Array.isArray(value)) throw new AdminError(400, "colors must be an array");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    if (!HEX_RE.test(t)) throw new AdminError(400, `invalid colour (use #rrggbb): ${t}`);
    const lower = t.toLowerCase();
    if (!seen.has(lower)) { seen.add(lower); out.push(lower); }
  }
  return out;
}

// trimmed text or null for nullable text fields (empty clears the field).
function nullableText(value: string, max = 200): string | null {
  const t = value.trim().slice(0, max);
  return t === "" ? null : t;
}

export async function updateBrand(input: BrandUpdateInput) {
  const slug = (input.slug ?? "").trim();
  if (!slug) throw new AdminError(400, "Missing slug");

  if (input.logoSize !== undefined && !LOGO_SIZES.includes(input.logoSize)) throw new AdminError(400, "Invalid logoSize");
  if (input.logoCorner !== undefined && !LOGO_CORNERS.includes(input.logoCorner)) throw new AdminError(400, "Invalid logoCorner");

  const data: Prisma.BrandUpdateInput = {};

  // overlay
  if (input.posterFooterLeft !== undefined) data.posterFooterLeft = input.posterFooterLeft.slice(0, 120);
  if (input.posterFooterRight !== undefined) data.posterFooterRight = input.posterFooterRight.slice(0, 120);
  if (input.logoSize !== undefined) data.logoSize = input.logoSize;
  if (input.logoCorner !== undefined) data.logoCorner = input.logoCorner;

  // knowledge — arrays
  if (input.contentPillars !== undefined) data.contentPillars = normalizeStringArray(input.contentPillars, "contentPillars");
  if (input.audienceSegments !== undefined) data.audienceSegments = normalizeStringArray(input.audienceSegments, "audienceSegments");
  if (input.doNot !== undefined) data.doNot = normalizeStringArray(input.doNot, "doNot");
  if (input.signaturePhrases !== undefined) data.signaturePhrases = normalizeStringArray(input.signaturePhrases, "signaturePhrases");
  if (input.fonts !== undefined) data.fonts = normalizeStringArray(input.fonts, "fonts");
  if (input.colors !== undefined) data.colors = normalizeColors(input.colors);

  // knowledge — scalars
  if (input.religiousGuidelines !== undefined) data.religiousGuidelines = input.religiousGuidelines.trim().slice(0, 2000);
  if (input.footer !== undefined) data.footer = nullableText(input.footer);
  if (input.logoPath !== undefined) data.logoPath = nullableText(input.logoPath, 300);

  try {
    return await prisma.brand.update({
      where: { slug },
      data,
      select: {
        slug: true, name: true,
        posterFooterLeft: true, posterFooterRight: true, logoSize: true, logoCorner: true,
        contentPillars: true, audienceSegments: true, doNot: true, signaturePhrases: true,
        colors: true, fonts: true, religiousGuidelines: true, footer: true, logoPath: true,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new AdminError(404, "Brand not found");
    }
    throw e;
  }
}
