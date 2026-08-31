/**
 * Cleanup script to remove orphaned clusters and comments
 * 
 * This script identifies and removes:
 * 1. Clusters that reference deleted videos
 * 2. Clusters that reference deleted parent clusters
 * 3. Comments that reference deleted videos
 * 4. Comments that reference deleted clusters
 * 
 * Run with: npx ts-node scripts/cleanup-orphaned-data.ts
 */

import { prisma } from '@/lib/db';

async function cleanupOrphanedData() {
    try {
        console.log('[CLEANUP] Starting orphaned data cleanup...\n');

        // Step 1: Find and delete clusters with missing videos
        console.log('[CLEANUP] Step 1: Finding clusters with deleted videos...');
        const orphanedClusters = await prisma.$queryRaw<Array<{ id: string; videoId: string }>>`
      SELECT c."id", c."videoId" 
      FROM "Cluster" c
      LEFT JOIN "Video" v ON c."videoId" = v."id"
      WHERE v."id" IS NULL
    `;

        if (orphanedClusters.length > 0) {
            console.log(`[CLEANUP] Found ${orphanedClusters.length} orphaned clusters with missing videos`);

            const deletedOrphanClusters = await prisma.cluster.deleteMany({
                where: {
                    id: { in: orphanedClusters.map(c => c.id) }
                }
            });

            console.log(`[CLEANUP] Deleted ${deletedOrphanClusters.count} orphaned clusters\n`);
        } else {
            console.log('[CLEANUP] No orphaned clusters found with missing videos\n');
        }

        // Step 2: Find and delete clusters with missing parent clusters
        console.log('[CLEANUP] Step 2: Finding clusters with deleted parent clusters...');
        const orphanedSubClusters = await prisma.$queryRaw<Array<{ id: string; parentClusterId: string }>>`
      SELECT c."id", c."parentClusterId" 
      FROM "Cluster" c
      WHERE c."parentClusterId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Cluster" p WHERE p."id" = c."parentClusterId")
    `;

        if (orphanedSubClusters.length > 0) {
            console.log(`[CLEANUP] Found ${orphanedSubClusters.length} orphaned sub-clusters with missing parent clusters`);

            const deletedOrphanSubClusters = await prisma.cluster.deleteMany({
                where: {
                    id: { in: orphanedSubClusters.map(c => c.id) }
                }
            });

            console.log(`[CLEANUP] Deleted ${deletedOrphanSubClusters.count} orphaned sub-clusters\n`);
        } else {
            console.log('[CLEANUP] No orphaned sub-clusters found with missing parent clusters\n');
        }

        // Step 3: Find and delete comments with missing videos
        console.log('[CLEANUP] Step 3: Finding comments with deleted videos...');
        const orphanedCommentsByVideo = await prisma.$queryRaw<Array<{ id: string; videoId: string }>>`
      SELECT c."id", c."videoId" 
      FROM "Comment" c
      LEFT JOIN "Video" v ON c."videoId" = v."id"
      WHERE v."id" IS NULL
    `;

        if (orphanedCommentsByVideo.length > 0) {
            console.log(`[CLEANUP] Found ${orphanedCommentsByVideo.length} orphaned comments with missing videos`);

            const deletedOrphanCommentsByVideo = await prisma.comment.deleteMany({
                where: {
                    id: { in: orphanedCommentsByVideo.map(c => c.id) }
                }
            });

            console.log(`[CLEANUP] Deleted ${deletedOrphanCommentsByVideo.count} orphaned comments\n`);
        } else {
            console.log('[CLEANUP] No orphaned comments found with missing videos\n');
        }

        // Step 4: Find and reset comments pointing to deleted clusters
        console.log('[CLEANUP] Step 4: Finding comments pointing to deleted clusters...');
        const orphanedCommentsByCluster = await prisma.$queryRaw<Array<{ id: string; clusterId: string }>>`
      SELECT c."id", c."clusterId" 
      FROM "Comment" c
      WHERE c."clusterId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Cluster" cl WHERE cl."id" = c."clusterId")
    `;

        if (orphanedCommentsByCluster.length > 0) {
            console.log(`[CLEANUP] Found ${orphanedCommentsByCluster.length} comments pointing to deleted clusters`);

            const updatedComments = await prisma.comment.updateMany({
                where: {
                    id: { in: orphanedCommentsByCluster.map(c => c.id) }
                },
                data: {
                    clusterId: null
                }
            });

            console.log(`[CLEANUP] Reset clusterId to NULL for ${updatedComments.count} comments\n`);
        } else {
            console.log('[CLEANUP] No comments found pointing to deleted clusters\n');
        }

        // Summary
        console.log('[CLEANUP] Cleanup completed successfully!');
        console.log('[CLEANUP] Summary:');
        console.log(`  - Orphaned clusters by video: ${orphanedClusters.length}`);
        console.log(`  - Orphaned clusters by parent: ${orphanedSubClusters.length}`);
        console.log(`  - Orphaned comments by video: ${orphanedCommentsByVideo.length}`);
        console.log(`  - Comments with NULL cluster: ${orphanedCommentsByCluster.length}`);

    } catch (error) {
        console.error('[CLEANUP] Error during cleanup:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the cleanup
cleanupOrphanedData();
