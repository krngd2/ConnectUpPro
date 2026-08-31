import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'
import { getVideoDetailsFromYT, getVideoCommentsInBatches, extractVideoIdFromYTUrl } from '@/lib/youtube'
import { ClusterCommentsWithEmbeddings, createEmbeddings, parsePgVectorString, toPgVectorString } from '@/lib/gemini'
import { VIDEO_STATUS, type VideoStatus } from '@/lib/constants'
import { notifyAnalysisResult } from '@/lib/notifications'
import { performSentimentAnalysis } from '@/lib/sentiment-analysis'

interface Comment {
  id?: string;
  platformId: string;
  text: string;
  likeCount?: number;
  isReply?: boolean;
}

interface Cluster {
  name: string;
  commentIDs: string[];
}
const MAX_COMMENTS_FOR_CLUSTERING = 50000; // Adjust based on your server memory

// Unified memory-optimized clustering function
interface ClusteringInput {
  videoId: string;
  maxClusters?: number;
  maxEmbeddings?: number;
  clusterPrefix?: string;
  parentClusterId?: string;
  useOptimizedMode?: boolean;
}

interface ClusteringResult {
  clusters: Cluster[];
  embeddingsUsed: number;
  commentsProcessed: number;
}

async function performOptimizedClustering(input: ClusteringInput): Promise<ClusteringResult> {
  const { videoId, maxClusters = 10, maxEmbeddings = 2000, clusterPrefix = '', parentClusterId, useOptimizedMode = true } = input;

  console.log(`[VIDEO_ACTIONS] Starting ${useOptimizedMode ? 'optimized' : 'standard'} clustering for ${parentClusterId ? 'sub-cluster' : 'video'}: ${videoId}`);

  let commentData: Array<{ id: string; embedding: string; }> = [];
  let commentsToProcess: Array<{ id: string; embedding: string; }> = [];

  if (useOptimizedMode) {
    // Memory-optimized approach: fetch only embeddings
    const embeddingQuery = parentClusterId ? `
      SELECT c."id", c.embedding::text as embedding, c."likeCount", c."timestamp"
      FROM "Comment" c
      WHERE c."clusterId" = $1 AND c.embedding IS NOT NULL
      ORDER BY c."timestamp" DESC
    ` : `
      SELECT c."id", c.embedding::text as embedding, c."likeCount", c."timestamp"
      FROM "Comment" c
      WHERE c."videoId" = $1 AND c.embedding IS NOT NULL
      ORDER BY c."timestamp" DESC
    `;

    const queryParam = parentClusterId || videoId;
    commentData = await prisma.$queryRawUnsafe(embeddingQuery, queryParam) as Array<{
      id: string;
      embedding: string;
      likeCount: number;
      timestamp: Date;
    }>;

    console.log(`[VIDEO_ACTIONS] Found ${commentData.length} comments with embeddings`);

    if (commentData.length === 0) {
      throw new Error('No comments with embeddings found. Cannot perform semantic clustering.');
    }

    // Memory-efficient sampling using database queries
    if (commentData.length > maxEmbeddings) {
      console.log(`[VIDEO_ACTIONS] Sampling ${maxEmbeddings} embeddings from ${commentData.length} total`);

      const recentCount = Math.floor(maxEmbeddings * 0.4);
      const topEngagementCount = Math.floor(maxEmbeddings * 0.4);
      const randomCount = maxEmbeddings - recentCount - topEngagementCount;

      const samplingQueries = parentClusterId ? [
        // For sub-clusters: sample from cluster
        prisma.$queryRawUnsafe(`
          SELECT c."id", c.embedding::text as embedding
          FROM "Comment" c
          WHERE c."clusterId" = $1 AND c.embedding IS NOT NULL
          ORDER BY c."timestamp" DESC
          LIMIT $2
        `, parentClusterId, recentCount),

        prisma.$queryRawUnsafe(`
          SELECT c."id", c.embedding::text as embedding
          FROM "Comment" c
          WHERE c."clusterId" = $1 AND c.embedding IS NOT NULL
          ORDER BY c."likeCount" DESC
          LIMIT $2
        `, parentClusterId, topEngagementCount),

        prisma.$queryRawUnsafe(`
          SELECT c."id", c.embedding::text as embedding
          FROM "Comment" c
          WHERE c."clusterId" = $1 AND c.embedding IS NOT NULL
          ORDER BY RANDOM()
          LIMIT $2
        `, parentClusterId, randomCount)
      ] : [
        // For video-level clustering
        prisma.$queryRawUnsafe(`
          SELECT c."id", c.embedding::text as embedding
          FROM "Comment" c
          WHERE c."videoId" = $1 AND c.embedding IS NOT NULL
          ORDER BY c."timestamp" DESC
          LIMIT $2
        `, videoId, recentCount),

        prisma.$queryRawUnsafe(`
          SELECT c."id", c.embedding::text as embedding
          FROM "Comment" c
          WHERE c."videoId" = $1 AND c.embedding IS NOT NULL
          ORDER BY c."likeCount" DESC
          LIMIT $2
        `, videoId, topEngagementCount),

        prisma.$queryRawUnsafe(`
          SELECT c."id", c.embedding::text as embedding
          FROM "Comment" c
          WHERE c."videoId" = $1 AND c.embedding IS NOT NULL
          ORDER BY RANDOM()
          LIMIT $2
        `, videoId, randomCount)
      ];

      const [recentEmbeddings, topEngagementEmbeddings, randomEmbeddings] = await Promise.all(samplingQueries) as [
        Array<{ id: string; embedding: string }>,
        Array<{ id: string; embedding: string }>,
        Array<{ id: string; embedding: string }>
      ];

      // Deduplicate samples
      const combinedMap = new Map<string, { id: string; embedding: string }>();
      [...recentEmbeddings, ...topEngagementEmbeddings, ...randomEmbeddings].forEach(item => {
        combinedMap.set(item.id, item);
      });

      commentsToProcess = Array.from(combinedMap.values());
      console.log(`[VIDEO_ACTIONS] After deduplication: ${commentsToProcess.length} unique embeddings for clustering`);
    } else {
      commentsToProcess = commentData;
    }
  } else {
    // Standard approach: fetch full comment objects using raw SQL for embedding compatibility
    const comments = parentClusterId ?
      await prisma.$queryRaw`
        SELECT c."id", c."platformId", c.embedding::text as embedding
        FROM "Comment" c
        WHERE c."clusterId" = ${parentClusterId}
        ORDER BY c."timestamp" DESC
      ` as Array<{ id: string; platformId: string; embedding: string | null }> :
      await prisma.$queryRaw`
        SELECT c."id", c."platformId", c.embedding::text as embedding
        FROM "Comment" c
        WHERE c."videoId" = ${videoId}
        ORDER BY c."timestamp" DESC
      ` as Array<{ id: string; platformId: string; embedding: string | null }>;

    commentsToProcess = comments
      .filter(c => c.embedding)
      .map(c => ({
        id: c.id || c.platformId,
        embedding: c.embedding!
      }));
  }

  // Prepare embedding data for clustering
  const embeddingData: { commentID: string, embedding?: number[] }[] = [];

  for (const item of commentsToProcess) {
    const embeddingArray = parsePgVectorString(item.embedding);

    // Validate both embedding and commentID
    if (!item.id || typeof item.id !== 'string' || item.id.length < 8) {
      console.error(`[VIDEO_ACTIONS] Invalid comment ID found: ${item.id} (type: ${typeof item.id})`);
      continue;
    }

    if (embeddingArray && embeddingArray.length === 768) {
      embeddingData.push({
        commentID: item.id,
        embedding: embeddingArray
      });
    } else {
      console.warn(`[VIDEO_ACTIONS] Invalid embedding dimensions for comment ${item.id}: ${embeddingArray?.length || 'null'}`);
    }
  }

  console.log(`[VIDEO_ACTIONS] Prepared ${embeddingData.length} valid embeddings for clustering`);
  
  // Sample a few commentIDs for verification
  if (embeddingData.length > 0) {
    const sampleIds = embeddingData.slice(0, 3).map(e => e.commentID);
    console.log(`[VIDEO_ACTIONS] Sample commentIDs being sent to clustering:`, sampleIds);
  }

  // Perform clustering
  let clusters: Cluster[] = [];
  try {
    console.log(`[VIDEO_ACTIONS] Starting clustering with ${embeddingData.length} embeddings into ${maxClusters} clusters...`);
    clusters = await ClusterCommentsWithEmbeddings(embeddingData, maxClusters, 10);
    console.log(`[VIDEO_ACTIONS] Clustering completed. Generated ${clusters.length} clusters`);
  } catch (clusteringError) {
    console.error('[VIDEO_ACTIONS] Clustering failed, using fallback strategy:', clusteringError);

    // Fallback: Create sequential clusters
    const embeddingIds = embeddingData.map(item => item.commentID);
    const clusterSize = Math.ceil(embeddingIds.length / maxClusters);

    clusters = [];
    for (let i = 0; i < maxClusters && i * clusterSize < embeddingIds.length; i++) {
      const start = i * clusterSize;
      const end = Math.min(start + clusterSize, embeddingIds.length);
      const clusterCommentIds = embeddingIds.slice(start, end);

      clusters.push({
        name: `${clusterPrefix}Cluster ${i + 1}`,
        commentIDs: clusterCommentIds
      });
    }

    console.log(`[VIDEO_ACTIONS] Fallback clustering created ${clusters.length} clusters`);
  }

  return {
    clusters,
    embeddingsUsed: embeddingData.length,
    commentsProcessed: commentsToProcess.length
  };
}

