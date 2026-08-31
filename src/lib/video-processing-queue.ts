import { prisma } from '@/lib/db';
import { VIDEO_STATUS } from '@/lib/constants';
import { processVideoAnalysisBackground } from '@/app/actions/videos.actions';

// Simple in-memory lock to avoid concurrent processing overlaps in a single instance.
let processing = false;

const INTERVAL_MS = parseInt(process.env.VIDEO_QUEUE_INTERVAL_MS || '60000', 10); // default 60s
const MAX_CONCURRENT = parseInt(process.env.VIDEO_QUEUE_MAX_CONCURRENT || '1', 10); // for future scaling

let currentConcurrent = 0;

async function fetchAndLockNextPendingVideo() {
    // Use a transaction to lock the pending video row with timeout and retry logic
    // Note: This transaction is just for claiming the video, not processing it
    try {
        return await prisma.$transaction(async (tx) => {
            // Oldest PENDING video
            const video = await tx.video.findFirst({
                where: { status: VIDEO_STATUS.PENDING },
                orderBy: { createdAt: 'asc' }
            });

            if (!video) return null;

            // Transition to DOWNLOADING_COMMENTS to claim it
            await tx.video.update({
                where: { id: video.id },
                data: { status: VIDEO_STATUS.DOWNLOADING_COMMENTS, updatedAt: new Date() }
            });

            return video;
        }, {
            maxWait: 10000, // Maximum time to wait for a transaction to start (10 seconds)
            timeout: 30000, // Maximum time the transaction can run (30 seconds - just for the lock operation)
        });
    } catch (error) {
        // Log transaction errors but don't crash the queue
        if (error instanceof Error && error.message.includes('Unable to start a transaction')) {
            console.warn('[QUEUE] Transaction timeout - database may be busy, will retry on next cycle');
        } else {
            console.error('[QUEUE] Error fetching and locking video:', error);
        }
        return null;
    }
}

async function processOne() {
    if (processing) return; // global serialized loop
    processing = true;
    try {
        while (currentConcurrent < MAX_CONCURRENT) {
            const video = await fetchAndLockNextPendingVideo();
            if (!video) break; // no more pending or transaction failed

            currentConcurrent++;
            // Note: The actual video processing (processVideoAnalysisBackground) happens outside
            // the transaction and has its own 4-hour timeout. The transaction timeout above (30s)
            // only applies to claiming/locking the video, not the entire processing pipeline.
            (async () => {
                try {
                    console.log('[QUEUE] Starting background processing for queued video', video.id);
                    await processVideoAnalysisBackground(video.id);
                    console.log('[QUEUE] Finished processing video', video.id);
                } catch (err) {
                    console.error('[QUEUE] Error processing queued video', video.id, err);
                } finally {
                    currentConcurrent--;
                }
            })();
        }
    } catch (err) {
        console.error('[QUEUE] Error in processOne:', err);
    } finally {
        processing = false;
    }
}

function startQueueProcessor() {
    interface GlobalWithQueueFlag extends Global {
        __VIDEO_QUEUE_STARTED?: boolean;
    }
    const g = globalThis as unknown as GlobalWithQueueFlag;
    if (typeof globalThis !== 'undefined' && g.__VIDEO_QUEUE_STARTED) return; // singleton guard
    g.__VIDEO_QUEUE_STARTED = true;
    console.log(`[QUEUE] Video processing queue started. Interval ${INTERVAL_MS}ms, max concurrent ${MAX_CONCURRENT}`);
    setInterval(processOne, INTERVAL_MS);
    // Kick off immediately
    processOne();
}

// The queue is a server-runtime concern. Starting it while `next build` is
// collecting static page data would create timers and attempt database access.
if (process.env.NEXT_PHASE !== 'phase-production-build') {
    startQueueProcessor();
}

export { }; // side-effect module
