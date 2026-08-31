import { prisma } from '@/lib/db';
import type { VideoStatus } from './constants';

interface Cluster {
  id: string;
  name: string;
  commentIDs: string[];
  description?: string;
  level?: number;
  subClusters?: Cluster[];
  commentCount?: number; // Optional field for comment count
}
export interface AnalysisDataCluster {
  id: string;
  name: string;
  commentIDs: string[];
  description?: string;
  level?: number;
  commentCount?: number; // Add commentCount to the interface
  subClusters?: Array<{
    id: string;
    name: string;
    commentIDs: string[];
    description?: string;
    level?: number;
    commentCount?: number; // Add commentCount to sub-clusters too
  }>;
}
export interface AnalysisData {
  project: {
    id: string;
    name: string;
    videosCount: number;
    totalComments: number;
    status: VideoStatus;
    title?: string;
    thumbnailUrl?: string;
    analyzedComments?: number; // Number of comments analyzed (with embeddings)
  };
  summary: {
    sentimentBreakdown: {
      positive: number;
      neutral: number;
      negative: number;
      offensive?: number; // Optional: abusive/offensive category
    };
    topTopics: Array<{
      topic: string;
      count: number;
      sentiment: string;
    }>;
    clusters: AnalysisDataCluster[];
  };
  comments: Array<{
    id: string;
    text: string;
    author: string;
    authorAvatarUrl: string;
    timestamp: string;
    rawTimestamp?: Date; // Raw timestamp for sorting
    sentiment?: string;
    topics?: string[];
    likes?: number;
    video: string;
    platformId: string;
    embedding?: string | null; // Add embedding field
    replies?: Array<{
      id: string;
      text: string;
      author: string;
      authorAvatarUrl: string;
      timestamp: string;
      rawTimestamp?: Date; // Raw timestamp for sorting
      sentiment?: string;
      topics?: string[];
      likes?: number;
      video: string;
      platformId: string;
      embedding?: string | null; // Add embedding field to replies as well
      isReply?: boolean;
      parentId?: string;
    }>;
    isReply?: boolean;
    parentId?: string;
  }>;
}

// Local copy of sentiment analysis interfaces (kept in sync with videos.actions.ts)
interface SentimentCategoryResultLocal {
  category: string;
  title: string;
  count: number;
  semanticSearchId: string;
}

interface SentimentAnalysisResultLocal {
  totalComments: number;
  analyzedAt: string;
  categories: SentimentCategoryResultLocal[];
  threshold: number;
}

