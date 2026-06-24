// Module 1 Phase F — Prompt 1 checks: buildPlanPdf (PURE, no fs/db/OpenAI). AC-7.
// Run: npx tsx scripts/m1f-pdf.ts   — exits 1 on fail.
import { buildPlanPdf, sanitize } from "@/lib/export-pdf";
import { PDFDocument } from "pdf-lib";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
const brand = { name: "SifuTutor", primaryColor: "#3b4ee2", secondaryColor: "#fd8549", footerLeft: "© 2026 SifuTutor", footerRight: "Tutor ke rumah" };
const meta = { title: "Kempen Pendaftaran Tuisyen Musim Peperiksaan", brandName: "SifuTutor", platform: "Instagram Feed", dateLabel: "24 Jun 2026" };
const texts = [
  { type: "strategy", text: "Tingkatkan pendaftaran sesi percubaan sebanyak 30% dalam 3 minggu." },
  { type: "copy", text: "Anak struggle Matematik? Bukan dia malas — dia cuma belum jumpa cara yang betul." },
  { type: "social", text: "Musim exam dah dekat. Daftar sesi percubaan PERCUMA hari ini. Slot terhad." },
];

// ── valid PDF buffer ──
const buf = await buildPlanPdf({ meta, texts, brand });
ok("returns a Buffer", Buffer.isBuffer(buf));
ok("non-empty (> 1KB)", buf.length > 1024);
ok("starts with %PDF magic", buf.subarray(0, 4).toString("latin1") === "%PDF");
// re-parse to confirm structurally valid + has at least one page
const parsed = await PDFDocument.load(buf);
ok("parses back as a valid PDF", parsed.getPageCount() >= 1);

// ── empty texts → cover-only, still valid ──
const empty = await buildPlanPdf({ meta, texts: [], brand });
ok("empty texts → still valid %PDF", empty.subarray(0, 4).toString("latin1") === "%PDF");
ok("empty texts → non-empty buffer", empty.length > 512);

// ── emoji / non-Latin-1 must not throw ──
let threw = false;
try {
  await buildPlanPdf({ meta, texts: [{ type: "social", text: "Daftar sekarang 📚🔥 — slot terhad! 你好" }], brand });
} catch { threw = true; }
ok("emoji/unicode input does not throw (sanitized)", !threw);
ok("sanitize strips emoji", !/📚/.test(sanitize("a📚b")) && sanitize("a📚b") === "ab");
ok("sanitize keeps Latin-1 accents", sanitize("café") === "café");
ok("sanitize normalises CRLF", sanitize("a\r\nb") === "a\nb");

// ── unknown brand colour falls back, does not throw ──
let threw2 = false;
try { await buildPlanPdf({ meta, texts, brand: { ...brand, primaryColor: "not-a-hex", secondaryColor: "" } }); } catch { threw2 = true; }
ok("bad brand colours → fallback, no throw", !threw2);

// ── long text paginates (multi-page) ──
const long = { type: "strategy", text: Array.from({ length: 120 }, (_, i) => `Baris ${i + 1}: ayat panjang untuk menguji pagination dalam dokumen PDF ini.`).join(" ") };
const big = await buildPlanPdf({ meta, texts: [long], brand });
const bigParsed = await PDFDocument.load(big);
ok("long content paginates to >1 page", bigParsed.getPageCount() > 1);

// ── determinism guard: same inputs → byte-identical (proves no embedded timestamp / no `new Date()`) ──
const a = await buildPlanPdf({ meta, texts, brand });
const b = await buildPlanPdf({ meta, texts, brand });
ok("deterministic — identical inputs produce identical bytes", Buffer.compare(a, b) === 0);

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
