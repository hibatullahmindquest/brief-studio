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
