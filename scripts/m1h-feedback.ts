// Module 1 Phase H — Prompt 0 checks: per-run feedback (DB-backed, NO OpenAI).
//   setRunFeedback set/toggle/clear/note + owner scope + value validation; getRunArtifacts surfaces it.
// Run: DATABASE_URL=... npx tsx scripts/m1h-feedback.ts
import { prisma } from "@/lib/prisma";
import { setRunFeedback } from "@/lib/studio-feedback";
import { getRunArtifacts } from "@/lib/artifact-store";
import { StudioError } from "@/lib/studio-error";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function seedRun(userId: string, brandId: string): Promise<string> {
  const run = await prisma.creativeRun.create({
    data: { userId, brandId, feature: "poster", lens: "marketing", title: "H run", inputText: "b", spec: {}, status: "generated", outputJson: "{}" },
    select: { id: true },
  });
  return run.id;
}

async function expectStudioError(fn: () => Promise<unknown>, status: number, label: string) {
  try { await fn(); ok(label, false); }
  catch (e) { ok(label, e instanceof StudioError && e.status === status); }
}

async function main() {
  const brand = await prisma.brand.findFirstOrThrow({ where: { slug: "sifututor" } });
  const ts = Date.now();
  const u1 = await prisma.user.create({ data: { email: `m1h_a_${ts}@t.local`, username: `m1h_a_${ts}`, password: "x", name: "A", teamRole: "marketing", team: "all" }, select: { id: true } });
  const u2 = await prisma.user.create({ data: { email: `m1h_b_${ts}@t.local`, username: `m1h_b_${ts}`, password: "x", name: "B", teamRole: "marketing", team: "all" }, select: { id: true } });
  const runIds: string[] = [];

  try {
    const r = await seedRun(u1.id, brand.id); runIds.push(r);

    // thumbs up
    const up = await setRunFeedback({ id: u1.id }, r, 1);
    ok("👍 sets feedback=1, note null", up.feedback === 1 && up.feedbackNote === null);

    // thumbs down with note
    const down = await setRunFeedback({ id: u1.id }, r, -1, "  warna tak match brand  ");
    ok("👎 sets feedback=-1 + trimmed note", down.feedback === -1 && down.feedbackNote === "warna tak match brand");

    // flip back to up clears the note
    const up2 = await setRunFeedback({ id: u1.id }, r, 1);
    ok("👍 again clears the note", up2.feedback === 1 && up2.feedbackNote === null);

    // clear (toggle off)
    const cleared = await setRunFeedback({ id: u1.id }, r, 0);
    ok("clear (0) → feedback null", cleared.feedback === null && cleared.feedbackNote === null);

    // persisted + surfaced via the read layer
    await setRunFeedback({ id: u1.id }, r, -1, "off tone");
    const ga = await getRunArtifacts(r, u1.id);
    ok("getRunArtifacts surfaces run.feedback", ga?.run.feedback === -1 && ga?.run.feedbackNote === "off tone");

    // value validation
    await expectStudioError(() => setRunFeedback({ id: u1.id }, r, 2), 400, "bad value (2) → 400");
    await expectStudioError(() => setRunFeedback({ id: u1.id }, r, 0.5), 400, "bad value (0.5) → 400");

    // owner scope
    await expectStudioError(() => setRunFeedback({ id: u2.id }, r, 1), 404, "non-owner → 404");
    await expectStudioError(() => setRunFeedback({ id: u1.id }, "no-such-run", 1), 404, "missing run → 404");
  } finally {
    if (runIds.length) await prisma.creativeRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [u1.id, u2.id] } } });
  }
}

main()
  .then(() => { console.log(failed ? `\n${failed} FAILED` : "\nALL PASS"); process.exit(failed ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
