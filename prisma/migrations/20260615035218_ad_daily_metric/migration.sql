-- CreateTable
CREATE TABLE "AdDailyMetric" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "waConversations" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT NOT NULL DEFAULT '',
    "adsetName" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "effectiveStatus" TEXT NOT NULL DEFAULT '',
    "metricsJson" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdDailyMetric_brandId_metricDate_idx" ON "AdDailyMetric"("brandId", "metricDate");

-- CreateIndex
CREATE INDEX "AdDailyMetric_adId_metricDate_idx" ON "AdDailyMetric"("adId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "AdDailyMetric_adId_metricDate_key" ON "AdDailyMetric"("adId", "metricDate");

-- AddForeignKey
ALTER TABLE "AdDailyMetric" ADD CONSTRAINT "AdDailyMetric_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdCreative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdDailyMetric" ADD CONSTRAINT "AdDailyMetric_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
