import { NextRequest, NextResponse } from 'next/server'
import { analyzeChannelVideoAction } from '@/app/actions/videos.actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoUrl, channelId, forceSync } = body

    if (!videoUrl || !channelId) {
      return NextResponse.json(
        { error: 'Video URL and Channel ID are required' },
        { status: 400 }
      )
    }

    // Create FormData to match the action signature
    const formData = new FormData()
    formData.append('videoUrl', videoUrl)
    formData.append('channelId', channelId)
    if (forceSync) {
      formData.append('forceSync', 'true')
    }

    const result = await analyzeChannelVideoAction(formData)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in video analysis API:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to analyze video'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
