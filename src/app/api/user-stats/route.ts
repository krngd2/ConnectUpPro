/**
 * User Statistics API Endpoint
 * 
 * Retrieves user-specific data statistics including:
 * - Total videos analyzed
 * - Total comments processed
 * - Total clusters created
 */

import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getLocalUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's videos and associated stats
    const videos = await prisma.video.findMany({
      where: { userId: user.id },
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
    // Get user's semantic searches
    const semanticSearches = await prisma.semanticSearch.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        category: true,
        isDefault: true,
        createdAt: true
      }
    });

    // Calculate aggregate stats
    const totalVideos = videos.length;
    const totalComments = videos.reduce((sum, v) => sum + v._count.comments, 0);
    const totalClusters = videos.reduce((sum, v) => sum + v._count.clusters, 0);

    // Get cluster level distribution
    const clusterLevels = await prisma.$queryRaw<Array<{ level: number; count: bigint }>>`
      SELECT "level", COUNT(*) as count
      FROM "Cluster" c
      INNER JOIN "Video" v ON c."videoId" = v."id"
      WHERE v."userId" = ${user.id}
      GROUP BY "level"
      ORDER BY "level" ASC
    `;

    const topLevelClustersRaw = clusterLevels.find(cl => cl.level === 0)?.count;
    const topLevelClusters = topLevelClustersRaw ? Number(topLevelClustersRaw) : 0;
    const deepestLevel = clusterLevels.length > 0 ? clusterLevels[clusterLevels.length - 1].level : 0;

    // Count semantic searches by category
    const searchesByCategory = semanticSearches.reduce(
      (acc, search) => {
        acc[search.category] = (acc[search.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalSemanticSearches = semanticSearches.length;
    const defaultSemanticSearches = semanticSearches.filter(s => s.isDefault).length;

    return NextResponse.json({
      totalVideos,
      totalComments,
      totalClusters,
      clusterHierarchy: {
        topLevel: topLevelClusters,
        deepestLevel,
        levels: clusterLevels.map(cl => ({
          level: cl.level,
          count: Number(cl.count)
        }))
      },
      semanticSearches: {
        total: totalSemanticSearches,
        default: defaultSemanticSearches,
        byCategory: searchesByCategory,
        categories: Object.keys(searchesByCategory)
      }
    });
  } catch (error) {
    console.error('[USER-STATS] Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user statistics' },
      { status: 500 }
    );
  }
}
