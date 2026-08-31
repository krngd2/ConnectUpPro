import { NextRequest, NextResponse } from 'next/server';
import { getVideoDetailsFromYT } from '@/lib/youtube';

export async function POST(request: NextRequest) {
    try {
        const { videoUrl } = await request.json();

        if (!videoUrl) {
            return NextResponse.json(
                { error: 'Video URL is required' },
                { status: 400 }
            );
        }

        const videoDetails = await getVideoDetailsFromYT(videoUrl);

        if (!videoDetails) {
            return NextResponse.json(
                { error: 'Could not fetch video details. Please check the URL.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ videoDetails });
    } catch (error) {
        console.error('Error fetching video details:', error);
        return NextResponse.json(
            { error: 'Failed to fetch video details' },
            { status: 500 }
        );
    }
}