export async function getVideoAnalysisSummary(videoId: string): Promise<Omit<AnalysisData, 'comments'> | null> {
  try {
    console.log("[ANALYSIS_LIB] Fetching video analysis summary for videoId:", videoId)

    // Get video with comment count
    console.log("[ANALYSIS_LIB] Executing database query");
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        _count: {
          select: {
            comments: true
          }
        }
      }
    }) as {
      id: string;
      name: string;
      status: string;
      title: string | null;
      thumbnailUrl: string | null;
      analysisSummary: unknown | null;
      sentimentAnalysis: unknown | null;
      _count: {
        comments: number;
      };
    } | null;

    console.log("[ANALYSIS_LIB] Database query successful");

    if (!video) {
      console.log("[ANALYSIS_LIB] Video not found")
      return null;
    }

    // Get clusters from the Cluster table using raw SQL
    const clustersFromDB = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      description: string | null;
      level: number;
      commentCount: number;
      parentClusterId: string | null;
    }>>`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.level,
        c."parentClusterId",
        COUNT(cc."id")::int as "commentCount"
      FROM "Cluster" c
      LEFT JOIN "Comment" cc ON c.id = cc."clusterId"
      WHERE c."videoId" = ${videoId}
      GROUP BY c.id, c.name, c.description, c.level, c."parentClusterId"
      ORDER BY c.level ASC, c.name ASC
    `;    // Parse analysis summary from the video (keeping for metadata only)
    // const analysisSummary = video.analysisSummary as AnalysisSummaryData | null;
    // console.log("[ANALYSIS_LIB] Raw analysisSummary (metadata only):", analysisSummary)

    // Convert database clusters to the expected format
    let clusters: Cluster[] = [];

    if (clustersFromDB.length > 0) {
      console.log("[ANALYSIS_LIB] Using clusters from Cluster table:", clustersFromDB.length)

      // Get comment IDs for each cluster
      const clusterCommentIDs = await Promise.all(
        clustersFromDB.map(async (cluster) => {
          const commentIds = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT "id"
            FROM "Comment"
            WHERE "clusterId" = ${cluster.id}
          `;
          return {
            clusterId: cluster.id,
            commentIDs: commentIds.map(c => c.id)
          };
        })
      );

      clusters = clustersFromDB.map((cluster) => {
        const clusterComments = clusterCommentIDs.find(c => c.clusterId === cluster.id);
        return {
          id: cluster.id,
          name: cluster.name,
          description: cluster.description || undefined,
          level: cluster.level,
          commentIDs: clusterComments?.commentIDs || [],
          subClusters: [], // Will be populated below
          commentCount: cluster.commentCount
        };
      });

      // Build hierarchical structure
      const clusterMap = new Map<string, Cluster>();
      const rootClusters: Cluster[] = [];

      // First pass: create all clusters
      clusters.forEach(cluster => {
        clusterMap.set(cluster.id, cluster);
      });

      // Second pass: build hierarchy
      clusters.forEach(cluster => {
        const dbCluster = clustersFromDB.find(c => c.id === cluster.id);
        if (dbCluster?.parentClusterId) {
          const parent = clusterMap.get(dbCluster.parentClusterId);
          if (parent) {
            parent.subClusters = parent.subClusters || [];
            parent.subClusters.push(cluster);
          }
        } else {
          rootClusters.push(cluster);
        }
      });

      clusters = rootClusters;
    } else {
      console.log("[ANALYSIS_LIB] No clusters found in Cluster table")
    }
    console.log("[ANALYSIS_LIB] Video status:", video.status)

    // If no clusters exist but we have comments, it means the analysis needs to be run
    if (clusters.length === 0 && video._count.comments > 0) {
      console.log("[ANALYSIS_LIB] No clusters found but video has comments. Analysis may need to be re-run.")
      console.log("[ANALYSIS_LIB] Video has", video._count.comments, "comments but no cluster data")
    }

    // Calculate sentiment breakdown using stored sentimentAnalysis when available
    const totalCommentsFromDB = video._count.comments;

    // Default counts
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let offensive = 0;
    let analyzedComments: number | undefined = undefined;

    const sentimentData = (video.sentimentAnalysis || null) as SentimentAnalysisResultLocal | null;
    if (sentimentData && Array.isArray(sentimentData.categories)) {
      // Aggregate counts by high-level bucket
      for (const cat of sentimentData.categories) {
        const catName = (cat.category || '').toLowerCase();
        if (catName.includes('positive')) {
          positive += cat.count || 0;
        } else if (catName.includes('negative')) {
          negative += cat.count || 0;
        } else if (catName.includes('neutral')) {
          neutral += cat.count || 0;
        } else if (
          catName.includes('abusive')
        ) {
          offensive += cat.count || 0;
        }
      }
      analyzedComments = Number(sentimentData.totalComments || 0);
    }

    // Calculate total comments from clusters (use commentCount from database)
    const totalCommentsFromClusters = clusters.reduce((total, cluster) => {
      return total + (clustersFromDB.find(c => c.id === cluster.id)?.commentCount || 0);
    }, 0);

    console.log("[ANALYSIS_LIB] Total comments from _count:", totalCommentsFromDB);
    console.log("[ANALYSIS_LIB] Total comments from clusters:", totalCommentsFromClusters);

    // Use the larger of the two counts (DB count includes all comments, clusters only include analyzed ones)
    const totalComments = Math.max(totalCommentsFromDB, totalCommentsFromClusters);

    // Only use real sentiment data - no fallback
    const sentimentBreakdown = {
      positive,
      neutral,
      negative,
      offensive
    };

    // Extract top topics from clusters
    const topTopics = clusters.map((cluster: Cluster, index: number) => {
      const clusterFromDB = clustersFromDB.find(c => c.id === cluster.id);
      return {
        topic: cluster.name,
        count: clusterFromDB?.commentCount || 0,
        sentiment: index % 3 === 0 ? 'positive' : index % 3 === 1 ? 'neutral' : 'negative'
      };
    });

    const result = {
      project: {
        id: video.id,
        name: video.name,
        videosCount: 1, // Single video analysis
        totalComments: totalComments,
        status: video.status as VideoStatus,
        title: video.title || undefined,
        thumbnailUrl: video.thumbnailUrl || undefined,
        analyzedComments
      },
      summary: {
        sentimentBreakdown,
        topTopics,
        clusters
      }
    };

    console.log("[ANALYSIS_LIB] Final result clusters:", result.summary.clusters.length)
    console.log("[ANALYSIS_LIB] Final result status:", result.project.status)
    console.log("[ANALYSIS_LIB] Final totalComments (calculated from max of DB and clusters):", result.project.totalComments)
    console.log("[ANALYSIS_LIB] Returning analysis summary:")

    return result;

  } catch (error) {
    console.error('Error fetching video analysis summary:', error);
    return null;
  }
}

export async function getVideoAnalysis(videoId: string): Promise<AnalysisData | null> {
  try {
    const summary = await getVideoAnalysisSummary(videoId);
    if (!summary) {
      return null;
    }

    // For backward compatibility, return with empty comments array
    return {
      ...summary,
      comments: []
    };

  } catch (error) {
    console.error('Error fetching video analysis:', error);
    return null;
  }
}

interface ThreadedComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  rawTimestamp?: Date; // Raw timestamp for sorting
  sentiment?: string;
  topics?: string[];
  likes?: number;
  video: string;
  platformId: string;
  replies?: ThreadedComment[];
  isReply?: boolean;
  parentId?: string;
  embedding?: string | null; // Add embedding field (can be null)
}

export async function getCommentsByCluster(videoId: string, clusterId: string): Promise<ThreadedComment[]> {
  try {
    // Find cluster in the new Cluster table using raw SQL
    const clusterResult = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      videoId: string;
      parentClusterId: string | null;
    }>>`
      SELECT "id", "name", "videoId", "parentClusterId"
      FROM "Cluster"
      WHERE "videoId" = ${videoId} AND "id" = ${clusterId}
      LIMIT 1
    `;

    if (clusterResult.length === 0) {
      console.log(`[ANALYSIS_LIB] No cluster found with ID "${clusterId}" for video ${videoId}`);
      return [];
    }

    const cluster = clusterResult[0];

    // Get video details
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        title: true,
        name: true
      }
    });

    if (!video) {
      return [];
    }

    // Check if this cluster has sub-clusters
    const subClusters = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Cluster"
      WHERE "parentClusterId" = ${cluster.id}
    `;

    let comments: Array<{
      id: string;
      text: string;
      authorName: string;
      timestamp: Date;
      platformId: string;
      embedding: string | null;
      likeCount: number;
      isReply: boolean;
    }>;

    if (subClusters.length > 0) {
      // If cluster has sub-clusters, get comments from all sub-clusters
      const allClusterIds = [cluster.id, ...subClusters.map(sc => sc.id)];
      comments = await prisma.$queryRaw<Array<{
        id: string;
        text: string;
        authorName: string;
        timestamp: Date;
        platformId: string;
        embedding: string | null;
        likeCount: number;
        isReply: boolean;
      }>>`
        SELECT
          "id", "text", "authorName", "timestamp", "platformId",
          embedding::text as embedding, "likeCount", "isReply"
        FROM "Comment"
        WHERE "clusterId" = ANY(${allClusterIds}::uuid[])
        ORDER BY "timestamp" DESC
      `;
      console.log(`[ANALYSIS_LIB] Cluster "${cluster.name}" has ${subClusters.length} sub-clusters, fetching comments from all`);
    } else {
      // Get comments directly from this cluster
      comments = await prisma.$queryRaw<Array<{
        id: string;
        text: string;
        authorName: string;
        timestamp: Date;
        platformId: string;
        embedding: string | null;
        likeCount: number;
        isReply: boolean;
      }>>`
        SELECT
          "id", "text", "authorName", "timestamp", "platformId",
          embedding::text as embedding, "likeCount", "isReply"
        FROM "Comment"
        WHERE "clusterId" = ${cluster.id}
        ORDER BY "timestamp" DESC
      `;
    }

    if (comments.length > 0) {
      // Use comments from the cluster(s)
      const formattedComments = comments.map((comment) => ({
        id: comment.id,
        text: comment.text,
        author: comment.authorName,
        timestamp: formatTimeAgo(comment.timestamp),
        rawTimestamp: comment.timestamp,
        sentiment: 'neutral',
        topics: [cluster.name],
        likes: comment.likeCount || 0,
        video: video.title || video.name,
        platformId: comment.platformId,
        embedding: comment.embedding || undefined,
        isReply: comment.isReply,
        replies: [] as ThreadedComment[]
      }));

      return organizeCommentsIntoThreads(formattedComments);
    }

    // No comments found for this cluster
    console.log(`[ANALYSIS_LIB] No comments found for cluster "${clusterId}"`);
    return [];

  } catch (error) {
    console.error('Error fetching comments by cluster:', error);
    return [];
  }
}

export async function getAllCommentsWithEmbeddings(videoId: string): Promise<ThreadedComment[]> {
  try {
    // Use retry wrapper for the database query
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        title: true,
        name: true
      }
    });

    if (!video) {
      return [];
    }

    // Fetch all comments for the video with embeddings using raw SQL
    const comments = await prisma.$queryRaw<Array<{
      id: string;
      text: string;
      authorName: string;
      timestamp: Date;
      platformId: string;
      embedding: string | null;
      likeCount: number;
      isReply: boolean;
    }>>`
      SELECT 
        id, 
        text, 
        "authorName", 
        timestamp, 
        "platformId", 
        embedding::text as embedding,
        "likeCount",
        "isReply"
      FROM "Comment"
      WHERE "videoId" = ${videoId}
      ORDER BY timestamp DESC
    `;

    // Format and organize comments into threads
    const formattedComments = comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      author: comment.authorName,
      timestamp: formatTimeAgo(comment.timestamp),
      rawTimestamp: comment.timestamp, // Keep raw timestamp for sorting
      sentiment: 'neutral', // You can implement actual sentiment analysis here
      topics: [], // No specific topic for all comments
      likes: comment.likeCount || 0,
      video: video.title || video.name,
      platformId: comment.platformId,
      embedding: comment.embedding || undefined, // Convert null to undefined for consistency
      isReply: comment.isReply,
      replies: [] as ThreadedComment[]
    }));

    // Organize comments into threads
    const threaded = organizeCommentsIntoThreads(formattedComments);
    return threaded;

  } catch (error) {
    console.error('Error fetching all comments with embeddings:', error);
    return [];
  }
}

