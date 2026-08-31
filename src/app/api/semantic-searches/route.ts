import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';
import { createEmbeddings } from '@/lib/gemini';
// Initial default seeding now handled in local-user.server.ts to avoid duplicate triggers

// Get all semantic searches for the user
export async function GET() {
  try {
    const user = await getLocalUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Defaults are seeded during auth; no seeding side-effect here to avoid duplicates

    const semanticSearches = await prisma.semanticSearch.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: semanticSearches
    });

  } catch (error) {
    console.error('Error fetching semantic searches:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch semantic searches',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Create a new semantic search
export async function POST(request: NextRequest) {
  try {
    const user = await getLocalUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Defaults are seeded during auth; no seeding side-effect here to avoid duplicates

    const jsonData = await request.json();
    const { title, positiveExamples, negativeExamples, examples } = jsonData;

    // Support both old format (examples) and new format (positiveExamples/negativeExamples)
    const posExamples = positiveExamples || examples || [];
    const negExamples = negativeExamples || [];

    if (!title || !Array.isArray(posExamples) || posExamples.length === 0) {
      return NextResponse.json(
        { error: 'Title and at least one positive example are required' },
        { status: 400 }
      );
    }

    let { category } = jsonData;
    if (!category || typeof category !== 'string') {
      category = 'Default';
    }

    if (posExamples.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 positive examples allowed' },
        { status: 400 }
      );
    }

    if (negExamples.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 negative examples allowed' },
        { status: 400 }
      );
    }

    // Generate embeddings for positive examples
    const positiveEmbeddings = await createEmbeddings(posExamples);

    if (positiveEmbeddings.length !== posExamples.length) {
      return NextResponse.json(
        { error: 'Failed to generate embeddings for all positive examples' },
        { status: 500 }
      );
    }

    // Generate embeddings for negative examples (if any)
    let negativeEmbeddings: number[][] = [];
    if (negExamples.length > 0) {
      negativeEmbeddings = await createEmbeddings(negExamples);
      if (negativeEmbeddings.length !== negExamples.length) {
        return NextResponse.json(
          { error: 'Failed to generate embeddings for all negative examples' },
          { status: 500 }
        );
      }
    }

    // Combine examples with their embeddings in new format
    const examplesWithEmbeddings = [
      {
        include: posExamples.map((comment: string, index: number) => ({
          comment,
          embedding: positiveEmbeddings[index]
        })),
        exclude: negExamples.map((comment: string, index: number) => ({
          comment,
          embedding: negativeEmbeddings[index]
        }))
      }
    ];

    // Create the semantic search
    const semanticSearch = await prisma.semanticSearch.create({
      data: {
        title,
        userId: user.id,
        category,
        examples: examplesWithEmbeddings
      }
    });

    return NextResponse.json({
      success: true,
      data: semanticSearch
    });

  } catch (error) {
    console.error('Error creating semantic search:', error);
    return NextResponse.json(
      {
        error: 'Failed to create semantic search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
