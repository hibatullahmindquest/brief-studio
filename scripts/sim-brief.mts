// Proof: free-text brief (with a specific angle) → gpt-4o director writes copy FROM that angle
// → gpt-image-2 renders → brand overlay. Demonstrates how GPT "understands" a custom angle.
// Run: npx tsx scripts/sim-brief.mts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";

process.loadEnvFile(".env.local");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const OUT = "C:/claude/temp/sim-brief";
const W = 1024, H = 1536;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── The user's free-text brief (their own words, with a specific angle) ──
const BRIEF =
  "Poster commercial untuk SifuTutor. Angle: musim CUTI SEKOLAH — galakkan ibu bapa daftar kelas " +
  "supaya anak isi cuti dengan berfaedah dan tak ketinggalan pelajaran. Format: Instagram Story (9:16). " +
  "Audiens: ibu bapa pelajar sekolah. Gaya: bold graphic, ceria.";

const DIRECTOR_SYSTEM = `You are SifuTutor's art director + Malay copywriter (Malaysian education brand).
Given a creative brief, return ONLY valid JSON (no markdown):
{ "headline": "<bold uppercase Malay headline, max 5 words>",
  "accent": "<short handwritten-script accent phrase, max 4 words>",
  "cta": "<short call-to-action, max 3 words>",
  "concept": "<one sentence describing the photographic scene to generate>" }
The copy MUST clearly reflect the brief's specific ANGLE (e.g. school holidays). Friendly, energetic, trustworthy.`;

async function director(brief: string) {
  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: DIRECTOR_SYSTEM },
      { role: "user", content: brief },
    ],
    max_completion_tokens: 400,
    response_format: { type: "json_object" },
  });
  return JSON.parse(res.choices[0]?.message?.content ?? "{}") as
    { headline: string; accent: string; cta: string; concept: string };
}

async function genImage(p: string): Promise<Buffer> {
  const res = await client.images.generate({ model: "gpt-image-2", prompt: p, size: "1024x1536", n: 1 });
  const it = res.data?.[0];
  if (it?.b64_json) return Buffer.from(it.b64_json, "base64");
  if (it?.url) return Buffer.from(await (await fetch(it.url)).arrayBuffer());
  throw new Error("no image data");
}

function overlaySvg(): Buffer {
  const FL = "© 2025 Sifu & Edu Learning Sdn Bhd", FR = "Malaysia's leading private tutoring platform";
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="34" y="34" rx="14" ry="14" width="232" height="64" fill="#ffffff" opacity="0.95"/>
    <text x="58" y="76" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="#2747DB">sif</text>
    <circle cx="129" cy="66" r="13" fill="#F47C3C"/><circle cx="129" cy="66" r="6" fill="#2747DB"/>
    <text x="148" y="76" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="800" fill="#2747DB">tutor</text>
    <rect x="0" y="${H - 56}" width="${W}" height="56" fill="#0b1c73" opacity="0.92"/>
    <text x="34" y="${H - 21}" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600" fill="#ffffff">${esc(FL)}</text>
    <text x="${W - 34}" y="${H - 21}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="19" fill="#cfe0ff">${esc(FR)}</text>
  </svg>`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("BRIEF:\n  " + BRIEF + "\n");
  console.log("→ gpt-4o director writing copy from the angle…");
  const spec = await director(BRIEF);
  console.log("  SPEC (from gpt-4o):");
  console.log("    headline: " + spec.headline);
  console.log("    accent  : " + spec.accent);
  console.log("    cta     : " + spec.cta);
  console.log("    concept : " + spec.concept + "\n");

  const prompt =
    `Vertical 9:16 Instagram Story poster for the SifuTutor Malaysian education brand. Bold graphic, cheerful style. ` +
    `Scene: ${spec.concept}. Royal cobalt blue (#2747DB) brand background with subtle swirl shapes; ` +
    `coral-orange (#F47C3C) and bright yellow (#FFE21F) accents; sticker-style cut-out subject with soft shadow. ` +
    `Keep the very TOP-LEFT corner empty for a logo, and a clean thin strip at the VERY BOTTOM for a footer. ` +
    `Typography: BOLD uppercase white sans-serif headline reading "${spec.headline}"; ` +
    `below it the phrase "${spec.accent}" in handwritten SCRIPT italic coral-orange with sticker drop-shadow; ` +
    `a rounded coral-orange CTA button with white text "${spec.cta}" in the lower-middle. ` +
    `Add subtle yellow sparkle accents. Spell every Malay word exactly. High quality ad design.`;

  console.log("→ gpt-image-2 render…");
  const base = await genImage(prompt);
  await writeFile(path.join(OUT, "01-base.png"), base);
  console.log("→ brand overlay…");
  const final = await sharp(base).resize(W, H, { fit: "cover" })
    .composite([{ input: overlaySvg(), top: 0, left: 0 }]).png().toBuffer();
  await writeFile(path.join(OUT, "02-final.png"), final);
  console.log("DONE → " + OUT);
}
main().catch((e) => { console.error("FAILED:", e?.message ?? e); process.exit(1); });
