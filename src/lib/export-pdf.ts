import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getBrandContext } from "@/lib/brand-context";
import { sumRunCostMyr } from "@/lib/usage";
import { logError } from "@/lib/error-log";

// Module 1 Phase F — PDF export.
//
// Two layers:
//  1. buildPlanPdf — PURE. Composes a run's user-facing TEXT artifacts into a brand-styled
//     A4 PDF buffer with pdf-lib. No fs, no db, no `new Date()` (the date label is injected).
//     StandardFonts (Helvetica) only → input is sanitised to its encodable range.
//  2. exportRunToPdf (below) — the owner-scoped, idempotent, re-invokable export seam. It is
//     the Phase F analogue of Phase E's renderFromRun: id-only, IO injected, failure-isolated.

// ── pure composer ───────────────────────────────────────────────────────────

export type PlanText = { type: string; text: string };
export type PlanBrand = {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  footerLeft?: string | null;
  footerRight?: string | null;
};
export type PlanMeta = {
  title: string;
  brandName: string;
  platform?: string | null;
  /** INJECTED — keep buildPlanPdf pure (no `new Date()` here). */
  dateLabel: string;
};

const A4: [number, number] = [595, 842];
const MARGIN = 40;
const INK = rgb(0, 0.149, 0.161); // #00262a
const GREY = rgb(0.42, 0.45, 0.5);
const FAINT = rgb(0.949, 0.961, 0.992); // #f2f5fd

const HEADINGS: Record<string, string> = {
  strategy: "Strategi",
  copy: "Copy",
  social: "Caption Sosial",
  text: "Nota",
};
const headingFor = (type: string) => HEADINGS[type] ?? "Nota";

/** Helvetica (WinAnsi) can't encode emoji / non-Latin-1. Drop unencodable chars so draw never throws. */
export function sanitize(s: string): string {
  return (s ?? "").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "").replace(/\r\n?/g, "\n");
}

function hexToRgb(hex: string, fallback: RGB): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex ?? "").trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function wrapLines(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const raw of sanitize(text).split("\n")) {
    if (raw.trim() === "") { out.push(""); continue; }
    let line = "";
    for (const word of raw.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxW && line) { out.push(line); line = word; }
      else line = next;
    }
    if (line) out.push(line);
  }
  return out;
}

export async function buildPlanPdf(args: { meta: PlanMeta; texts: PlanText[]; brand: PlanBrand }): Promise<Buffer> {
  const { meta, texts, brand } = args;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const primary = hexToRgb(brand.primaryColor, rgb(0.231, 0.306, 0.886));
  const accent = hexToRgb(brand.secondaryColor, rgb(0.992, 0.522, 0.286));
  const contentW = A4[0] - MARGIN * 2;

  let page: PDFPage = doc.addPage(A4);
  let y = 0;

  const footer = () => {
    page.drawLine({ start: { x: MARGIN, y: 50 }, end: { x: A4[0] - MARGIN, y: 50 }, thickness: 1, color: FAINT });
    const left = sanitize(brand.footerLeft || `© ${meta.brandName}`);
    const right = sanitize(brand.footerRight || "");
    page.drawText(left, { x: MARGIN, y: 36, size: 9, font, color: GREY });
    if (right) page.drawText(right, { x: A4[0] - MARGIN - font.widthOfTextAtSize(right, 9), y: 36, size: 9, font, color: GREY });
  };
  const newPage = () => { footer(); page = doc.addPage(A4); y = A4[1] - MARGIN; };
  const need = (h: number) => { if (y - h < 70) newPage(); };

  // ── header bar ──
  page.drawRectangle({ x: 0, y: A4[1] - 70, width: A4[0], height: 70, color: primary });
  page.drawText(sanitize(brand.name), { x: MARGIN, y: A4[1] - 45, size: 22, font: bold, color: rgb(1, 1, 1) });
  const kicker = "MARKETING PLAN";
  page.drawText(kicker, { x: A4[0] - MARGIN - font.widthOfTextAtSize(kicker, 10), y: A4[1] - 42, size: 10, font, color: rgb(0.85, 0.88, 1) });
  y = A4[1] - 110;

  // ── title block ──
  page.drawText("MARKETING PLAN", { x: MARGIN, y, size: 9, font: bold, color: accent }); y -= 18;
  for (const ln of wrapLines(meta.title, bold, 18, contentW)) { page.drawText(ln, { x: MARGIN, y, size: 18, font: bold, color: INK }); y -= 22; }
  const metaLine = sanitize([`Brand: ${meta.brandName}`, meta.platform || null, `Dijana: ${meta.dateLabel}`].filter(Boolean).join("  ·  "));
  page.drawText(metaLine, { x: MARGIN, y, size: 10, font, color: GREY }); y -= 28;

  // ── sections ──
  for (const t of texts) {
    need(40);
    y -= 6;
    page.drawText(headingFor(t.type).toUpperCase(), { x: MARGIN, y, size: 11, font: bold, color: primary }); y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 1.5, color: FAINT }); y -= 16;
    for (const ln of wrapLines(t.text, font, 11, contentW)) {
      need(16);
      page.drawText(ln, { x: MARGIN, y, size: 11, font, color: INK }); y -= 16;
    }
    y -= 8;
  }

  footer();
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// ── export seam ──────────────────────────────────────────────────────────────

