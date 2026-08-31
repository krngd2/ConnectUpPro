/**
 * Client-safe utility functions for embedding-related operations
 * These functions can be safely used in client-side code
 */

/**
 * Converts a pgvector string format to a number array
 * @param pgvectorString - String in format "[1.23,4.56,7.89]"
 * @returns Array of numbers or null if invalid
 */
export function parsePgVectorString(pgvectorString: string): number[] | null {
    try {
        if (!pgvectorString || typeof pgvectorString !== 'string') {
            return null;
        }

        // Remove brackets and split by comma, then convert to numbers
        const embeddingStr = pgvectorString.replace(/^\[|\]$/g, '');
        const embeddingArray = embeddingStr.split(',').map((val: string) => parseFloat(val.trim()));

        // Validate that all values are valid numbers
        if (embeddingArray.some((val: number) => isNaN(val))) {
            return null;
        }

        return embeddingArray;
    } catch (error) {
        console.warn('[EMBEDDING_HELPERS] Failed to parse pgvector string:', error);
        return null;
    }
}

/**
 * Converts a number array to pgvector string format
 * @param embedding - Array of numbers
 * @returns String in format "[1.23,4.56,7.89]" or null if invalid
 */
export function toPgVectorString(embedding: number[]): string | null {
    try {
        if (!Array.isArray(embedding) || embedding.length === 0) {
            return null;
        }

        // Validate that all values are valid numbers
        if (embedding.some((val: number) => isNaN(val))) {
            return null;
        }

        return `[${embedding.join(',')}]`;
    } catch (error) {
        console.warn('[EMBEDDING_HELPERS] Failed to convert to pgvector string:', error);
        return null;
    }
}

/**
 * Calculate cosine similarity between two vectors
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Cosine similarity score between -1 and 1
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        console.warn('[EMBEDDING_HELPERS] Vectors must have the same length for cosine similarity');
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Validate if a vector has the expected dimensions for embeddings
 * @param vector - The vector to validate
 * @param expectedDimensions - Expected number of dimensions (default: 1536 for text-embedding-3-small)
 * @returns Boolean indicating if the vector is valid
 */
export function validateEmbedding(embedding: number[], expectedDimensions: number = 1536): boolean {
    return Array.isArray(embedding) &&
        embedding.length === expectedDimensions &&
        embedding.every((val: number) => typeof val === 'number' && !isNaN(val));
}
