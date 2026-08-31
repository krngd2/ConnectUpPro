import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { findSimilarCommentsOptimized } from '@/lib/gemini';

interface RouteParams {
    params: Promise<{
        videoId: string;
    }>;
}

export async function POST(
    request: NextRequest,
    { params }: RouteParams
) {
    try {
        const user = await getLocalUser();
        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { videoId } = await params;
        const body = await request.json();
        const {
            // legacy
            embeddings,
            // new contrastive fields
            positiveEmbeddings,
            negativeEmbeddings,
            posThreshold = 0.7,
            margin = 0.1,
            maxResults = 100
        } = body;

        // Normalize input to positive/negative
        const pos = Array.isArray(positiveEmbeddings) && positiveEmbeddings.length > 0
            ? positiveEmbeddings
            : embeddings; // fallback to legacy
        const neg = Array.isArray(negativeEmbeddings) ? negativeEmbeddings : [];

        if (!Array.isArray(pos) || pos.length === 0) {
            return NextResponse.json(
                { error: 'Invalid positive embeddings: expected non-empty array' },
                { status: 400 }
            );
        }

        const validPos = pos.filter((emb: unknown) => Array.isArray(emb) && emb.length > 0 && emb.every(val => typeof val === 'number'));
        const validNeg = neg.filter((emb: unknown) => Array.isArray(emb) && emb.length > 0 && emb.every(val => typeof val === 'number'));

        if (validPos.length === 0) {
            return NextResponse.json(
                { error: 'No valid positive embeddings provided' },
                { status: 400 }
            );
        }

        console.log(`[SEMANTIC_SEARCH_EMBEDDINGS] Searching video ${videoId} with pos:${validPos.length} neg:${validNeg.length} (posThreshold: ${posThreshold}, margin: ${margin}, maxResults: ${maxResults})`);

        const results = await findSimilarCommentsOptimized(
            videoId,
            validPos,
            validNeg,
            posThreshold,
            margin,
            maxResults,
            false
        );

        console.log(
            `[SEMANTIC_SEARCH_EMBEDDINGS] Found ${results.length} matching comments`
        );

        return NextResponse.json({
            success: true,
            data: results,
            metadata: {
                embeddingCount: validPos.length,
                posThreshold,
                margin,
                resultsFound: results.length,
                optimized: true
            }
        });

    } catch (error) {
        console.error('[SEMANTIC_SEARCH_EMBEDDINGS] Error performing semantic search:', error);
        return NextResponse.json(
            {
                error: 'Failed to perform semantic search',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
