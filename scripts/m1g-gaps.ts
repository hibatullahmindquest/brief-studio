// Module 1 Phase G — Prompt 0 checks: the 4 backend gap-closers (DB-backed, NO OpenAI).
//   G1 recipe job-status read (getLatestJobForRun: status + notices + owner scope)
//   G2 getRunArtifacts returns contextUsed (object present / null / array→null)
//   G3 renderFromRun mapping the render route relies on (skipped gate + not_found owner scope)
//   G4 buildSystemPrompt language-mirror contract + gapCheck still deterministic
// Run: DATABASE_URL=... npx tsx scripts/m1g-gaps.ts
import { prisma } from "@/lib/prisma";
import { enqueue, getLatestJobForRun, markSucceeded } from "@/lib/job-store";
import { getRunArtifacts } from "@/lib/artifact-store";
import { renderFromRun } from "@/lib/visual-render";
import { buildSystemPrompt, gapCheck } from "@/lib/router";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function seedRun(userId: string, brandId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const run = await prisma.creativeRun.create({
    data: { userId, brandId, feature: "generate", lens: "marketing", title: "G run", inputText: "b", spec: {}, status: "generated", outputJson: "{}", ...extra },
    select: { id: true },
  });
  return run.id;
}

async function main() {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const ts = Date.now();
  const u1 = await prisma.user.create({ data: { email: `m1g_a_${ts}@t.local`, username: `m1g_a_${ts}`, password: "x", name: "A", teamRole: "marketing", team: "all" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `m1g_b_${ts}@t.local`, username: `m1g_b_${ts}`, password: "x", name: "B", teamRole: "marketing", team: "all" }, select: { id: true } });
  const runIds: string[] = [];
  const jobIds: string[] = [];

  try {
    // ── G1: recipe job-status read ──
    const r1 = await seedRun(u1.id, brand.id); runIds.push(r1);
    const { job } = await enqueue({ kind: "generate", lane: "interactive", dedupeKey: r1, featureRunId: r1, userId: u1.id, brandId: brand.id, payload: { runId: r1 } });
    jobIds.push(job.id);
    const queued = await getLatestJobForRun(r1, u1.id);
    ok("G1 latest job found for owner", queued !== null && queued.id === job.id);
    ok("G1 status starts queued", queued?.status === "queued");
    ok("G1 owner-scoped (other user → null)", (await getLatestJobForRun(r1, u2.id)) === null);

    await markSucceeded(job.id, { resultKind: "recipe", result: { notices: ["image render failed (rate): slow down"], artifacts: [] }, costMyr: 0.1 });
    const done = await getLatestJobForRun(r1, u1.id);
    ok("G1 status reflects succeeded", done?.status === "succeeded");
    ok("G1 resultKind = recipe", done?.resultKind === "recipe");
    const notices = (done?.result as { notices?: unknown } | null)?.notices;
    ok("G1 notices surfaced from result", Array.isArray(notices) && notices[0] === "image render failed (rate): slow down");

    // ── G1b: concurrent enqueue for the SAME run → exactly one job (per-run advisory lock) ──
    const rl = await seedRun(u1.id, brand.id); runIds.push(rl);
    const [ea, eb] = await Promise.all([
      enqueue({ kind: "generate", lane: "interactive", dedupeKey: rl, featureRunId: rl, userId: u1.id, brandId: brand.id, payload: { runId: rl } }),
      enqueue({ kind: "generate", lane: "interactive", dedupeKey: rl, featureRunId: rl, userId: u1.id, brandId: brand.id, payload: { runId: rl } }),
    ]);
    jobIds.push(ea.job.id, eb.job.id);
    ok("G1b concurrent enqueue → same job id", ea.job.id === eb.job.id);
    ok("G1b exactly one created, one reused", ea.reused !== eb.reused);
    ok("G1b only ONE active job for the run", (await prisma.job.count({ where: { dedupeKey: rl, status: { in: ["queued", "processing"] } } })) === 1);

    // ── G2: getRunArtifacts returns contextUsed ──
    const r2 = await seedRun(u1.id, brand.id, { contextUsed: { guardian: { verdict: "on-brand", lens: "marketing" }, notices: ["ok"] } }); runIds.push(r2);
    const ga = await getRunArtifacts(r2, u1.id);
    ok("G2 contextUsed object surfaced", !!ga && typeof ga.contextUsed === "object" && ga.contextUsed !== null);
    ok("G2 guardian verdict readable", (ga?.contextUsed as { guardian?: { verdict?: string } } | null)?.guardian?.verdict === "on-brand");

    const r3 = await seedRun(u1.id, brand.id); runIds.push(r3); // contextUsed unset
    const ga3 = await getRunArtifacts(r3, u1.id);
    ok("G2 contextUsed null when unset", !!ga3 && ga3.contextUsed === null);

    const r4 = await seedRun(u1.id, brand.id, { contextUsed: ["not", "an", "object"] }); runIds.push(r4);
    const ga4 = await getRunArtifacts(r4, u1.id);
    ok("G2 non-object contextUsed collapses to null", !!ga4 && ga4.contextUsed === null);

    // ── G2b: imageable (text-first) + durationMs ──
    const rv = await seedRun(u1.id, brand.id); runIds.push(rv);
    await prisma.artifact.create({ data: { runId: rv, type: "visual_direction", exportFormat: "", content: { text: "vd" } } });
    ok("imageable true: visual_direction present, no image yet", (await getRunArtifacts(rv, u1.id))?.imageable === true);
    await prisma.artifact.create({ data: { runId: rv, type: "image", mediaPath: "/uploads/generated/x.png", exportFormat: "png", content: { ratio: "9:16" } } });
    ok("imageable false: image already rendered", (await getRunArtifacts(rv, u1.id))?.imageable === false);
    ok("durationMs is a number after a succeeded generate job", typeof (await getRunArtifacts(r1, u1.id))?.durationMs === "number");
    ok("durationMs null when no finished job", (await getRunArtifacts(r3, u1.id))?.durationMs === null);

    // ── G3: renderFromRun mapping (no OpenAI — gates before render) ──
    const r5 = await seedRun(u1.id, brand.id); runIds.push(r5); // no visual_direction artifact
    const rend = await renderFromRun({ runId: r5, userId: u1.id });
    ok("G3 skipped when no visual_direction", rend.ok === true && rend.skipped === true);
    const notFound = await renderFromRun({ runId: r5, userId: u2.id });
    ok("G3 not_found for non-owner", notFound.ok === false && notFound.category === "not_found");

    // ── G4: language-mirror prompt contract + deterministic gapCheck ──
    const prompt = buildSystemPrompt("BRAND BLOCK", ["poster", "caption", "marketing_plan"]);
    ok("G4 prompt requests SAME LANGUAGE", /SAME LANGUAGE/i.test(prompt));
    ok("G4 prompt no longer hardcodes Malay question", !/short Malay question/i.test(prompt));
    ok("G4 prompt gives Malay/English examples", /Malay brief/i.test(prompt) && /English brief/i.test(prompt));

    const gaps = await gapCheck("poster", { objective: "sales" }, { taskType: "poster", lens: "marketing", brandSlug: "sifututor" });
    ok("G4 gapCheck still deterministic (platform+key_message missing)", gaps.length === 2 && gaps.every((g) => g.required));
    const none = await gapCheck("poster", { objective: "x", platform: "ig", key_message: "y" }, { taskType: "poster", lens: "marketing", brandSlug: "sifututor" });
    ok("G4 gapCheck empty when complete", none.length === 0);
  } finally {
    if (jobIds.length) await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    if (runIds.length) {
      await prisma.artifact.deleteMany({ where: { runId: { in: runIds } } });
      await prisma.aPIUsageLog.deleteMany({ where: { featureRunId: { in: runIds } } });
      await prisma.creativeRun.deleteMany({ where: { id: { in: runIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
