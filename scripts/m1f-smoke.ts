// Module 1 Phase F — live smoke: REAL pdf-lib + REAL fs write (no OpenAI). AC-1/2/3.
// Seeds a run with text + image artifacts → exportRunToPdf (real) → file on disk + listed.
// Run: DATABASE_URL=... npx tsx scripts/m1f-smoke.ts
import { stat, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { exportRunToPdf } from "@/lib/export-pdf";
import { listLibrary, getRunArtifacts } from "@/lib/artifact-store";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const ts = Date.now();
  const user = await prisma.user.create({ data: { email: `m1f_smoke_${ts}@t.local`, username: `m1f_smoke_${ts}`, password: "x", name: "Smoke", teamRole: "marketing", team: "all" }, select: { id: true } });
  let runId = "";

  try {
    const run = await prisma.creativeRun.create({
      data: { userId: user.id, brandId: brand.id, feature: "generate", lens: "marketing", title: "Kempen Pendaftaran Tuisyen Musim Peperiksaan", inputText: "brief", spec: { platform: "Instagram Feed" }, status: "generated", outputJson: "{}" },
      select: { id: true },
    });
    runId = run.id;
    await prisma.artifact.create({ data: { runId, type: "strategy", content: { text: "Tingkatkan pendaftaran sesi tuisyen percubaan sebanyak 30% dalam tempoh 3 minggu sebelum musim peperiksaan, menyasarkan ibu bapa yang risau tentang prestasi akademik anak mereka." } } });
    await prisma.artifact.create({ data: { runId, type: "copy", content: { text: "Anak struggle Matematik? Bukan dia malas — dia cuma belum jumpa cara yang betul. Daftar sesi percubaan percuma hari ini." } } });
    await prisma.artifact.create({ data: { runId, type: "social", content: { text: "Musim exam dah dekat. Daftar sesi percubaan PERCUMA — tutor berpengalaman, datang terus ke rumah. Slot terhad." } } });
    await prisma.artifact.create({ data: { runId, type: "visual_direction", content: { text: "AD: internal — should NOT appear in PDF" } } });
    await prisma.artifact.create({ data: { runId, type: "image", mediaPath: "/uploads/generated/smoke.png", exportFormat: "png", content: {} } });

    // ── real export ──
    const res = await exportRunToPdf({ runId, userId: user.id });
    ok("export ok + not skipped", res.ok === true && "skipped" in res && res.skipped === false);
    const mediaPath = res.ok && !res.skipped ? res.mediaPath : "";
    ok("mediaPath returned", mediaPath === `/uploads/exports/${runId}/plan.pdf`);

    const abs = path.join(process.cwd(), "public", mediaPath.replace(/^\/+/, ""));
    const st = await stat(abs).catch(() => null);
    ok("PDF file exists on disk", st !== null);
    ok("PDF size > 1KB", (st?.size ?? 0) > 1024);
    const head = await readFile(abs).then((b) => b.subarray(0, 4).toString("latin1")).catch(() => "");
    ok("valid %PDF header", head === "%PDF");

    // ── grouped result excludes visual_direction, includes pdf ──
    const ga = await getRunArtifacts(runId, user.id);
    ok("getRunArtifacts: 3 texts (no visual_direction)", ga!.texts.length === 3 && !ga!.texts.some((t) => t.type === "visual_direction"));
    ok("getRunArtifacts: pdf present", ga!.pdf !== null);
    ok("getRunArtifacts: image present (poster→image+copy stored)", ga!.images.length === 1);

    // ── listed in Library with pdf kind ──
    const lib = await listLibrary(user.id, { limit: 50 });
    const item = lib.find((l) => l.runId === runId);
    ok("run listed in Library", !!item);
    ok("Library kinds incl pdf + image", !!item && item.kinds.includes("pdf") && item.kinds.includes("image"));

    console.log(`\n📄 PDF written: ${abs}`);
    console.log("   (gitignored — open it to eyeball brand bar / sections / footer)");
  } finally {
    if (runId) {
      await prisma.artifact.deleteMany({ where: { runId } });
      await prisma.aPIUsageLog.deleteMany({ where: { featureRunId: runId } });
      await prisma.creativeRun.deleteMany({ where: { id: runId } });
    }
    await prisma.user.deleteMany({ where: { id: user.id } });
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
