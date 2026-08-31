-- Database Cleanup Queries
-- These queries help identify and remove orphaned data

-- ============================================
-- 1. IDENTIFY ORPHANED CLUSTERS
-- ============================================

-- Find clusters with missing video references
SELECT 
  c.id,
  c.name,
  c.videoId,
  c.parentClusterId,
  c.level,
  c."commentCount"
FROM "Cluster" c
LEFT JOIN "Video" v ON c."videoId" = v."id"
WHERE v."id" IS NULL
ORDER BY c.level DESC, c."createdAt" DESC;

-- Find clusters with missing parent cluster references
SELECT 
  c.id,
  c.name,
  c.parentClusterId,
  c.level,
  c."commentCount"
FROM "Cluster" c
WHERE c."parentClusterId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "Cluster" p WHERE p."id" = c."parentClusterId")
ORDER BY c.level DESC;

-- ============================================
-- 2. IDENTIFY ORPHANED COMMENTS
-- ============================================

-- Find comments with missing video references
SELECT 
  c.id,
  c."platformId",
  c.text,
  c."videoId",
  c."clusterId",
  c."timestamp"
FROM "Comment" c
LEFT JOIN "Video" v ON c."videoId" = v."id"
WHERE v."id" IS NULL
ORDER BY c."timestamp" DESC;

-- Find comments with missing cluster references
SELECT 
  c.id,
  c."platformId",
  c.text,
  c."videoId",
  c."clusterId",
  c."timestamp"
FROM "Comment" c
WHERE c."clusterId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "Cluster" cl WHERE cl."id" = c."clusterId")
ORDER BY c."timestamp" DESC;

-- ============================================
-- 3. DELETE ORPHANED RECORDS
-- ============================================

-- DELETE all clusters with missing video references
DELETE FROM "Cluster" c
WHERE NOT EXISTS (SELECT 1 FROM "Video" v WHERE v."id" = c."videoId");

-- DELETE all clusters with missing parent cluster references
DELETE FROM "Cluster" c
WHERE c."parentClusterId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "Cluster" p WHERE p."id" = c."parentClusterId");

-- DELETE all comments with missing video references
DELETE FROM "Comment" c
WHERE NOT EXISTS (SELECT 1 FROM "Video" v WHERE v."id" = c."videoId");

-- SET NULL on comments with missing cluster references (preserve comments, clear invalid references)
UPDATE "Comment" c
SET "clusterId" = NULL
WHERE c."clusterId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "Cluster" cl WHERE cl."id" = c."clusterId");

-- ============================================
-- 4. DATA INTEGRITY REPORT
-- ============================================

-- Total record counts
SELECT 
  'Videos' as entity,
  COUNT(*) as count
FROM "Video"
UNION ALL
SELECT 'Clusters', COUNT(*) FROM "Cluster"
UNION ALL
SELECT 'Comments', COUNT(*) FROM "Comment";

-- Cluster hierarchy statistics
SELECT 
  "level",
  COUNT(*) as cluster_count,
  SUM("commentCount") as total_comments_in_clusters
FROM "Cluster"
GROUP BY "level"
ORDER BY "level" ASC;

-- Comments per video (summary)
SELECT 
  v.id,
  v.name,
  COUNT(DISTINCT c.id) as comment_count,
  COUNT(DISTINCT cl.id) as cluster_count
FROM "Video" v
LEFT JOIN "Comment" c ON v.id = c."videoId"
LEFT JOIN "Cluster" cl ON v.id = cl."videoId"
GROUP BY v.id, v.name
ORDER BY comment_count DESC;

-- Clusters with their child counts
SELECT 
  c.id,
  c.name,
  c.level,
  c."commentCount",
  COUNT(DISTINCT sub.id) as subcluster_count
FROM "Cluster" c
LEFT JOIN "Cluster" sub ON sub."parentClusterId" = c.id
GROUP BY c.id, c.name, c.level, c."commentCount"
ORDER BY c.level ASC, subcluster_count DESC;

-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

-- Verify all clusters have valid video references
SELECT 
  COUNT(*) as clusters_with_orphaned_videos
FROM "Cluster"
WHERE NOT EXISTS (SELECT 1 FROM "Video" WHERE "Video".id = "Cluster"."videoId");

-- Verify all sub-clusters have valid parent references
SELECT 
  COUNT(*) as clusters_with_orphaned_parents
FROM "Cluster"
WHERE "parentClusterId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "Cluster" p WHERE p.id = "Cluster"."parentClusterId");

-- Verify all comments have valid video references
SELECT 
  COUNT(*) as comments_with_orphaned_videos
FROM "Comment"
WHERE NOT EXISTS (SELECT 1 FROM "Video" WHERE "Video".id = "Comment"."videoId");

-- Verify no comments point to deleted clusters
SELECT 
  COUNT(*) as comments_with_orphaned_clusters
FROM "Comment"
WHERE "clusterId" IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM "Cluster" WHERE "Cluster".id = "Comment"."clusterId");

-- ============================================
-- 6. CASCADE DELETE REFERENCE (for documentation)
-- ============================================

-- Constraints with CASCADE delete:
-- - Cluster.videoId → Video.id (CASCADE)
-- - Cluster.parentClusterId → Cluster.id (CASCADE)
-- - Comment.videoId → Video.id (CASCADE)
-- - Comment.clusterId → Cluster.id (SET NULL)

-- When a video is deleted:
-- 1. All clusters with that videoId are deleted (CASCADE)
-- 2. All sub-clusters of those clusters are deleted (CASCADE via parentClusterId)
-- 3. All comments with that videoId are deleted (CASCADE)
-- 4. All comments in those clusters have clusterId set to NULL (indirect CASCADE)

-- ============================================
-- 7. MAINTENANCE
-- ============================================

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
AND tablename IN ('Video', 'Cluster', 'Comment')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Analyze tables for query optimization
ANALYZE "Video";
ANALYZE "Cluster";
ANALYZE "Comment";

-- Rebuild indexes
REINDEX TABLE "Video";
REINDEX TABLE "Cluster";
REINDEX TABLE "Comment";
