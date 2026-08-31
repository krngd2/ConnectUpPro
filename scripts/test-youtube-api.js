#!/usr/bin/env node

/**
 * Debug script to test YouTube API connectivity
 * Run with: node scripts/test-youtube-api.js
 */

const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.GOOGLE_API_KEY,
});

async function testYouTubeAPI() {
  console.log('🔍 Testing YouTube API connectivity...\n');

  // Test API key
  if (!process.env.GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('✅ YouTube API key found');
  console.log(`📝 API key: ${process.env.GOOGLE_API_KEY.substring(0, 10)}...`);

  // Test video ID extraction
  const testUrls = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    // 'https://youtu.be/dQw4w9WgXcQ',
    // 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    // 'dQw4w9WgXcQ'
  ];

  console.log('\n🔗 Testing URL parsing:');
  testUrls.forEach(url => {
    const videoId = extractVideoId(url);
    console.log(`  ${url} → ${videoId}`);
  });

  // Test API call with a known video
  const testVideoId = 'dQw4w9WgXcQ'; // Rick Roll - should always exist
  console.log(`\n📹 Testing video details fetch for: ${testVideoId}`);

  try {
    const response = await youtube.videos.list({
      part: ['snippet'],
      id: [testVideoId],
    });

    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      console.log('✅ Video details fetched successfully:');
      console.log(`   Title: ${video.snippet?.title}`);
      console.log(`   Channel: ${video.snippet?.channelTitle}`);
      console.log(`   Published: ${video.snippet?.publishedAt}`);
    } else {
      console.log('⚠️ No video data returned');
    }

  } catch (error) {
    console.error('❌ Error fetching video details:', error.message);
    
    if (error.message.includes('quota')) {
      console.error('💡 Suggestion: YouTube API quota exceeded');
    } else if (error.message.includes('forbidden')) {
      console.error('💡 Suggestion: Check API key permissions');
    } else if (error.message.includes('API key')) {
      console.error('💡 Suggestion: Verify API key is correct');
    }
  }

  // Test comments fetch
  console.log(`\n💬 Testing comments fetch for: ${testVideoId}`);
  
  try {
    const response = await youtube.commentThreads.list({
      part: ['snippet'],
      videoId: testVideoId,
      maxResults: 5,
    });

    if (response.data.items && response.data.items.length > 0) {
      console.log(`✅ Comments fetched successfully (${response.data.items.length} comments)`);
      response.data.items.forEach((item, index) => {
        const comment = item.snippet?.topLevelComment?.snippet;
        if (comment) {
          console.log(`   ${index + 1}. ${comment.authorDisplayName}: ${comment.textDisplay?.substring(0, 50)}...`);
        }
      });
    } else {
      console.log('⚠️ No comments returned (may be disabled)');
    }

  } catch (error) {
    console.error('❌ Error fetching comments:', error.message);
    
    if (error.message.includes('disabled')) {
      console.log('💡 Comments are disabled for this video');
    }
  }

  console.log('\n🎉 YouTube API test completed!');
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Run the test
testYouTubeAPI().catch(console.error);
