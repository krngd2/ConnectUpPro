import { NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'
import { VIDEO_STATUS, type VideoStatus } from '@/lib/constants'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    // Check if user is authenticated
    const user = await getLocalUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId } = await params

    // Get the video record to verify ownership and return status
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        userId: true,
        status: true,
        analysisSummary: true,
        updatedAt: true,
        _count: {
          select: {
            comments: true
          }
        }
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
        { error: 'Unauthorized to access this video' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        status: video.status,
        totalComments: video._count.comments,
        updatedAt: video.updatedAt,
        analysisSummary: video.analysisSummary
      }
    })

  } catch (error) {
    console.error('Error fetching video status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch video status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    // Check if user is authenticated
    const user = await getLocalUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId } = await params
    const body = await request.json()
    const { status, reason } = body

    if (!status || !Object.values(VIDEO_STATUS).includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status provided' },
        { status: 400 }
      )
    }

    // Get the video record to verify ownership
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        userId: true,
        status: true,
        analysisSummary: true
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
        { error: 'Unauthorized to update this video' },
        { status: 403 }
      )
    }

    // Update video status
    await prisma.video.update({
      where: { id: videoId },
      data: {
        status: status as VideoStatus,
        updatedAt: new Date(),
        analysisSummary: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(video.analysisSummary as any) || {},
          statusUpdatedAt: new Date().toISOString(),
          statusReason: reason || `Status updated to ${status}`
        }
      }
    })

    console.log(`[VIDEO_STATUS] Updated video ${videoId} status from ${video.status} to ${status}. Reason: ${reason || 'No reason provided'}`)

    return NextResponse.json({
      success: true,
      message: `Video status updated to ${status}`,
      previousStatus: video.status,
      newStatus: status,
      reason
    })

  } catch (error) {
    console.error('Error updating video status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update video status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
