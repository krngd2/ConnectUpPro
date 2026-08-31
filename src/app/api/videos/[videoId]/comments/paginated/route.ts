import { NextRequest, NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface ClusterData {
  name: string;
  commentIDs: string[];
}

interface AnalysisSummary {
  clusters?: ClusterData[];
  [key: string]: unknown;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params
    const { searchParams } = new URL(request.url)
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Max 100 per page
    const offset = (page - 1) * limit
    
    // Filter parameters
    const category = searchParams.get('category')
    const cluster = searchParams.get('cluster')
    const search = searchParams.get('search')
    const sentimentFilter = searchParams.get('sentiment')
    const sortBy = searchParams.get('sortBy') || 'timestamp' // timestamp, likes, relevance
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // Check if user is authenticated
    const user = await getLocalUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify video ownership
    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        userId: user.id,
      },
      select: {
        id: true,
        analysisSummary: true,
      }
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Build dynamic where clause based on filters
    const whereClause: Prisma.CommentWhereInput = {
      videoId: videoId,
    }

    // Apply cluster filter
    if (cluster && cluster !== 'all') {
      const analysisSummary = video.analysisSummary as AnalysisSummary | null
      const clusters = analysisSummary?.clusters || []
      const selectedCluster = clusters.find((c: ClusterData) => c.name === cluster)
      
      if (selectedCluster && selectedCluster.commentIDs) {
        whereClause.platformId = {
          in: selectedCluster.commentIDs
        }
      }
    }

    // Apply text search filter
    if (search && search.trim()) {
      whereClause.text = {
        contains: search.trim(),
        mode: 'insensitive'
      }
    }

    // Apply category filter (keyword-based)
    if (category && category !== 'all') {
      const existingTextFilter = whereClause.text
      whereClause.text = {
        contains: category.toLowerCase(),
        mode: 'insensitive',
        ...(existingTextFilter && typeof existingTextFilter === 'object' ? existingTextFilter : {})
      }
    }

    // Build order by clause
    const orderByClause: Prisma.CommentOrderByWithRelationInput = (() => {
      switch (sortBy) {
        case 'likes':
          return { likeCount: sortOrder as 'asc' | 'desc' }
        case 'timestamp':
          return { timestamp: sortOrder as 'asc' | 'desc' }
        default:
          return { timestamp: sortOrder as 'asc' | 'desc' }
      }
    })()

    // Get total count for pagination
    const totalCount = await prisma.comment.count({
      where: whereClause
    })

    // Get paginated comments
    const comments = await prisma.comment.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: offset,
      take: limit,
      select: {
        id: true,
        platformId: true,
        text: true,
        authorName: true,
        authorAvatar: true,
        timestamp: true,
        likeCount: true,
        analysis: true,
        // embedding excluded by default - don't send to frontend
      }
    })

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    return NextResponse.json({
      success: true,
      data: {
        comments,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPreviousPage,
        },
        filters: {
          category,
          cluster,
          search,
          sentiment: sentimentFilter,
          sortBy,
          sortOrder,
        }
      }
    })

  } catch (error) {
    console.error('Error fetching paginated comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
