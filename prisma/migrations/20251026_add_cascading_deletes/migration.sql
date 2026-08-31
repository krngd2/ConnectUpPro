-- AlterTable - Add cascading delete constraints for proper data integrity
-- Note: Using relationMode "foreignKeys" to support CASCADE on self-relations

-- First, drop the existing foreign key constraints
ALTER TABLE "Cluster" DROP CONSTRAINT IF EXISTS "Cluster_videoId_fkey";
ALTER TABLE "Cluster" DROP CONSTRAINT IF EXISTS "Cluster_parentClusterId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_videoId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_clusterId_fkey";

-- Add the new constraints with CASCADE delete for hierarchical deletion:
-- 1. Video -> Cluster: CASCADE (delete video cascades to all clusters including nested)
-- 2. Cluster -> parentCluster: CASCADE (delete parent cluster cascades to child clusters)
-- 3. Video -> Comment: CASCADE (delete video cascades to all comments)
-- 4. Cluster -> Comment: SET NULL (delete cluster, preserve comments but unlink them)

ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Cluster" ADD CONSTRAINT "Cluster_parentClusterId_fkey" FOREIGN KEY ("parentClusterId") REFERENCES "Cluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for better query performance on foreign key columns
CREATE INDEX IF NOT EXISTS "Cluster_videoId_idx" ON "Cluster"("videoId");
CREATE INDEX IF NOT EXISTS "Cluster_parentClusterId_idx" ON "Cluster"("parentClusterId");
CREATE INDEX IF NOT EXISTS "Comment_videoId_idx" ON "Comment"("videoId");
CREATE INDEX IF NOT EXISTS "Comment_clusterId_idx" ON "Comment"("clusterId");
