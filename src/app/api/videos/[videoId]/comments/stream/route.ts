import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { isDatabaseConnectionError, prisma } from '@/lib/db';

interface RouteParams {
    params: Promise<{
        videoId: string;
    }>;
}

interface ThreadedComment {
    id: string;
    text: string;
    author: string;
    timestamp: string;
    rawTimestamp?: Date;
    sentiment?: string;
    topics?: string[];
    likes?: number;
    video: string;
    platformId: string;
    embedding?: string | null;
    isReply?: boolean;
    parentId?: string;
    replies?: ThreadedComment[];
}

function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 60) {
        return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours} hours ago`;
    } else {
        return `${diffInDays} days ago`;
    }
}

export async function GET(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        // Check if user is authenticated
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { videoId } = await params;

        // Set up streaming response
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Get video information
                    const video = await prisma.video.findUnique({
                        where: { id: videoId },
                        select: {
                            title: true,
                            name: true,
                            _count: {
                                select: {
                                    comments: true
                                }
                            }
                        }
                    });

                    if (!video) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'error',
                            message: 'Video not found'
                        })}\n\n`));
                        controller.close();
                        return;
                    }

                    const totalComments = video._count.comments;

                    // Send initial metadata
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'metadata',
                        total: totalComments,
                        clusterName: 'all-topics'
                    })}\n\n`));

                    if (totalComments === 0) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'complete',
                            data: [],
                            total: 0
                        })}\n\n`));
                        controller.close();
                        return;
                    }

                    // Implement pagination-based streaming instead of pg-query-stream
                    // This is more reliable with Prisma
                    const batchSize = 25; // Larger batches for all-topics
                    let processedCount = 0;
                    let offset = 0;

                    while (true) {
                        // Fetch this batch of comments
                        const comments = await prisma.$queryRaw<Array<{
                            id: string;
                            text: string;
                            authorName: string;
                            authorAvatar: string | null;
                            timestamp: Date;
                            platformId: string;
                            embedding: string | null;
                            likeCount: number;
                            isReply: boolean;
                        }>>`
              SELECT 
                id, 
                text, 
                "authorName", 
                "authorAvatar",
                timestamp, 
                "platformId", 
                embedding::text as embedding,
                "likeCount",
                "isReply"
              FROM "Comment"
              WHERE "videoId" = ${videoId}
              ORDER BY timestamp DESC
              LIMIT ${batchSize}
              OFFSET ${offset}
            `;

                        // If no more comments, break the loop
                        if (comments.length === 0) {
                            break;
                        }

                        // Format comments
                        const formattedComments = comments.map((comment) => ({
                            id: comment.id,
                            text: comment.text,
                            author: comment.authorName,
                            authorAvatarUrl: comment.authorAvatar,
                            timestamp: formatTimeAgo(comment.timestamp),
                            rawTimestamp: comment.timestamp,
                            sentiment: 'neutral',
                            topics: [],
                            likes: comment.likeCount || 0,
                            video: video.title || video.name,
                            platformId: comment.platformId,
                            embedding: comment.embedding || undefined,
                            isReply: comment.isReply,
                            replies: [] as ThreadedComment[]
                        }));

                        processedCount += comments.length;

                        // Send this batch
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'batch',
                            data: formattedComments,
                            progress: processedCount
                        })}\n\n`));

                        // Move to next batch
                        offset += batchSize;

                        // Add a small delay between batches to prevent overwhelming the client
                        await new Promise(resolve => setTimeout(resolve, 15));

                        // Safety check to prevent infinite loops
                        if (processedCount >= totalComments || comments.length < batchSize) {
                            break;
                        }
                    }

                    // Send completion signal
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'complete',
                        total: processedCount
                    })}\n\n`));

                    controller.close();

                } catch (error) {
                    console.error('Error in streaming endpoint:', error);

                    if (isDatabaseConnectionError(error)) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'error',
                            message: 'Database connection issue. Please try again.'
                        })}\n\n`));
                    } else {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'error',
                            message: 'Failed to fetch comments'
                        })}\n\n`));
                    }

                    controller.close();
                }
            },

            cancel() {
                console.log('Stream cancelled by client');
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Cache-Control',
            },
        });

    } catch (error) {
        console.error('Error setting up streaming response:', error);

        // Check if it's a database connection error
        if (isDatabaseConnectionError(error)) {
            return NextResponse.json(
                {
                    error: 'Database connection issue. Please try again.',
                    details: 'Connection temporarily unavailable'
                },
                { status: 503 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to fetch comments',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
