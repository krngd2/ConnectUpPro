import { NextRequest, NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'
import { createVideoAnalysisQuick } from '@/app/actions/videos.actions'
import { z } from 'zod'

// Validation schema for video analysis creation
const createVideoAnalysisSchema = z.object({
  name: z.string().min(2, 'Analysis name must be at least 2 characters'),
  videoUrl: z.string().url('Please enter a valid YouTube video URL')
})

export async function POST(request: NextRequest) {
  console.log('[API] Starting video analysis creation');

  try {
    // Check if user is authenticated
    const user = await getLocalUser()
    if (!user) {
      console.error('[API] User not authenticated');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`[API] User authenticated: ${user.id}`);

    // Parse and validate request body
    const body = await request.json()
    console.log('[API] Request body:', body);

    const validationResult = createVideoAnalysisSchema.safeParse(body)

    if (!validationResult.success) {
      console.error('[API] Validation failed:', validationResult.error);
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { name, videoUrl } = validationResult.data
    console.log(`[API] Video URL: ${videoUrl}, Analysis Name: ${name}`);

    // Create video analysis quickly (only basic details)
    const result = await createVideoAnalysisQuick(videoUrl, user.id, undefined, name)

    console.log(`[API] Quick video analysis created: ${result.videoId}, isExisting: ${result.isExisting}`);

    // If it's a new video, DO NOT start background processing immediately; queue handled by scheduler
    // Keep existing behavior for already existing completed videos

    return NextResponse.json({
      success: true,
      video: {
        id: result.videoId,
        status: result.status,
        title: result.title,
        thumbnailUrl: result.thumbnailUrl,
        commentsCount: result.commentsCount,
        isExisting: result.isExisting
      },
      message: result.isExisting && result.status === 'COMPLETED'
        ? 'Video analysis already completed'
        : result.status === 'PENDING' ? 'Video queued for analysis' : 'Video created, pending processing'
    })

  } catch (error) {
    console.error('[API] Error creating video analysis:', error)

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid YouTube URL')) {
        return NextResponse.json(
          { error: 'Please enter a valid YouTube video URL' },
          { status: 400 }
        )
      }

      if (error.message.includes('already being analyzed')) {
        return NextResponse.json(
          { error: 'This video is already being analyzed' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
export async function GET() {
  try {
    // Check if user is authenticated
    const user = await getLocalUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's videos (which are now the primary analysis units)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videos = await (prisma.video as any).findMany({
      where: {
        userId: user.id,
      },
      include: {
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transform the data to match your frontend expectations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformedVideos = videos.map((video: any) => ({
      id: video.id,
      name: video.name || video.title || 'Untitled Analysis',
      videosCount: 1, // Each video is its own analysis
      commentsAnalyzed: video._count?.comments || 0,
      status: video.status || 'PENDING',
      createdAt: video.createdAt,
      thumbnail: video.thumbnailUrl,
      url: video.url,
      title: video.title,
    }))

    return NextResponse.json({
      success: true,
      projects: transformedVideos, // Keep the same response structure for frontend compatibility
    })

  } catch (error) {
    console.error('Error fetching video analyses:', error)

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
