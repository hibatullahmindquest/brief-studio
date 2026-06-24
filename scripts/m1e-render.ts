// Module 1 Phase E — Prompt 2 checks: renderFromRun seam (DB-backed, NO OpenAI).
// Render + overlay are injected fakes → asserts idempotency, skip-gate, owner-scope,
// failure-isolation (AC-6, AC-7, AC-8). Run: DATABASE_URL=... npx tsx scripts/m1e-render.ts
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { renderFromRun, type RenderDeps } from "@/lib/visual-render";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

let renderCalls = 0;
const writtenFiles: string[] = [];

// fake render: writes a real (tiny) file so the overlay readFile path works, counts calls.
const fakeRender: NonNullable<RenderDeps["render"]> = async ({ runId, size }) => {
  renderCalls++;
  const urlPath = `/uploads/generated/${runId}-m1e-test.png`;
  const abs = path.join(process.cwd(), "public", urlPath.replace(/^\/+/, ""));
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from("FAKE_PNG_BYTES"));
  writtenFiles.push(abs);
  return { urlPath, size, imageCount: 1 };
};
const fakeOverlay: NonNullable<RenderDeps["overlay"]> = async (buf) => buf; // no-op stamp
const deps: RenderDeps = { render: fakeRender, overlay: fakeOverlay };

async function seedRun(userId: string, brandId: string, withDirection: boolean): Promise<string> {
  const run = await prisma.creativeRun.create({
    data: { userId, brandId, feature: "poster", lens: "marketing", inputText: "brief", spec: { platform: "instagram_story" }, status: "generated", outputJson: "{}" },
    select: { id: true },
  });
  // text artifacts always present (must survive render)
  await prisma.artifact.create({ data: { runId: run.id, type: "strategy", content: { text: "S" } } });
  await prisma.artifact.create({ data: { runId: run.id, type: "copy", content: { text: "C" } } });
  if (withDirection) {
    await prisma.artifact.create({ data: { runId: run.id, type: "visual_direction", content: { text: "AD: smiling student, cobalt blue" } } });
  }
  return run.id;
}

const countType = (runId: string, type: string) => prisma.artifact.count({ where: { runId, type } });

async function main() {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const ts = Date.now();
  const u1 = await prisma.user.create({ data: { email: `m1e_a_${ts}@t.local`, username: `m1e_a_${ts}`, password: "x", name: "A", teamRole: "creative", team: "all" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `m1e_b_${ts}@t.local`, username: `m1e_b_${ts}`, password: "x", name: "B", teamRole: "creative", team: "all" }, select: { id: true } });
  const runIds: string[] = [];

  try {
    // (a) happy path — renders one image artifact, text survives
    const rA = await seedRun(u1.id, brand.id, true); runIds.push(rA);
    renderCalls = 0;
    const res = await renderFromRun({ runId: rA, userId: u1.id, deps });
    ok("(a) ok + not skipped", res.ok === true && "skipped" in res && res.skipped === false);
    ok("(a) returns mediaPath", res.ok === true && !res.skipped && typeof res.mediaPath === "string" && res.mediaPath.length > 0);
    ok("(a) ratio from story spec = 9:16", res.ok === true && !res.skipped && res.ratio === "9:16");
    ok("(a) render called once", renderCalls === 1);
    ok("(a) exactly one image artifact", (await countType(rA, "image")) === 1);
    ok("(a) text artifacts intact", (await countType(rA, "strategy")) === 1 && (await countType(rA, "copy")) === 1 && (await countType(rA, "visual_direction")) === 1);

    // (b) idempotent — second call → still ONE image, text untouched, render re-ran
    const res2 = await renderFromRun({ runId: rA, userId: u1.id, deps });
    ok("(b) second call ok", res2.ok === true && "skipped" in res2 && res2.skipped === false);
    ok("(b) still exactly one image artifact", (await countType(rA, "image")) === 1);
    ok("(b) text still intact after re-render", (await countType(rA, "strategy")) === 1 && (await countType(rA, "visual_direction")) === 1);
    ok("(b) render invoked again (idempotent re-render)", renderCalls === 2);

    // (c) skip-gate — no visual_direction → skipped, render NOT called
    const rC = await seedRun(u1.id, brand.id, false); runIds.push(rC);
    renderCalls = 0;
    const resC = await renderFromRun({ runId: rC, userId: u1.id, deps });
    ok("(c) skipped:true", resC.ok === true && "skipped" in resC && resC.skipped === true);
    ok("(c) render NOT called", renderCalls === 0);
    ok("(c) no image artifact written", (await countType(rC, "image")) === 0);

    // (d) render failure (moderation) — classified, text intact, no image
    const rD = await seedRun(u1.id, brand.id, true); runIds.push(rD);
    const throwingRender: NonNullable<RenderDeps["render"]> = async () => { const e = new Error("blocked"); (e as { code?: string }).code = "content_policy_violation"; throw e; };
    const resD = await renderFromRun({ runId: rD, userId: u1.id, deps: { render: throwingRender, overlay: fakeOverlay } });
    ok("(d) ok:false", resD.ok === false);
    ok("(d) non-retryable moderated", resD.ok === false && resD.retryable === false && resD.category === "moderated");
    ok("(d) no image artifact after failure", (await countType(rD, "image")) === 0);
    ok("(d) text artifacts survive failure", (await countType(rD, "strategy")) === 1 && (await countType(rD, "visual_direction")) === 1);

    // (e) owner scope — wrong user → not_found, no render
    const rE = await seedRun(u1.id, brand.id, true); runIds.push(rE);
    renderCalls = 0;
    const resE = await renderFromRun({ runId: rE, userId: u2.id, deps });
    ok("(e) non-owner → ok:false not_found", resE.ok === false && resE.category === "not_found");
    ok("(e) render NOT called for non-owner", renderCalls === 0);
  } finally {
    if (runIds.length) {
      await prisma.artifact.deleteMany({ where: { runId: { in: runIds } } });
      await prisma.aPIUsageLog.deleteMany({ where: { featureRunId: { in: runIds } } });
      await prisma.creativeRun.deleteMany({ where: { id: { in: runIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
    for (const f of writtenFiles) { await rm(f, { force: true }); }
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
