// Simulation: full Approach-C output — gpt-image-2 (render-in-image) + brand overlay (logo + footer).
// Spec: SifuTutor · awareness · school students · realistic photo.
// Run: npx tsx scripts/sim-poster.mts
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

process.loadEnvFile(".env.local");

const OUT = "C:/claude/temp/sim-poster";
const W = 1024, H = 1536;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const HEADLINE = "BELAJAR JADI MUDAH";
const ACCENT = "bila ikut pace sendiri";
const CTA = "Kenali SifuTutor";
const FOOTER_L = "© 2025 Sifu & Edu Learning Sdn Bhd";
const FOOTER_R = "Malaysia's leading private tutoring platform";

const prompt =
  `Vertical 9:16 social media poster for the SifuTutor Malaysian education brand, realistic photographic style. ` +
  `A cheerful young Malaysian school student (about 11-13 years old) in a neat school uniform, studying happily with a book at a tidy desk, ` +
  `genuine warm smile, soft natural daylight. The environment subtly uses royal cobalt blue (#2747DB) brand tones. ` +
  `IMPORTANT layout: keep the very TOP-LEFT corner empty (clear) for a logo badge, and keep a clean thin strip along the VERY BOTTOM empty for a footer. ` +
  `Typography: render a BOLD heavy uppercase white sans-serif headline across the upper area reading "${HEADLINE}". ` +
  `Directly below it render the phrase "${ACCENT}" in a stylish handwritten SCRIPT italic font in coral-orange (#F47C3C) with a soft sticker drop-shadow. ` +
  `Render a small rounded coral-orange call-to-action button with white text reading "${CTA}" in the lower-middle area (not at the very bottom edge). ` +
  `Add a few subtle yellow (#FFE21F) sparkle/star accents. Spell every Malay word exactly as given. Friendly, trustworthy, vibrant, high quality ad design.`;

async function gen(p: string): Promise<Buffer> {
  const res = await client.images.generate({ model: "gpt-image-2", prompt: p, size: "1024x1536", n: 1 });
  const it = res.data?.[0];
  if (it?.b64_json) return Buffer.from(it.b64_json, "base64");
  if (it?.url) return Buffer.from(await (await fetch(it.url)).arrayBuffer());
  throw new Error("no image data");
}

// Brand overlay — logo (top-left) + footer (bottom). In production these come from brand settings
// (uploaded logo PNG + footer text). Here the logo is a wordmark stand-in.
function overlaySvg(): Buffer {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <!-- logo badge top-left -->
    <rect x="34" y="34" rx="14" ry="14" width="232" height="64" fill="#ffffff" opacity="0.95"/>
    <text x="58" y="76" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="#2747DB">sif</text>
    <circle cx="129" cy="66" r="13" fill="#F47C3C"/>
    <circle cx="129" cy="66" r="6" fill="#2747DB"/>
    <text x="148" y="76" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="#2747DB">tutor</text>
    <!-- footer bar bottom -->
    <rect x="0" y="${H - 56}" width="${W}" height="56" fill="#0b1c73" opacity="0.92"/>
    <text x="34" y="${H - 21}" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600" fill="#ffffff">${esc(FOOTER_L)}</text>
    <text x="${W - 34}" y="${H - 21}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="19" fill="#cfe0ff">${esc(FOOTER_R)}</text>
  </svg>`;
  return Buffer.from(svg);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const basePath = path.join(OUT, "01-ai-base.png");
  let base: Buffer;
  try {
    await access(basePath);
    base = await readFile(basePath);
    console.log("→ reusing existing 01-ai-base.png (no new OpenAI call)");
  } catch {
    console.log("→ gpt-image-2 (render-in-image)…");
    base = await gen(prompt);
    await writeFile(basePath, base);
    console.log("  saved 01-ai-base.png");
  }
  console.log("→ brand overlay (logo + footer)…");
  const final = await sharp(base).resize(W, H, { fit: "cover" })
    .composite([{ input: overlaySvg(), top: 0, left: 0 }]).png().toBuffer();
  await writeFile(path.join(OUT, "02-final-with-overlay.png"), final);
  console.log("  saved 02-final-with-overlay.png\nDONE → " + OUT);
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
