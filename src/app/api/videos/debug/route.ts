import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';
import { VIDEO_STATUS } from '@/lib/constants';

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const detailed = searchParams.get('detailed') === 'true';
        const status = searchParams.get('status');

        console.log('[VIDEO_DEBUG_API] Getting video debug information...');

        // Build where clause based on status filter
        const whereClause = status ? { status } : {
            status: {
                in: [
                    VIDEO_STATUS.PENDING,
                    VIDEO_STATUS.FETCHING_DETAILS,
                    VIDEO_STATUS.DOWNLOADING_COMMENTS,
                    VIDEO_STATUS.ANALYZING_COMMENTS,
                    VIDEO_STATUS.FAILED
                ]
            }
        };

        // Get videos with processing information
        const videos = await prisma.video.findMany({
            where: whereClause,
            select: {
                id: true,
                url: true,
                title: true,
                name: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                lastSynced: true,
                userId: true,
                analysisSummary: true,
                _count: {
                    select: {
                        comments: true,
                        clusters: true
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        console.log(`[VIDEO_DEBUG_API] Found ${videos.length} videos matching criteria`);

        // Calculate processing metrics for each video
        const now = new Date();
        const debugInfo = videos.map(video => {
            const minutesSinceCreated = Math.floor(
                (now.getTime() - video.createdAt.getTime()) / (1000 * 60)
            );

            const minutesSinceUpdated = Math.floor(
                (now.getTime() - video.updatedAt.getTime()) / (1000 * 60)
            );

            const minutesSinceLastSync = video.lastSynced
                ? Math.floor((now.getTime() - video.lastSynced.getTime()) / (1000 * 60))
                : null;

            // Check if potentially stuck based on status timeouts
            const timeoutThresholds = {
                [VIDEO_STATUS.PENDING]: 60,
                [VIDEO_STATUS.FETCHING_DETAILS]: 10,
                [VIDEO_STATUS.DOWNLOADING_COMMENTS]: 120,
                [VIDEO_STATUS.ANALYZING_COMMENTS]: 180
            };

            const threshold = timeoutThresholds[video.status as keyof typeof timeoutThresholds];
            const isStuck = threshold && minutesSinceUpdated > threshold;
            const isWarning = threshold && minutesSinceUpdated > (threshold * 0.7);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const analysisSummary = video.analysisSummary as any;

            const basicInfo = {
                id: video.id,
                url: video.url,
                title: video.title || video.name,
                status: video.status,
                timing: {
                    createdAt: video.createdAt.toISOString(),
                    updatedAt: video.updatedAt.toISOString(),
                    lastSynced: video.lastSynced?.toISOString() || null,
                    minutesSinceCreated,
                    minutesSinceUpdated,
                    minutesSinceLastSync
                },
                counts: {
                    comments: video._count.comments,
                    clusters: video._count.clusters
                },
                health: {
                    isStuck,
                    isWarning,
                    threshold,
                    statusSince: minutesSinceUpdated
                }
            };

            if (detailed) {
                return {
                    ...basicInfo,
                    analysisSummary: analysisSummary || null,
                    debugging: {
                        hasAnalysisSummary: !!analysisSummary,
                        hasError: !!(analysisSummary?.error),
                        hasFailedAt: !!(analysisSummary?.failedAt),
                        lastProcessingStep: analysisSummary?.lastProcessingStep || 'unknown',
                        processingMethod: analysisSummary?.processingMethod || 'unknown',
                        syncType: analysisSummary?.lastSyncType || 'unknown'
                    }
                };
            }

            return basicInfo;
        });

        // Calculate summary statistics
        const summary = {
            total: videos.length,
            byStatus: videos.reduce((acc, video) => {
                acc[video.status] = (acc[video.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            stuck: debugInfo.filter(v => v.health.isStuck).length,
            warning: debugInfo.filter(v => v.health.isWarning).length,
            averageMinutesSinceUpdate: videos.length > 0
                ? Math.floor(debugInfo.reduce((sum, v) => sum + v.timing.minutesSinceUpdated, 0) / videos.length)
                : 0
        };

        return NextResponse.json({
            success: true,
            message: `Retrieved debug information for ${videos.length} videos`,
            data: {
                summary,
                videos: debugInfo,
                generatedAt: now.toISOString()
            }
        });

    } catch (error) {
        console.error('[VIDEO_DEBUG_API] Error:', error);

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, videoId, status } = body;

        console.log(`[VIDEO_DEBUG_API] Processing debug action: ${action}`);

        switch (action) {
            case 'force_status_update': {
                if (!videoId || !status) {
                    return NextResponse.json(
                        { error: 'Video ID and status are required' },
                        { status: 400 }
                    );
                }

                // Validate status
                if (!Object.values(VIDEO_STATUS).includes(status)) {
                    return NextResponse.json(
                        { error: `Invalid status: ${status}` },
                        { status: 400 }
                    );
                }

                console.log(`[VIDEO_DEBUG_API] Forcing status update for video ${videoId} to ${status}`);

                const video = await prisma.video.findUnique({
                    where: { id: videoId },
                    select: { analysisSummary: true, status: true }
                });

                if (!video) {
                    return NextResponse.json(
                        { error: 'Video not found' },
                        { status: 404 }
                    );
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const currentSummary = (video.analysisSummary as any) || {};

                await prisma.video.update({
                    where: { id: videoId },
                    data: {
                        status,
                        updatedAt: new Date(),
                        analysisSummary: {
                            ...currentSummary,
                            debugAction: {
                                forcedStatusUpdate: {
                                    from: video.status,
                                    to: status,
                                    at: new Date().toISOString(),
                                    by: 'debug_api'
                                }
                            }
                        }
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: `Video ${videoId} status updated from ${video.status} to ${status}`
                });
            }

            case 'clear_stuck_analysis': {
                if (!videoId) {
                    return NextResponse.json(
                        { error: 'Video ID is required' },
                        { status: 400 }
                    );
                }

                console.log(`[VIDEO_DEBUG_API] Clearing stuck analysis for video ${videoId}`);

                const video = await prisma.video.findUnique({
                    where: { id: videoId },
                    select: { analysisSummary: true, status: true }
                });

                if (!video) {
                    return NextResponse.json(
                        { error: 'Video not found' },
                        { status: 404 }
                    );
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const currentSummary = (video.analysisSummary as any) || {};

                await prisma.video.update({
                    where: { id: videoId },
                    data: {
                        status: VIDEO_STATUS.PENDING,
                        updatedAt: new Date(),
                        analysisSummary: {
                            ...currentSummary,
                            debugAction: {
                                clearedStuckAnalysis: {
                                    previousStatus: video.status,
                                    at: new Date().toISOString(),
                                    by: 'debug_api'
                                }
                            }
                        }
                    }
                });

                return NextResponse.json({
                    success: true,
                    message: `Video ${videoId} cleared from stuck analysis and reset to PENDING`
                });
            }

            default: {
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
            }
        }

    } catch (error) {
        console.error('[VIDEO_DEBUG_API] Error in POST:', error);

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
