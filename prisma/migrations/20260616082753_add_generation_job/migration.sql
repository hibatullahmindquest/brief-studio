-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "featureRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'visual',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT true,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_featureRunId_createdAt_idx" ON "GenerationJob"("featureRunId", "createdAt");