// Enhanced cluster creation with category labeling
async function createClustersInDatabase(clusters: Cluster[], videoId: string, parentClusterId?: string, level: number = 0): Promise<string[]> {
  const createdClusterIds: string[] = [];

  for (const cluster of clusters) {
    try {
      if (!cluster.commentIDs || cluster.commentIDs.length === 0) {
        console.warn(`[VIDEO_ACTIONS] Skipping empty cluster: ${cluster.name}`);
        continue;
      }
      // Detect pathological clusters containing only placeholder numeric zeros or invalid IDs
      const nonEmptyRealIds = cluster.commentIDs.filter(id => typeof id === 'string' && id.length > 8); // uuid length heuristic
      if (nonEmptyRealIds.length === 0) {
        console.warn(`[VIDEO_ACTIONS] Cluster "${cluster.name}" has only non-UUID/placeholder IDs:`, cluster.commentIDs.slice(0, 5));
        continue; // Avoid creating meaningless cluster entries
      }
      // Generate category label based on sample comments
      let categoryLabel = cluster.name;
      // if incase categoryLabel is not set
      if (!categoryLabel) {
        // Fetch sample comment texts for category labeling (memory efficient)
        const sampleSize = Math.min(10, cluster.commentIDs.length);
        const sampleCommentIds = cluster.commentIDs.slice(0, sampleSize);
        const sampleComments = await prisma.$queryRawUnsafe(`
          SELECT c."text"
          FROM "Comment" c
          WHERE c."id" = ANY($1)
          LIMIT $2
        `, sampleCommentIds, sampleSize) as Array<{ text: string }>;
        const combinedText = sampleComments.map(c => c.text).join(' ').toLowerCase();

        // Enhanced category detection
        if (combinedText.includes('love') || combinedText.includes('amazing') || combinedText.includes('great') || combinedText.includes('awesome')) {
          categoryLabel = `Positive Feedback (${cluster.commentIDs.length} comments)`;
        } else if (combinedText.includes('question') || combinedText.includes('how') || combinedText.includes('what') || combinedText.includes('why')) {
          categoryLabel = `Questions & Inquiries (${cluster.commentIDs.length} comments)`;
        } else if (combinedText.includes('problem') || combinedText.includes('issue') || combinedText.includes('bug') || combinedText.includes('error')) {
          categoryLabel = `Issues & Problems (${cluster.commentIDs.length} comments)`;
        } else if (combinedText.includes('suggestion') || combinedText.includes('should') || combinedText.includes('improve') || combinedText.includes('better')) {
          categoryLabel = `Suggestions & Feedback (${cluster.commentIDs.length} comments)`;
        } else if (combinedText.includes('thank') || combinedText.includes('appreciate') || combinedText.includes('helpful')) {
          categoryLabel = `Appreciation & Thanks (${cluster.commentIDs.length} comments)`;
        } else {
          categoryLabel = `General Discussion (${cluster.commentIDs.length} comments)`;
        }
      }

      // Create cluster record
      const insertQuery = parentClusterId ? `
        INSERT INTO "Cluster" ("id", "name", "description", "videoId", "parentClusterId", "level", "commentCount", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING "id", "name"
      ` : `
        INSERT INTO "Cluster" ("id", "name", "description", "videoId", "level", "commentCount", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING "id", "name"
      `;

      const insertParams = parentClusterId ? [
        categoryLabel,
        `Cluster containing ${cluster.commentIDs.length} comments`,
        videoId,
        parentClusterId,
        level,
        cluster.commentIDs.length
      ] : [
        categoryLabel,
        `Cluster containing ${cluster.commentIDs.length} comments`,
        videoId,
        level,
        cluster.commentIDs.length
      ];

      const createdCluster = await prisma.$queryRawUnsafe(insertQuery, ...insertParams) as Array<{ id: string, name: string }>;
      const clusterRecord = createdCluster[0];
      createdClusterIds.push(clusterRecord.id);

      // Validate comment IDs before updating
      const validCommentIds = cluster.commentIDs.filter(id => 
        id && typeof id === 'string' && id.length >= 8
      );

      if (validCommentIds.length === 0) {
        console.error(`[VIDEO_ACTIONS] No valid comment IDs found for cluster "${categoryLabel}". Original IDs:`, cluster.commentIDs.slice(0, 5));
        continue;
      }

      if (validCommentIds.length !== cluster.commentIDs.length) {
        console.warn(`[VIDEO_ACTIONS] Filtered out ${cluster.commentIDs.length - validCommentIds.length} invalid comment IDs for cluster "${categoryLabel}"`);
      }

      console.log(`[VIDEO_ACTIONS] Attempting to update ${validCommentIds.length} comments for cluster "${categoryLabel}"`);
      console.log(`[VIDEO_ACTIONS] Sample comment IDs:`, validCommentIds.slice(0, 3));

      // Assign comments to this cluster - use Prisma's updateMany instead of raw SQL
      try {
        const updateResult = await prisma.comment.updateMany({
          where: {
            id: {
              in: validCommentIds
            }
          },
          data: {
            clusterId: clusterRecord.id
          }
        });

        console.log(`[VIDEO_ACTIONS] Successfully updated ${updateResult.count} comments for cluster "${categoryLabel}"`);

        if (updateResult.count !== validCommentIds.length) {
          console.warn(`[VIDEO_ACTIONS] Expected to update ${validCommentIds.length} comments but only updated ${updateResult.count}`);
        }
      } catch (updateError) {
        console.error(`[VIDEO_ACTIONS] Error updating comments for cluster "${categoryLabel}":`, updateError);
        throw updateError;
      }
    } catch (clusterError) {
      console.error(`[VIDEO_ACTIONS] Error creating cluster "${cluster.name}":`, clusterError);
    }
  }

  // Verify cluster assignments after creation
  if (createdClusterIds.length > 0) {
    console.log(`[VIDEO_ACTIONS] Verifying cluster assignments for ${createdClusterIds.length} clusters...`);
    const verificationResults = await prisma.cluster.findMany({
      where: {
        id: {
          in: createdClusterIds
        }
      },
      select: {
        id: true,
        name: true,
        commentCount: true,
        _count: {
          select: {
            comments: true
          }
        }
      }
    });

    verificationResults.forEach(cluster => {
      const actualCount = cluster._count.comments;
      const recordedCount = cluster.commentCount;
      if (actualCount !== recordedCount) {
        console.warn(`[VIDEO_ACTIONS] Cluster "${cluster.name}" has mismatch: recorded ${recordedCount}, actual ${actualCount}`);
      } else {
        console.log(`[VIDEO_ACTIONS] Cluster "${cluster.name}" verified: ${actualCount} comments`);
      }
    });
  }

  return createdClusterIds;
}

