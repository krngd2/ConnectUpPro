-- CreateTable
CREATE TABLE "public"."Cluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "videoId" TEXT NOT NULL,
    "parentClusterId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."Comment" ADD COLUMN "clusterId" TEXT;

-- AddForeignKey (will be handled by Prisma's relation mode)
-- Note: These foreign key constraints are managed by Prisma in relationMode = "prisma"
