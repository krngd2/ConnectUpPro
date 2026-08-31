import { NextRequest, NextResponse } from 'next/server';
import { getLocalUser } from '@/lib/local-user.server';
import { prisma } from '@/lib/db';
import { createEmbeddings } from '@/lib/gemini';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// Delete a semantic search
export async function DELETE(
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

    const { id } = await params;

    // Verify the semantic search belongs to the user
    const semanticSearch = await prisma.semanticSearch.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!semanticSearch) {
      return NextResponse.json(
        { error: 'Semantic search not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of default semantic searches
    if (semanticSearch.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default semantic searches' },
        { status: 403 }
      );
    }

    // Delete the semantic search
    await prisma.semanticSearch.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Semantic search deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting semantic search:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete semantic search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Update a semantic search
export async function PUT(
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

    const { id } = await params;
    const jsonData = await request.json();
    const { title, positiveExamples, negativeExamples, examples, category } = jsonData;

    // Support both old format (examples) and new format (positiveExamples/negativeExamples)
    const posExamples = positiveExamples || examples || [];
    const negExamples = negativeExamples || [];

    if (!title || !Array.isArray(posExamples) || posExamples.length === 0) {
      return NextResponse.json(
        { error: 'Title and at least one positive example are required' },
        { status: 400 }
      );
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

    // Verify the semantic search belongs to the user
    const existingSearch = await prisma.semanticSearch.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!existingSearch) {
      return NextResponse.json(
        { error: 'Semantic search not found' },
        { status: 404 }
      );
    }

    // For default searches, prevent editing title and category
    // Only allow editing examples
    const updateData: {
      title?: string;
      category?: string;
      examples: Array<{
        include: Array<{ comment: string; embedding: number[] }>;
        exclude: Array<{ comment: string; embedding: number[] }>;
      }>;
    } = {
      examples: [] // Will be set below
    };

    if (existingSearch.isDefault) {
      // For default searches, only update examples, keep title and category unchanged
      if (title !== existingSearch.title || category !== existingSearch.category) {
        return NextResponse.json(
          { error: 'Cannot modify title or category of default semantic searches' },
          { status: 403 }
        );
      }
    } else {
      // For non-default searches, allow updating title and category
      updateData.title = title;
      updateData.category = category || '';
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

    updateData.examples = examplesWithEmbeddings;

    // Update the semantic search
    const semanticSearch = await prisma.semanticSearch.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      data: semanticSearch
    });

  } catch (error) {
    console.error('Error updating semantic search:', error);
    return NextResponse.json(
      {
        error: 'Failed to update semantic search',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