// Fallback clustering function for when memory-intensive clustering fails
async function createFallbackClusters(comments: Comment[]): Promise<Cluster[]> {
  console.log('[VIDEO_ACTIONS] Creating fallback topic-based clusters');

  // Simple keyword-based clustering
  const clusters: Cluster[] = [];
  const usedCommentIds = new Set<string>();

  // Define topic keywords
  const topicKeywords = {
    'Positive Feedback': ['good', 'great', 'awesome', 'amazing', 'love', 'excellent', 'perfect', 'wonderful'],
    'Questions': ['how', 'why', 'what', 'when', 'where', 'which', '?'],
    'Suggestions': ['should', 'could', 'suggest', 'recommend', 'idea', 'improvement'],
    'Technical Issues': ['bug', 'error', 'problem', 'issue', 'broken', 'fix', 'crash'],
    'Appreciation': ['thank', 'thanks', 'appreciate', 'grateful', 'help'],
    'Criticism': ['bad', 'terrible', 'awful', 'hate', 'worst', 'disappointed'],
  };

  // Create clusters based on keywords
  for (const [clusterName, keywords] of Object.entries(topicKeywords)) {
    const matchingComments = comments.filter(comment => {
      if (usedCommentIds.has(comment.id || comment.platformId)) return false;

      const text = comment.text.toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    });

    if (matchingComments.length > 0) {
      clusters.push({
        name: clusterName,
        commentIDs: matchingComments.map(c => c.id || c.platformId)
      });

      matchingComments.forEach(c => usedCommentIds.add(c.id || c.platformId));
    }
  }

  // Add remaining comments to "Other" cluster
  const remainingComments = comments.filter(c => !usedCommentIds.has(c.id || c.platformId));
  if (remainingComments.length > 0) {
    clusters.push({
      name: 'Other Comments',
      commentIDs: remainingComments.map(c => c.id || c.platformId)
    });
  }

  return clusters;
}

// Helper function to get video status for resumable analysis
export async function getVideoStatus(videoUrl: string) {
  const existingVideo = await prisma.video.findFirst({
    where: { url: videoUrl },
    select: {
      id: true,
      status: true,
      name: true,
      analysisSummary: true,
      comments: {
        select: { id: true }
      }
    }
  });

  if (!existingVideo) {
    return { exists: false, status: null, canResume: false };
  }

  return {
    exists: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: (existingVideo as any).status,
    canResume: true,
    videoId: existingVideo.id,
    commentsCount: existingVideo.comments.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    analysisSummary: (existingVideo as any).analysisSummary
  };
}

// Helper function to update video status with timeout awareness
async function updateVideoStatus(videoId: string, status: VideoStatus, additionalData?: Record<string, unknown>) {
  const updateData: { status: VideoStatus; updatedAt: Date;[key: string]: unknown } = {
    status,
    updatedAt: new Date() // Always update the timestamp to reset timeout tracking
  };

  if (additionalData) {
    Object.assign(updateData, additionalData);
  }

  // Add status transition tracking to analysis summary
  if (additionalData?.analysisSummary) {
    const currentTime = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysisSummary = additionalData.analysisSummary as any;

    // Add status transition tracking
    if (!analysisSummary.statusTransitions) {
      analysisSummary.statusTransitions = [];
    }

    analysisSummary.statusTransitions.push({
      toStatus: status,
      timestamp: currentTime,
      processStep: analysisSummary.lastProcessingStep || 'unknown'
    });

    // Keep only last 10 transitions to avoid bloating
    if (analysisSummary.statusTransitions.length > 10) {
      analysisSummary.statusTransitions = analysisSummary.statusTransitions.slice(-10);
    }

    analysisSummary.lastStatusUpdate = currentTime;

    console.log(`[VIDEO_ACTIONS] Saving analysisSummary with status transition to: ${status}`);
  }

  const result = await prisma.video.update({
    where: { id: videoId },
    data: updateData
  });

  console.log(`[VIDEO_ACTIONS] Video ${videoId} updated successfully to status: ${status}`);
  return result;
}

// Helper function to get the latest comment timestamp for a video
export async function getLatestCommentTimestamp(videoId: string): Promise<Date | null> {
  console.log(`[VIDEO_ACTIONS] Getting latest comment timestamp for video: ${videoId}`);

  const latestComment = await prisma.comment.findFirst({
    where: { videoId },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true }
  });

  if (latestComment) {
    console.log(`[VIDEO_ACTIONS] Latest comment timestamp: ${latestComment.timestamp.toISOString()}`);
    return latestComment.timestamp;
  } else {
    console.log(`[VIDEO_ACTIONS] No comments found for video: ${videoId}`);
    return null;
  }
}

export async function analyzeChannelVideoAction(formData: FormData) {
  console.log('[VIDEO_ACTIONS] Starting analyzeChannelVideoAction');

  // Check if user is authenticated
  const user = await getLocalUser()
  if (!user) {
    console.error('[VIDEO_ACTIONS] User not authenticated');
    throw new Error('Unauthorized')
  }

  // Extract form data
  const videoUrl = formData.get('videoUrl') as string
  const channelId = formData.get('channelId') as string
  const forceSync = formData.get('forceSync') === 'true'

  if (!videoUrl || !channelId) {
    throw new Error('Video URL and Channel ID are required')
  }

  // Create the video quickly first
  const quickResult = await createVideoAnalysisQuick(videoUrl, user.id, channelId)

  // If it's not already completed, start background processing
  if (!quickResult.isExisting || quickResult.status !== 'COMPLETED') {
    // Start background processing without waiting
    processVideoAnalysisBackground(quickResult.videoId, forceSync)
      .then((backgroundResult) => {
        console.log(`[CHANNEL_ANALYSIS] Background processing completed for video ${quickResult.videoId}:`, backgroundResult);
      })
      .catch((error) => {
        console.error(`[CHANNEL_ANALYSIS] Background processing failed for video ${quickResult.videoId}:`, error);
      });
  }

  // Return quick result with additional metadata for channel analysis
  return {
    success: true,
    videoId: quickResult.videoId,
    commentsCount: quickResult.commentsCount,
    status: quickResult.status,
    message: quickResult.isExisting && quickResult.status === 'COMPLETED'
      ? 'Video analysis already completed'
      : 'Video created successfully, analysis running in background',
    isExisting: quickResult.isExisting,
    backgroundProcessing: !quickResult.isExisting || quickResult.status !== 'COMPLETED'
  }
}

