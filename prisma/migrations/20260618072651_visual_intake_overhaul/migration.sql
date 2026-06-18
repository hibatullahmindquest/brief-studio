-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "posterFooterLeft" TEXT,
ADD COLUMN     "posterFooterRight" TEXT;

-- AlterTable
ALTER TABLE "FeatureRun" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'generated';
