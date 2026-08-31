import { google } from 'googleapis';
import { YouTubeComment, YouTubeVideo } from './types';

// Ensure API key is provided, otherwise googleapis will attempt Application Default Credentials
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable. Please set GOOGLE_API_KEY to your YouTube Data API key.');
}
// Instantiate YouTube client with API key auth
export const youtube = google.youtube({
  version: 'v3',
  auth: GOOGLE_API_KEY,
});

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoIdFromYTUrl(url: string): string | null {
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
 * Fetch video details from YouTube API
 */
export async function getVideoDetailsFromYT(videoId: string): Promise<YouTubeVideo | null> {
  console.log(`[YOUTUBE] Fetching video details for ID: ${videoId}`);
  if (videoId.startsWith('http')) {
    const extractedId = extractVideoIdFromYTUrl(videoId);
    if (!extractedId) {
      console.warn(`[YOUTUBE] Could not extract video ID from URL: ${videoId}`);
      return null;
    }
    videoId = extractedId;
    console.log(`[YOUTUBE] Extracted video ID: ${videoId}`);
  }
  try {
    // API key is already validated at module level, so we can proceed directly
    const response = await youtube.videos.list({
      part: ['snippet', 'statistics'],
      id: [videoId],
    });


    if (!response.data.items || response.data.items.length === 0) {
      console.warn(`[YOUTUBE] No video found for ID: ${videoId}. Video may be private, deleted, or unavailable.`);
      return null;
    }

    const video = response.data.items[0];
    if (!video || !video.snippet) {
      console.warn(`[YOUTUBE] Video snippet not available for ID: ${videoId}`);
      return null;
    }

    const videoDetails = {
      id: videoId,
      title: video.snippet.title || 'Untitled Video',
      thumbnailUrl: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || '',
      commentCount: parseInt(video.statistics?.commentCount || '0', 10),
    };

    console.log(`[YOUTUBE] Successfully fetched video: "${videoDetails.title}" with ${videoDetails.commentCount} comments`);
    return videoDetails;

  } catch (error) {
    console.error(`[YOUTUBE] Error fetching video details for ID ${videoId}:`, error);

    if (error instanceof Error) {
      // Log specific error information
      console.error(`[YOUTUBE] Error name: ${error.name}`);
      console.error(`[YOUTUBE] Error message: ${error.message}`);

      // Check for specific YouTube API errors
      if (error.message.includes('quota')) {
        throw new Error('YouTube API quota exceeded');
      }

      if (error.message.includes('API key')) {
        throw new Error('Invalid YouTube API key');
      }

      if (error.message.includes('forbidden') || error.message.includes('403')) {
        throw new Error('YouTube API access forbidden - check API key permissions');
      }
    }

    return null;
  }
}

/**
 * Generator function that yields batches of comments as they're downloaded
 * This allows for streaming processing instead of loading all comments into memory
 * Supports incremental sync by stopping when reaching a specific timestamp
 */
export async function* getVideoCommentsInBatches(
  videoId: string,
  batchSize: number = 100,
  options: {
    maxComments?: number; // Maximum number of new comments to fetch (for incremental sync)
    stopAfterTimestamp?: Date; // Stop fetching when we reach comments older than this timestamp
  } = {}
): AsyncGenerator<YouTubeComment[], void, unknown> {
  const { maxComments, stopAfterTimestamp } = options;

  console.log(`[YOUTUBE] Starting streaming comment fetch for video ID: ${videoId}`);
  console.log(`[YOUTUBE] Batch size: ${batchSize}, Max new comments: ${maxComments || 'unlimited'}`);
  if (stopAfterTimestamp) {
    console.log(`[YOUTUBE] Will stop when reaching comments older than: ${stopAfterTimestamp.toISOString()}`);
  }

  let nextPageToken: string | undefined;
  let pageCount = 0;
  let newCommentsProcessed = 0;

  try {
    // API key is already validated at module level, so we can proceed directly
    do {
      pageCount++;
      console.log(`[YOUTUBE] Fetching comments page ${pageCount} for video: ${videoId}`);

      const response = await youtube.commentThreads.list({
        part: ['snippet', 'replies'],
        videoId: videoId,
        maxResults: batchSize,
        pageToken: nextPageToken,
        order: 'time',
        textFormat: 'plainText', // Use plain text to avoid HTML entities
      });


      if (!response.data.items || response.data.items.length === 0) {
        console.log(`[YOUTUBE] No more comments found on page ${pageCount}`);
        break;
      }

      const batchComments: YouTubeComment[] = [];

      console.log(`[YOUTUBE] Processing ${response.data.items.length} comment threads from page ${pageCount}`);

      for (const item of response.data.items) {
        // Check if we've reached the max new comments limit
        if (maxComments && newCommentsProcessed >= maxComments) {
          console.log(`[YOUTUBE] Reached max new comments limit (${maxComments}), stopping fetch`);
          return;
        }

        const comment = item.snippet?.topLevelComment?.snippet;
        if (comment) {
          batchComments.push({
            id: item.snippet?.topLevelComment?.id || '',
            text: comment.textDisplay || '',
            authorName: comment.authorDisplayName || 'Anonymous',
            authorAvatarUrl: comment.authorProfileImageUrl || '',
            timestamp: new Date(comment.publishedAt || Date.now()),
            likeCount: comment.likeCount || 0,
            isReply: false, // Top-level comments are not replies
            replyCount: item.snippet?.totalReplyCount || 0
          });
          newCommentsProcessed++;
        }

        // Also fetch replies if they exist
        if (item.replies?.comments) {
          console.log(`[YOUTUBE] Processing ${item.replies.comments.length} replies`);
          for (const reply of item.replies.comments) {
            // Check max limit for replies too
            if (maxComments && newCommentsProcessed >= maxComments) {
              console.log(`[YOUTUBE] Reached max new comments limit (${maxComments}) while processing replies, stopping`);
              return;
            }

            const replySnippet = reply.snippet;
            if (replySnippet) {
              batchComments.push({
                id: reply.id || '',
                text: replySnippet.textDisplay || '',
                authorName: replySnippet.authorDisplayName || 'Anonymous',
                authorAvatarUrl: replySnippet.authorProfileImageUrl || '',
                timestamp: new Date(replySnippet.publishedAt || Date.now()),
                likeCount: replySnippet.likeCount || 0,
                isReply: true, // Reply comments are marked as replies
                replyCount: 0 // Replies do not have further replies in this context
              });
              newCommentsProcessed++;
            }
          }
        }
      }

      // Check if we should stop based on timestamp
      if (stopAfterTimestamp && batchComments.length > 0) {
        // Find the oldest comment in this batch
        const oldestCommentTime = Math.min(...batchComments.map(c => c.timestamp.getTime()));
        const oldestTimestamp = new Date(oldestCommentTime);

        if (oldestTimestamp <= stopAfterTimestamp) {
          console.log(`[YOUTUBE] Reached timestamp cutoff. Oldest comment in batch: ${oldestTimestamp.toISOString()}, stopping at: ${stopAfterTimestamp.toISOString()}`);

          // Filter out comments older than or equal to the cutoff timestamp
          const newComments = batchComments.filter(comment => comment.timestamp > stopAfterTimestamp);

          if (newComments.length > 0) {
            console.log(`[YOUTUBE] Page ${pageCount} yielding final batch of ${newComments.length} new comments before cutoff (filtered from ${batchComments.length})`);
            yield newComments;
          }

          console.log(`[YOUTUBE] Total new comments fetched before timestamp cutoff: ${newCommentsProcessed}`);
          return;
        }
      }

      // Always yield if we have comments in this batch
      if (batchComments.length > 0) {
        console.log(`[YOUTUBE] Page ${pageCount} yielding ${batchComments.length} comments. Total new comments so far: ${newCommentsProcessed}`);
        yield batchComments;
      }

      nextPageToken = response.data.nextPageToken || undefined;

      if (nextPageToken) {
        console.log(`[YOUTUBE] Next page token found, continuing to page ${pageCount + 1}`);
      }

    } while (nextPageToken && pageCount < 100); // Limit to 100 pages max (10000 comments) to prevent infinite loops

    if (pageCount >= 100) {
      console.warn(`[YOUTUBE] Reached maximum page limit (100) for video: ${videoId}`);
    }

    console.log(`[YOUTUBE] Streaming fetch completed: ${newCommentsProcessed} new comments processed from ${pageCount} pages for video: ${videoId}`);

  } catch (error) {
    console.error(`[YOUTUBE] Error in streaming comment fetch for video ${videoId}:`, error);

    if (error instanceof Error) {
      console.error(`[YOUTUBE] Error name: ${error.name}`);
      console.error(`[YOUTUBE] Error message: ${error.message}`);

      // Check for specific YouTube API errors
      if (error.message.includes('quota')) {
        throw new Error('YouTube API quota exceeded');
      }

      if (error.message.includes('disabled')) {
        console.warn(`[YOUTUBE] Comments are disabled for video: ${videoId}`);
        return; // End generator gracefully
      }

      if (error.message.includes('forbidden') || error.message.includes('403')) {
        throw new Error('YouTube API access forbidden - check API key permissions');
      }

      if (error.message.includes('not found') || error.message.includes('404')) {
        throw new Error('Video not found or is private');
      }
    }

    throw error;
  }
}

/**
 * Fetch all comments for a YouTube video (legacy function for backward compatibility)
 */
export async function getVideoComments(videoId: string): Promise<YouTubeComment[]> {
  console.log(`[YOUTUBE] Starting to fetch comments for video ID: ${videoId}`);

  const comments: YouTubeComment[] = [];
  let nextPageToken: string | undefined;
  let pageCount = 0;

  try {
    // API key is already validated at module level, so we can proceed directly
    do {
      pageCount++;
      console.log(`[YOUTUBE] Fetching comments page ${pageCount} for video: ${videoId}`);

      const response = await youtube.commentThreads.list({
        part: ['snippet', 'replies'],
        videoId: videoId,
        maxResults: 100,
        pageToken: nextPageToken,
        order: 'time',
      });


      if (!response.data.items || response.data.items.length === 0) {
        console.log(`[YOUTUBE] No more comments found on page ${pageCount}`);
        break;
      }

      console.log(`[YOUTUBE] Processing ${response.data.items.length} comment threads from page ${pageCount}`);

      for (const item of response.data.items) {
        const comment = item.snippet?.topLevelComment?.snippet;
        if (comment) {
          comments.push({
            id: item.snippet?.topLevelComment?.id || '',
            text: comment.textDisplay || '',
            authorName: comment.authorDisplayName || 'Anonymous',
            authorAvatarUrl: comment.authorProfileImageUrl || '',
            timestamp: new Date(comment.publishedAt || Date.now()),
            likeCount: comment.likeCount || 0,
            isReply: false, // Top-level comments are not replies
            replyCount: item.snippet?.totalReplyCount || 0
          });
        }

        // Also fetch replies if they exist
        if (item.replies?.comments) {
          console.log(`[YOUTUBE] Processing ${item.replies.comments.length} replies`);
          for (const reply of item.replies.comments) {
            const replySnippet = reply.snippet;
            if (replySnippet) {
              comments.push({
                id: reply.id || '',
                text: replySnippet.textDisplay || '',
                authorName: replySnippet.authorDisplayName || 'Anonymous',
                authorAvatarUrl: replySnippet.authorProfileImageUrl || '',
                timestamp: new Date(replySnippet.publishedAt || Date.now()),
                likeCount: replySnippet.likeCount || 0,
                isReply: true, // Reply comments are marked as replies
                replyCount: 0,
              });
            }
          }
        }
      }

      nextPageToken = response.data.nextPageToken || undefined;
      console.log(`[YOUTUBE] Page ${pageCount} processed. Total comments so far: ${comments.length}`);

      if (nextPageToken) {
        console.log(`[YOUTUBE] Next page token found, continuing to page ${pageCount + 1}`);
      }

    } while (nextPageToken && pageCount < 50); // Limit to 50 pages max (5000 comments) to prevent infinite loops

    if (pageCount >= 50) {
      console.warn(`[YOUTUBE] Reached maximum page limit (50) for video: ${videoId}`);
    }

    console.log(`[YOUTUBE] Successfully fetched ${comments.length} total comments from ${pageCount} pages for video: ${videoId}`);
    return comments;

  } catch (error) {
    console.error(`[YOUTUBE] Error fetching comments for video ${videoId}:`, error);

    if (error instanceof Error) {
      console.error(`[YOUTUBE] Error name: ${error.name}`);
      console.error(`[YOUTUBE] Error message: ${error.message}`);

      // Check for specific YouTube API errors
      if (error.message.includes('quota')) {
        throw new Error('YouTube API quota exceeded');
      }

      if (error.message.includes('disabled')) {
        console.warn(`[YOUTUBE] Comments are disabled for video: ${videoId}`);
        return []; // Return empty array instead of throwing
      }

      if (error.message.includes('forbidden') || error.message.includes('403')) {
        throw new Error('YouTube API access forbidden - check API key permissions');
      }

      if (error.message.includes('not found') || error.message.includes('404')) {
        throw new Error('Video not found or is private');
      }
    }

    throw error;
  }
}
