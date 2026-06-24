import { prisma } from "@/lib/prisma";
import type { Lens } from "@/lib/lens";

// Module 1 Phase D — brand grounding for the recipe engine.
//
// getBrandContext (brand-context.ts) only surfaces tagline/tone/audience/coreOffer/
// keyMessages/dontSay + visualDna. The richer Module-1 knowledge that seed-m1 writes
// — contentPillars, audienceSegments, doNot[], signaturePhrases, religiousGuidelines,
// colours/fonts — is exactly what the experts (voice) and the Brand Guardian (hard
// rules) need. buildGrounding reads the raw Brand row and assembles two blocks:
//   expertBlock    : brand voice + audience + spec + lens framing → producing steps
//   guardrailBlock : do-not + religious + tone as a pass/flag/retry checklist → Guardian
//
// Empty fields are omitted, never throw. Unknown/inactive brand → null.

export type Grounding = {
  brandId: string;
  expertBlock: string;
  guardrailBlock: string;
};

const LENS_FRAMING: Record<string, string> = {
  marketing: "Lens: MARKETING — paid/campaign framing. Sell the offer, drive the conversion.",
  social: "Lens: SOCIAL — organic, publish-ready content. Build trust and engagement, soft CTA.",
  social_memo: "Lens: SOCIAL MEMO — internal organic note framing.",
};

const list = (label: string, items: string[]): string | null =>
  items.length ? `${label}: ${items.join(", ")}` : null;

const line = (label: string, value: string | null | undefined): string | null =>
  value && value.trim() ? `${label}: ${value.trim()}` : null;

function formatSpec(spec: unknown): string {
  if (!spec || typeof spec !== "object") return "";
  const entries = Object.entries(spec as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string" && v.trim() !== "")
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`);
  return entries.length ? entries.join("\n") : "";
}

export async function buildGrounding(
  brandSlug: string,
  lens: Lens | string,
  spec: unknown,
): Promise<Grounding | null> {
  const brand = await prisma.brand.findFirst({ where: { slug: brandSlug, isActive: true } });
  if (!brand) return null;

  const palette = brand.colors.length ? brand.colors : [brand.primaryColor, brand.secondaryColor].filter(Boolean);
  const specBlock = formatSpec(spec);
  const framing = LENS_FRAMING[lens] ?? `Lens: ${lens}`;

  // ── Expert block — brand voice for producing steps ──
  const expertLines = [
    `Brand: ${brand.name}`,
    line("Tagline", brand.tagline),
    line("Tone", brand.tone),
    list("Audience segments", brand.audienceSegments),
    list("Content pillars", brand.contentPillars),
    list("Signature phrases (favour these)", brand.signaturePhrases),
    list("Brand colours", palette),
    framing,
    specBlock ? `\nBrief:\n${specBlock}` : null,
  ].filter(Boolean);

  // ── Guardrail block — hard rules for the Brand Guardian ──
  const doNot = brand.doNot.length ? brand.doNot : (brand.dontSay ? [brand.dontSay] : []);
  const guardLines = [
    `Brand Guardian rules for ${brand.name} — judge the output pass / flag / retry against these:`,
    list("MUST NOT say or imply", doNot),
    line("Religious / cultural guidelines", brand.religiousGuidelines),
    line("Required tone", brand.tone),
    "Flag tone drift; retry (with reasons) anything that violates a MUST NOT or the religious guidelines.",
  ].filter(Boolean);

  return {
    brandId: brand.id,
    expertBlock: expertLines.join("\n"),
    guardrailBlock: guardLines.join("\n"),
  };
}
