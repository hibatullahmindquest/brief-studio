import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getClient } from "@/lib/openai";
import type { BrandContext } from "@/lib/brand-context";
import type { ImageSize } from "@/lib/pricing";

export type VisualKind = "poster" | "storyboard" | "none";
export type Aspect = "1:1" | "9:16" | "16:9";

export type VisualScene = { no: number; caption: string };

export type VisualPlan = {
  shouldRender: boolean;
  kind: VisualKind;
  aspect: Aspect;
  brandNotes: string;
  imagePrompt: string;
  scenes: VisualScene[];
};

export type Usage = { model: string; inputTokens: number; outputTokens: number };

export const IMAGE_MODEL = "gpt-image-2";

// Output type → visual family. gpt-4o can plan the content but NOT change the
// family — this guard-rail stops a poster output becoming a storyboard, etc.
export function kindForOutputType(outputTypeId: string): VisualKind {
  if (outputTypeId === "poster") return "poster";
  if (outputTypeId === "storyboard" || outputTypeId === "video_script") return "storyboard";
  return "none"; // hook_copy and anything text-only
}

const PLAN_SYSTEM = `You are a visual art director for Malaysian education brands. Read the generated marketing output and the brief, then plan ONE image to produce.
Respond with ONLY valid JSON (no markdown, no extra keys):
{
  "shouldRender": true,
  "aspect": "1:1" | "9:16" | "16:9",
  "brandNotes": "<colours / mood to honour>",
  "imagePrompt": "<one detailed image prompt>",
  "scenes": [ { "no": 1, "caption": "<short scene caption>" } ]
}
Rules:
- POSTER family: imagePrompt describes a single poster-style visual. scenes = [].
- STORYBOARD family: imagePrompt describes ONE single image that is a storyboard sheet of N numbered panels in a grid, with a CONSISTENT art style and recurring characters across all panels. Put one scenes[] entry per panel with a short caption. N = number of scenes/shots in the output (fall back to the brief's scene count).
- Keep text INSIDE the image minimal or none (it garbles). Real captions go in scenes[].
- Leave clean negative space for a logo. Do NOT render the real logo, exact prices, or exact dates.
- Honour the brand colours and tone. Set shouldRender=false only if an image truly adds nothing.`;

export async function planVisual(args: {
  outputTypeId: string;
  outputText: string;
  briefAnswers: Record<string, string>;
  brand: BrandContext;
}): Promise<{ plan: VisualPlan; usage: Usage }> {
  const kind = kindForOutputType(args.outputTypeId);
  if (kind === "none") {
    return {
      plan: { shouldRender: false, kind: "none", aspect: "1:1", brandNotes: "", imagePrompt: "", scenes: [] },
      usage: { model: "none", inputTokens: 0, outputTokens: 0 },
    };
  }

  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5";
  const brief = Object.entries(args.briefAnswers)
    .filter(([, v]) => v && v !== "—")
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const user = `Output type: ${args.outputTypeId} (family: ${kind})
Brand colours: ${args.brand.primaryColor} (primary) / ${args.brand.secondaryColor} (secondary)
${args.brand.promptBlock}

Generated output:
${args.outputText}

Brief:
${brief || "(none)"}`;

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: PLAN_SYSTEM },
      { role: "user", content: user },
    ],
    max_completion_tokens: 4000,
    response_format: { type: "json_object" },
  });

  const raw = res.choices[0]?.message?.content?.trim() || "{}";
  const p = JSON.parse(raw) as Partial<VisualPlan>;

  const aspect: Aspect =
    p.aspect === "9:16" || p.aspect === "16:9" || p.aspect === "1:1"
      ? p.aspect
      : kind === "poster"
        ? "9:16"
        : "16:9";

  const scenes: VisualScene[] = Array.isArray(p.scenes)
    ? p.scenes.map((s, i) => ({ no: typeof s?.no === "number" ? s.no : i + 1, caption: String(s?.caption ?? "") }))
    : [];

  // The director occasionally returns no prompt (e.g. reasoning model truncation).
  // Fall back to a deterministic brand-aware prompt so rendering never gets "".
  const imagePrompt = String(p.imagePrompt ?? "").trim() || fallbackPrompt(kind, args.brand, args.outputText, scenes);

  return {
    plan: {
      shouldRender: p.shouldRender !== false,
      kind, // forced from output type
      aspect,
      brandNotes: String(p.brandNotes ?? ""),
      imagePrompt,
      scenes,
    },
    usage: {
      model,
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    },
  };
}

