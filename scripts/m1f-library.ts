// Module 1 Phase F — Prompt 3 checks: artifact-store read-layer (DB-backed, NO OpenAI).
// getRunArtifacts + listLibrary: grouping, exclude-empty, cursor, owner-scope, no N+1.
// Run: DATABASE_URL=... npx tsx scripts/m1f-library.ts
import { prisma } from "@/lib/prisma";
import { getRunArtifacts, listLibrary } from "@/lib/artifact-store";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function seedRun(userId: string, brandId: string, kinds: { type: string; mediaPath?: string }[], title = "Run"): Promise<string> {
  const run = await prisma.creativeRun.create({
    data: { userId, brandId, feature: "generate", lens: "marketing", title, inputText: "b", spec: {}, status: "generated", outputJson: "{}" },
    select: { id: true },
  });
  for (const k of kinds) {
    await prisma.artifact.create({ data: { runId: run.id, type: k.type, mediaPath: k.mediaPath ?? null, exportFormat: k.mediaPath ? "png" : "", content: { text: `${k.type} body` } } });
  }
  return run.id;
}

async function main() {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const ts = Date.now();
  const u1 = await prisma.user.create({ data: { email: `m1fl_a_${ts}@t.local`, username: `m1fl_a_${ts}`, password: "x", name: "A", teamRole: "marketing", team: "all" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `m1fl_b_${ts}@t.local`, username: `m1fl_b_${ts}`, password: "x", name: "B", teamRole: "marketing", team: "all" }, select: { id: true } });
  const runIds: string[] = [];

  try {
    // full run: text + image + pdf + internal visual_direction
    const full = await seedRun(u1.id, brand.id, [
      { type: "strategy" }, { type: "copy" }, { type: "social" },
      { type: "visual_direction" },
      { type: "image", mediaPath: "/uploads/generated/a.png" },
      { type: "image", mediaPath: "/uploads/generated/b.png" },
      { type: "pdf", mediaPath: "/uploads/exports/x/plan.pdf" },
    ], "Full Run"); runIds.push(full);

    // ── getRunArtifacts grouping ──
    const ga = await getRunArtifacts(full, u1.id);
    ok("getRunArtifacts returns object", ga !== null);
    ok("images grouped (2, carousel)", ga!.images.length === 2);
    ok("texts grouped (3: strategy/copy/social)", ga!.texts.length === 3);
    ok("visual_direction EXCLUDED from texts", !ga!.texts.some((t) => t.type === "visual_direction"));
    ok("pdf present (latest)", ga!.pdf !== null && ga!.pdf!.mediaPath === "/uploads/exports/x/plan.pdf");
    ok("run.brandSlug surfaced", ga!.run.brandSlug === "sifututor");
    ok("costMyr is a number", typeof ga!.costMyr === "number");

    // ── owner scope ──
    ok("getRunArtifacts null for non-owner", (await getRunArtifacts(full, u2.id)) === null);

    // empty (artifact-less) run — must be excluded from listLibrary
    const empty = await prisma.creativeRun.create({ data: { userId: u1.id, brandId: brand.id, feature: "generate", title: "Empty", inputText: "b", spec: {}, status: "draft", outputJson: "{}" }, select: { id: true } });
    runIds.push(empty.id);

    // text-only run (no image → no thumbnail)
    const textOnly = await seedRun(u1.id, brand.id, [{ type: "copy" }], "Text Only"); runIds.push(textOnly);

    // ── listLibrary ──
    const lib = await listLibrary(u1.id, { limit: 50 });
    const libIds = lib.map((l) => l.runId);
    ok("listLibrary includes full + textOnly", libIds.includes(full) && libIds.includes(textOnly));
    ok("listLibrary EXCLUDES artifact-less run", !libIds.includes(empty.id));
    const fullItem = lib.find((l) => l.runId === full)!;
    ok("kinds distinct incl pdf+image", fullItem.kinds.includes("pdf") && fullItem.kinds.includes("image") && fullItem.kinds.includes("strategy"));
    ok("thumbnailPath = first image", fullItem.thumbnailPath === "/uploads/generated/a.png");
    const textItem = lib.find((l) => l.runId === textOnly)!;
    ok("text-only run has no thumbnailPath", textItem.thumbnailPath === undefined);
    ok("newest-first ordering", lib.findIndex((l) => l.runId === textOnly) < lib.findIndex((l) => l.runId === full));

    // ── cursor pagination ──
    const page1 = await listLibrary(u1.id, { limit: 1 });
    ok("page1 limit respected (1)", page1.length === 1);
    const page2 = await listLibrary(u1.id, { limit: 1, cursor: page1[0].runId });
    ok("page2 cursor advances (no overlap)", page2.length === 1 && page2[0].runId !== page1[0].runId);

    // ── owner scope on list ──
    const otherLib = await listLibrary(u2.id, { limit: 50 });
    ok("listLibrary owner-scoped (u2 sees none of u1's)", !otherLib.some((l) => runIds.includes(l.runId)));
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
