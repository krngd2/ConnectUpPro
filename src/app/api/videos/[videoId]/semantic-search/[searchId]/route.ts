import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';
import { findSimilarCommentsOptimized } from '@/lib/gemini';

interface RouteParams {
  params: Promise<{
    videoId: string;
    searchId: string;
  }>;
}

export async function GET(
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

    const { videoId, searchId } = await params;
    const { searchParams } = new URL(request.url);
    const posThreshold = parseFloat(searchParams.get('posThreshold') || searchParams.get('threshold') || '0.7');
    const margin = parseFloat(searchParams.get('margin') || '0.1');
    const maxResults = parseInt(searchParams.get('maxResults') || '100');

    // Get the semantic search
    const semanticSearch = await prisma.semanticSearch.findFirst({
      where: {
        id: searchId,
        userId: user.id
      }
    });

    if (!semanticSearch) {
      return NextResponse.json(
        { error: 'Semantic search not found' },
        { status: 404 }
      );
    }

    // Extract embeddings from the semantic search examples
    // Support both old format and new format (include/exclude examples)
    const examples = semanticSearch.examples as Array<{
      comment?: string;
      embedding?: number[];
      include?: Array<{ comment: string; embedding: number[] }>;
      exclude?: Array<{ comment: string; embedding: number[] }>;
      // Legacy support
      positive_examples?: Array<{ comment: string; embedding: number[] }>;
      negative_examples?: Array<{ comment: string; embedding: number[] }>;
    }>;

    if (!examples || examples.length === 0) {
      return NextResponse.json(
        { error: 'No examples found in semantic search' },
        { status: 400 }
      );
    }

    // Collect positive and negative embeddings (combine across entries for robustness)
    const positiveEmbeddings: number[][] = [];
    const negativeEmbeddings: number[][] = [];

    for (const ex of examples) {
      // New format: include/exclude
      if (ex.include && Array.isArray(ex.include)) {
        for (const pe of ex.include) {
          if (Array.isArray(pe.embedding) && pe.embedding.length > 0) positiveEmbeddings.push(pe.embedding);
        }
      }
      if (ex.exclude && Array.isArray(ex.exclude)) {
        for (const ne of ex.exclude) {
          if (Array.isArray(ne.embedding) && ne.embedding.length > 0) negativeEmbeddings.push(ne.embedding);
        }
      }
      // Legacy format: positive_examples/negative_examples
      if (ex.positive_examples && Array.isArray(ex.positive_examples)) {
        for (const pe of ex.positive_examples) {
          if (Array.isArray(pe.embedding) && pe.embedding.length > 0) positiveEmbeddings.push(pe.embedding);
        }
      }
      if (ex.negative_examples && Array.isArray(ex.negative_examples)) {
        for (const ne of ex.negative_examples) {
          if (Array.isArray(ne.embedding) && ne.embedding.length > 0) negativeEmbeddings.push(ne.embedding);
        }
      }
      // Legacy support: single embedding treated as positive
      if (ex.embedding && ex.embedding.length > 0) {
        positiveEmbeddings.push(ex.embedding);
      }
    }

    if (positiveEmbeddings.length === 0) {
      return NextResponse.json(
        { error: 'No valid positive embeddings found in semantic search' },
        { status: 400 }
      );
    }

    // Use optimized pgvector search
    const results = await findSimilarCommentsOptimized(
      videoId,
      positiveEmbeddings,
      negativeEmbeddings,
      posThreshold,
      margin,
      maxResults,
      false // Don't need full text for UI
    );

    // Calculate metadata
    const positiveCount = positiveEmbeddings.length;
    const negativeCount = negativeEmbeddings.length;

    return NextResponse.json({
      success: true,
      data: results,
      metadata: {
        searchTitle: semanticSearch.title,
        positiveExamples: positiveCount,
        negativeExamples: negativeCount,
        posThreshold,
        margin,
        resultsFound: results.length,
        optimized: true // Flag to indicate we're using the optimized version
      }
    });

  } catch (error) {
    console.error('Error performing semantic search:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform semantic search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
