// Module 1 Phase D — Prompt 1 checks: tier→model map + live expert load (DB-backed).
// Deterministic, no LLM. Run: DATABASE_URL=... npx tsx scripts/m1d-expert.ts
// Needs seeded experts (scripts/seed-m1.ts). Exits 1 on any fail.
import { prisma } from "@/lib/prisma";
import { tierToModel, loadExpert } from "@/lib/expert";

// Models pricing.ts knows exact rates for — tierToModel must resolve into this set
// so per-expert cost logging is accurate, not a fallback estimate.
const PRICED = new Set(["gpt-4o", "gpt-5"]);

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  // tier→model
  ok("fast → gpt-4o", tierToModel("fast") === (process.env.OPENAI_MODEL_FAST ?? "gpt-4o"));
  ok("standard → gpt-4o", tierToModel("standard") === (process.env.OPENAI_MODEL_STANDARD ?? "gpt-4o"));
  ok("premium → gpt-5", tierToModel("premium") === (process.env.OPENAI_MODEL_PREMIUM ?? "gpt-5"));
  ok("unknown tier → standard default", tierToModel("does_not_exist") === tierToModel("standard"));
  ok("null/undefined → standard default", tierToModel(null) === tierToModel("standard") && tierToModel(undefined) === tierToModel("standard"));
  ok("fast resolves to a PRICED model", PRICED.has(tierToModel("fast")));
  ok("standard resolves to a PRICED model", PRICED.has(tierToModel("standard")));
  ok("premium resolves to a PRICED model", PRICED.has(tierToModel("premium")));

  // every seeded expert's tier maps to a priced model
  const experts = await prisma.expert.findMany({ select: { roleKey: true, modelTier: true } });
  ok("seeded experts present", experts.length >= 5);
  for (const e of experts) {
    ok(`expert ${e.roleKey} (tier=${e.modelTier}) → priced model`, PRICED.has(tierToModel(e.modelTier)));
  }

  // loadExpert
  const strat = await loadExpert("strategist");
  ok("loadExpert(strategist) returns the seeded expert", !!strat && strat.roleKey === "strategist" && strat.systemPrompt.length > 0);
  ok("loadExpert(unknown) → null", (await loadExpert("does_not_exist_role")) === null);
  ok("loadExpert('') → null", (await loadExpert("")) === null);
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
