// Display-layer copy normalization, shared by the result UI and the PDF export.
// Generation is unreliable about (a) brand-name casing and (b) emitting markdown, so we clean
// at the point of display rather than fighting the LLM.

// Force the canonical brand-name casing the model sometimes mangles (e.g. "SifuTutor" →
// "Sifututor"). Driven by the DB Brand.name — never hardcode the spelling here. Matches the full
// brand token only, so the standalone Malay word "sifu" is left untouched.
export function fixBrandCase(text: string, brandName?: string | null): string {
  if (!text || !brandName) return text;
  const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), brandName);
}

// Strip markdown bold markers — for plain-text surfaces (the PDF) that can't render them.
export function stripMarkdownBold(text: string): string {
  return text ? text.replace(/\*\*/g, "") : text;
}
