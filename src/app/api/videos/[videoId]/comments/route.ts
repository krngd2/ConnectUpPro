import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{
    videoId: string;
  }>;
}

interface ThreadedComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  sentiment?: string;
  topics?: string[];
  likes?: number;
  video: string;
  platformId: string;
  embedding?: string | null; // Add embedding field
  replies?: ThreadedComment[];
  isReply?: boolean;
  parentId?: string;
}

function organizeCommentsIntoThreads(comments: ThreadedComment[]): ThreadedComment[] {
  const commentMap = new Map<string, ThreadedComment>();
  const parentComments: ThreadedComment[] = [];

  // First pass: create a map of all comments and identify parents
  comments.forEach(comment => {
    commentMap.set(comment.platformId, comment);

    if (!comment.platformId.includes('.')) {
      // This is a parent comment
      parentComments.push(comment);
    }
  });

  // Second pass: organize replies under their parents
  comments.forEach(comment => {
    if (comment.platformId.includes('.')) {
      // This is a reply comment
      const parentId = comment.platformId.split('.')[0];
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

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // Check if user is authenticated
    const user = await getLocalUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { videoId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000; // Increased limit for all comments
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Fetch video info first
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        name: true,
        title: true,
        userId: true
      }
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if user owns the video
    if (video.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Fetch comments with embeddings using raw SQL
    const comments = await prisma.$queryRaw<Array<{
      id: string;
      text: string;
      authorName: string;
      timestamp: Date;
      platformId: string;
      embedding: string | null;
      likeCount: number;
      authorAvatarUrl: string;
      replyCount: number;
    }>>`
      SELECT 
        id, 
        text, 
        "authorName", 
        "authorAvatarUrl",
        timestamp, 
        "platformId", 
        embedding::text as embedding,
        "likeCount",
        "replyCount"
      FROM "Comment"
      WHERE "videoId" = ${videoId}
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Format and organize comments into threads
    const formattedComments = comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      author: comment.authorName,
      authorAvatarUrl: comment.authorAvatarUrl,
      timestamp: formatTimeAgo(comment.timestamp),
      sentiment: 'neutral', // You can implement actual sentiment analysis here
      topics: [], // Extract from comment analysis if available
      likes: comment.likeCount || 0,
      video: video.title || video.name,
      platformId: comment.platformId,
      embedding: comment.embedding || undefined, // Include embedding in response
      replies: [] as ThreadedComment[],
      replyCount: comment.replyCount || 0
    }));

    // Organize comments into threads
    const threaded = organizeCommentsIntoThreads(formattedComments);

    return NextResponse.json({
      success: true,
      data: threaded,
      pagination: {
        limit,
        offset,
        total: comments.length // Use the actual fetched comments count
      }
    });

  } catch (error) {
    console.error('Error fetching video comments:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch comments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
