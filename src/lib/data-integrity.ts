/**
 * Data integrity checking utility
 * 
 * This utility provides functions to:
 * 1. Check for orphaned records
 * 2. Verify referential integrity
 * 3. Generate reports on data relationships
 * 
 * Usage: npx ts-node -e "import('./lib/data-integrity.ts').then(m => m.checkDataIntegrity())"
 */

import { prisma } from '@/lib/db';

export interface IntegrityReport {
    timestamp: string;
    totalVideos: number;
    totalClusters: number;
    totalComments: number;
    orphanedClusters: {
        missingVideo: number;
        missingParent: number;
    };
    orphanedComments: {
        missingVideo: number;
        missingCluster: number;
    };
    clusterHierarchy: {
        topLevel: number;
        withChildren: number;
        deepestLevel: number;
    };
    issues: string[];
}

export async function checkDataIntegrity(): Promise<IntegrityReport> {
    try {
        console.log('[INTEGRITY] Starting data integrity check...\n');

        // Get basic counts
        const [totalVideos, totalClusters, totalComments] = await Promise.all([
            prisma.video.count(),
            prisma.cluster.count(),
            prisma.comment.count()
        ]);

        console.log(`[INTEGRITY] Total records: ${totalVideos} videos, ${totalClusters} clusters, ${totalComments} comments\n`);

        // Check for orphaned clusters with missing videos
        const orphanedClustersByVideo = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Cluster" c
      LEFT JOIN "Video" v ON c."videoId" = v."id"
      WHERE v."id" IS NULL
    `;
        const orphanedClustersByVideoCount = Number(orphanedClustersByVideo[0]?.count || 0);

        // Check for orphaned clusters with missing parent
        const orphanedClustersByParent = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Cluster" c
      WHERE c."parentClusterId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Cluster" p WHERE p."id" = c."parentClusterId")
    `;
        const orphanedClustersByParentCount = Number(orphanedClustersByParent[0]?.count || 0);

        // Check for orphaned comments with missing videos
        const orphanedCommentsByVideo = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Comment" c
      LEFT JOIN "Video" v ON c."videoId" = v."id"
      WHERE v."id" IS NULL
    `;
        const orphanedCommentsByVideoCount = Number(orphanedCommentsByVideo[0]?.count || 0);

        // Check for comments with missing cluster references
        const orphanedCommentsByCluster = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Comment" c
      WHERE c."clusterId" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "Cluster" cl WHERE cl."id" = c."clusterId")
    `;
        const orphanedCommentsByClusterCount = Number(orphanedCommentsByCluster[0]?.count || 0);

        // Get cluster hierarchy statistics
        const clusterStats = await prisma.$queryRaw<Array<{ level: number; count: bigint }>>`
      SELECT "level", COUNT(*) as count
      FROM "Cluster"
      GROUP BY "level"
      ORDER BY "level" ASC
    `;

        const topLevelClusters = Number(clusterStats.find(s => s.level === 0)?.count || 0);
        const deepestLevel = clusterStats.length > 0 ? clusterStats[clusterStats.length - 1].level : 0;
        const clustersWithChildren = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "id") as count
      FROM "Cluster"
      WHERE EXISTS (SELECT 1 FROM "Cluster" child WHERE child."parentClusterId" = "Cluster"."id")
    `;
        const clustersWithChildrenCount = Number(clustersWithChildren[0]?.count || 0);

        // Compile issues
        const issues: string[] = [];
        if (orphanedClustersByVideoCount > 0) {
            issues.push(`⚠️ Found ${orphanedClustersByVideoCount} clusters with missing video references`);
        }
        if (orphanedClustersByParentCount > 0) {
            issues.push(`⚠️ Found ${orphanedClustersByParentCount} clusters with missing parent cluster references`);
        }
        if (orphanedCommentsByVideoCount > 0) {
            issues.push(`⚠️ Found ${orphanedCommentsByVideoCount} comments with missing video references`);
        }
        if (orphanedCommentsByClusterCount > 0) {
            issues.push(`⚠️ Found ${orphanedCommentsByClusterCount} comments with deleted cluster references (should be NULL)`);
        }

        const report: IntegrityReport = {
            timestamp: new Date().toISOString(),
            totalVideos,
            totalClusters,
            totalComments,
            orphanedClusters: {
                missingVideo: orphanedClustersByVideoCount,
                missingParent: orphanedClustersByParentCount
            },
            orphanedComments: {
                missingVideo: orphanedCommentsByVideoCount,
                missingCluster: orphanedCommentsByClusterCount
            },
            clusterHierarchy: {
                topLevel: Number(topLevelClusters),
                withChildren: clustersWithChildrenCount,
                deepestLevel
            },
            issues
        };

        // Print report
        console.log('[INTEGRITY] Data Integrity Report:');
        console.log('─'.repeat(50));
        console.log(`Total Records:`);
        console.log(`  Videos: ${totalVideos}`);
        console.log(`  Clusters: ${totalClusters}`);
        console.log(`  Comments: ${totalComments}`);
        console.log('\nOrphaned Records:');
        console.log(`  Clusters (missing video): ${orphanedClustersByVideoCount}`);
        console.log(`  Clusters (missing parent): ${orphanedClustersByParentCount}`);
        console.log(`  Comments (missing video): ${orphanedCommentsByVideoCount}`);
        console.log(`  Comments (missing cluster): ${orphanedCommentsByClusterCount}`);
        console.log('\nCluster Hierarchy:');
        console.log(`  Top-level clusters: ${topLevelClusters}`);
        console.log(`  Clusters with children: ${clustersWithChildrenCount}`);
        console.log(`  Deepest level: ${deepestLevel}`);
        console.log('\nCluster breakdown by level:');
        clusterStats.forEach(stat => {
            console.log(`  Level ${stat.level}: ${stat.count} clusters`);
        });
        console.log('\nIssues:');
        if (issues.length === 0) {
            console.log('  ✅ No integrity issues found');
        } else {
            issues.forEach(issue => console.log(`  ${issue}`));
        }
        console.log('─'.repeat(50));

        return report;
    } catch (error) {
        console.error('[INTEGRITY] Error checking data integrity:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

export async function getVideoStats(videoId: string) {
    try {
        const video = await prisma.video.findUnique({
            where: { id: videoId },
            select: {
                id: true,
                name: true,
                _count: {
                    select: {
                        comments: true,
                        clusters: true
                    }
                }
            }
        });

        if (!video) {
            throw new Error(`Video ${videoId} not found`);
        }

        // Get cluster hierarchy for this video
        const clusters = await prisma.cluster.findMany({
            where: { videoId },
            select: {
                id: true,
                name: true,
                level: true,
                parentClusterId: true,
                _count: { select: { comments: true, subClusters: true } }
            },
            orderBy: [{ level: 'asc' }, { name: 'asc' }]
        });

        console.log(`\n[STATS] Video: ${video.name} (ID: ${videoId})`);
        console.log(`  Total comments: ${video._count.comments}`);
        console.log(`  Total clusters: ${video._count.clusters}`);
        console.log(`\n  Cluster breakdown:`);
        clusters.forEach(cluster => {
            const indent = '  '.repeat(cluster.level + 1);
            console.log(`${indent}${cluster.name} (Level ${cluster.level}, ${cluster._count.comments} comments, ${cluster._count.subClusters} sub-clusters)`);
        });

        return {
            video,
            clusters
        };
    } catch (error) {
        console.error('[STATS] Error getting video stats:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}
