// Classification benchmark for Module 1 Phase C (OPENAI-gated — skips without a key).
// 10 labelled briefs (8 clear across poster/caption/marketing_plan × both lenses +
// 2 ambiguous). Pass bar: ≥ 9/10 — clear briefs classified to the right taskType,
// ambiguous briefs fall below CLARIFY_THRESHOLD (would clarify). Loose assertions only.
// Run: DATABASE_URL=... OPENAI_API_KEY=... npx tsx scripts/m1c-benchmark.ts
import { classify, listEnabledTaskTypes, CLARIFY_THRESHOLD } from "@/lib/router";

type Case = { brand: string; text: string; expect: string | "AMBIGUOUS" };

const CASES: Case[] = [
  { brand: "nakngaji", text: "Ad poster untuk promo kelas mengaji online, target parents, untuk IG", expect: "poster" },
  { brand: "sifututor", text: "Design poster webinar parenting untuk IG story, sasaran ibu bapa", expect: "poster" },
  { brand: "sifututor", text: "Poster diskaun back-to-school untuk Facebook feed", expect: "poster" },
  { brand: "nakngaji", text: "Tulis caption Instagram untuk post pasal kelebihan kelas mengaji", expect: "caption" },
  { brand: "sifututor", text: "Caption pendek untuk reels tips belajar berkesan", expect: "caption" },
  { brand: "nakngaji", text: "Buatkan caption untuk carousel raya kami", expect: "caption" },
  { brand: "sifututor", text: "Tolong rangka marketing plan untuk back-to-school campaign, sasaran ibu bapa murid sekolah rendah, 6 minggu", expect: "marketing_plan" },
  { brand: "nakngaji", text: "Saya nak strategi pemasaran lengkap untuk Q3, objektif tambah pendaftaran", expect: "marketing_plan" },
  { brand: "nakngaji", text: "buat sesuatu untuk raya", expect: "AMBIGUOUS" },
  { brand: "sifututor", text: "ada idea tak untuk minggu ni", expect: "AMBIGUOUS" },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("SKIP — no OPENAI_API_KEY (benchmark is LLM-gated)");
    process.exit(0);
  }
  const enabled = await listEnabledTaskTypes();

  let correct = 0;
  for (const [i, c] of CASES.entries()) {
    const { classification: r } = await classify({ text: c.text, brandSlug: c.brand, enabledTaskTypes: enabled });
    let pass: boolean;
    if (c.expect === "AMBIGUOUS") pass = r.confidence < CLARIFY_THRESHOLD;
    else pass = r.taskType === c.expect && r.confidence >= CLARIFY_THRESHOLD;
    if (pass) correct++;
    console.log(`${pass ? "✓" : "✗"} [${i + 1}] expect=${c.expect} got=${r.taskType} conf=${r.confidence} — "${c.text.slice(0, 40)}…"`);
  }

  const passed = correct >= 9;
  console.log(`\nSCORE: ${correct}/10 — ${passed ? "PASS (>= 9)" : "FAIL (< 9)"}`);
  process.exit(passed ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
