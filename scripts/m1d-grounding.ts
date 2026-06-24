// Module 1 Phase D — Prompt 2 checks: brand grounding blocks (DB-backed, no LLM).
// Asserts the FULL M1 brand knowledge (that getBrandContext omits) reaches experts,
// and that the guardrail block carries do-not + religious rules for the Guardian.
// Run: DATABASE_URL=... npx tsx scripts/m1d-grounding.ts   (needs seed-m1). Exits 1 on fail.
import { prisma } from "@/lib/prisma";
import { buildGrounding } from "@/lib/grounding";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  const spec = { objective: "drive signups", platform: "Instagram", key_message: "belajar dengan sifu" };

  const sifu = await buildGrounding("sifututor", "marketing", spec);
  ok("sifututor grounding built", !!sifu);
  if (sifu) {
    ok("expertBlock has a content pillar", /exam tips|study motivation|subject mastery|parent trust/i.test(sifu.expertBlock));
    ok("expertBlock has a signature phrase", /Belajar dengan sifu|Cemerlang itu satu tabiat/i.test(sifu.expertBlock));
    ok("expertBlock has an audience segment", /pelajar sekolah menengah|ibu bapa|guru tuisyen/i.test(sifu.expertBlock));
    ok("expertBlock carries the spec key_message", /belajar dengan sifu/i.test(sifu.expertBlock));
    ok("expertBlock reflects lens=marketing", /marketing|paid|campaign/i.test(sifu.expertBlock));
    ok("guardrailBlock has a do-not item", /janji markah palsu|rendahkan sekolah lain|bahasa kasar/i.test(sifu.guardrailBlock));
    ok("guardrailBlock returns brandId", typeof sifu.brandId === "string" && sifu.brandId.length > 0);
  }

  const nak = await buildGrounding("nakngaji", "social", spec);
  ok("nakngaji grounding built", !!nak);
  if (nak) {
    ok("nakngaji guardrailBlock has religious guidelines", /adab Islam|aurat|khilaf/i.test(nak.guardrailBlock));
    ok("nakngaji guardrailBlock has a do-not item", /khilaf mazhab|aurat|paksaan/i.test(nak.guardrailBlock));
    ok("nakngaji expertBlock reflects lens=social", /social|organic|publish/i.test(nak.expertBlock));
  }

  ok("unknown brand → null", (await buildGrounding("does_not_exist", "marketing", spec)) === null);

  // never throws on empty spec
  const empty = await buildGrounding("sifututor", "marketing", {});
  ok("empty spec still builds", !!empty);
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
