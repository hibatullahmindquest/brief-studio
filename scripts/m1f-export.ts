// Module 1 Phase F — Prompt 2 checks: exportRunToPdf seam (DB-backed, NO real fs/pdf).
// build + write are injected fakes → asserts happy/idempotent/skip/owner/failure-isolation.
// Run: DATABASE_URL=... npx tsx scripts/m1f-export.ts
import { prisma } from "@/lib/prisma";
import { exportRunToPdf, type ExportDeps } from "@/lib/export-pdf";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

let buildCalls = 0;
let lastTexts: { type: string }[] = [];
const writes: { abs: string; bytes: number }[] = [];

const fakeBuild: NonNullable<ExportDeps["build"]> = async ({ texts }) => { buildCalls++; lastTexts = texts; return Buffer.from("%PDF-FAKE"); };
const fakeWrite: NonNullable<ExportDeps["write"]> = async (abs, data) => { writes.push({ abs, bytes: data.length }); };
const deps: ExportDeps = { build: fakeBuild, write: fakeWrite, dateLabel: "24 Jun 2026" };

async function seedRun(userId: string, brandId: string, opts: { withText: boolean; withImage?: boolean }): Promise<string> {
  const run = await prisma.creativeRun.create({
    data: { userId, brandId, feature: "generate", lens: "marketing", title: "Kempen Ujian", inputText: "brief", spec: { platform: "feed" }, status: "generated", outputJson: "{}" },
    select: { id: true },
  });
  if (opts.withText) {
    await prisma.artifact.create({ data: { runId: run.id, type: "strategy", content: { text: "Strategi penuh." } } });
    await prisma.artifact.create({ data: { runId: run.id, type: "copy", content: { text: "Copy hook." } } });
    await prisma.artifact.create({ data: { runId: run.id, type: "social", content: { text: "Caption sosial." } } });
    // internal — must NOT be exported
    await prisma.artifact.create({ data: { runId: run.id, type: "visual_direction", content: { text: "AD: internal only" } } });
  }
  if (opts.withImage) {
    await prisma.artifact.create({ data: { runId: run.id, type: "image", mediaPath: "/uploads/generated/x.png", exportFormat: "png", content: {} } });
  }
  return run.id;
}

const countType = (runId: string, type: string) => prisma.artifact.count({ where: { runId, type } });

async function main() {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const ts = Date.now();
  const u1 = await prisma.user.create({ data: { email: `m1f_a_${ts}@t.local`, username: `m1f_a_${ts}`, password: "x", name: "A", teamRole: "marketing", team: "all" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `m1f_b_${ts}@t.local`, username: `m1f_b_${ts}`, password: "x", name: "B", teamRole: "marketing", team: "all" }, select: { id: true } });
  const runIds: string[] = [];

  try {
    // (a) happy — pdf artifact written, mediaPath shape, build/write called, internal types excluded
    const rA = await seedRun(u1.id, brand.id, { withText: true, withImage: true }); runIds.push(rA);
    buildCalls = 0; writes.length = 0;
    const res = await exportRunToPdf({ runId: rA, userId: u1.id, deps });
    ok("(a) ok + not skipped", res.ok === true && "skipped" in res && res.skipped === false);
    ok("(a) mediaPath = /uploads/exports/<runId>/plan.pdf", res.ok === true && !res.skipped && res.mediaPath === `/uploads/exports/${rA}/plan.pdf`);
    ok("(a) build called once", buildCalls === 1);
    ok("(a) write called once with abs path + bytes", writes.length === 1 && writes[0].abs.includes(rA) && writes[0].bytes > 0);
    ok("(a) exactly one pdf artifact", (await countType(rA, "pdf")) === 1);
    ok("(a) PDF composes 3 text types (strategy/copy/social)", lastTexts.length === 3);
    ok("(a) visual_direction EXCLUDED from PDF", !lastTexts.some((t) => t.type === "visual_direction"));
    ok("(a) text + image artifacts intact", (await countType(rA, "strategy")) === 1 && (await countType(rA, "image")) === 1 && (await countType(rA, "visual_direction")) === 1);

    // (b) idempotent — second export → still ONE pdf, text/image untouched
    const res2 = await exportRunToPdf({ runId: rA, userId: u1.id, deps });
    ok("(b) second export ok", res2.ok === true && "skipped" in res2 && res2.skipped === false);
    ok("(b) still exactly one pdf artifact", (await countType(rA, "pdf")) === 1);
    ok("(b) text/image still intact", (await countType(rA, "copy")) === 1 && (await countType(rA, "image")) === 1);

    // (c) skip-gate — no text artifacts → skipped, build/write NOT called, no pdf
    const rC = await seedRun(u1.id, brand.id, { withText: false, withImage: true }); runIds.push(rC);
    buildCalls = 0; writes.length = 0;
    const resC = await exportRunToPdf({ runId: rC, userId: u1.id, deps });
    ok("(c) skipped:true", resC.ok === true && "skipped" in resC && resC.skipped === true);
    ok("(c) build NOT called", buildCalls === 0);
    ok("(c) write NOT called", writes.length === 0);
    ok("(c) no pdf artifact", (await countType(rC, "pdf")) === 0);

    // (d) owner scope — wrong user → not_found, nothing built
    const rD = await seedRun(u1.id, brand.id, { withText: true }); runIds.push(rD);
    buildCalls = 0;
    const resD = await exportRunToPdf({ runId: rD, userId: u2.id, deps });
    ok("(d) non-owner → ok:false not_found", resD.ok === false && resD.category === "not_found");
    ok("(d) build NOT called for non-owner", buildCalls === 0);
    ok("(d) no pdf artifact for non-owner", (await countType(rD, "pdf")) === 0);

    // (e) failure isolation — build throws → ok:false retryable, run + text intact, no pdf
    const rE = await seedRun(u1.id, brand.id, { withText: true }); runIds.push(rE);
    const throwingBuild: NonNullable<ExportDeps["build"]> = async () => { throw new Error("compose boom"); };
    const resE = await exportRunToPdf({ runId: rE, userId: u1.id, deps: { ...deps, build: throwingBuild } });
    ok("(e) ok:false retryable", resE.ok === false && resE.retryable === true && resE.category === "export");
    ok("(e) no pdf artifact after failure", (await countType(rE, "pdf")) === 0);
    ok("(e) text artifacts survive failure", (await countType(rE, "strategy")) === 1 && (await countType(rE, "social")) === 1);
  } finally {
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