// Quick video analysis creation - only creates record and fetches basic details
export async function createVideoAnalysisQuick(videoUrl: string, userId: string, channelId?: string, analysisName?: string) {
  console.log('[VIDEO_ACTIONS] Creating quick video analysis for:', videoUrl);

  // Extract video ID from URL
  const videoId = extractVideoIdFromYTUrl(videoUrl)
  if (!videoId) {
    throw new Error('Invalid YouTube URL format')
  }

  try {
    // Check if video already exists
    const existingVideo = await prisma.video.findFirst({
      where: { url: videoUrl },
      include: { comments: true }
    })

    if (existingVideo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log(`[VIDEO_ACTIONS] Found existing video with status: ${(existingVideo as any).status}`);

      return {
        success: true,
        videoId: existingVideo.id,
        commentsCount: existingVideo.comments.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: (existingVideo as any).status,
        message: 'Video already exists',
        isExisting: true
      }
    }

    // Fetch video details immediately
    console.log('[VIDEO_ACTIONS] Fetching video details...');
    const videoDetails = await getVideoDetailsFromYT(videoId);

    if (!videoDetails) {
      throw new Error('Failed to fetch video details. Video may be private, deleted, or invalid.');
    }

    // Create video record with details
    console.log('[VIDEO_ACTIONS] Creating new video record with details');
    const video = await prisma.video.create({
      data: {
        url: videoUrl,
        name: analysisName || `${videoDetails.title} Analysis`,
        title: videoDetails.title,
        thumbnailUrl: videoDetails.thumbnailUrl,
        status: VIDEO_STATUS.PENDING, // Initially queued instead of starting immediately
        userId: userId,
        channelId: channelId,
        lastSynced: new Date(),
        analysisSummary: {
          processedAt: new Date().toISOString(),
          source: channelId ? 'channel_analysis' : 'manual_analysis',
          videoDetailsAt: new Date().toISOString(),
          queueQueuedAt: new Date().toISOString(),
          queueNotes: 'Queued for background processing'
        }
      },
      include: { comments: true }
    });

    console.log('[VIDEO_ACTIONS] Quick video analysis created successfully');

    return {
      success: true,
      videoId: video.id,
      commentsCount: 0,
      status: VIDEO_STATUS.PENDING,
      message: 'Video created successfully and queued for analysis',
      isExisting: false,
      title: videoDetails.title,
      thumbnailUrl: videoDetails.thumbnailUrl
    }

  } catch (error) {
    console.error('[VIDEO_ACTIONS] Error creating quick video analysis:', error);
    throw error;
  }
}