// Deterministic prompt when the director returns nothing — keeps the brand
// voice and the actual output topic so the image is still on-brief.
function fallbackPrompt(kind: VisualKind, brand: BrandContext, outputText: string, scenes: VisualScene[]): string {
  const topic = outputText.replace(/\s+/g, " ").slice(0, 400);
  const base = `${brand.tone} marketing visual for ${brand.name}. Use brand colours ${brand.primaryColor} and ${brand.secondaryColor}. Clean composition, leave clear negative space for a logo, minimal or no text in the image.`;
  if (kind === "storyboard") {
    const n = scenes.length || 5;
    return `A storyboard sheet with ${n} numbered panels in a grid, consistent art style and recurring characters across all panels, illustrating this story: ${topic}. ${base}`;
  }
  return `A poster-style key visual illustrating: ${topic}. ${base}`;
}

// ── Guided brief → Creative Spec (visual intake overhaul) ───────────────────

export type VisualSpec = {
  brief: string;              // the user's free-text brief (their own words / angle)
  angle: string;              // distilled angle/occasion (e.g. "cuti sekolah")
  objective: string;          // commercial | awareness | event | tips
  style: string;              // chosen/suggested visual style
  mood: string;               // chosen/suggested mood
  headline: string;           // bold headline rendered on the poster
  accent: string;             // script accent phrase
  cta: string;                // CTA button text
  concept: string;            // one-sentence scene description
  ratio: Aspect;              // 1:1 | 9:16 | 16:9
  styleOptions: string[];     // AI-suggested alternatives (for chips)
  moodOptions: string[];      // AI-suggested alternatives (for chips)
};

// Strip placeholder artifacts an LLM sometimes echoes from a prompt template
// (angle brackets, surrounding quotes, markdown) so they never reach the image.
function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/^[\s"'`<>(\[]+|[\s"'`<>)\]]+$/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

const SPEC_SYSTEM = `You are a brand art director and Malay copywriter for a Malaysian education brand.
Read the user's brief (in their own words, possibly mixed Malay/English) and the brand guidelines, then design ONE poster.
Respond with ONLY valid JSON (no markdown, no placeholder brackets, no extra keys):
{
  "angle": "the specific angle/occasion distilled from the brief, in a few words",
  "objective": "one of: commercial, awareness, event, tips",
  "style": "the single best visual style for this poster",
  "mood": "the single best mood",
  "headline": "a BOLD short headline in the brief's language, max 6 words, that clearly reflects the angle",
  "accent": "a short handwritten-script accent phrase, max 4 words",
  "cta": "a short call-to-action, max 3 words",
  "concept": "one sentence describing the photographic scene to generate",
  "ratio": "one of: 1:1, 9:16, 16:9 (use 9:16 for IG Story, 1:1 for feed unless stated)",
  "styleOptions": ["3-4 alternative visual styles the user could pick"],
  "moodOptions": ["3-4 alternative moods the user could pick"]
}
The copy MUST clearly reflect the brief's specific angle. Honour brand colours, tone, and do-not-say rules. Keep all text spellable and exact.`;

export async function planSpec(args: {
  brief: string;
  brand: BrandContext;
  outputTypeId: string;
  gaps?: string;
}): Promise<{ spec: VisualSpec; usage: Usage }> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5";
  const user = `Brand colours: ${args.brand.primaryColor} (primary) / ${args.brand.secondaryColor} (secondary)
${args.brand.promptBlock}

Visual style direction:
${args.brand.visualDna}

User brief (their own words):
${args.brief || "(none — propose something on-brand)"}
${args.gaps ? `\nStill undecided (suggest good defaults): ${args.gaps}` : ""}`;

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SPEC_SYSTEM },
      { role: "user", content: user },
    ],
    max_completion_tokens: 4500,
    response_format: { type: "json_object" },
  });

  const p = JSON.parse(res.choices[0]?.message?.content?.trim() || "{}") as Partial<VisualSpec>;
  const ratio: Aspect = p.ratio === "1:1" || p.ratio === "16:9" || p.ratio === "9:16" ? p.ratio : "9:16";
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(clean).filter(Boolean).slice(0, 4) : []);

  const spec: VisualSpec = {
    brief: args.brief,
    angle: clean(p.angle),
    objective: clean(p.objective) || "awareness",
    style: clean(p.style),
    mood: clean(p.mood),
    headline: clean(p.headline),
    accent: clean(p.accent),
    cta: clean(p.cta),
    concept: clean(p.concept),
    ratio,
    styleOptions: arr(p.styleOptions),
    moodOptions: arr(p.moodOptions),
  };

  return {
    spec,
    usage: { model, inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 },
  };
}

