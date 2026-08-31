import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';

interface DeleteRequest {
    videoId: string;
}

export async function POST(request: NextRequest) {
    try {
        // Check if user is authenticated
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body: DeleteRequest = await request.json();
        const { videoId } = body;

        if (!videoId) {
            return NextResponse.json(
                { error: 'Video ID is required' },
                { status: 400 }
            );
        }

        // Verify the video belongs to the user
        const video = await prisma.video.findFirst({
            where: {
                id: videoId,
                userId: user.id
            },
            select: {
                id: true,
                userId: true,
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
            return NextResponse.json(
                { error: 'Video not found or you do not have permission to delete it' },
                { status: 404 }
            );
        }

        console.log(`[DELETE_VIDEO] Starting deletion of video ${videoId} (${video._count.comments} comments, ${video._count.clusters} clusters)`);

        // With cascading deletes in place:
        // 1. Deleting the video will cascade to delete all clusters via videoId FK
        // 2. Deleting clusters will cascade to delete child clusters via parentClusterId FK
        // 3. Deleting clusters will cascade to delete comments via clusterId FK (SetNull) and videoId FK (Cascade)

        // Get all cluster IDs before deletion for logging
        const clustersBeforeDeletion = await prisma.cluster.findMany({
            where: { videoId },
            select: { id: true, parentClusterId: true, level: true },
            orderBy: { level: 'desc' } // Get deepest levels first
        });

        console.log(`[DELETE_VIDEO] Found ${clustersBeforeDeletion.length} clusters to be deleted:`,
            clustersBeforeDeletion.map(c => ({ id: c.id, parentId: c.parentClusterId, level: c.level }))
        );

        // Get comments count for verification
        const commentsBeforeDeletion = await prisma.comment.count({
            where: { videoId }
        });

        console.log(`[DELETE_VIDEO] Found ${commentsBeforeDeletion} comments to be deleted`);

        // Delete the video - this will cascade to:
        // - All clusters with this videoId
        // - All comments with this videoId
        // - All child clusters (via parentClusterId cascade)
        // - All comments in those clusters (via clusterId cascade)
        await prisma.video.delete({
            where: { id: videoId }
        });

        console.log(`[DELETE_VIDEO] Successfully deleted video ${videoId}: ${video.name}`);
        console.log(`[DELETE_VIDEO] Cascading deletes removed ${video._count.clusters} clusters and ${video._count.comments} comments`);

        return NextResponse.json({
            success: true,
            message: `Video "${video.name}" and all associated data have been permanently deleted`,
            deletedCounts: {
                comments: video._count.comments,
                clusters: video._count.clusters,
                video: 1,
                clusterDetails: clustersBeforeDeletion
            }
        });

    } catch (error) {
        console.error('[DELETE_VIDEO] Error deleting video:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete video',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