// Background processing function for heavy operations
export async function processVideoAnalysisBackground(videoId: string, forceSync?: boolean) {
  console.log('[VIDEO_ACTIONS] Starting background processing for video:', videoId, 'forceSync:', forceSync);

  // Add timeout protection - set a maximum processing time
  const startTime = Date.now();
  const MAX_PROCESSING_TIME_MS = 4 * 60 * 60 * 1000; // 4 hours maximum

  // Function to check if we've exceeded timeout
  const checkTimeout = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_PROCESSING_TIME_MS) {
      throw new Error(`Processing timeout: exceeded ${MAX_PROCESSING_TIME_MS / 1000 / 60} minutes`);
    }
  };

  try {
    // Check timeout at start
    checkTimeout();

    // Get video record
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: { comments: true, user: true }
    });

    if (!video) {
      throw new Error('Video not found');
    }

    const videoYoutubeId = extractVideoIdFromYTUrl(video.url);
    if (!videoYoutubeId) {
      throw new Error('Invalid video URL');
    }

    // Update to DOWNLOADING_COMMENTS status if not already in progress
    if (video.status === VIDEO_STATUS.PENDING) {
      await updateVideoStatus(video.id, VIDEO_STATUS.DOWNLOADING_COMMENTS, {
        analysisSummary: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(video.analysisSummary as any || {}),
          lastProcessingStep: 'starting_download',
          processingStartedAt: new Date().toISOString()
        }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let comments: any[] = [];

    // Stage 1: Download comments (if not done, force sync, or incremental sync requested)
    // For incremental sync: forceSync === false means we want to download new comments only
    // For full resync: forceSync === true means we want to re-download all comments

    console.log(`[VIDEO_ACTIONS] Downloading comments... (status: ${video.status}, forceSync: ${forceSync})`);

    // Get current comment count for incremental sync and latest comment timestamp
    const existingCommentCount = video.comments.length;
    console.log(`[VIDEO_ACTIONS] Existing comment count in DB: ${existingCommentCount}`);

    // Get latest comment timestamp for incremental sync
    let latestCommentTimestamp: Date | null = null;
    if (!forceSync && existingCommentCount > 0) {
      latestCommentTimestamp = await getLatestCommentTimestamp(video.id);
      if (latestCommentTimestamp) {
        console.log(`[VIDEO_ACTIONS] Latest comment timestamp in DB: ${latestCommentTimestamp.toISOString()}`);
      }
    }

    // If force sync is enabled, delete existing comments first and do full sync
    if (forceSync && video.comments.length > 0) {
      console.log('[VIDEO_ACTIONS] Force sync - deleting existing comments for full resync');
      await prisma.comment.deleteMany({
        where: { videoId: video.id }
      });
      console.log('[VIDEO_ACTIONS] Starting full sync - processing all comments');
    }

    // Initialize variables for tracking processing stats
    let totalProcessed = 0;
    let totalEmbeddingsCreated = 0;
    let totalEmbeddingsSaved = 0;
    let batchNumber = 0;

    // Determine sync strategy: full sync vs incremental sync
    if (!forceSync) {
      if (existingCommentCount === 0) {
        console.log('[VIDEO_ACTIONS] No existing comments, will do full sync');
      } else if (latestCommentTimestamp) {
        console.log('[VIDEO_ACTIONS] Will do incremental sync using timestamp-based approach');
      } else {
        console.log('[VIDEO_ACTIONS] Could not get latest timestamp, falling back to full sync');
      }
    }

    // Always fetch comments (either full sync or incremental sync)
    try {
      // Check timeout before starting download
      checkTimeout();

      // Configure comment fetching options based on sync type
      const fetchOptions = forceSync || !latestCommentTimestamp ? {} : {
        stopAfterTimestamp: latestCommentTimestamp
      };

      console.log(`[VIDEO_ACTIONS] Starting comment fetch with options:`, fetchOptions);

      // Update status tracking
      await updateVideoStatus(video.id, VIDEO_STATUS.DOWNLOADING_COMMENTS, {
        analysisSummary: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(video.analysisSummary as any || {}),
          lastProcessingStep: 'downloading_comments',
          downloadStartedAt: new Date().toISOString()
        }
      });

      // Use generator to process comments in batches as they're downloaded
      for await (const commentBatch of getVideoCommentsInBatches(videoYoutubeId, 100, fetchOptions)) {
        // Check timeout periodically during download
        checkTimeout();

        batchNumber++;
        console.log(`[VIDEO_ACTIONS] Processing batch ${batchNumber} with ${commentBatch.length} comments`);

        if (commentBatch.length === 0) {
          console.log(`[VIDEO_ACTIONS] Empty batch ${batchNumber}, continuing...`);
          continue;
        }

        // Generate embeddings for this batch
        console.log(`[VIDEO_ACTIONS] Generating embeddings for batch ${batchNumber}...`);
        const commentTexts = commentBatch.map(comment => comment.text);

        const embeddings = await createEmbeddings(commentTexts, (message: string) => {
          console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: ${message}`);
        });

        console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: Generated ${embeddings.length} embeddings for ${commentBatch.length} comments`);

        // Validate embedding generation
        if (embeddings.length !== commentBatch.length) {
          console.warn(`[VIDEO_ACTIONS] Batch ${batchNumber}: Embedding count mismatch: ${embeddings.length} embeddings for ${commentBatch.length} comments`);
        }

        // Debug: Check embedding dimensions for first batch
        if (batchNumber === 1 && embeddings.length > 0) {
          console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: First embedding dimensions: ${embeddings[0].length}`);
          console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: Sample embedding values:`, embeddings[0].slice(0, 5));

          // Validate all embeddings have correct dimensions
          const invalidEmbeddings = embeddings.filter(emb => emb.length !== 768);
          if (invalidEmbeddings.length > 0) {
            console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Found ${invalidEmbeddings.length} embeddings with invalid dimensions!`);
            console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Expected 768, got dimensions:`, invalidEmbeddings.map(emb => emb.length));
          } else {
            console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: ✅ All ${embeddings.length} embeddings have correct 768 dimensions`);
          }
        }

        // Prepare comment data with embeddings for this batch
        const commentData = commentBatch.map((comment, index) => {
          const embeddingVector = embeddings[index];
          const embeddingString = embeddingVector ? toPgVectorString(embeddingVector) : null;

          // Debug first few embeddings of first batch
          // if (batchNumber === 1 && index < 3) {
          //   console.log(`[VIDEO_ACTIONS] Batch ${batchNumber} Comment ${index} embedding conversion:`, {
          //     hasEmbedding: !!embeddingVector,
          //     embeddingLength: embeddingVector?.length,
          //     stringLength: embeddingString?.length,
          //     stringPreview: embeddingString?.substring(0, 50) + '...'
          //   });
          // }

          return {
            platformId: comment.id,
            text: comment.text,
            authorName: comment.authorName,
            authorAvatar: comment.authorAvatarUrl,
            timestamp: comment.timestamp,
            likeCount: comment.likeCount || 0,
            videoId: video.id,
            analysis: {},
            isReply: comment.isReply, // Add the isReply field
            embedding: embeddingString
          };
        });

        // Bulk insert/update all comments with embeddings in a single operation
        let batchSuccessfulInserts = 0;
        let batchEmbeddingsSaved = 0;

        if (commentData.length > 0) {
          try {
            // Build VALUES clause for bulk insert
            const values = commentData.map((_, index) => {
              const paramIndex = index * 10; // 10 parameters per comment (added isReply)
              return `(gen_random_uuid(), $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}::jsonb, $${paramIndex + 9}, $${paramIndex + 10}::vector)`;
            }).join(', ');

            // Flatten all parameters into a single array
            const allParams = commentData.flatMap(commentRecord => [
              commentRecord.platformId,
              commentRecord.text,
              commentRecord.authorName,
              commentRecord.authorAvatar,
              commentRecord.timestamp,
              commentRecord.likeCount,
              commentRecord.videoId,
              JSON.stringify(commentRecord.analysis),
              commentRecord.isReply,
              commentRecord.embedding
            ]);

            // Execute bulk upsert
            const result = await prisma.$executeRawUnsafe(`
              INSERT INTO "Comment" (
                "id", "platformId", "text", "authorName", "authorAvatar", 
                "timestamp", "likeCount", "videoId", "analysis", "isReply", "embedding"
              ) 
              VALUES ${values}
              ON CONFLICT ("platformId") 
              DO UPDATE SET 
                "text" = EXCLUDED."text",
                "authorName" = EXCLUDED."authorName",
                "authorAvatar" = EXCLUDED."authorAvatar",
                "timestamp" = EXCLUDED."timestamp",
                "likeCount" = EXCLUDED."likeCount",
                "analysis" = EXCLUDED."analysis",
                "isReply" = EXCLUDED."isReply",
                "embedding" = EXCLUDED."embedding"
            `, ...allParams); batchSuccessfulInserts = commentData.length;
            batchEmbeddingsSaved = commentData.filter(c => c.embedding !== null).length;

            console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: ✅ Successfully bulk upserted ${batchSuccessfulInserts} comments with ${batchEmbeddingsSaved} embeddings (result: ${result})`);

          } catch (error) {
            console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: ❌ Failed to bulk upsert ${commentData.length} comments:`);
            console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Error details:`, error);

            // Fallback to individual inserts if bulk fails
            console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: Falling back to individual inserts...`);

            for (const commentRecord of commentData) {
              try {
                await prisma.$executeRawUnsafe(`
                    INSERT INTO "Comment" (
                      "id", "platformId", "text", "authorName", "authorAvatar", 
                      "timestamp", "likeCount", "videoId", "analysis", "isReply", "embedding"
                    ) VALUES (
                      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::vector
                    )
                    ON CONFLICT ("platformId") 
                    DO UPDATE SET 
                      "text" = $2,
                      "authorName" = $3,
                      "authorAvatar" = $4,
                      "timestamp" = $5,
                      "likeCount" = $6,
                      "analysis" = $8::jsonb,
                      "isReply" = $9,
                      "embedding" = $10::vector
                  `,
                  commentRecord.platformId,
                  commentRecord.text,
                  commentRecord.authorName,
                  commentRecord.authorAvatar,
                  commentRecord.timestamp,
                  commentRecord.likeCount,
                  commentRecord.videoId,
                  JSON.stringify(commentRecord.analysis),
                  commentRecord.isReply,
                  commentRecord.embedding
                );

                batchSuccessfulInserts++;
                if (commentRecord.embedding) {
                  batchEmbeddingsSaved++;
                }

              } catch (individualError) {
                console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Failed individual insert for comment ${commentRecord.platformId}:`, individualError);
              }
            }

            // Try to identify the bulk operation issue
            if (error instanceof Error) {
              if (error.message.includes('dimensions')) {
                console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Dimension error - expected 768, check embedding generation`);
              } else if (error.message.includes('vector')) {
                console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Vector casting error - check pgvector format`);
              } else if (error.message.includes('foreign key')) {
                console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Foreign key error - video may not exist`);
              } else if (error.message.includes('syntax')) {
                console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: SQL syntax error in bulk operation`);
              } else {
                console.error(`[VIDEO_ACTIONS] Batch ${batchNumber}: Unknown bulk operation error:`, error.message);
              }
            }
          }
        }

        console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: Bulk upsert summary: ${batchSuccessfulInserts} comments saved, ${batchEmbeddingsSaved} embeddings saved`);
        totalEmbeddingsSaved += batchEmbeddingsSaved;

        totalProcessed += commentBatch.length;
        totalEmbeddingsCreated += embeddings.length;

        console.log(`[VIDEO_ACTIONS] Batch ${batchNumber}: Saved ${batchSuccessfulInserts} comments. Running totals: ${totalProcessed} comments processed, ${totalEmbeddingsCreated} embeddings created, ${totalEmbeddingsSaved} embeddings saved`);

        // Small delay between batches to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[VIDEO_ACTIONS] Streaming processing completed: ${totalProcessed} new comments processed, ${totalEmbeddingsCreated} embeddings created, ${totalEmbeddingsSaved} embeddings saved`);

      const isIncrementalSync = !forceSync && latestCommentTimestamp !== null;

      await updateVideoStatus(video.id, VIDEO_STATUS.ANALYZING_COMMENTS, {
        analysisSummary: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(video.analysisSummary as any || {}),
          newCommentsProcessed: totalProcessed,
          commentsSuccessfullyInserted: totalProcessed,
          embeddingsGenerated: totalEmbeddingsSaved,
          commentsDownloadedAt: new Date().toISOString(),
          processingMethod: isIncrementalSync ? 'incremental_streaming_batches' : 'full_streaming_batches',
          lastSyncType: isIncrementalSync ? 'incremental' : 'full',
          lastProcessingStep: 'starting_analysis'
        }
      });

    } catch (error) {
      console.error('[VIDEO_ACTIONS] Error in streaming comment processing:', error);
      throw error;
    }

    // Refetch video to get updated data with comments
    // Add a small delay to ensure all database writes are committed
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updatedVideo = await prisma.video.findUnique({
      where: { id: video.id },
      include: {
        comments: true,
        _count: {
          select: {
            comments: true
          }
        }
      }
    });

    if (!updatedVideo) {
      throw new Error('Failed to retrieve updated video record');
    }

    console.log(`[VIDEO_ACTIONS] Refetched video: ${updatedVideo._count.comments} comments in database`);
    console.log(`[VIDEO_ACTIONS] Comments array length: ${updatedVideo.comments.length}`);

    comments = updatedVideo.comments;

    // Stage 2: Analyze comments (clustering) - This should run if new comments were downloaded
    // or if the analysis was never completed in the first place.
    const wasTimestampSync = !forceSync && latestCommentTimestamp !== null;
    const shouldAnalyzeComments = forceSync || wasTimestampSync || updatedVideo.status !== VIDEO_STATUS.COMPLETED;

    console.log(`[VIDEO_ACTIONS] Analysis decision: forceSync=${forceSync}, wasTimestampSync=${wasTimestampSync}, currentStatus=${updatedVideo.status}, shouldAnalyzeComments=${shouldAnalyzeComments}`);

    if (comments.length > 0 && shouldAnalyzeComments) {
      console.log('[VIDEO_ACTIONS] Analyzing comments...');

      // Check timeout before starting analysis
      checkTimeout();

      // Update status to indicate analysis started
      await updateVideoStatus(video.id, VIDEO_STATUS.ANALYZING_COMMENTS, {
        analysisSummary: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(video.analysisSummary as any || {}),
          lastProcessingStep: 'clustering_analysis',
          analysisStartedAt: new Date().toISOString()
        }
      });

      // Memory safety: limit clustering to reasonable size
      let commentsToAnalyze = comments;

      if (comments.length > MAX_COMMENTS_FOR_CLUSTERING) {
        console.log(`[VIDEO_ACTIONS] Too many comments (${comments.length}) for clustering. Using sampling strategy.`);

        // Sample comments strategically: recent + high engagement + random sample
        const recentComments = comments.slice(0, Math.floor(MAX_COMMENTS_FOR_CLUSTERING * 0.4));
        const topEngagementComments = comments
          .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
          .slice(0, Math.floor(MAX_COMMENTS_FOR_CLUSTERING * 0.3));

        // Random sample from remaining
        const remaining = comments.filter(c =>
          !recentComments.includes(c) && !topEngagementComments.includes(c)
        );
        const randomSample = remaining
          .sort(() => Math.random() - 0.5)
          .slice(0, MAX_COMMENTS_FOR_CLUSTERING - recentComments.length - topEngagementComments.length);

        commentsToAnalyze = [...recentComments, ...topEngagementComments, ...randomSample];
        console.log(`[VIDEO_ACTIONS] Using ${commentsToAnalyze.length} sampled comments for clustering`);
      }

      // Prepare comment data with embeddings if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const commentTexts = commentsToAnalyze.map((c: any) => {
        const result: { comments: string, commentID: string, embedding?: number[] } = {
          comments: c.text,
          commentID: c.id || c.platformId
        };

        // Parse embedding if it exists and is in pgvector format
        if (c.embedding && typeof c.embedding === 'string') {
          const embeddingArray = parsePgVectorString(c.embedding);

          // Validate embedding dimensions (should be 768 for our model)
          if (embeddingArray && embeddingArray.length === 768) {
            result.embedding = embeddingArray;
          } else {
            console.warn(`[VIDEO_ACTIONS] Invalid embedding dimensions for comment ${c.id}: ${embeddingArray?.length || 'null'}`);
          }
        }

        return result;
      });

      // Count how many comments have valid embeddings
      const embeddingsCount = commentTexts.filter(c => c.embedding).length;
      console.log(`[VIDEO_ACTIONS] Using ${embeddingsCount} pre-computed embeddings out of ${commentTexts.length} comments`);

      // If we have zero embeddings, attempt to (a) generate them now, (b) persist to DB for future runs
      if (embeddingsCount === 0 && commentTexts.length > 0) {
        try {
          console.log('[VIDEO_ACTIONS] No pre-computed embeddings found. Generating embeddings on-the-fly...');
          // Generate embeddings for ALL (small dataset) or cap if very large in future
          const plainTexts = commentTexts.map(c => c.comments);
          const generatedEmbeddings = await createEmbeddings(plainTexts, (m) => console.log('[VIDEO_ACTIONS][EMBED_GEN]', m));

          if (generatedEmbeddings.length === plainTexts.length) {
            console.log(`[VIDEO_ACTIONS] Generated ${generatedEmbeddings.length} embeddings. Attaching & persisting to DB...`);
            // Attach back to in-memory objects
            type TempCommentForClustering = { comments: string; commentID: string; embedding?: number[] };
            (generatedEmbeddings as number[][]).forEach((emb, idx) => {
              (commentTexts[idx] as TempCommentForClustering).embedding = emb; // mutate in place so downstream sees them
            });

            // Persist to DB in small batches to avoid huge single statements
            const BATCH_SIZE = 100;
            for (let i = 0; i < commentTexts.length; i += BATCH_SIZE) {
              const slice = commentTexts.slice(i, i + BATCH_SIZE);
              for (const item of slice) {
                try {
                  // Convert to pgvector string
                  // item.embedding added dynamically above when generated
                  const vectorString = (item as { embedding?: number[] }).embedding ? toPgVectorString((item as { embedding?: number[] }).embedding as number[]) : null;
                  if (vectorString) {
                    await prisma.$executeRawUnsafe(
                      `UPDATE "Comment" SET embedding = $1::vector WHERE "id" = $2`,
                      vectorString,
                      item.commentID
                    );
                  }
                } catch (persistErr) {
                  console.warn('[VIDEO_ACTIONS] Failed to persist embedding for comment', item.commentID, persistErr);
                }
              }
              console.log(`[VIDEO_ACTIONS] Persisted embeddings ${Math.min(i + BATCH_SIZE, commentTexts.length)} / ${commentTexts.length}`);
            }
          } else {
            console.warn(`[VIDEO_ACTIONS] Embedding generation mismatch. Expected ${plainTexts.length} got ${generatedEmbeddings.length}. Proceeding with fallback clustering.`);
          }
        } catch (embedError) {
          console.error('[VIDEO_ACTIONS] On-the-fly embedding generation failed. Will use fallback clustering.', embedError);
        }
      }

      // Re-count embeddings after potential generation
      const embeddingsCountPost = commentTexts.filter(c => c.embedding).length;
      if (embeddingsCount === 0 && embeddingsCountPost > 0) {
        console.log(`[VIDEO_ACTIONS] Successfully generated ${embeddingsCountPost} embeddings for clustering`);
      }

      // Use the unified clustering function
      let clusterResult: ClusteringResult;
      try {
        // Check timeout before clustering
        checkTimeout();

        console.log(`[VIDEO_ACTIONS] Starting clustering with ${commentTexts.length} comments...`);
        console.log(`[VIDEO_ACTIONS] Embeddings available: ${embeddingsCount}, Post-generation: ${embeddingsCountPost}`);

        // For smaller datasets, use the existing approach
        const clusterNames = await ClusterCommentsWithEmbeddings(commentTexts, 10, 10);

        console.log(`[VIDEO_ACTIONS] ClusterCommentsWithEmbeddings returned ${clusterNames ? clusterNames.length : 'null'} clusters`);

        clusterResult = {
          clusters: clusterNames && Array.isArray(clusterNames) ? clusterNames : [],
          embeddingsUsed: embeddingsCount,
          commentsProcessed: commentTexts.length
        };

        console.log(`[VIDEO_ACTIONS] Clustering completed. Generated ${clusterResult.clusters.length} clusters`);

        // Check timeout after clustering
        checkTimeout();

      } catch (clusteringError) {
        console.error('[VIDEO_ACTIONS] Clustering failed, using fallback strategy:', clusteringError);

        // Check if this is a timeout error
        if (clusteringError instanceof Error && clusteringError.message.includes('timeout')) {
          throw clusteringError; // Re-throw timeout errors
        }

        // Fallback: create simple topic-based clusters
        const fallbackClusters = await createFallbackClusters(commentsToAnalyze);
        clusterResult = {
          clusters: fallbackClusters,
          embeddingsUsed: embeddingsCount,
          commentsProcessed: commentTexts.length
        };
        console.log(`[VIDEO_ACTIONS] Fallback clustering created ${clusterResult.clusters.length} clusters`);
      }

      // Calculate final totals
      const finalCommentCount = comments.length;
      const finalEmbeddingsCount = clusterResult.embeddingsUsed;

      // Get the latest analysis summary to preserve sync information
      const latestVideo = await prisma.video.findUnique({
        where: { id: video.id },
        select: { analysisSummary: true }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentAnalysisSummary = (latestVideo?.analysisSummary as any) || {};

      // Delete existing clusters and create new ones
      console.log(`[VIDEO_ACTIONS] Deleting existing clusters for video ${video.id}`);
      await prisma.$executeRaw`DELETE FROM "Cluster" WHERE "videoId" = ${video.id}`;

      console.log(`[VIDEO_ACTIONS] About to create ${clusterResult.clusters.length} clusters from clustering result`);
      const createdClusterIds = await createClustersInDatabase(clusterResult.clusters, video.id);
      console.log(`[VIDEO_ACTIONS] Successfully created ${createdClusterIds.length} cluster records in database`);

      // Update the video's analysis summary WITHOUT clusters (they're now in the table)
      await updateVideoStatus(video.id, VIDEO_STATUS.COMPLETED, {
        analysisSummary: {
          ...currentAnalysisSummary, // Preserve all existing data
          processedAt: new Date().toISOString(),
          source: currentAnalysisSummary?.source || 'manual_analysis',
          embeddingsUsed: finalEmbeddingsCount,
          clustersMigratedToTable: true, // Flag to indicate clusters are in table
          completedAt: new Date().toISOString(),
          clustersCreated: createdClusterIds.length
        }
      });

      // Notify user of completion
      try {
        await notifyAnalysisResult({
          userId: video.userId,
          videoId: video.id,
          status: 'COMPLETED',
          title: video.name || video.title,
          commentsCount: finalCommentCount
        });
      } catch (notifyErr) {
        console.error('[VIDEO_ACTIONS] Notification error (completion):', notifyErr);
      }

      console.log(`[VIDEO_ACTIONS] Background analysis completed successfully with ${finalCommentCount} total comments and ${createdClusterIds.length} clusters`);
    } else {
      // No comments to analyze, mark as completed
      await updateVideoStatus(video.id, VIDEO_STATUS.COMPLETED, {
        analysisSummary: {
          processedAt: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          source: (video.analysisSummary as any)?.source || 'manual_analysis',
          clustersMigratedToTable: true, // Flag to indicate we're using table structure
          completedAt: new Date().toISOString()
        }
      });
    }

    // Perform sentiment analysis using default semantic searches
    // This should not affect the video completion status if it fails
    try {
      console.log(`[VIDEO_ACTIONS] Starting sentiment analysis for video ${video.id}`);
      const sentimentResult = await performSentimentAnalysis(video.id, video.userId);

      if (sentimentResult) {
        // Update the video with sentiment analysis results
        await prisma.video.update({
          where: { id: video.id },
          data: {
            sentimentAnalysis: sentimentResult as object
          }
        });
        console.log(`[VIDEO_ACTIONS] Sentiment analysis completed and saved for video ${video.id}`);
      } else {
        console.log(`[VIDEO_ACTIONS] Sentiment analysis returned no results for video ${video.id}`);
      }
    } catch (sentimentError) {
      // Log the error but don't fail the entire process
      console.error(`[VIDEO_ACTIONS] Sentiment analysis failed for video ${video.id}:`, sentimentError);
      console.log(`[VIDEO_ACTIONS] Continuing despite sentiment analysis failure`);
    }
    return {
      success: true,
      videoId: video.id,
      commentsCount: comments.length,
      message: `Background analysis completed with ${comments.length} comments`
    };

  } catch (error) {
    console.error('[VIDEO_ACTIONS] Error in background processing:', error);

    // Determine error type for better debugging
    let errorType = 'unknown';
    let errorDetails = '';

    if (error instanceof Error) {
      errorDetails = error.message;

      if (error.message.includes('timeout')) {
        errorType = 'timeout';
      } else if (error.message.includes('memory') || error.message.includes('heap')) {
        errorType = 'memory';
      } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
        errorType = 'api_limit';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorType = 'network';
      } else if (error.message.includes('permission') || error.message.includes('forbidden')) {
        errorType = 'permission';
      } else {
        errorType = 'processing';
      }
    }

    console.error(`[VIDEO_ACTIONS] Error type: ${errorType}, Details: ${errorDetails}`);

    // Get current video state for error context
    let currentVideoState = null;
    try {
      currentVideoState = await prisma.video.findUnique({
        where: { id: videoId },
        select: { status: true, analysisSummary: true }
      });
    } catch (fetchError) {
      console.error('[VIDEO_ACTIONS] Could not fetch current video state for error handling:', fetchError);
    }

    // Mark video as failed with detailed error information
    await updateVideoStatus(videoId, VIDEO_STATUS.FAILED, {
      analysisSummary: {
        ...(currentVideoState?.analysisSummary as Record<string, unknown> || {}),
        error: errorDetails,
        errorType,
        failedAt: new Date().toISOString(),
        lastProcessingStep: 'error_occurred',
        processingDurationMs: Date.now() - startTime,
        lastKnownStatus: currentVideoState?.status || 'unknown',
        errorContext: {
          function: 'processVideoAnalysisBackground',
          forceSync,
          videoId,
          timestamp: new Date().toISOString()
        }
      }
    });

    // Notify user of failure
    try {
      // Fetch userId for video (if not already)
      const failedVideo = await prisma.video.findUnique({ where: { id: videoId }, select: { userId: true, name: true, title: true } });
      if (failedVideo) {
        await notifyAnalysisResult({
          userId: failedVideo.userId,
          videoId: videoId,
          status: 'FAILED',
          title: failedVideo.name || failedVideo.title,
          errorMessage: errorDetails
        });
      }
    } catch (notifyErr) {
      console.error('[VIDEO_ACTIONS] Notification error (failure):', notifyErr);
    }

    throw error;
  }
}

