import { NextRequest, NextResponse } from 'next/server';
import { regenerateClustersAction } from '@/app/actions/videos.actions';

export async function POST(request: NextRequest) {
    try {
        const { videoId } = await request.json();

        if (!videoId) {
            return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
        }

        const result = await regenerateClustersAction(videoId);

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error in regenerate clusters API:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to regenerate clusters'
        }, { status: 500 });
    }
}
