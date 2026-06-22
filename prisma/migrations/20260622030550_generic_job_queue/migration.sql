-- DropIndex
DROP INDEX "GenerationJob_status_createdAt_idx";

-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "lane" TEXT NOT NULL DEFAULT 'interactive',
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "payload" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "result" JSONB,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ALTER COLUMN "featureRunId" DROP NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "kind" SET DEFAULT 'generate';

-- CreateIndex
CREATE INDEX "GenerationJob_lane_status_scheduledAt_idx" ON "GenerationJob"("lane", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "GenerationJob_dedupeKey_idx" ON "GenerationJob"("dedupeKey");