const PDF = "pdf";
// User-facing text artifact types that compose the plan PDF. Deliberately EXCLUDES
// `visual_direction` (internal render instruction) and `image` (media, not text).
const TEXT_TYPES = ["strategy", "copy", "social", "text"];

const MONTHS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
function formatDateLabel(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export type ExportDeps = {
  /** injected for tests — default buildPlanPdf */
  build?: (args: { meta: PlanMeta; texts: PlanText[]; brand: PlanBrand }) => Promise<Buffer>;
  /** injected for tests — default mkdir -p + writeFile */
  write?: (absPath: string, data: Buffer) => Promise<void>;
  /** injected for tests — default Date-based MYT label */
  dateLabel?: string;
};

export type ExportOutcome =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; mediaPath: string; costMyr: number }
  | { ok: false; retryable: boolean; reason: string; category: string };

const defaultWrite = async (absPath: string, data: Buffer) => {
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, data);
};

/**
 * Compose a run's user-facing text artifacts into a brand-styled PDF and persist it.
 * Owner-scoped, idempotent (drops only prior `pdf` artifacts), re-invokable, IO-injected.
 * Mirrors the Phase E render seam: a render failure leaves the run + its other artifacts intact.
 */
export async function exportRunToPdf(args: { runId: string; userId: string; deps?: ExportDeps }): Promise<ExportOutcome> {
  const { runId, userId } = args;
  const build = args.deps?.build ?? buildPlanPdf;
  const write = args.deps?.write ?? defaultWrite;

  // owner-scoped load
  const run = await prisma.creativeRun.findFirst({
    where: { id: runId, userId },
    select: { id: true, title: true, spec: true, brandId: true, brand: { select: { slug: true } } },
  });
  if (!run) return { ok: false, retryable: false, reason: "Run not found.", category: "not_found" };

  // gather user-facing text artifacts (oldest first → reads in lineup order)
  const rows = await prisma.artifact.findMany({
    where: { runId, type: { in: TEXT_TYPES } },
    orderBy: { createdAt: "asc" },
    select: { type: true, content: true },
  });
  const texts: PlanText[] = rows
    .map((r) => ({ type: r.type, text: ((r.content as { text?: unknown } | null)?.text ?? "").toString() }))
    .filter((t) => t.text.trim().length > 0);
  if (texts.length === 0) return { ok: true, skipped: true, reason: "no text artifacts to export" };

  const brandSlug = run.brand?.slug ?? "";
  const brandCtx = brandSlug ? await getBrandContext(brandSlug) : null;
  const brand: PlanBrand = brandCtx
    ? { name: brandCtx.name, primaryColor: brandCtx.primaryColor, secondaryColor: brandCtx.secondaryColor, footerLeft: brandCtx.footerLeft, footerRight: brandCtx.footerRight }
    : { name: "Brief Studio", primaryColor: "#3b4ee2", secondaryColor: "#fd8549" };

  const spec = (run.spec ?? {}) as { platform?: unknown; ratio?: unknown };
  const platform = typeof spec.platform === "string" ? spec.platform : null;
  const meta: PlanMeta = {
    title: run.title || "Marketing Plan",
    brandName: brand.name,
    platform,
    dateLabel: args.deps?.dateLabel ?? formatDateLabel(new Date()),
  };

  // idempotent: drop any prior pdf artifact before (re)writing. PDF type only → text/image safe.
  await prisma.artifact.deleteMany({ where: { runId, type: PDF } });

  // Path built from the DB-confirmed id (a cuid), never raw input → no traversal.
  const mediaPath = `/uploads/exports/${run.id}/plan.pdf`;
  const abs = path.join(process.cwd(), "public", mediaPath.replace(/^\/+/, ""));

  try {
    const buf = await build({ meta, texts, brand });
    await write(abs, buf);
    await prisma.artifact.create({
      data: { runId, type: PDF, mediaPath, exportFormat: "pdf", content: { sections: texts.map((t) => t.type) } },
    });
    const costMyr = await sumRunCostMyr(runId);
    return { ok: true, skipped: false, mediaPath, costMyr };
  } catch (err) {
    await logError({
      source: "export.pdf", error: err,
      userId, brandId: brandCtx?.id, featureRunId: runId,
      context: { phase: "export", runId },
    });
    return { ok: false, retryable: true, reason: "PDF export failed.", category: "export" };
  }
}
