// Module 1 Phase E — render-contract resolver.
//
// The Phase D recipe engine stops at a `visual_direction` Artifact: free text from the
// art_director expert (mode "auto"), or the user may supply their own visual description
// (mode "describe"). This module turns that text into a concrete gpt-image-2 prompt + ratio
// — the render contract. It is a PURE function (no IO, no LLM) so the seam is fully testable:
// the art_director already did the creative thinking, so "auto" just wraps that text with the
// brand visual DNA + the proven layout-reserve boilerplate (decision A1, deterministic).

export type RenderMode = "auto" | "describe";

export type RenderRatio = "1:1" | "9:16" | "16:9";

export type RenderContract = {
  mode: RenderMode;
  imagePrompt: string; // final gpt-image-2 prompt (never empty)
  ratio: RenderRatio;
};

export type ResolveInput = {
  /** art_director artifact content.text — the auto-mode source. */
  visualDirectionText: string;
  /** user's own visual description (run.inputText). When present AND useDescribe, drives the prompt. */
  describeText?: string | null;
  /** explicit opt-in to describe mode — we never guess the mode from text shape. */
  useDescribe?: boolean;
  /** run.spec (unknown JSON) — may carry ratio/platform. */
  spec?: unknown;
  brand: { visualDna: string; primaryColor: string; secondaryColor: string; name: string };
};

// Reserve clause lifted from buildPosterPromptFromSpec — gpt-image-2 otherwise ignores the
// corner and the overlay logo lands on top of rendered content.
const LAYOUT_RESERVE =
  "CRITICAL LAYOUT: the entire TOP-LEFT corner — roughly the top-left 28% of the width and 16% " +
  "of the height — MUST be completely empty: no text, no subjects, no graphics there. It is " +
  "reserved for a logo added later. Also leave a clean empty thin strip along the VERY BOTTOM " +
  "edge for a footer.";

const QUALITY = "Keep any in-image text minimal and spelled exactly. Professional, high-quality ad design.";

const RATIO_SENTENCE: Record<RenderRatio, string> = {
  "9:16": "Vertical 9:16 social media poster.",
  "16:9": "Landscape 16:9 social media poster.",
  "1:1": "Square 1:1 social media poster.",
};

// platform token (in spec) → ratio. Tolerant of casing/separators.
const PLATFORM_RATIO: Record<string, RenderRatio> = {
  instagram_feed: "1:1", feed: "1:1", instagram: "1:1", facebook: "1:1", fb: "1:1",
  instagram_story: "9:16", story: "9:16", stories: "9:16", reel: "9:16", reels: "9:16",
  tiktok: "9:16", shorts: "9:16",
  youtube: "16:9", landscape: "16:9", web: "16:9",
};

function asRatio(v: unknown): RenderRatio | null {
  return v === "1:1" || v === "9:16" || v === "16:9" ? v : null;
}

function norm(v: unknown): string {
  return String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

// Resolve the output ratio: explicit spec.ratio wins; else spec.platform mapped; else 9:16.
export function resolveRatio(spec: unknown): RenderRatio {
  if (!spec || typeof spec !== "object") return "9:16";
  const s = spec as Record<string, unknown>;
  const direct = asRatio(s.ratio) ?? asRatio(s.aspect);
  if (direct) return direct;
  const platform = PLATFORM_RATIO[norm(s.platform)] ?? PLATFORM_RATIO[norm(s.placement)];
  return platform ?? "9:16";
}

// Clamp an over-long source text so the image prompt stays sane (the art_director can ramble).
function clampSource(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 1200 ? `${t.slice(0, 1200)}…` : t;
}

export function resolveVisualDirection(input: ResolveInput): RenderContract {
  const ratio = resolveRatio(input.spec);
  const describe = input.useDescribe && (input.describeText ?? "").trim().length > 0;
  const mode: RenderMode = describe ? "describe" : "auto";

  const source = clampSource(describe ? String(input.describeText) : input.visualDirectionText);
  const sourceLine = source
    ? `Visual direction: ${source}`
    : `A poster-style key visual for ${input.brand.name}.`; // never let the prompt be empty

  const imagePrompt = [
    RATIO_SENTENCE[ratio],
    input.brand.visualDna,
    `Honour the brand colours ${input.brand.primaryColor} and ${input.brand.secondaryColor}.`,
    sourceLine,
    LAYOUT_RESERVE,
    QUALITY,
  ]
    .filter((p) => p && p.trim())
    .join(" ");

  return { mode, imagePrompt, ratio };
}
