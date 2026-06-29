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

// Strip the common markdown markers for a clean plain-text copy-to-clipboard:
// heading hashes, list bullets/numbers, and bold/italic emphasis. Leaves the words intact.
export function stripMarkdown(text: string): string {
  if (!text) return text;
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "") // heading hashes
        .replace(/^\s*[-*]\s+/, "• ") // unordered bullets → •
        .replace(/^\s*(\d+)\.\s+/, "$1. "), // keep ordered numbering, normalise spacing
    )
    .join("\n")
    .replace(/\*\*([^*]+?)\*\*/g, "$1") // bold
    .replace(/(^|[^*])\*([^*\n]+?)\*/g, "$1$2") // italic *…*
    .replace(/(^|[^_])_([^_\n]+?)_/g, "$1$2"); // italic _…_
}
