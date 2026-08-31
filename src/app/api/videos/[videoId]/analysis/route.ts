import { NextRequest, NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params

    // Check if user is authenticated
    const user = await getLocalUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get video analysis data - SUMMARY ONLY for performance
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        userId: user.id, // Ensure user can only access their own videos
      },
      select: {
        id: true,
        name: true,
        url: true,
        title: true,
        thumbnailUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        analysisSummary: true,
        _count: {
          select: {
            comments: true,
          },
        },
        // DON'T INCLUDE comments to avoid memory issues with large datasets
      },
    })

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found or access denied' },
        { status: 404 }
      )
    }

    // Transform the data for the frontend
    const analysisData = {
      video: {
        id: video.id,
        name: video.name,
        url: video.url,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        status: video.status,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt,
        analysisSummary: video.analysisSummary,
      },
      // Comments are now loaded separately via pagination API
      stats: {
        totalComments: video._count.comments,
        // Add more stats as needed
      },
    }

    return NextResponse.json({
      success: true,
      data: analysisData,
    })

  } catch (error) {
    console.error('Error fetching video analysis:', error)

    // Handle specific database connection errors
    if (error instanceof Error) {
      if (error.message.includes('Can\'t reach database server') ||
        error.message.includes('database connection') ||
        error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database connection failed. Please check your database configuration.' },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
