-- CreateTable
CREATE TABLE "APIUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT,
    "featureRunId" TEXT,
    "module" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "imageSize" TEXT NOT NULL DEFAULT '',
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costMyr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "APIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "APIUsageLog_userId_createdAt_idx" ON "APIUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "APIUsageLog_brandId_module_createdAt_idx" ON "APIUsageLog"("brandId", "module", "createdAt");

-- AddForeignKey
ALTER TABLE "APIUsageLog" ADD CONSTRAINT "APIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
