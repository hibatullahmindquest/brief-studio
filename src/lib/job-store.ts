import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { laneForKind, type Lane } from "@/lib/job-kinds";
import { nextScheduledAt } from "@/lib/job-backoff";

// Generic queue between the web app (enqueue) and the worker (claim → run → mark).
// Status: queued | processing | succeeded | failed.
const ACTIVE = ["queued", "processing"];

export type JobRow = {
  id: string;
  kind: string;
  lane: string;
  payload: unknown;
  dedupeKey: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date | null;
  claimedAt: Date | null;
  resultKind: string;
  result: unknown;
  costMyr: number;
  reason: string | null;
  retryable: boolean;
  featureRunId: string | null;
  userId: string | null;
  brandId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// Generic enqueue. Idempotent on dedupeKey: if an active (queued|processing) job with the
// same dedupeKey exists, reuse it instead of creating a duplicate.
//
// The dedupe is made RACE-SAFE with a per-key Postgres advisory lock inside a transaction:
// two concurrent enqueues for the SAME dedupeKey (e.g. a double-fired Confirm, or a retry) are
// serialized, so they can never both pass the "no active job" check and create two jobs. The
// lock is PER-KEY, so DIFFERENT runs/users still enqueue fully in parallel — multi-user
// concurrency is preserved. Retry-safe: a failed/succeeded job is not "active", so a later
// enqueue for the same key creates a fresh job.
export async function enqueue(args: {
  kind: string;
  payload?: unknown;
  dedupeKey?: string | null;
  lane?: Lane;
  userId?: string | null;
  brandId?: string | null;
  featureRunId?: string | null;
  maxAttempts?: number;
  scheduledAt?: Date | null;
}): Promise<{ job: JobRow; reused: boolean }> {
  const data = {
    kind: args.kind,
    lane: args.lane ?? laneForKind(args.kind),
    payload: (args.payload ?? {}) as object,
    dedupeKey: args.dedupeKey ?? null,
    userId: args.userId ?? null,
    brandId: args.brandId ?? null,
    featureRunId: args.featureRunId ?? null,
    maxAttempts: args.maxAttempts ?? 3,
    scheduledAt: args.scheduledAt ?? null,
    status: "queued",
  };

  if (args.dedupeKey) {
    const key = args.dedupeKey;
    return await prisma.$transaction(async (tx) => {
      // serialize concurrent enqueues for this key only (advisory xact lock auto-releases on commit)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key})::bigint)`;
      const existing = await tx.job.findFirst({
        where: { dedupeKey: key, status: { in: ACTIVE } },
        orderBy: { createdAt: "desc" },
      });
      if (existing) return { job: existing as JobRow, reused: true };
      const job = await tx.job.create({ data });
      return { job: job as JobRow, reused: false };
    });
  }

  const job = await prisma.job.create({ data });
  return { job: job as JobRow, reused: false };
}

// Thin wrapper preserving the visual flow's call-site + per-run idempotency.
export async function enqueueVisualJob(args: {
  featureRunId: string;
  userId: string;
  brandId?: string | null;
}): Promise<{ job: JobRow; reused: boolean }> {
  return enqueue({
    kind: "generate",
    lane: "interactive",
    dedupeKey: args.featureRunId, // one active generate per run (unchanged behaviour)
    featureRunId: args.featureRunId,
    userId: args.userId,
    brandId: args.brandId ?? null,
    payload: { featureRunId: args.featureRunId, userId: args.userId },
  });
}

// Latest job for a run, scoped to owner (visual poll + resume).
export async function getLatestJobForRun(featureRunId: string, userId: string): Promise<JobRow | null> {
  const job = await prisma.job.findFirst({
    where: { featureRunId, userId },
    orderBy: { createdAt: "desc" },
  });
  return (job as JobRow) ?? null;
}

// Atomically claim the oldest eligible queued job IN A LANE. Eligible =
// status queued AND (scheduledAt null OR <= now). The conditional updateMany on
// status='queued' guarantees a single worker wins the row.
export async function claimNextJob(lane: Lane): Promise<JobRow | null> {
  const now = new Date();
  const candidate = await prisma.job.findFirst({
    where: {
      lane,
      status: "queued",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;

  const claim = await prisma.job.updateMany({
    where: { id: candidate.id, status: "queued" },
    data: { status: "processing", claimedAt: now },
  });
  if (claim.count !== 1) return null; // lost the race — caller loops

  const claimed = await prisma.job.findUnique({ where: { id: candidate.id } });
  return (claimed as JobRow) ?? null;
}

export async function markSucceeded(
  jobId: string,
  out: { resultKind?: string; result?: unknown; costMyr?: number },
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: "succeeded",
      reason: null,
      resultKind: out.resultKind ?? "",
      costMyr: out.costMyr ?? 0,
      // Only touch the Json column when the caller passed a result; null → SQL NULL.
      ...(out.result === undefined
        ? {}
        : { result: out.result === null ? Prisma.JsonNull : (out.result as Prisma.InputJsonValue) }),
    },
  });
}

// Retry-aware failure. If retryable and we have attempts left, re-queue with a
// backoff delay (attempts++). Otherwise mark terminally failed.
export async function markFailedOrRetry(
  jobId: string,
  reason: string,
  retryable: boolean,
): Promise<{ requeued: boolean }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { requeued: false };
  const attempts = job.attempts + 1;

  if (retryable && attempts < job.maxAttempts) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "queued",
        attempts,
        reason,
        retryable,
        claimedAt: null,
        scheduledAt: nextScheduledAt(attempts),
      },
    });
    return { requeued: true };
  }
  await prisma.job.update({
    where: { id: jobId },
    data: { status: "failed", attempts, reason, retryable },
  });
  return { requeued: false };
}

// Watchdog: jobs stuck in `processing` past maxAgeMs are pushed back through the
// retry path (so they re-queue if attempts remain, else fail).
export async function sweepStaleJobs(maxAgeMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const stale = await prisma.job.findMany({
    where: { status: "processing", claimedAt: { lt: cutoff } },
    select: { id: true },
  });
  for (const s of stale) {
    await markFailedOrRetry(s.id, "Job stuck too long (stale) — re-queued.", true);
  }
  return stale.length;
}