export async function regenerateClustersAction(videoId: string) {
  console.log('[VIDEO_ACTIONS] Starting cluster regeneration for video:', videoId);

  // Check if user is authenticated
  const user = await getLocalUser()
  if (!user) {
    console.error('[VIDEO_ACTIONS] User not authenticated');
    throw new Error('Unauthorized')
  }

  try {
    // Step 1: Get video metadata and comment count efficiently
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        userId: true,
        name: true,
        _count: {
          select: {
            comments: true
          }
        }
      }
    });

    if (!video) {
      throw new Error('Video not found');
    }

    // Check if user owns this video or has access
    if (video.userId !== user.id) {
      throw new Error('Unauthorized: You do not have access to this video');
    }

    console.log(`[VIDEO_ACTIONS] Found video with ${video._count.comments} existing comments`);

    if (video._count.comments === 0) {
      throw new Error('No comments found for this video. Cannot regenerate clusters.');
    }

    // Update status to indicate clustering is in progress
    await updateVideoStatus(video.id, VIDEO_STATUS.ANALYZING_COMMENTS);

    // Use the unified clustering function with optimized mode
    const clusterResult = await performOptimizedClustering({
      videoId: video.id,
      maxClusters: 10,
      maxEmbeddings: 2000,
      useOptimizedMode: false
    });

    // Get the latest analysis summary to preserve existing data
    const latestVideo = await prisma.video.findUnique({
      where: { id: video.id },
      select: { analysisSummary: true }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentAnalysisSummary = (latestVideo?.analysisSummary as any) || {};

    // Delete existing clusters for this video
    console.log(`[VIDEO_ACTIONS] Deleting existing clusters for video ${video.id}`);
    await prisma.$executeRaw`DELETE FROM "Cluster" WHERE "videoId" = ${video.id}`;

    // Reset all comment cluster assignments
    await prisma.$executeRaw`UPDATE "Comment" SET "clusterId" = NULL WHERE "videoId" = ${video.id}`;

    // Create new clusters with enhanced category labeling
    const createdClusterIds = await createClustersInDatabase(clusterResult.clusters, video.id);

    // Update the video's analysis summary to mark completion
    await updateVideoStatus(video.id, VIDEO_STATUS.COMPLETED, {
      analysisSummary: {
        ...currentAnalysisSummary, // Preserve all existing data
        processedAt: new Date().toISOString(),
        source: currentAnalysisSummary?.source || 'manual_analysis',
        embeddingsUsed: clusterResult.embeddingsUsed,
        clustersMigratedToTable: true,
        completedAt: new Date().toISOString(),
        clustersRegeneratedAt: new Date().toISOString(), // New field to track regeneration
        optimizedClustering: true // Flag to indicate memory-optimized clustering was used
      }
    });

    console.log(`[VIDEO_ACTIONS] Successfully regenerated ${clusterResult.clusters.length} clusters for video ${video.id} using optimized approach`);

    return {
      success: true,
      message: `Successfully regenerated ${clusterResult.clusters.length} clusters`,
      clustersCount: clusterResult.clusters.length,
      commentsProcessed: clusterResult.commentsProcessed,
      embeddingsUsed: clusterResult.embeddingsUsed,
      parentClusterId: videoId,
      subClusterIds: createdClusterIds
    };

  } catch (error) {
    console.error('[VIDEO_ACTIONS] Error regenerating clusters:', error);

    // Reset video status back to completed if it was completed before
    try {
      await updateVideoStatus(videoId, VIDEO_STATUS.COMPLETED);
    } catch (statusError) {
      console.error('[VIDEO_ACTIONS] Error resetting video status:', statusError);
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to regenerate clusters. Please try again.');
  }
}

// Separate action for creating sub-clusters from an existing cluster
export async function createSubClustersAction(clusterId: string) {
  console.log('[VIDEO_ACTIONS] Starting sub-cluster creation for cluster:', clusterId);

  // Check if user is authenticated
  const user = await getLocalUser()
  if (!user) {
    console.error('[VIDEO_ACTIONS] User not authenticated');
    throw new Error('Unauthorized')
  }

  try {
    // Get the parent cluster and its video
    const parentCluster = await prisma.cluster.findUnique({
      where: { id: clusterId },
      include: {
        video: true
      }
    });

    if (!parentCluster) {
      throw new Error('Parent cluster not found');
    }

    // Check if user owns this video/cluster
    if (parentCluster.video.userId !== user.id) {
      throw new Error('Unauthorized: You do not have access to this cluster');
    }

    // Get comments for this cluster using raw SQL to include embedding
    const clusterComments = await prisma.$queryRaw`
      SELECT c."id", c."platformId", c."text", c."authorName", c."authorAvatar",
             c."timestamp", c."likeCount", c."analysis", c."isReply", 
             c.embedding::text as embedding
      FROM "Comment" c
      WHERE c."clusterId" = ${clusterId}
      ORDER BY c."timestamp" DESC
    ` as Array<{
      id: string;
      platformId: string;
      text: string;
      authorName: string;
      authorAvatar: string | null;
      timestamp: Date;
      likeCount: number;
      analysis: Record<string, unknown>;
      isReply: boolean;
      embedding: string | null;
    }>;

    console.log(`[VIDEO_ACTIONS] Found parent cluster "${parentCluster.name}" with ${clusterComments.length} comments`);

    if (clusterComments.length === 0) {
      throw new Error('No comments found in this cluster. Cannot create sub-clusters.');
    }

    // Limit sub-clusters to maximum 10 clusters
    const maxSubClusters = 10;
    const totalComments = clusterComments.length;
    const targetSubClusterSize = Math.ceil(totalComments / maxSubClusters);
    const numSubClusters = Math.min(maxSubClusters, Math.max(1, Math.ceil(totalComments / targetSubClusterSize)));

    console.log(`[VIDEO_ACTIONS] Creating ${numSubClusters} sub-clusters from ${totalComments} comments (max ${maxSubClusters} allowed)`);

    // Use the unified clustering function for sub-clusters
    let clusterResult: ClusteringResult;
    try {
      console.log(`[VIDEO_ACTIONS] Starting intelligent clustering for ${totalComments} comments into ${numSubClusters} sub-clusters`);

      clusterResult = await performOptimizedClustering({
        videoId: parentCluster.videoId,
        parentClusterId: clusterId,
        maxClusters: numSubClusters,
        maxEmbeddings: totalComments, // Use all comments for sub-clustering
        clusterPrefix: `${parentCluster.name} - `,
        useOptimizedMode: totalComments > 5000
      });

      console.log(`[VIDEO_ACTIONS] Intelligent clustering completed. Generated ${clusterResult.clusters.length} sub-clusters`);
    } catch (clusteringError) {
      console.error('[VIDEO_ACTIONS] Intelligent clustering failed, using fallback sequential division:', clusteringError);

      // Fallback: create simple sequential sub-clusters
      const commentsPerSubCluster = Math.ceil(totalComments / numSubClusters);
      const fallbackClusters: Cluster[] = [];

      for (let i = 0; i < numSubClusters; i++) {
        const startIndex = i * commentsPerSubCluster;
        const endIndex = Math.min(startIndex + commentsPerSubCluster, totalComments);
        const subClusterComments = clusterComments.slice(startIndex, endIndex);

        fallbackClusters.push({
          name: `${parentCluster.name} - Part ${i + 1}`,
          commentIDs: subClusterComments.map(c => c.id)
        });
      }

      clusterResult = {
        clusters: fallbackClusters,
        embeddingsUsed: 0,
        commentsProcessed: totalComments
      };

      console.log(`[VIDEO_ACTIONS] Fallback clustering created ${clusterResult.clusters.length} sub-clusters`);
    }

    // Create sub-clusters in the database using the unified function
    const createdSubClusterIds = await createClustersInDatabase(
      clusterResult.clusters,
      parentCluster.videoId,
      parentCluster.id,
      parentCluster.level + 1
    );

    // Update parent cluster comment count to 0 since comments are now in sub-clusters
    await prisma.$executeRaw`
      UPDATE "Cluster"
      SET "commentCount" = 0, "updatedAt" = NOW()
      WHERE "id" = ${clusterId}
    `;

    console.log(`[VIDEO_ACTIONS] Successfully created ${createdSubClusterIds.length} sub-clusters for cluster ${clusterId}`);

    return {
      success: true,
      message: `Successfully created ${createdSubClusterIds.length} sub-clusters`,
      subClustersCount: createdSubClusterIds.length,
      commentsProcessed: clusterResult.commentsProcessed,
      embeddingsUsed: clusterResult.embeddingsUsed,
      parentClusterId: clusterId,
      subClusterIds: createdSubClusterIds
    };
  } catch (error) {
    console.error('[VIDEO_ACTIONS] Error creating sub-clusters:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Failed to create sub-clusters. Please try again.');
  }
}
