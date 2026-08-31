#!/usr/bin/env node

/**
 * YouTube Comment Download Debug Script
 * 
 * This script helps debug discrepancies between reported comment counts
 * and actual downloadable comments from YouTube videos.
 * 
 * Usage: node scripts/debug-comment-download.js <video-url-or-id>
 */

const { google } = require('googleapis');
require('dotenv').config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('❌ Missing GOOGLE_API_KEY environment variable');
  process.exit(1);
}

const youtube = google.youtube({
  version: 'v3',
  auth: GOOGLE_API_KEY,
});

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get detailed video statistics
 */
async function getVideoStatistics(videoId) {
  console.log(`\n🔍 Fetching video statistics for: ${videoId}`);
  
  try {
    const response = await youtube.videos.list({
      part: ['snippet', 'statistics', 'status'],
      id: [videoId],
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found or is private');
    }

    const video = response.data.items[0];
    const stats = {
      id: videoId,
      title: video.snippet?.title || 'Unknown',
      description: video.snippet?.description?.substring(0, 200) + '...' || 'No description',
      publishedAt: video.snippet?.publishedAt,
      channelTitle: video.snippet?.channelTitle,
      categoryId: video.snippet?.categoryId,
      defaultLanguage: video.snippet?.defaultLanguage,
      viewCount: parseInt(video.statistics?.viewCount || '0'),
      likeCount: parseInt(video.statistics?.likeCount || '0'),
      commentCount: parseInt(video.statistics?.commentCount || '0'),
      commentsDisabled: video.status?.commentsDisabled || false,
      madeForKids: video.status?.madeForKids || false,
    };

    console.log(`📊 Video Statistics:`);
    console.log(`   Title: ${stats.title}`);
    console.log(`   Channel: ${stats.channelTitle}`);
    console.log(`   Published: ${stats.publishedAt}`);
    console.log(`   Views: ${stats.viewCount.toLocaleString()}`);
    console.log(`   Likes: ${stats.likeCount.toLocaleString()}`);
    console.log(`   📝 Reported Comment Count: ${stats.commentCount.toLocaleString()}`);
    console.log(`   Comments Disabled: ${stats.commentsDisabled}`);
    console.log(`   Made For Kids: ${stats.madeForKids}`);

    return stats;
  } catch (error) {
    console.error('❌ Error fetching video statistics:', error.message);
    throw error;
  }
}

/**
 * Debug comment download with detailed tracking
 */
async function debugCommentDownload(videoId, maxPages = 20) {
  console.log(`\n🚀 Starting comment download debug for video: ${videoId}`);
  console.log(`📄 Will fetch up to ${maxPages} pages (${maxPages * 100} comments max)\n`);

  let nextPageToken;
  let pageCount = 0;
  let totalComments = 0;
  let totalReplies = 0;
  let skippedThreads = 0;
  let emptyPages = 0;
  const pageSizes = [];
  const errors = [];
  const sampleComments = [];

  try {
    do {
      pageCount++;
      console.log(`📄 Fetching page ${pageCount}${nextPageToken ? ` (token: ${nextPageToken.substring(0, 20)}...)` : ' (first page)'}`);

      const startTime = Date.now();
      
      try {
        const response = await youtube.commentThreads.list({
          part: ['snippet', 'replies'],
          videoId: videoId,
          maxResults: 100,
          pageToken: nextPageToken,
          order: 'time',
          textFormat: 'plainText',
        });

        const fetchTime = Date.now() - startTime;

        if (!response.data.items || response.data.items.length === 0) {
          console.log(`   ⚠️  Empty page received`);
          emptyPages++;
          break;
        }

        const pageComments = response.data.items.length;
        let pageReplies = 0;
        let pageThreadsWithReplies = 0;

        // Process comment threads
        for (const item of response.data.items) {
          const comment = item.snippet?.topLevelComment?.snippet;
          
          if (!comment) {
            skippedThreads++;
            continue;
          }

          // Collect sample comments from first few pages
          if (pageCount <= 3 && sampleComments.length < 10) {
            sampleComments.push({
              text: comment.textDisplay?.substring(0, 100) + '...',
              author: comment.authorDisplayName,
              timestamp: comment.publishedAt,
              likes: comment.likeCount,
            });
          }

          // Count replies
          if (item.replies?.comments) {
            pageReplies += item.replies.comments.length;
            pageThreadsWithReplies++;
          }
        }

        totalComments += pageComments;
        totalReplies += pageReplies;
        pageSizes.push(pageComments + pageReplies);

        console.log(`   ✅ Page ${pageCount}: ${pageComments} threads, ${pageReplies} replies (${pageComments + pageReplies} total) - ${fetchTime}ms`);
        console.log(`      Threads with replies: ${pageThreadsWithReplies}`);

        nextPageToken = response.data.nextPageToken;

        if (!nextPageToken) {
          console.log(`   🏁 No more pages available (API indicates end)`);
          break;
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (pageError) {
        console.error(`   ❌ Error on page ${pageCount}:`, pageError.message);
        errors.push({ page: pageCount, error: pageError.message });
        
        // Check if it's a specific error that should stop pagination
        if (pageError.message.includes('quota') || 
            pageError.message.includes('disabled') ||
            pageError.message.includes('forbidden')) {
          break;
        }
      }

    } while (nextPageToken && pageCount < maxPages);

    // Generate debug report
    console.log(`\n📊 Download Debug Report:`);
    console.log(`════════════════════════════════════════════════════════════════`);
    console.log(`📄 Pages processed: ${pageCount}`);
    console.log(`📄 Empty pages: ${emptyPages}`);
    console.log(`💬 Total comment threads: ${totalComments.toLocaleString()}`);
    console.log(`↩️  Total replies: ${totalReplies.toLocaleString()}`);
    console.log(`🔢 Total downloadable comments: ${(totalComments + totalReplies).toLocaleString()}`);
    console.log(`⚠️  Skipped threads: ${skippedThreads}`);
    console.log(`❌ Errors encountered: ${errors.length}`);

    if (pageSizes.length > 0) {
      const avgPageSize = pageSizes.reduce((a, b) => a + b, 0) / pageSizes.length;
      const minPageSize = Math.min(...pageSizes);
      const maxPageSize = Math.max(...pageSizes);
      
      console.log(`\n📈 Page Size Analysis:`);
      console.log(`   Average: ${avgPageSize.toFixed(1)} comments per page`);
      console.log(`   Range: ${minPageSize} - ${maxPageSize} comments per page`);
      console.log(`   Page sizes: [${pageSizes.join(', ')}]`);
    }

    if (nextPageToken && pageCount >= maxPages) {
      console.log(`\n⚠️  Stopped due to page limit (${maxPages}). More comments likely available.`);
      console.log(`   Last page token: ${nextPageToken.substring(0, 50)}...`);
    }

    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach(({ page, error }) => {
        console.log(`   Page ${page}: ${error}`);
      });
    }

    if (sampleComments.length > 0) {
      console.log(`\n💬 Sample Comments (first ${sampleComments.length}):`);
      sampleComments.forEach((comment, index) => {
        console.log(`   ${index + 1}. [${comment.author}] ${comment.text} (${comment.likes} likes, ${comment.timestamp})`);
      });
    }

    return {
      totalDownloaded: totalComments + totalReplies,
      totalThreads: totalComments,
      totalReplies,
      pagesProcessed: pageCount,
      emptyPages,
      skippedThreads,
      errors,
      hasMorePages: !!nextPageToken,
      pageSizes,
    };

  } catch (error) {
    console.error('❌ Critical error during comment download:', error.message);
    throw error;
  }
}

/**
 * Compare reported vs actual comment counts
 */
function compareCommentCounts(reported, actual, debugInfo) {
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
  } else if (actual < reported * 0.9) {
    console.log(`   ✅ Good coverage - small discrepancy likely due to:`);
    console.log(`      • Recently deleted comments`);
    console.log(`      • Comment moderation`);
    console.log(`      • API caching delays`);
  } else {
    console.log(`   ✅ Excellent coverage - counts match closely`);
  }

  if (debugInfo.skippedThreads > 0) {
    console.log(`   📝 ${debugInfo.skippedThreads} comment threads were skipped (malformed data)`);
  }

  if (debugInfo.errors.length > 0) {
    console.log(`   ❌ ${debugInfo.errors.length} errors occurred during download`);
  }
}

/**
 * Main debug function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: node scripts/debug-comment-download.js <video-url-or-id> [max-pages]

Examples:
  node scripts/debug-comment-download.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  node scripts/debug-comment-download.js "dQw4w9WgXcQ" 50
  
This script will:
1. Fetch video statistics including reported comment count
2. Download comments page by page with detailed logging
3. Compare reported vs actual downloadable comment counts
4. Provide analysis of potential discrepancy causes
    `);
    process.exit(1);
  }

  const input = args[0];
  const maxPages = parseInt(args[1] || '20', 10);
  
  console.log(`🎬 YouTube Comment Download Debugger`);
  console.log(`═══════════════════════════════════════════════════════════════════════════════`);

  try {
    // Extract video ID
    const videoId = extractVideoId(input);
    if (!videoId) {
      throw new Error('Invalid YouTube URL or video ID');
    }

    console.log(`📹 Video ID: ${videoId}`);

    // Get video statistics
    const videoStats = await getVideoStatistics(videoId);

    // Debug comment download
    const debugInfo = await debugCommentDownload(videoId, maxPages);

    // Compare counts and analyze
    compareCommentCounts(videoStats.commentCount, debugInfo.totalDownloaded, debugInfo);

    // Final summary
    console.log(`\n✅ Debug Complete!`);
    console.log(`   Check the detailed logs above to identify the source of any discrepancy.`);

  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    process.exit(1);
  }
}

// Run the debug script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = {
  extractVideoId,
  getVideoStatistics,
  debugCommentDownload,
  compareCommentCounts,
};
