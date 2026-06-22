// Generic worker poll loop, scoped to one lane (WORKER_LANE env).
import { claimNextJob, markSucceeded, markFailedOrRetry, sweepStaleJobs } from "../lib/job-store";
import { dispatch } from "./dispatch";
import type { Lane } from "../lib/job-kinds";

const LANE = (process.env.WORKER_LANE as Lane) || "interactive";
const POLL_MS = 2_000;
const STALE_MS = 5 * 60 * 1_000;

let running = true;
const stop = (sig: string) => { console.log(`[worker:${LANE}] ${sig} — finishing then stopping`); running = false; };
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tick(): Promise<boolean> {
  const swept = await sweepStaleJobs(STALE_MS);
  if (swept > 0) console.log(`[worker:${LANE}] watchdog swept ${swept} stale`);

  const job = await claimNextJob(LANE);
  if (!job) return false;

  console.log(`[worker:${LANE}] claimed ${job.id} kind=${job.kind} attempt=${job.attempts + 1}`);
  const r = await dispatch(job);

  if (r.ok) {
    await markSucceeded(job.id, { resultKind: r.resultKind, result: r.result, costMyr: r.costMyr });
    console.log(`[worker:${LANE}] ${job.id} ✓ (RM${(r.costMyr ?? 0).toFixed(2)})`);
  } else {
    const { requeued } = await markFailedOrRetry(job.id, r.reason ?? "unknown", r.retryable ?? false);
    console.log(`[worker:${LANE}] ${job.id} ✗ ${r.reason} — ${requeued ? "re-queued" : "failed"}`);
  }
  return true;
}

async function main() {
  console.log(`[worker:${LANE}] started — poll ${POLL_MS}ms, stale ${STALE_MS / 60000}min`);
  while (running) {
    let processed = false;
    try { processed = await tick(); }
    catch (err) { console.error(`[worker:${LANE}] tick error:`, err); }
    if (!processed) await sleep(POLL_MS);
  }
  console.log(`[worker:${LANE}] stopped cleanly`);
  process.exit(0);
}
void main();
