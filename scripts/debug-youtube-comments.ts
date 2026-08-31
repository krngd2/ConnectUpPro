import { getVideoDetailsFromYT, getVideoCommentsInBatches, extractVideoIdFromYTUrl } from '../src/lib/youtube';

interface DebugInfo {
    totalDownloaded: number;
    totalThreads: number;
    totalReplies: number;
    pagesProcessed: number;
    emptyPages: number;
    skippedThreads: number;
    errors: Array<{ page: number; error: string }>;
    hasMorePages: boolean;
    pageSizes: number[];
}

/**
 * Debug comment download using the existing YouTube API functions
 */
async function debugCommentDownloadWithExistingAPI(videoId: string, maxComments: number = 2000): Promise<DebugInfo> {
    console.log(`\n🚀 Starting comment download debug using existing API for video: ${videoId}`);
    console.log(`📥 Will fetch up to ${maxComments.toLocaleString()} comments\n`);

    let totalComments = 0;
    let totalReplies = 0;
    let batchCount = 0;
    let hasMorePages = false;
    const batchSizes: number[] = [];
    const errors: Array<{ page: number; error: string }> = [];
    const sampleComments: any[] = [];

    try {
        // Use the existing generator function
        const commentGenerator = getVideoCommentsInBatches(videoId, 100, { maxComments });

        for await (const batch of commentGenerator) {
            batchCount++;
            const batchSize = batch.length;
            const batchReplies = batch.filter(comment => comment.isReply).length;
            const batchThreads = batchSize - batchReplies;

            totalComments += batchThreads;
            totalReplies += batchReplies;
            batchSizes.push(batchSize);

            console.log(`   ✅ Batch ${batchCount}: ${batchThreads} threads, ${batchReplies} replies (${batchSize} total)`);

            // Collect sample comments from first few batches
            if (batchCount <= 2 && sampleComments.length < 5) {
                const samples = batch.slice(0, Math.min(3, batch.length)).map(comment => ({
                    text: comment.text.substring(0, 100) + '...',
                    author: comment.authorName,
                    timestamp: comment.timestamp.toISOString(),
                    likes: comment.likeCount,
                    isReply: comment.isReply,
                }));
                sampleComments.push(...samples);
            }

            // Add small delay to see streaming behavior
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        const totalDownloaded = totalComments + totalReplies;

        // Generate debug report
        console.log(`\n📊 Existing API Debug Report:`);
        console.log(`════════════════════════════════════════════════════════════════`);
        console.log(`📦 Batches processed: ${batchCount}`);
        console.log(`💬 Total comment threads: ${totalComments.toLocaleString()}`);
        console.log(`↩️  Total replies: ${totalReplies.toLocaleString()}`);
        console.log(`🔢 Total downloadable comments: ${totalDownloaded.toLocaleString()}`);

        if (batchSizes.length > 0) {
            const avgBatchSize = batchSizes.reduce((a, b) => a + b, 0) / batchSizes.length;
            const minBatchSize = Math.min(...batchSizes);
            const maxBatchSize = Math.max(...batchSizes);

            console.log(`\n📈 Batch Size Analysis:`);
            console.log(`   Average: ${avgBatchSize.toFixed(1)} comments per batch`);
            console.log(`   Range: ${minBatchSize} - ${maxBatchSize} comments per batch`);
            console.log(`   Batch sizes: [${batchSizes.join(', ')}]`);
        }

        if (totalDownloaded >= maxComments) {
            console.log(`\n⚠️  Stopped due to maxComments limit (${maxComments}). More comments likely available.`);
            hasMorePages = true;
        }

        if (sampleComments.length > 0) {
            console.log(`\n💬 Sample Comments (first ${sampleComments.length}):`);
            sampleComments.forEach((comment, index) => {
                console.log(`   ${index + 1}. [${comment.author}] ${comment.text} (${comment.likes} likes, ${comment.isReply ? 'Reply' : 'Thread'})`);
            });
        }

        return {
            totalDownloaded,
            totalThreads: totalComments,
            totalReplies,
            pagesProcessed: batchCount,
            emptyPages: 0,
            skippedThreads: 0,
            errors,
            hasMorePages,
            pageSizes: batchSizes,
        };

    } catch (error) {
        console.error('❌ Error during existing API debug:', error);

        if (error instanceof Error) {
            errors.push({ page: batchCount, error: error.message });
        }

        return {
            totalDownloaded: totalComments + totalReplies,
            totalThreads: totalComments,
            totalReplies,
            pagesProcessed: batchCount,
            emptyPages: 0,
            skippedThreads: 0,
            errors,
            hasMorePages: false,
            pageSizes: batchSizes,
        };
    }
}

/**
 * Compare reported vs actual comment counts
 */
function compareCommentCounts(reported: number, actual: number, debugInfo: DebugInfo): void {
    console.log(`\n🔍 Comment Count Analysis:`);
    console.log(`════════════════════════════════════════════════════════════════`);
    console.log(`📊 Reported by YouTube API: ${reported.toLocaleString()}`);
    console.log(`📥 Actually downloaded: ${actual.toLocaleString()}`);
    console.log(`📉 Difference: ${(reported - actual).toLocaleString()}`);
    console.log(`📊 Coverage: ${((actual / reported) * 100).toFixed(1)}%`);

    if (debugInfo.hasMorePages) {
        console.log(`\n⚠️  Note: Download was limited and more comments are available`);
    }

    // Analyze potential reasons for discrepancy
    console.log(`\n🔍 Potential Reasons for Discrepancy:`);

    if (actual === 0) {
        console.log(`   ❌ Comments might be disabled or restricted`);
    } else if (actual < reported * 0.1) {
        console.log(`   ⚠️  Very low download rate - likely API restrictions or disabled comments`);
    } else if (actual < reported * 0.5) {
        console.log(`   📱 Moderate discrepancy - could be:`);
        console.log(`      • Comment privacy settings`);
        console.log(`      • Regional restrictions`);
        console.log(`      • Deleted/hidden comments`);
        console.log(`      • API pagination limits`);
        console.log(`      • Comments requiring approval`);
    } else if (actual < reported * 0.9) {
        console.log(`   ✅ Good coverage - small discrepancy likely due to:`);
        console.log(`      • Recently deleted comments`);
        console.log(`      • Comment moderation`);
        console.log(`      • API caching delays`);
    } else {
        console.log(`   ✅ Excellent coverage - counts match closely`);
    }

    if (debugInfo.errors.length > 0) {
        console.log(`   ❌ ${debugInfo.errors.length} errors occurred during download`);
        debugInfo.errors.forEach(({ page, error }) => {
            console.log(`      Page ${page}: ${error}`);
        });
    }
}

/**
 * Main debug function for TypeScript integration
 */
export async function debugVideoComments(input: string, maxComments: number = 2000): Promise<void> {
    console.log(`🎬 YouTube Comment Download Debugger (TypeScript)`);
    console.log(`═══════════════════════════════════════════════════════════════════════════════`);

    try {
        // Extract video ID
        const videoId = extractVideoIdFromYTUrl(input);
        if (!videoId) {
            throw new Error('Invalid YouTube URL or video ID');
        }

        console.log(`📹 Video ID: ${videoId}`);

        // Get video statistics using existing function
        const videoDetails = await getVideoDetailsFromYT(videoId);
        if (!videoDetails) {
            throw new Error('Could not fetch video details');
        }

        console.log(`\n📊 Video Statistics:`);
        console.log(`   Title: ${videoDetails.title}`);
        console.log(`   📝 Reported Comment Count: ${(videoDetails.commentCount || 0).toLocaleString()}`);

        // Debug comment download using existing API
        const debugInfo = await debugCommentDownloadWithExistingAPI(videoId, maxComments);

        // Compare counts and analyze
        compareCommentCounts(videoDetails.commentCount || 0, debugInfo.totalDownloaded, debugInfo);

        // Check for specific issues in your implementation
        console.log(`\n🔧 Implementation Analysis:`);
        console.log(`════════════════════════════════════════════════════════════════`);

        if (debugInfo.totalDownloaded < (videoDetails.commentCount || 0)) {
            console.log(`🔍 Checking your YouTube API implementation:`);

            // Check if the issue is in pagination limits
            if (debugInfo.pagesProcessed < 10 && !debugInfo.hasMorePages) {
                console.log(`   ⚠️  Few pages processed (${debugInfo.pagesProcessed}) but reached end`);
                console.log(`      This suggests the API stopped returning data early`);
            }

            // Check if the issue is in the maxComments limit
            if (debugInfo.hasMorePages) {
                console.log(`   📏 Download stopped due to maxComments limit (${maxComments})`);
                console.log(`      Try increasing maxComments to download more`);
            }

            // Check batch sizes
            if (debugInfo.pageSizes.length > 0) {
                const avgBatchSize = debugInfo.pageSizes.reduce((a, b) => a + b, 0) / debugInfo.pageSizes.length;
                if (avgBatchSize < 50) {
                    console.log(`   📉 Low average batch size (${avgBatchSize.toFixed(1)})`);
                    console.log(`      This suggests the API is returning fewer comments than expected per page`);
                }
            }
        }

        // Final recommendations
        console.log(`\n💡 Recommendations:`);
        console.log(`════════════════════════════════════════════════════════════════`);

        if (debugInfo.totalDownloaded === 0) {
            console.log(`   1. Check if comments are disabled for this video`);
            console.log(`   2. Verify your YouTube API key has CommentThreads permission`);
            console.log(`   3. Try a different video to test your API setup`);
        } else if (debugInfo.totalDownloaded < (videoDetails.commentCount || 0) * 0.5) {
            console.log(`   1. Remove or increase the maxComments limit in getVideoCommentsInBatches`);
            console.log(`   2. Check for API quota limits in Google Cloud Console`);
            console.log(`   3. Verify the video doesn't have restricted comment access`);
            console.log(`   4. Try running without timestamp cutoffs`);
        } else {
            console.log(`   1. Your implementation is working well`);
            console.log(`   2. Small discrepancies are normal due to comment moderation`);
            console.log(`   3. Consider the difference acceptable for most use cases`);
        }

        console.log(`\n✅ Debug Complete!`);

    } catch (error) {
        console.error('\n❌ Debug failed:', error);
        throw error;
    }
}

// Example usage function for testing
export async function runDebugExample(): Promise<void> {
    // You can test with a popular video that has many comments
    const testVideoUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; // Rick Roll - usually has many comments

    try {
        await debugVideoComments(testVideoUrl, 1000);
    } catch (error) {
        console.error('Debug example failed:', error);
    }
}
