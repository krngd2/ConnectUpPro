import { prisma } from '@/lib/db'
import { VIDEO_STATUS } from '@/lib/constants'

/**
 * Video Timeout Monitor - Handles stuck video analysis processes
 * 
 * This module provides functionality to:
 * 1. Detect videos stuck in processing states for too long
 * 2. Automatically mark them as FAILED
 * 3. Log timeout details for debugging
 * 4. Provide recovery mechanisms
 */

// Timeout thresholds (in minutes)
export const TIMEOUT_THRESHOLDS = {
    FETCHING_DETAILS: 10,        // Video details should fetch quickly
    DOWNLOADING_COMMENTS: 180,   // 3 hours for comment download (large videos)
    ANALYZING_COMMENTS: 120,     // 2 hours for analysis (clustering is intensive)
    PENDING: 60,                 // 1 hour pending before considered stuck
} as const;

export interface StuckVideo {
    id: string;
    url: string;
    title: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    minutesStuck: number;
    threshold: number;
    userId: string;
    analysisSummary: unknown;
}

/**
 * Find videos that have been stuck in processing states beyond timeout thresholds
 */
export async function findStuckVideos(): Promise<StuckVideo[]> {
    console.log('[TIMEOUT_MONITOR] Checking for stuck videos...');

    try {
        // Get videos in processing states
        const processingVideos = await prisma.video.findMany({
            where: {
                status: {
                    in: [
                        VIDEO_STATUS.PENDING,
                        VIDEO_STATUS.FETCHING_DETAILS,
                        VIDEO_STATUS.DOWNLOADING_COMMENTS,
                        VIDEO_STATUS.ANALYZING_COMMENTS
                    ]
                }
            },
            select: {
                id: true,
                url: true,
                title: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
                analysisSummary: true
            }
        });

        console.log(`[TIMEOUT_MONITOR] Found ${processingVideos.length} videos in processing states`);

        const stuckVideos: StuckVideo[] = [];
        const now = new Date();

        for (const video of processingVideos) {
            // Calculate how long the video has been in current state
            const minutesSinceUpdate = Math.floor(
                (now.getTime() - video.updatedAt.getTime()) / (1000 * 60)
            );

            // Get threshold for current status
            const threshold = TIMEOUT_THRESHOLDS[video.status as keyof typeof TIMEOUT_THRESHOLDS];

            if (!threshold) {
                console.warn(`[TIMEOUT_MONITOR] No threshold defined for status: ${video.status}`);
                continue;
            }

            // Check if video is stuck
            if (minutesSinceUpdate > threshold) {
                console.log(`[TIMEOUT_MONITOR] Found stuck video: ${video.id} (${video.status}) - ${minutesSinceUpdate}min > ${threshold}min threshold`);

                stuckVideos.push({
                    ...video,
                    minutesStuck: minutesSinceUpdate,
                    threshold
                });
            }
        }

        console.log(`[TIMEOUT_MONITOR] Found ${stuckVideos.length} stuck videos`);
        return stuckVideos;

    } catch (error) {
        console.error('[TIMEOUT_MONITOR] Error finding stuck videos:', error);
        throw error;
    }
}

/**
 * Mark a stuck video as FAILED with timeout details
 */
