// Live classification check for Module 1 Phase C (OPENAI-gated — skips cleanly without a key).
// Loose assertions only (enum membership + correct match + confidence range) to avoid
// LLM flakiness; exact wording is never asserted.
// Run: DATABASE_URL=... OPENAI_API_KEY=... npx tsx scripts/m1c-classify.ts
import { classify, listEnabledTaskTypes, CLARIFY_THRESHOLD } from "@/lib/router";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("SKIP — no OPENAI_API_KEY (classification is LLM-gated; deterministic core covered by m1c-router.ts)");
    process.exit(0);
  }

  const enabled = await listEnabledTaskTypes();
  ok("enabled task types loaded", enabled.length > 0);

  // Roadmap acceptance #1 — clear poster brief
  const r1 = await classify({
    text: "Ad poster untuk promo kelas mengaji online, target parents, untuk IG",
    brandSlug: "nakngaji",
    enabledTaskTypes: enabled,
  });
  const c1 = r1.classification;
  console.log("  → #1:", JSON.stringify({ taskType: c1.taskType, conf: c1.confidence, lens: c1.suggestedLens, extracted: c1.extracted }));
  ok("#1 taskType ∈ enabled", enabled.includes(c1.taskType));
  ok("#1 classified as poster", c1.taskType === "poster");
  ok("#1 confidence in 0..1", c1.confidence >= 0 && c1.confidence <= 1);
  ok("#1 confident → would proceed (>= threshold)", c1.confidence >= CLARIFY_THRESHOLD);

  // Roadmap acceptance #2 — marketing plan brief
  const r2 = await classify({
    text: "Tolong rangka marketing plan untuk back-to-school campaign, sasaran ibu bapa murid sekolah rendah, untuk 6 minggu sebelum sesi persekolahan",
    brandSlug: "sifututor",
    enabledTaskTypes: enabled,
  });
  const c2 = r2.classification;
  console.log("  → #2:", JSON.stringify({ taskType: c2.taskType, conf: c2.confidence, extracted: c2.extracted }));
  ok("#2 classified as marketing_plan", c2.taskType === "marketing_plan");

  // Ambiguous — should be low confidence
  const r3 = await classify({ text: "buat sesuatu untuk raya", brandSlug: "nakngaji", enabledTaskTypes: enabled });
  const c3 = r3.classification;
  console.log("  → #3 (ambiguous):", JSON.stringify({ taskType: c3.taskType, conf: c3.confidence }));
  ok("#3 ambiguous → would clarify (< threshold)", c3.confidence < CLARIFY_THRESHOLD);

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