function organizeCommentsIntoThreads(comments: ThreadedComment[]): ThreadedComment[] {
  const commentMap = new Map<string, ThreadedComment>();
  const parentComments: ThreadedComment[] = [];

  // First pass: create a map of all comments and identify parents
  comments.forEach(comment => {
    commentMap.set(comment.id, comment);

    if (!comment.id.includes('.')) {
      // This is a parent comment
      parentComments.push(comment);
    }
  });

  // Second pass: organize replies under their parents
  comments.forEach(comment => {
    if (comment.id.includes('.')) {
      // This is a reply comment
      const parentId = comment.id.split('.')[0];
      const parentComment = commentMap.get(parentId);

      if (parentComment) {
        comment.isReply = true;
        comment.parentId = parentId;
        parentComment.replies = parentComment.replies || [];
        parentComment.replies.push(comment);
      }
    }
  });

  // Sort replies by timestamp (oldest first for natural conversation flow)
  parentComments.forEach(parent => {
    if (parent.replies && parent.replies.length > 0) {
      parent.replies.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
  });

  return parentComments;
}

export async function getAllVideos(userId: string): Promise<Array<{ id: string; name: string; status: VideoStatus }>> {
  try {
    // Use retry wrapper for the database query
    const videos = await prisma.video.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        status: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return videos.map((video: { id: string; name: string; status: string }) => ({
      id: video.id,
      name: video.name,
      status: video.status as VideoStatus
    }));
  } catch (error) {
    console.error('Error fetching videos:', error);
    return [];
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  } else {
    return `${diffInDays} days ago`;
  }
}
