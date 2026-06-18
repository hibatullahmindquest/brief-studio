import sharp from "sharp";
import { readFile, access } from "fs/promises";
import path from "path";

export type OverlayBrand = {
  logoPath?: string | null;   // path under /public (e.g. /uploads/brand/sifututor-logo.png)
  footerLeft?: string | null;
  footerRight?: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Stamp brand furniture (logo top-left + footer bottom) onto a generated poster.
// Reads from brand settings at generation time. Safe no-op if nothing configured
// or the logo file is missing/invalid — never throws on a missing asset.
export async function applyBrandOverlay(input: Buffer, brand: OverlayBrand): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1536;
  const composites: sharp.OverlayOptions[] = [];

  // Logo (top-left), transparent PNG from brand settings.
  if (brand.logoPath) {
    try {
      const abs = path.join(process.cwd(), "public", brand.logoPath.replace(/^\/+/, ""));
      await access(abs);
      const logo = await sharp(await readFile(abs)).resize({ width: Math.round(W * 0.22) }).png().toBuffer();
      const pad = Math.round(W * 0.033);
      composites.push({ input: logo, top: pad, left: pad });
    } catch {
      /* missing / invalid logo → skip silently */
    }
  }

  // Footer bar (bottom), left + right text.
  const fl = (brand.footerLeft ?? "").trim();
  const fr = (brand.footerRight ?? "").trim();
  if (fl || fr) {
    const barH = Math.max(40, Math.round(H * 0.037));
    const fs = Math.round(barH * 0.42);
    const pad = Math.round(W * 0.028);
    const baseline = H - Math.round(barH / 2) + Math.round(fs / 3);
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${H - barH}" width="${W}" height="${barH}" fill="#0b1c73" opacity="0.92"/>
      ${fl ? `<text x="${pad}" y="${baseline}" font-family="Segoe UI, Arial, sans-serif" font-size="${fs}" font-weight="600" fill="#ffffff">${esc(fl)}</text>` : ""}
      ${fr ? `<text x="${W - pad}" y="${baseline}" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="${Math.round(fs * 0.95)}" fill="#cfe0ff">${esc(fr)}</text>` : ""}
    </svg>`;
    composites.push({ input: Buffer.from(svg), top: 0, left: 0 });
  }

  if (composites.length === 0) return input;
  return sharp(input).composite(composites).png().toBuffer();
}
