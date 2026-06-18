// One-off: how close can pure gpt-image-2 get to the SifuTutor designer DNA?
// Encodes the extracted brand direction into a single prompt. No template layer.
// Run: npx tsx scripts/sifututor-style-test.mts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

process.loadEnvFile(".env.local");

const OUT = "C:/claude/temp/sifututor-test";
const SIZE = "1024x1536" as const;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// SifuTutor visual DNA, distilled from 10 real designer posters.
const DNA =
  `Vertical social media poster in the SifuTutor brand style. ` +
  `Background: vivid royal cobalt blue (#2747DB) with subtle lighter-blue soft swirl shapes. ` +
  `A cheerful Malaysian secondary-school student in a clean white school uniform, ` +
  `photographic cut-out with a soft drop shadow (sticker style), smiling, holding a textbook. ` +
  `Bright, saturated, friendly and trustworthy education mood, clean studio lighting. ` +
  `Playful accents: a yellow rounded speech bubble, small orange and yellow sparkle/star shapes. ` +
  `Coral-orange (#F47C3C) and bright yellow (#FFE21F) accent colours. Leave the top-left corner clean.`;

const HEADLINE = "BELAJAR 1-TO-1";          // bold uppercase sans
const ACCENT = "ikut pace sendiri";          // script/handwritten accent word, orange
const CTA = "Mula Sekarang";

const prompt =
  `${DNA} ` +
  `Typography: render a BOLD heavy uppercase sans-serif headline at the top that reads "${HEADLINE}" in white. ` +
  `Directly below it, render the phrase "${ACCENT}" in a stylish handwritten SCRIPT italic font in coral-orange with a soft sticker drop-shadow. ` +
  `Near the bottom, render a rounded coral-orange call-to-action button with white text that reads "${CTA}". ` +
  `Spell all Malay text exactly as given. Professional ad design, high quality.`;

async function gen(p: string, n: number): Promise<Buffer> {
  const res = await client.images.generate({ model: "gpt-image-2", prompt: p, size: SIZE, n });
  return res.data!.map((it) =>
    it.b64_json ? Buffer.from(it.b64_json, "base64") : Buffer.alloc(0)
  )[0];
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("→ generating SifuTutor-style test poster…");
  await writeFile(path.join(OUT, "sifututor-style-01.png"), await gen(prompt, 1));
  console.log("  saved sifututor-style-01.png\nDONE → " + OUT);
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
