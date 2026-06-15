-- CreateTable
CREATE TABLE "MetaConnection" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "tokenEnc" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicPost" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "metaPostId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "caption" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT,
    "permalink" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganicPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganicMetricSnapshot" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "dateRange" TEXT NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "profileActions" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metricsJson" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganicMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCreative" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL DEFAULT '',
    "adsetId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "copyJson" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCreative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMetricSnapshot" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "dateRange" TEXT NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "results" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metricsJson" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySignal" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "decisionLabel" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "recommendation" TEXT NOT NULL DEFAULT '',
    "suggestedActions" TEXT NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dataJson" TEXT NOT NULL,
    "narrative" TEXT NOT NULL DEFAULT '',
    "exportPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaConnection_brandId_type_idx" ON "MetaConnection"("brandId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MetaConnection_brandId_type_externalId_key" ON "MetaConnection"("brandId", "type", "externalId");

-- CreateIndex
CREATE INDEX "OrganicPost_brandId_platform_publishedAt_idx" ON "OrganicPost"("brandId", "platform", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganicPost_brandId_metaPostId_key" ON "OrganicPost"("brandId", "metaPostId");

-- CreateIndex
CREATE INDEX "OrganicMetricSnapshot_postId_dateRange_idx" ON "OrganicMetricSnapshot"("postId", "dateRange");

-- CreateIndex
CREATE UNIQUE INDEX "OrganicMetricSnapshot_postId_dateRange_key" ON "OrganicMetricSnapshot"("postId", "dateRange");

-- CreateIndex
CREATE INDEX "AdCreative_brandId_campaignId_idx" ON "AdCreative"("brandId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreative_brandId_metaAdId_key" ON "AdCreative"("brandId", "metaAdId");

-- CreateIndex
CREATE INDEX "AdMetricSnapshot_adId_dateRange_idx" ON "AdMetricSnapshot"("adId", "dateRange");

-- CreateIndex
CREATE UNIQUE INDEX "AdMetricSnapshot_adId_dateRange_key" ON "AdMetricSnapshot"("adId", "dateRange");

-- CreateIndex
CREATE INDEX "DailySignal_brandId_channel_generatedAt_idx" ON "DailySignal"("brandId", "channel", "generatedAt");

-- CreateIndex
CREATE INDEX "Report_brandId_periodType_periodStart_idx" ON "Report"("brandId", "periodType", "periodStart");

-- AddForeignKey
ALTER TABLE "MetaConnection" ADD CONSTRAINT "MetaConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganicPost" ADD CONSTRAINT "OrganicPost_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganicMetricSnapshot" ADD CONSTRAINT "OrganicMetricSnapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "OrganicPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreative" ADD CONSTRAINT "AdCreative_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetricSnapshot" ADD CONSTRAINT "AdMetricSnapshot_adId_fkey" FOREIGN KEY ("adId") REFERENCES "AdCreative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySignal" ADD CONSTRAINT "DailySignal_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
