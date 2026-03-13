-- AlterTable
ALTER TABLE "Stats" ADD COLUMN "igAccessToken" TEXT;
ALTER TABLE "Stats" ADD COLUMN "igAvgComments" REAL;
ALTER TABLE "Stats" ADD COLUMN "igAvgLikes" REAL;
ALTER TABLE "Stats" ADD COLUMN "igEngagementRate" REAL;
ALTER TABLE "Stats" ADD COLUMN "igImpressions" INTEGER;
ALTER TABLE "Stats" ADD COLUMN "igProfileViews" INTEGER;
ALTER TABLE "Stats" ADD COLUMN "igReach" INTEGER;
ALTER TABLE "Stats" ADD COLUMN "igTokenExpiry" DATETIME;
ALTER TABLE "Stats" ADD COLUMN "igUserId" TEXT;
ALTER TABLE "Stats" ADD COLUMN "igWebsiteClicks" INTEGER;
