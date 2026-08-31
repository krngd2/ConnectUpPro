import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import {
    processStuckVideos,
    getVideoProcessingStats,
    resetFailedVideoForRetry,
    findStuckVideos
} from '@/lib/video-timeout-monitor';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, videoId } = body;

        console.log(`[VIDEO_MONITOR_API] Processing action: ${action}`);

        switch (action) {
            case 'process_stuck': {
                console.log('[VIDEO_MONITOR_API] Processing stuck videos...');
                const results = await processStuckVideos();

                return NextResponse.json({
                    success: true,
                    message: `Processed ${results.processed} stuck videos`,
                    data: results
                });
            }

            case 'check_stuck': {
                console.log('[VIDEO_MONITOR_API] Checking for stuck videos...');
                const stuckVideos = await findStuckVideos();

                return NextResponse.json({
                    success: true,
                    message: `Found ${stuckVideos.length} stuck videos`,
                    data: { stuckVideos }
                });
            }

            case 'get_stats': {
                console.log('[VIDEO_MONITOR_API] Getting processing stats...');
                const stats = await getVideoProcessingStats();

                return NextResponse.json({
                    success: true,
                    message: 'Processing stats retrieved',
                    data: stats
                });
            }

            case 'retry_video': {
                if (!videoId) {
                    return NextResponse.json(
                        { error: 'Video ID is required for retry action' },
                        { status: 400 }
                    );
                }

                console.log(`[VIDEO_MONITOR_API] Retrying failed video: ${videoId}`);
                await resetFailedVideoForRetry(videoId);

                return NextResponse.json({
                    success: true,
                    message: `Video ${videoId} reset for retry`
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
        console.error('[VIDEO_MONITOR_API] Error:', error);

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        // Check authentication
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[VIDEO_MONITOR_API] Getting processing stats (GET request)...');

        // Default GET action: return processing stats
        const stats = await getVideoProcessingStats();
        const stuckVideos = await findStuckVideos();

        return NextResponse.json({
            success: true,
            message: 'Video monitoring data retrieved',
            data: {
                stats,
                stuckVideos: {
                    count: stuckVideos.length,
                    videos: stuckVideos
                },
                lastChecked: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[VIDEO_MONITOR_API] Error in GET:', error);

        return NextResponse.json(
            {
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
