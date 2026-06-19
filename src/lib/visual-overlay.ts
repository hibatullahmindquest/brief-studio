import sharp from "sharp";
import { readFile, access } from "fs/promises";
import path from "path";

export type OverlayBrand = {
  logoPath?: string | null;       // legacy single logo (fallback) under /public
  logoPathLight?: string | null;  // logo for LIGHT backgrounds (dark-ink logo)
  logoPathDark?: string | null;   // logo for DARK backgrounds (light/white logo)
  footerLeft?: string | null;
  footerRight?: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Mean perceived luminance (0–255) of a region. Returns null if it can't sample.
async function regionLuminance(input: Buffer, region: sharp.Region): Promise<number | null> {
  try {
    const stats = await sharp(input).extract(region).stats();
    const [r, g, b] = stats.channels;
    if (!r || !g || !b) return null;
    return 0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean;
  } catch {
    return null;
  }
}

// Pick the logo variant that contrasts with the background behind the logo zone.
// Dark background → light logo (logoPathDark); light background → dark logo
// (logoPathLight). Falls back to whichever variant exists, then the legacy logo.
async function pickLogoPath(input: Buffer, brand: OverlayBrand, zone: sharp.Region): Promise<string | null> {
  const light = brand.logoPathLight ?? null; // for light bg
  const dark = brand.logoPathDark ?? null;   // for dark bg
  if (light && dark) {
    const lum = await regionLuminance(input, zone);
    if (lum !== null) return lum < 128 ? dark : light;
  }
  return dark ?? light ?? brand.logoPath ?? null;
}

// Stamp brand furniture (logo top-left + footer bottom) onto a generated poster.
// Reads from brand settings at generation time. Safe no-op if nothing configured
// or the logo file is missing/invalid — never throws on a missing asset.
export async function applyBrandOverlay(input: Buffer, brand: OverlayBrand): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1536;
  const composites: sharp.OverlayOptions[] = [];

  // Logo (top-left), transparent PNG from brand settings. With light/dark
  // variants we auto-pick the one that contrasts the background behind the zone.
  const pad = Math.round(W * 0.033);
  const logoW = Math.round(W * 0.22);
  const zone: sharp.Region = {
    left: pad,
    top: pad,
    width: Math.min(logoW, Math.max(1, W - pad)),
    height: Math.min(logoW, Math.max(1, H - pad)),
  };
  const logoPath = await pickLogoPath(input, brand, zone);
  if (logoPath) {
    try {
      const abs = path.join(process.cwd(), "public", logoPath.replace(/^\/+/, ""));
      await access(abs);
      const logo = await sharp(await readFile(abs)).resize({ width: logoW }).png().toBuffer();
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