// Regenerate a single text field (headline | accent | cta) from the brief + brand,
// anchored to the existing spec. Returns one fresh value.
export async function regenerateSpecText(args: {
  field: "headline" | "accent" | "cta";
  spec: VisualSpec;
  brand: BrandContext;
}): Promise<{ value: string; usage: Usage }> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL ?? "gpt-5";
  const limits = { headline: "BOLD, max 6 words", accent: "handwritten-script phrase, max 4 words", cta: "max 3 words" };
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: `You are a Malay copywriter for ${args.brand.name}. Return ONLY a JSON object {"value":"..."} with a single fresh ${args.field} (${limits[args.field]}) that reflects the angle. No brackets, no quotes inside.` },
      { role: "user", content: `Angle: ${args.spec.angle}\nObjective: ${args.spec.objective}\nBrief: ${args.spec.brief}\nCurrent ${args.field}: ${args.spec[args.field]}\nGive a DIFFERENT, better ${args.field}.` },
    ],
    max_completion_tokens: 1500,
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content?.trim() || "{}") as { value?: string };
  return {
    value: clean(parsed.value),
    usage: { model, inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 },
  };
}

// Build the gpt-image-2 prompt from a confirmed spec + brand DNA (render-in-image).
// Reserves a clean top-left zone (logo) + thin bottom strip (footer) for the overlay.
export function buildPosterPromptFromSpec(spec: VisualSpec, brand: BrandContext): string {
  const parts: string[] = [];
  parts.push(`${spec.ratio === "9:16" ? "Vertical 9:16" : spec.ratio === "16:9" ? "Landscape 16:9" : "Square 1:1"} social media poster.`);
  parts.push(brand.visualDna);
  if (spec.style) parts.push(`Style: ${spec.style}.`);
  if (spec.mood) parts.push(`Mood: ${spec.mood}.`);
  if (spec.concept) parts.push(`Scene: ${spec.concept}.`);
  parts.push("CRITICAL LAYOUT: the entire TOP-LEFT corner — roughly the top-left 28% of the width and 16% of the height — MUST be completely empty: no text, no headline, no subjects, no graphics there. It is reserved for a logo added later. Also leave a clean empty thin strip along the VERY BOTTOM edge for a footer.");
  if (spec.headline) parts.push(`Render a BOLD heavy uppercase headline reading "${spec.headline}" placed in the CENTER or lower-center of the poster — never starting in the top-left corner.`);
  if (spec.accent) parts.push(`Just below the headline, render "${spec.accent}" in a handwritten SCRIPT italic font as an accent, with a soft sticker drop-shadow.`);
  if (spec.cta) parts.push(`Render a rounded call-to-action button with the text "${spec.cta}" in the lower-middle area (not at the very bottom edge).`);
  parts.push("Spell every word exactly as given. Professional, high-quality ad design.");
  return parts.join(" ");
}

export type RenderResult = { urlPath: string; size: ImageSize; imageCount: number };

export async function renderImage(args: {
  prompt: string;
  size: ImageSize;
  runId: string;
}): Promise<RenderResult> {
  if (!args.prompt.trim()) {
    throw new Error("Empty image prompt — refusing to call the image API");
  }
  const client = getClient();
  const res = await client.images.generate({
    model: IMAGE_MODEL,
    prompt: args.prompt,
    size: args.size,
    n: 1,
  });

  const item = res.data?.[0];
  let buf: Buffer;
  if (item?.b64_json) {
    buf = Buffer.from(item.b64_json, "base64");
  } else if (item?.url) {
    const r = await fetch(item.url);
    buf = Buffer.from(await r.arrayBuffer());
  } else {
    throw new Error("Image API returned no image data");
  }

  const dir = path.join(process.cwd(), "public", "uploads", "generated");
  await mkdir(dir, { recursive: true });
  const filename = `${args.runId}-${Date.now()}.png`;
  await writeFile(path.join(dir, filename), buf);

  return { urlPath: `/uploads/generated/${filename}`, size: args.size, imageCount: 1 };
}
