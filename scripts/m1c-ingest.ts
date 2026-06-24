// Integration checks for Module 1 Phase C — upload ingest.
// Deterministic routing/aggregation verified with STUB parsers + scratch fixtures
// (real pdf/docx parsing is exercised by the live smoke / manual). Asserts: images
// pass through, docs → extraText, unknown/url/missing/empty → skipped, never throws.
// Run: npx tsx scripts/m1c-ingest.ts   (exits 1 on any failure)
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { ingestUploads, type DocParsers } from "@/lib/ingest";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

const DIR = "/uploads/zztest-ingest";
const abs = (rel: string) => path.join(process.cwd(), "public", DIR.replace(/^\/+/, ""), rel);

const markerParsers: DocParsers = {
  pdf: async () => "PDF_MARKER text",
  docx: async () => "DOCX_MARKER text",
};
const emptyParsers: DocParsers = { pdf: async () => "   ", docx: async () => "" };

async function main() {
  await mkdir(path.dirname(abs("x")), { recursive: true });
  await writeFile(abs("image.png"), "fake-png-bytes");
  await writeFile(abs("brief.pdf"), "fake-pdf-bytes");
  await writeFile(abs("brief.docx"), "fake-docx-bytes");

  try {
    const r = await ingestUploads(
      [
        `${DIR}/image.png`,
        `${DIR}/brief.pdf`,
        `${DIR}/brief.docx`,
        `${DIR}/missing.pdf`,
        `${DIR}/note.xyz`,
        "https://youtu.be/abc",
        "   ",
      ],
      markerParsers,
    );

    ok("image routed to images[]", r.images.length === 1 && r.images[0].endsWith("image.png"));
    ok("pdf parsed into extraText", r.extraText.includes("PDF_MARKER"));
    ok("docx parsed into extraText", r.extraText.includes("DOCX_MARKER"));
    ok("missing file → skipped (no throw)", r.skipped.some((s) => s.endsWith("missing.pdf")));
    ok("unknown ext → skipped", r.skipped.some((s) => s.endsWith("note.xyz")));
    ok("url/video → skipped", r.skipped.some((s) => s.startsWith("https://")));
    ok("blank path ignored (not in any bucket)", !r.images.concat(r.skipped).some((s) => s.trim() === ""));
    ok("image not double-counted in skipped", !r.skipped.some((s) => s.endsWith("image.png")));

    // parsed-but-empty → skipped, extraText stays empty
    const e = await ingestUploads([`${DIR}/brief.pdf`], emptyParsers);
    ok("empty parse result → skipped", e.skipped.some((s) => s.endsWith("brief.pdf")) && e.extraText === "");

    // undefined input → empty result, no throw
    const u = await ingestUploads(undefined);
    ok("undefined uploads → empty result", u.images.length === 0 && u.extraText === "" && u.skipped.length === 0);

    // path-traversal guard: a "../" doc path must NOT be read (parser never called) → skipped
    let traversalParserCalled = false;
    const t = await ingestUploads(["/../../.env.local.pdf"], {
      pdf: async () => { traversalParserCalled = true; return "SECRET"; },
      docx: async () => { traversalParserCalled = true; return "SECRET"; },
    });
    ok("traversal path skipped, parser never called", t.skipped.length === 1 && !traversalParserCalled && t.extraText === "");
  } finally {
    await rm(path.dirname(abs("x")), { recursive: true, force: true }).catch(() => {});
  }

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
