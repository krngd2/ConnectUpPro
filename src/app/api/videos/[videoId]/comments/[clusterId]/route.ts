import { NextRequest, NextResponse } from 'next/server';
import { getCommentsByCluster } from '@/lib/analysis';
import { getLocalUser } from '@/lib/local-user.server';
import { isDatabaseConnectionError } from '@/lib/db';

interface RouteParams {
  params: Promise<{
    videoId: string;
    clusterId: string;
  }>;
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

    const { videoId, clusterId } = await params;

    // Decode the cluster ID in case it was URL encoded
    const decodedClusterId = decodeURIComponent(clusterId);

    const comments = await getCommentsByCluster(videoId, decodedClusterId);

    return NextResponse.json({
      success: true,
      data: comments
    });

  } catch (error) {
    console.error('Error fetching comments by cluster:', error);

    // Check if it's a database connection error
    if (isDatabaseConnectionError(error)) {
      return NextResponse.json(
        {
          error: 'Database connection issue. Please try again.',
          details: 'Connection temporarily unavailable'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch comments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
