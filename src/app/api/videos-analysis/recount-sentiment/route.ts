import { NextRequest, NextResponse } from 'next/server'
import { getLocalUser } from '@/lib/local-user.server'
import { prisma } from '@/lib/db'
import { performSentimentAnalysis } from '@/lib/sentiment-analysis'
import { z } from 'zod'

// Validation schema for recount sentiment request
const recountSentimentSchema = z.object({
    videoId: z.string().uuid('Invalid video ID'),
})

export async function POST(request: NextRequest) {
    console.log('[API] Starting sentiment recount');

    try {
        // Check if user is authenticated
        const user = await getLocalUser();
        if (!user) {
            console.error('[API] User not authenticated');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        console.log('[API] Request body:', body);

        const validationResult = recountSentimentSchema.safeParse(body);

        if (!validationResult.success) {
            console.error('[API] Validation failed:', validationResult.error);
            return NextResponse.json(
                { error: 'Invalid input', details: validationResult.error.errors },
                { status: 400 }
            );
        }

        const { videoId } = validationResult.data;

        // Verify the video belongs to the user
        const video = await prisma.video.findUnique({
            where: { id: videoId },
            select: { id: true, userId: true, name: true }
        });

        if (!video) {
            console.error('[API] Video not found:', videoId);
            return NextResponse.json(
                { error: 'Video not found' },
                { status: 404 }
            );
        }

        if (video.userId !== user.id) {
            console.error('[API] Unauthorized: Video does not belong to user');
            return NextResponse.json(
                { error: 'Unauthorized: Video does not belong to current user' },
                { status: 403 }
            );
        }

        // Perform sentiment analysis
        const sentimentResult = await performSentimentAnalysis(videoId, user.id);

        // Update the video with sentiment analysis results if available
        if (sentimentResult) {
            await prisma.video.update({
                where: { id: videoId },
                data: {
                    sentimentAnalysis: sentimentResult as object
                }
            });
            console.log(`[API] Sentiment analysis recounted and saved for video ${videoId}`);
        } else {
            console.log(`[API] Sentiment analysis returned no results for video ${videoId}`);
        }

        return NextResponse.json({
            success: true,
            message: sentimentResult ? `Successfully recounted sentiment analysis with ${sentimentResult.categories.length} categories` : 'No sentiment data available',
            sentimentAnalysis: sentimentResult
        });

    } catch (error) {
        console.error('[API] Error in sentiment recount:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Internal server error', message: errorMessage },
            { status: 500 }
        );
    }
}
