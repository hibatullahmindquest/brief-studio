// SCIS visual generation worker — poll loop.
//
// Concurrency 1: claim one queued job, run it to completion, then claim the
// next. Each loop first sweeps stale `processing` jobs (watchdog). The web app
// never runs OpenAI calls — it only enqueues; all heavy work happens here, so a
// closed browser tab can't drop a generation.
import { claimNextQueuedJob, markSucceeded, markFailed, sweepStaleJobs } from "../lib/job-store";
import { runVisualJob } from "../lib/visual-job";

const POLL_MS = 2_000;
const STALE_MS = 5 * 60 * 1_000; // watchdog: processing > 5 min → failed(stale)

let running = true;
const stop = (sig: string) => {
  console.log(`[worker] ${sig} received — finishing current job then stopping`);
  running = false;
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// One iteration. Returns true if a job was processed (so the caller loops
// immediately to drain the queue), false if the queue was empty.
async function tick(): Promise<boolean> {
  const swept = await sweepStaleJobs(STALE_MS);
  if (swept > 0) console.log(`[worker] watchdog marked ${swept} stale job(s) failed`);

  const job = await claimNextQueuedJob();
  if (!job) return false;

  console.log(`[worker] claimed job ${job.id} (run ${job.featureRunId})`);
  const result = await runVisualJob({ featureRunId: job.featureRunId, userId: job.userId });

  if (result.ok && result.shouldRender) {
    await markSucceeded(job.id, { resultKind: "image", costMyr: result.costMyr });
    console.log(`[worker] job ${job.id} ✓ image (RM${result.costMyr.toFixed(2)})`);
  } else if (result.ok) {
    await markSucceeded(job.id, { resultKind: "skipped" });
    console.log(`[worker] job ${job.id} ✓ skipped (AI: no image needed)`);
  } else {
    await markFailed(job.id, result.reason, result.retryable);
    console.log(`[worker] job ${job.id} ✗ failed — ${result.reason}`);
  }
  return true;
}

async function main() {
  console.log(`[worker] SCIS visual worker started — poll ${POLL_MS}ms, stale ${STALE_MS / 60000}min`);
  while (running) {
    let processed = false;
    try {
      processed = await tick();
    } catch (err) {
      // A thrown tick (e.g. DB blip) leaves any claimed job in `processing`;
      // the watchdog will reclaim it as stale. Log and keep the loop alive.
      console.error("[worker] tick error:", err);
    }
    if (!processed) await sleep(POLL_MS);
  }
  console.log("[worker] stopped cleanly");
  process.exit(0);
}

void main();
