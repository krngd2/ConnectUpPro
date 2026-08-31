#!/usr/bin/env node

/**
 * Quick Comment Count Test
 * 
 * A simplified version to quickly test comment downloading
 * Usage: node scripts/quick-comment-test.js <video-url-or-id>
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

async function quickTest(videoId) {
  console.log(`🎬 Quick Comment Test for: ${videoId}\n`);

  try {
    // Step 1: Get reported comment count
    console.log('📊 Getting video statistics...');
    const videoResponse = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: [videoId],
    });

    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = videoResponse.data.items[0];
    const reportedCount = parseInt(video.statistics?.commentCount || '0');
    const title = video.snippet?.title || 'Unknown';

    console.log(`   Title: ${title}`);
    console.log(`   Reported Comments: ${reportedCount.toLocaleString()}\n`);

    // Step 2: Try downloading first page
    console.log('📥 Testing comment download (first page only)...');
    const commentsResponse = await youtube.commentThreads.list({
      part: ['snippet', 'replies'],
      videoId: videoId,
      maxResults: 100,
      order: 'time',
      textFormat: 'plainText',
    });

    if (!commentsResponse.data.items || commentsResponse.data.items.length === 0) {
      console.log('   ❌ No comments found in first page');
      console.log('   Possible reasons:');
      console.log('   • Comments are disabled');
      console.log('   • Video requires special permissions');
      console.log('   • Regional restrictions');
      return;
    }

    const threads = commentsResponse.data.items.length;
    let replies = 0;
    
    commentsResponse.data.items.forEach(item => {
      if (item.replies?.comments) {
        replies += item.replies.comments.length;
      }
    });

    const firstPageTotal = threads + replies;
    const hasNextPage = !!commentsResponse.data.nextPageToken;

    console.log(`   ✅ First page downloaded successfully`);
    console.log(`   Thread comments: ${threads}`);
    console.log(`   Reply comments: ${replies}`);
    console.log(`   Total first page: ${firstPageTotal}`);
    console.log(`   Has next page: ${hasNextPage ? 'Yes' : 'No'}\n`);

    // Step 3: Estimate if pagination looks normal
    if (hasNextPage && firstPageTotal > 50) {
      console.log('💡 Initial analysis:');
      console.log(`   First page size (${firstPageTotal}) looks normal`);
      console.log(`   With ${Math.ceil(reportedCount / firstPageTotal)} estimated pages needed`);
      console.log(`   Pagination appears to be working`);
      
      if (reportedCount > 5000) {
        console.log(`   ⚠️  Large video (${reportedCount.toLocaleString()} comments) - consider pagination limits`);
      }
    } else if (!hasNextPage) {
      console.log('⚠️  No next page available:');
      if (firstPageTotal < reportedCount) {
        console.log(`   This explains the discrepancy (${reportedCount - firstPageTotal} missing)`);
        console.log(`   Possible causes:`);
        console.log(`   • Comments became private/restricted`);
        console.log(`   • API access limitations`);
        console.log(`   • Comment count includes deleted/hidden comments`);
      } else {
        console.log(`   Comment count matches or is close to reported count`);
      }
    }

    // Step 4: Show sample comments
    console.log('\n💬 Sample comments:');
    const samples = commentsResponse.data.items.slice(0, 3);
    samples.forEach((item, index) => {
      const comment = item.snippet?.topLevelComment?.snippet;
      if (comment) {
        const text = comment.textDisplay?.substring(0, 80) + '...';
        const author = comment.authorDisplayName;
        const likes = comment.likeCount || 0;
        console.log(`   ${index + 1}. [${author}] ${text} (${likes} likes)`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('quota')) {
      console.log('\n💡 YouTube API quota exceeded. Wait and try again later.');
    } else if (error.message.includes('disabled')) {
      console.log('\n💡 Comments are disabled for this video.');
    } else if (error.message.includes('forbidden') || error.message.includes('403')) {
      console.log('\n💡 Check your YouTube API key permissions.');
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/quick-comment-test.js <video-url-or-id>');
    console.log('Example: node scripts/quick-comment-test.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
    process.exit(1);
  }

  const input = args[0];
  const videoId = extractVideoId(input);
  
  if (!videoId) {
    console.error('❌ Invalid YouTube URL or video ID');
    process.exit(1);
  }

  await quickTest(videoId);
}

if (require.main === module) {
  main().catch(console.error);
}
