-- AlterTable
ALTER TABLE "Brand" ADD COLUMN     "audienceSegments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contentPillars" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "doNot" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fonts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "footer" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "religiousGuidelines" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "signaturePhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "templates" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "FeatureRun" ADD COLUMN     "contextUsed" JSONB,
ADD COLUMN     "inputText" TEXT,
ADD COLUMN     "inputUploads" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "intent" TEXT,
ADD COLUMN     "lens" TEXT,
ADD COLUMN     "recipeId" TEXT,
ADD COLUMN     "spec" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "team" TEXT NOT NULL DEFAULT 'single';

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT '',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "outputFormat" TEXT NOT NULL DEFAULT '',
    "lenses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expert" (
    "id" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "modelTier" TEXT NOT NULL DEFAULT 'standard',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "exportFormat" TEXT NOT NULL DEFAULT '',
    "mediaPath" TEXT,
    "feedback" INTEGER,
    "feedbackNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_taskType_key" ON "Recipe"("taskType");

-- CreateIndex
CREATE UNIQUE INDEX "Expert_roleKey_key" ON "Expert"("roleKey");

-- CreateIndex
CREATE INDEX "Artifact_runId_createdAt_idx" ON "Artifact"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureRun_recipeId_idx" ON "FeatureRun"("recipeId");

-- AddForeignKey
ALTER TABLE "FeatureRun" ADD CONSTRAINT "FeatureRun_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FeatureRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
