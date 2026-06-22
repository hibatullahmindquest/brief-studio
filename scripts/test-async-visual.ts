// Live E2E test for async visual generation.
// Run the worker separately (npm run worker), then:
//   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brief_studio" npx tsx scripts/test-async-visual.ts
//
// Creates a realistic poster FeatureRun, enqueues a job, and polls until the
// worker finishes — proving the full async path (enqueue → claim → gpt-4o →
// gpt-image-2 → persist → cost) end-to-end with the real OpenAI API.
import { existsSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { saveFeatureRun } from "../src/lib/feature-store";
import { enqueueVisualJob, getLatestJobForRun } from "../src/lib/job-store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. Pick a creative/admin user (visual is creative-gated).
  const user = await prisma.user.findFirst({
    where: { OR: [{ isAdmin: true }, { teamRole: "creative" }] },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error("No admin/creative user found — seed one first.");

  // 2. Pick a brand.
  const brand = await prisma.brand.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!brand) throw new Error("No active brand found — seed SifuTutor/NakNgaji first.");

  console.log(`User: ${user.email} (${user.isAdmin ? "admin" : user.teamRole})`);
  console.log(`Brand: ${brand.name} (${brand.slug})`);

  // 3. Create a realistic poster FeatureRun.
  const run = await saveFeatureRun({
    userId: user.id,
    feature: "generate",
    subtype: "Poster",
    input: {
      brandSlug: brand.slug,
      contentType: "Poster", // = OUTPUT_TYPES poster label
      briefAnswers: {
        Objektif: "Tarik ibu bapa daftar kelas mengaji online untuk anak",
        "Audiens sasaran": "Ibu bapa Muslim 28-45 di Malaysia",
        "Mesej utama": "Anak boleh belajar Al-Quran dari rumah dengan ustaz bertauliah",
        Tawaran: "Kelas percubaan percuma minggu ini",
      },
    },
    output: {
      primaryPost:
        "Nak anak khatam Al-Quran tapi sibuk hantar ke kelas? Sekarang anak boleh belajar mengaji online dengan ustaz bertauliah, terus dari rumah. Jadual fleksibel, sesi one-to-one. Daftar kelas percubaan PERCUMA minggu ni!",
      caption: "Belajar mengaji dari rumah 📖",
      callToAction: "Daftar kelas percubaan percuma",
      hashtags: ["#NakNgaji", "#MengajiOnline", "#AlQuran"],
      strategyNote: "Test run for async visual generation",
      generatedAt: new Date().toISOString(),
    },
  });
  console.log(`FeatureRun created: ${run.id}`);

  // 4. Enqueue.
  const { job, reused } = await enqueueVisualJob({ featureRunId: run.id, userId: user.id });
  console.log(`Enqueued job ${job.id} (status=${job.status}, reused=${reused})`);

  // 5. Poll until terminal (max ~120s).
  const deadline = Date.now() + 120_000;
  let last = "";
  while (Date.now() < deadline) {
    await sleep(2000);
    const j = await getLatestJobForRun(run.id, user.id);
    if (!j) continue;
    if (j.status !== last) {
      console.log(`  [poll] status=${j.status}${j.claimedAt ? " (claimed)" : ""}`);
      last = j.status;
    }
    if (j.status === "succeeded") {
      console.log(`\n✅ SUCCEEDED — resultKind=${j.resultKind}, costMyr=RM${j.costMyr.toFixed(2)}`);
      const fresh = await prisma.creativeRun.findUnique({ where: { id: run.id } });
      const out = JSON.parse(fresh?.outputJson ?? "{}") as { image?: { urlPath?: string; kind?: string; scenes?: unknown[] } };
      const urlPath = out.image?.urlPath;
      console.log(`   image.kind=${out.image?.kind}, urlPath=${urlPath}`);
      if (urlPath) {
        const filePath = path.join(process.cwd(), "public", urlPath);
        console.log(`   file on disk: ${existsSync(filePath) ? "EXISTS ✅" : "MISSING ❌"} (${filePath})`);
      }
      return;
    }
    if (j.status === "failed") {
      console.log(`\n❌ FAILED — ${j.reason} (retryable=${j.retryable})`);
      return;
    }
  }
  console.log("\n⏱ TIMED OUT after 120s — is the worker running? (npm run worker)");
}

main()
  .catch((e) => { console.error("test error:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
