import { NextRequest, NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await getLocalUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { videoUrls } = body

    if (!videoUrls || !Array.isArray(videoUrls)) {
      return NextResponse.json({ error: 'Video URLs array is required' }, { status: 400 })
    }

    // Check which videos exist in database (regardless of completion status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingVideos = await (prisma.video as any).findMany({
      where: {
        url: {
          in: videoUrls
        },
        userId: user.id
      },
      include: {
        _count: {
          select: {
            comments: true
          }
        }
      }
    })

    // Map video URLs to analysis status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const analysisStatus = videoUrls.reduce((acc: Record<string, any>, url: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const video = existingVideos.find((v: any) => v.url === url)
      acc[url] = {
        isAnalyzed: video?.status === 'COMPLETED',
        status: video?.status || null,
        videoId: video?.id || null,
        commentsCount: video?._count?.comments || 0,
        canRetry: video?.status === 'FAILED' || video?.status === 'PENDING' || video?.status === 'FETCHING_DETAILS' || video?.status === 'DOWNLOADING_COMMENTS' || video?.status === 'ANALYZING_COMMENTS'
      }
      return acc
    }, {})

    return NextResponse.json({ analysisStatus })

  } catch (error) {
    console.error('Error checking analysis status:', error)
    return NextResponse.json(
      { error: 'Failed to check analysis status' },
      { status: 500 }
    )
  }
}
