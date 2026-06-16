import { prisma } from "@/lib/prisma";

// Queue between the web app (enqueue) and the worker (claim → run → mark).
// Status: queued | processing | succeeded | failed.

const ACTIVE = ["queued", "processing"];

export type JobRow = {
  id: string;
  featureRunId: string;
  userId: string;
  brandId: string | null;
  kind: string;
  status: string;
  resultKind: string;
  costMyr: number;
  reason: string | null;
  retryable: boolean;
  claimedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// Idempotent: if an active (queued|processing) job already exists for this run,
// return it instead of creating a duplicate. Otherwise create a queued job.
export async function enqueueVisualJob(args: {
  featureRunId: string;
  userId: string;
  brandId?: string | null;
}): Promise<{ job: JobRow; reused: boolean }> {
  const existing = await prisma.generationJob.findFirst({
    where: { featureRunId: args.featureRunId, status: { in: ACTIVE } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { job: existing as JobRow, reused: true };

  const job = await prisma.generationJob.create({
    data: {
      featureRunId: args.featureRunId,
      userId: args.userId,
      brandId: args.brandId ?? null,
      kind: "visual",
      status: "queued",
    },
  });
  return { job: job as JobRow, reused: false };
}

// Latest job for a run, scoped to the owner (for poll + resume).
export async function getLatestJobForRun(featureRunId: string, userId: string): Promise<JobRow | null> {
  const job = await prisma.generationJob.findFirst({
    where: { featureRunId, userId },
    orderBy: { createdAt: "desc" },
  });
  return (job as JobRow) ?? null;
}

// Atomically claim the oldest queued job. Returns the claimed row, or null if
// none available. The conditional updateMany on status='queued' guarantees only
// one worker wins a given row (a loser sees count===0 and the caller retries).
export async function claimNextQueuedJob(): Promise<JobRow | null> {
  const candidate = await prisma.generationJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!candidate) return null;

  const claim = await prisma.generationJob.updateMany({
    where: { id: candidate.id, status: "queued" },
    data: { status: "processing", claimedAt: new Date() },
  });
  if (claim.count !== 1) return null; // lost the race — caller loops

  const claimed = await prisma.generationJob.findUnique({ where: { id: candidate.id } });
  return (claimed as JobRow) ?? null;
}

export async function markSucceeded(
  jobId: string,
  result: { resultKind: "image" | "skipped"; costMyr?: number },
): Promise<void> {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "succeeded", reason: null, resultKind: result.resultKind, costMyr: result.costMyr ?? 0 },
  });
}

export async function markFailed(jobId: string, reason: string, retryable: boolean): Promise<void> {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "failed", reason, retryable },
  });
}

// Watchdog: any job stuck in `processing` whose claim is older than maxAgeMs is
// marked failed(stale) so the user can re-generate. Returns how many were swept.
export async function sweepStaleJobs(maxAgeMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const res = await prisma.generationJob.updateMany({
    where: { status: "processing", claimedAt: { lt: cutoff } },
    data: {
      status: "failed",
      reason: "Generation tersangkut terlalu lama (stale) — cuba jana semula.",
      retryable: true,
    },
  });
  return res.count;
}
