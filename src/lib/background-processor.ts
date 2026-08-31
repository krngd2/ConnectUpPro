import { prisma } from '@/lib/db';
import { getVideoDetailsFromYT, getVideoComments, extractVideoIdFromYTUrl } from '@/lib/youtube';

export interface ProcessingJob {
  videoId: string;
}

export interface VideoStatus {
  id: string;
  name: string;
  status: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  videosCount: number;
  commentsCount: number;
  analysisSummary: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Process a video: fetch YouTube data and comments
 */
export async function processVideo(videoId: string): Promise<void> {
  console.log(`[PROCESSOR] Starting to process video: ${videoId}`);

  // Check environment variables first
  if (!process.env.GOOGLE_API_KEY) {
    console.error(`[PROCESSOR] GOOGLE_API_KEY not found in environment`);
    throw new Error('Google API key not configured');
  }

  try {
    // Update video status to PROCESSING
    console.log(`[PROCESSOR] Updating video ${videoId} status to PROCESSING`);
    await prisma.video.update({
      where: { id: videoId },
      data: { status: 'PROCESSING' },
    });

    // Get video data
    console.log(`[PROCESSOR] Fetching video data for: ${videoId}`);
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    });

    if (!video) {
      throw new Error(`Video ${videoId} not found`);
    }

    console.log(`[PROCESSOR] Video found with URL: ${video.url}`);

    let totalComments = 0;

    try {
      console.log(`[PROCESSOR] Processing video: ${video.url}`);

      // Extract video ID from URL
      const ytVideoId = extractVideoIdFromYTUrl(video.url);
      if (!ytVideoId) {
        throw new Error(`Invalid YouTube URL: ${video.url}`);
      }

      console.log(`[PROCESSOR] Extracted YouTube video ID: ${ytVideoId}`);

      // Get video details
      console.log(`[PROCESSOR] Fetching video details...`);
      const videoDetails = await getVideoDetailsFromYT(ytVideoId);

      if (!videoDetails) {
        throw new Error(`Failed to get video details for: ${ytVideoId}`);
      }

      console.log(`[PROCESSOR] Video details fetched: "${videoDetails.title}"`);

      // Update video with details
      await prisma.video.update({
        where: { id: videoId },
        data: {
          title: videoDetails.title,
          thumbnailUrl: videoDetails.thumbnailUrl,
        },
      });

      // Get comments
      console.log(`[PROCESSOR] Fetching comments...`);
      const comments = await getVideoComments(ytVideoId);

      console.log(`[PROCESSOR] Found ${comments.length} comments`);

      if (comments.length > 0) {
        // Store comments in database
        console.log(`[PROCESSOR] Storing ${comments.length} comments in database...`);

        // Clear existing comments for this video
        await prisma.comment.deleteMany({
          where: { videoId: videoId },
        });

        // Insert new comments
        const commentData = comments.map(comment => ({
          platformId: comment.id,
          text: comment.text,
          authorName: comment.authorName,
          authorAvatarUrl: comment.authorAvatarUrl,
          timestamp: comment.timestamp,
          videoId: videoId,
          analysis: {}, // Empty analysis object for now
        }));

        await prisma.comment.createMany({
          data: commentData,
          skipDuplicates: true,
        });

        totalComments = comments.length;
        console.log(`[PROCESSOR] Stored ${totalComments} comments successfully`);
      }

    } catch (videoError) {
      console.error(`[PROCESSOR] Error processing video ${video.url}:`, videoError);
      throw videoError;
    }

    // Update video status to COMPLETED
    console.log(`[PROCESSOR] Updating video ${videoId} status to COMPLETED`);
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: 'COMPLETED',
        analysisSummary: {
          totalComments,
          processedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

    console.log(`[PROCESSOR] Video ${videoId} processed successfully! Total comments: ${totalComments}`);

  } catch (error) {
    console.error(`[PROCESSOR] Error processing video ${videoId}:`, error);

    // Update video status to FAILED
    try {
      await prisma.video.update({
        where: { id: videoId },
        data: { status: 'FAILED' },
      });
    } catch (updateError) {
      console.error(`[PROCESSOR] Failed to update video status to FAILED:`, updateError);
    }

    throw error;
  }
}

/**
 * Get video status and analysis data
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const video = await (prisma.video as any).findUnique({
      where: { id: videoId },
      include: {
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    if (!video) {
      return null;
    }

    return {
      id: video.id,
      name: video.name || video.title || 'Untitled Analysis',
      status: video.status || 'PENDING',
      url: video.url,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      videosCount: 1, // Since each video is its own analysis
      commentsCount: video._count?.comments || 0,
      analysisSummary: video.analysisSummary,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    };
  } catch (error) {
    console.error(`[PROCESSOR] Error getting video status for ${videoId}:`, error);
    throw error;
  }
}

/**
 * Backward compatibility - redirect to getVideoStatus
 */
export async function getProjectStatus(projectId: string): Promise<VideoStatus | null> {
  console.log(`[PROCESSOR] getProjectStatus called with ID: ${projectId}, redirecting to getVideoStatus`);
  return getVideoStatus(projectId);
}

/**
 * Queue a video for processing (alias for backward compatibility)
 */
export async function queueProjectProcessing(videoId: string): Promise<void> {
  return processVideo(videoId);
}

/**
 * Backward compatibility - redirect to processVideo
 */
export async function processProject(projectId: string): Promise<void> {
  console.log(`[PROCESSOR] processProject called with ID: ${projectId}, redirecting to processVideo`);
  return processVideo(projectId);
}
