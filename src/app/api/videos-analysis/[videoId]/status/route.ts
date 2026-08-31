import { NextRequest, NextResponse } from 'next/server';
import { getVideoStatus } from '@/lib/background-processor';
import { getLocalUser } from '@/lib/local-user.server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    // Check if user is authenticated
    const user = await getLocalUser();
    if (!user) {
      console.warn(`[API] Unauthorized access attempt to video status`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await params;

    if (!videoId) {
      console.error('[API] Video ID is missing from request');
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    console.log(`[API] Fetching status for video: ${videoId}`);
    const status = await getVideoStatus(videoId);

    if (!status) {
      console.warn(`[API] Video not found: ${videoId}`);
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    console.log(`[API] Video status: ${status.status}, Comments: ${status.commentsCount}`);
    return NextResponse.json(status);

  } catch (error) {
    const { videoId } = await params;
    console.error(`[API] Error fetching video status for ${videoId}:`, error);
    
    if (error instanceof Error) {
      console.error(`[API] Error details: ${error.message}`);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
