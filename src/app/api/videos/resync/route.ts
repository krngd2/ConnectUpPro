import { NextRequest, NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'
import { processVideoAnalysisBackground } from '@/app/actions/videos.actions'

export async function POST(request: NextRequest) {
  try {
    const user = await getLocalUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { videoId, forceSync } = body

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID is required' },
        { status: 400 }
      )
    }

    // Get the video record to get the URL and channel ID
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        url: true,
        channelId: true,
        userId: true
      }
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // Check if user owns this video
    if (video.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to resync this video' },
        { status: 403 }
      )
    }

    // Trigger the resync analysis in background
    processVideoAnalysisBackground(videoId, forceSync)
      .then((result) => {
        console.log(`[RESYNC] Background processing completed for video ${videoId}:`, result);
      })
      .catch((error) => {
        console.error(`[RESYNC] Background processing failed for video ${videoId}:`, error);
      });

    return NextResponse.json({
      success: true,
      message: 'Video resync initiated successfully',
      videoId
    })

  } catch (error) {
    console.error('Error in resync API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to resync video analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
