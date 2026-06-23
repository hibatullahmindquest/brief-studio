import path from "node:path";
import { readFile } from "node:fs/promises";
import { logError } from "./error-log";

// Turn uploaded asset references into router input:
//   images  → passed through (the classify step sends them to gpt-4o vision)
//   .pdf/.docx → parsed to text, appended to the raw brief
//   unknown / URL / video → skipped (logged), never fails the request
// Doc parsers are injected (default = lazy dynamic imports) so the deterministic
// routing/aggregation is testable with stubs and the real parsers only load when a
// document is actually present. Seam kept here for future URL/video/OCR ingest.

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export type DocParsers = {
  pdf: (buf: Buffer) => Promise<string>;
  docx: (buf: Buffer) => Promise<string>;
};

// pdf-parse: import the inner module to avoid its top-level debug block (reads a
// missing test PDF when `module.parent` is falsy under tsx/ESM).
const defaultParsers: DocParsers = {
  pdf: async (buf) => {
    // Import the inner module to skip pdf-parse's top-level debug block (it reads a
    // missing test PDF when module.parent is falsy). turbopackIgnore keeps it a runtime
    // import so the bundler doesn't try to resolve the inner path at build time.
    // @ts-expect-error pdf-parse ships no type declarations for its inner module path
    const mod = await import(/* turbopackIgnore: true */ "pdf-parse/lib/pdf-parse.js");
    const pdfParse = mod.default as (b: Buffer) => Promise<{ text: string }>;
    return (await pdfParse(buf)).text;
  },
  docx: async (buf) => {
    const mammoth = await import("mammoth");
    return (await mammoth.extractRawText({ buffer: buf })).value;
  },
};

export type IngestResult = {
  extraText: string; // parsed document text, joined
  images: string[]; // image paths for the vision call
  skipped: string[]; // anything not ingested (logged)
};

// Uploads are stored under /public; a path like "/uploads/ref/x.pdf" lives at public/uploads/ref/x.pdf.
// Returns null when the resolved path escapes /public (path-traversal guard) so a crafted
// "../" upload can never read arbitrary files off the server.
export function safePublicPath(p: string): string | null {
  const base = path.resolve(process.cwd(), "public");
  const abs = path.resolve(base, p.replace(/^\/+/, ""));
  if (abs !== base && !abs.startsWith(base + path.sep)) return null;
  return abs;
}

export async function ingestUploads(
  paths: string[] | undefined,
  parsers: DocParsers = defaultParsers,
): Promise<IngestResult> {
  const images: string[] = [];
  const texts: string[] = [];
  const skipped: string[] = [];

  for (const raw of paths ?? []) {
    const p = (raw ?? "").trim();
    if (!p) continue;

    if (/^https?:\/\//i.test(p)) { skipped.push(p); continue; } // URL / video — out of scope (Phase C)

    const ext = path.extname(p).toLowerCase();
    if (IMAGE_EXT.has(ext)) { images.push(p); continue; }

    if (ext === ".pdf" || ext === ".docx") {
      const safe = safePublicPath(p);
      if (!safe) { skipped.push(p); continue; } // escapes /public — reject
      try {
        const buf = await readFile(safe);
        const text = ext === ".pdf" ? await parsers.pdf(buf) : await parsers.docx(buf);
        const t = (text ?? "").trim();
        if (t) texts.push(t);
        else skipped.push(p); // parsed but empty
      } catch (e) {
        await logError({ source: "studio.ingest", error: e, level: "warn", context: { path: p } });
        skipped.push(p);
      }
      continue;
    }

    skipped.push(p); // unknown extension
  }

  return { extraText: texts.join("\n\n"), images, skipped };
}
