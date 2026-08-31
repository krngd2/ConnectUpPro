import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';
import { getVideoDetailsFromYT, extractVideoIdFromYTUrl } from '@/lib/youtube';

interface RouteParams {
  params: Promise<{
    videoId: string;
  }>;
}

// Get current video statistics from YouTube
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const user = await getLocalUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await params;

    // Get video from database to extract YouTube video ID
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        userId: user.id,
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Extract YouTube video ID from the URL
    const ytVideoId = extractVideoIdFromYTUrl(video.url);
    if (!ytVideoId) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    // Fetch current video statistics from YouTube
    const videoDetails = await getVideoDetailsFromYT(ytVideoId);
    if (!videoDetails) {
      return NextResponse.json({ error: 'Could not fetch video details from YouTube' }, { status: 404 });
    }

    // Return raw video details from YouTube
    return NextResponse.json({
      success: true,
      data: videoDetails,
    });

  } catch (error) {
    console.error('Error fetching current video stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current video statistics' },
      { status: 500 }
    );
  }
}