export async function markVideoAsFailed(
    videoId: string,
    reason: string,
    originalStatus: string,
    minutesStuck: number
): Promise<void> {
    console.log(`[TIMEOUT_MONITOR] Marking video ${videoId} as FAILED: ${reason}`);

    try {
        // Get current analysis summary to preserve data
        const currentVideo = await prisma.video.findUnique({
            where: { id: videoId },
            select: { analysisSummary: true }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentSummary = (currentVideo?.analysisSummary as any) || {};

        await prisma.video.update({
            where: { id: videoId },
            data: {
                status: VIDEO_STATUS.FAILED,
                updatedAt: new Date(),
                analysisSummary: {
                    ...currentSummary,
                    error: reason,
                    failedAt: new Date().toISOString(),
                    originalStatus,
                    minutesStuck,
                    failureReason: 'timeout',
                    timeoutDetails: {
                        originalStatus,
                        minutesStuck,
                        checkedAt: new Date().toISOString(),
                        autoFailedByMonitor: true
                    }
                }
            }
        });

        console.log(`[TIMEOUT_MONITOR] Successfully marked video ${videoId} as FAILED`);

    } catch (error) {
        console.error(`[TIMEOUT_MONITOR] Error marking video ${videoId} as FAILED:`, error);
        throw error;
    }
}

/**
 * Process all stuck videos and mark them as failed
 */
export async function processStuckVideos(): Promise<{
    processed: number;
    failed: number;
    errors: string[];
}> {
    console.log('[TIMEOUT_MONITOR] Starting stuck video processing...');

    const results = {
        processed: 0,
        failed: 0,
        errors: [] as string[]
    };

    try {
        const stuckVideos = await findStuckVideos();

        if (stuckVideos.length === 0) {
            console.log('[TIMEOUT_MONITOR] No stuck videos found');
            return results;
        }

        console.log(`[TIMEOUT_MONITOR] Processing ${stuckVideos.length} stuck videos`);

        for (const video of stuckVideos) {
            try {
                const reason = `Video stuck in ${video.status} status for ${video.minutesStuck} minutes (threshold: ${video.threshold} minutes)`;

                await markVideoAsFailed(video.id, reason, video.status, video.minutesStuck);
                results.processed++;

                console.log(`[TIMEOUT_MONITOR] Processed stuck video: ${video.url} (${video.status})`);

            } catch (error) {
                results.failed++;
                const errorMsg = `Failed to process video ${video.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                results.errors.push(errorMsg);
                console.error(`[TIMEOUT_MONITOR] ${errorMsg}`);
            }
        }

        console.log(`[TIMEOUT_MONITOR] Completed processing: ${results.processed} processed, ${results.failed} failed`);
        return results;

    } catch (error) {
        console.error('[TIMEOUT_MONITOR] Error in processStuckVideos:', error);
        results.errors.push(`Main process error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return results;
    }
}

/**
 * Get statistics about video processing states
 */
export async function getVideoProcessingStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    potentiallyStuck: number;
    processingTime: {
        averageMinutes: number;
        longestMinutes: number;
    };
}> {
    console.log('[TIMEOUT_MONITOR] Gathering video processing statistics...');

    try {
        // Get all videos with their status counts
        const statusCounts = await prisma.video.groupBy({
            by: ['status'],
            _count: {
                id: true
            }
        });

        const byStatus: Record<string, number> = {};
        let total = 0;

        statusCounts.forEach(group => {
            byStatus[group.status] = group._count.id;
            total += group._count.id;
        });

        // Get processing videos for time analysis
        const processingVideos = await prisma.video.findMany({
            where: {
                status: {
                    in: [
                        VIDEO_STATUS.PENDING,
                        VIDEO_STATUS.FETCHING_DETAILS,
                        VIDEO_STATUS.DOWNLOADING_COMMENTS,
                        VIDEO_STATUS.ANALYZING_COMMENTS
                    ]
                }
            },
            select: {
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });

        // Calculate processing times
        const now = new Date();
        const processingTimes = processingVideos.map(video =>
            Math.floor((now.getTime() - video.updatedAt.getTime()) / (1000 * 60))
        );

        const averageMinutes = processingTimes.length > 0
            ? Math.floor(processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length)
            : 0;

        const longestMinutes = processingTimes.length > 0
            ? Math.max(...processingTimes)
            : 0;

        // Count potentially stuck videos (using a lower threshold for early warning)
        const potentiallyStuck = processingVideos.filter(video => {
            const minutesSinceUpdate = Math.floor(
                (now.getTime() - video.updatedAt.getTime()) / (1000 * 60)
            );

            const threshold = TIMEOUT_THRESHOLDS[video.status as keyof typeof TIMEOUT_THRESHOLDS];
            return threshold && minutesSinceUpdate > (threshold * 0.7); // 70% of threshold as warning
        }).length;

        const stats = {
            total,
            byStatus,
            potentiallyStuck,
            processingTime: {
                averageMinutes,
                longestMinutes
            }
        };

        console.log('[TIMEOUT_MONITOR] Processing stats:', stats);
        return stats;

    } catch (error) {
        console.error('[TIMEOUT_MONITOR] Error gathering stats:', error);
        throw error;
    }
}

/**
 * Reset a failed video to retry processing
 * This can be used to manually retry videos that were marked as failed due to timeouts
 */
export async function resetFailedVideoForRetry(videoId: string): Promise<void> {
    console.log(`[TIMEOUT_MONITOR] Resetting failed video ${videoId} for retry`);

    try {
        const video = await prisma.video.findUnique({
            where: { id: videoId },
            select: { status: true, analysisSummary: true }
        });

        if (!video) {
            throw new Error(`Video ${videoId} not found`);
        }

        if (video.status !== VIDEO_STATUS.FAILED) {
            throw new Error(`Video ${videoId} is not in FAILED status (current: ${video.status})`);
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
                    retryAt: new Date().toISOString(),
                    retryReason: 'Manual retry after timeout failure',
                    previousFailure: {
                        error: currentSummary.error,
                        failedAt: currentSummary.failedAt,
                        originalStatus: currentSummary.originalStatus,
                        minutesStuck: currentSummary.minutesStuck
                    }
                }
            }
        });

        console.log(`[TIMEOUT_MONITOR] Successfully reset video ${videoId} to PENDING for retry`);

    } catch (error) {
        console.error(`[TIMEOUT_MONITOR] Error resetting video ${videoId}:`, error);
        throw error;
    }
}
