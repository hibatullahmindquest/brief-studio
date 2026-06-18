// One-off comparison: render-in-image vs text-overlay for poster headline+CTA.
// Generates 3 files into C:\claude\temp\poster-compare\:
//   A-render-in-image.png   — gpt-image-2 draws the text itself
//   B-base.png              — gpt-image-2 clean image (no text)
//   B-overlay.png           — headline+CTA composited as a real text layer over B-base
// Run: npx tsx scripts/poster-compare.mts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";

process.loadEnvFile(".env.local");

const OUT = "C:/claude/temp/poster-compare";
const SIZE = "1024x1536" as const; // gpt-image-2 portrait (closest to 9:16)
const W = 1024, H = 1536;

const HEADLINE = "Tak pernah terlambat untuk belajar mengaji";
const CTA = "Daftar kelas dewasa";
const BRAND_GREEN = "#35be89";

const SCENE =
  `Editorial commercial poster, portrait orientation, for a Malaysian Islamic adult Quran-reading class. ` +
  `A warm, dignified Malay adult gently reading the Quran in soft golden-hour light. ` +
  `Clean minimalist premium composition, friendly respectful Islamic tone, brand accent colour green ${BRAND_GREEN}. ` +
  `Photographic, high quality. No logo, no watermark.`;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function gen(prompt: string): Promise<Buffer> {
  const res = await client.images.generate({ model: "gpt-image-2", prompt, size: SIZE, n: 1 });
  const item = res.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error("no image data");
}

// Manual word-wrap into <=maxChars lines.
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function overlaySvg(): Buffer {
  const lines = wrap(HEADLINE, 18);
  const fs = 74, lh = 88, topY = 150;
  const headlineTspans = lines
    .map((l, i) => `<text x="70" y="${topY + i * lh}" font-family="Segoe UI, Arial, sans-serif" font-size="${fs}" font-weight="700" fill="#ffffff">${l}</text>`)
    .join("");
  const ctaY = H - 170, ctaText = CTA + "  →";
  const ctaW = Math.min(W - 140, 60 + ctaText.length * 22);
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0.6"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bot" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0.65"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="540" fill="url(#top)"/>
    <rect x="0" y="${H - 420}" width="${W}" height="420" fill="url(#bot)"/>
    ${headlineTspans}
    <rect x="70" y="${ctaY}" rx="16" ry="16" width="${ctaW}" height="78" fill="${BRAND_GREEN}"/>
    <text x="${70 + ctaW / 2}" y="${ctaY + 51}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">${ctaText}</text>
  </svg>`;
  return Buffer.from(svg);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("→ A: render-in-image (gpt-image-2 draws text)…");
  const aPrompt = `${SCENE} Render this exact headline prominently near the top in clean bold Malay typography: "${HEADLINE}". Render a clear call-to-action button near the bottom that reads: "${CTA}".`;
  await writeFile(path.join(OUT, "A-render-in-image.png"), await gen(aPrompt));
  console.log("  saved A-render-in-image.png");

  console.log("→ B: base image (no text)…");
  const bPrompt = `${SCENE} IMPORTANT: do NOT render any text, letters, words, numbers or buttons anywhere. Keep the top and bottom areas calmer and slightly darker so text can be overlaid later. Pure photographic scene only.`;
  const base = await gen(bPrompt);
  await writeFile(path.join(OUT, "B-base.png"), base);
  console.log("  saved B-base.png");

  console.log("→ B: compositing headline + CTA overlay…");
  const composed = await sharp(base)
    .resize(W, H, { fit: "cover" })
    .composite([{ input: overlaySvg(), top: 0, left: 0 }])
    .png()
    .toBuffer();
  await writeFile(path.join(OUT, "B-overlay.png"), composed);
  console.log("  saved B-overlay.png");

  console.log("\nDONE → " + OUT);
}

main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
