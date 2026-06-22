// Integration checks for the generic queue against the local dev DB.
// Run: DATABASE_URL=... npx tsx scripts/m0-verify.ts   (exits 1 on any failure)
import { prisma } from "@/lib/prisma";
import { enqueue, claimNextJob, markSucceeded, markFailedOrRetry } from "@/lib/job-store";

let failed = 0;
const ok = (name: string, cond: boolean) => { console.log(`${cond ? "PASS" : "FAIL"} — ${name}`); if (!cond) failed++; };

async function main() {
  const tag = "m0test:" + Math.floor(Math.random() * 1e9); // unique per run (no Date.now in asserts)

  // 1) enqueue + dedupe
  const a = await enqueue({ kind: "noop", lane: "background", dedupeKey: tag, maxAttempts: 2 });
  const b = await enqueue({ kind: "noop", lane: "background", dedupeKey: tag, maxAttempts: 2 });
  ok("dedupeKey reuses active job", b.reused && b.job.id === a.job.id);

  // 2) lane claim isolation
  const iJob = await enqueue({ kind: "noop", lane: "interactive", dedupeKey: tag + ":i" });
  const claimedBg = await claimNextJob("background");
  ok("background lane claims the background job", claimedBg?.id === a.job.id);
  const claimedI = await claimNextJob("interactive");
  ok("interactive lane claims its own job", claimedI?.id === iJob.job.id);

  // 3) success
  await markSucceeded(a.job.id, { resultKind: "skipped", costMyr: 0 });
  const aRow = await prisma.job.findUnique({ where: { id: a.job.id } });
  ok("markSucceeded sets succeeded", aRow?.status === "succeeded");

  // 4) retry then terminal (maxAttempts=2 → 1 requeue, then fail)
  const c = await enqueue({ kind: "noop", lane: "background", dedupeKey: tag + ":r", maxAttempts: 2 });
  const r1 = await markFailedOrRetry(c.job.id, "boom", true);
  ok("first retryable failure re-queues", r1.requeued === true);
  const cRow1 = await prisma.job.findUnique({ where: { id: c.job.id } });
  ok("re-queue bumps attempts + sets scheduledAt", cRow1?.attempts === 1 && cRow1?.scheduledAt != null && cRow1?.status === "queued");
  const r2 = await markFailedOrRetry(c.job.id, "boom", true);
  ok("attempts exhausted → terminal failed", r2.requeued === false);
  const cRow2 = await prisma.job.findUnique({ where: { id: c.job.id } });
  ok("status failed after maxAttempts", cRow2?.status === "failed" && cRow2?.attempts === 2);

  // 5) non-retryable fails immediately
  const d = await enqueue({ kind: "noop", lane: "background", dedupeKey: tag + ":n", maxAttempts: 3 });
  const rd = await markFailedOrRetry(d.job.id, "nope", false);
  ok("non-retryable fails without requeue", rd.requeued === false);

  // cleanup
  await prisma.job.deleteMany({ where: { dedupeKey: { startsWith: tag } } });

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
