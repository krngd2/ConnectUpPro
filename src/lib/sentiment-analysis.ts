import { prisma } from '@/lib/db'
import { countSimilarCommentsContrastiveOptimized } from '@/lib/gemini'
import type { SentimentAnalysisResult, SentimentCategoryResult } from './sentiment-analysis.types'

export type { SentimentAnalysisResult, SentimentCategoryResult }

/**
 * Perform sentiment analysis with deduplication - each comment can be assigned to up to 2 categories
 * This function is designed to be called after video analysis completes
 * or when manually recounting sentiment analysis
 * Errors are caught and logged but do not affect video analysis status
 */
export async function performSentimentAnalysis(videoId: string, userId: string): Promise<SentimentAnalysisResult | null> {
    console.log(`[SENTIMENT_ANALYSIS] Starting optimized contrastive sentiment analysis for video: ${videoId}`);

    try {
        // 1) Get all default semantic searches for this user
        const defaultSearches = await prisma.semanticSearch.findMany({
            where: { userId, isDefault: true },
            select: { id: true, title: true, category: true, examples: true }
        });

        if (defaultSearches.length === 0) {
            console.log(`[SENTIMENT_ANALYSIS] No default semantic searches found for user ${userId}`);
            return null;
        }

        console.log(`[SENTIMENT_ANALYSIS] Found ${defaultSearches.length} default semantic searches`);

        // 2) Get total comments with embeddings for the video
        const totalResult = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count
            FROM "Comment"
            WHERE "videoId" = ${videoId}
              AND embedding IS NOT NULL
        `;
        const totalComments = Number(totalResult[0]?.count || 0);
        if (totalComments === 0) {
            console.log(`[SENTIMENT_ANALYSIS] No comments with embeddings found for video ${videoId}`);
            return null;
        }

        console.log(`[SENTIMENT_ANALYSIS] Processing ${totalComments} comments using pgvector contrastive search (no downloads)`);

        // 3) Build category groups of embeddings (include/exclude), supporting legacy example format
        type Example = {
            include?: Array<{ embedding: number[] }>;
            exclude?: Array<{ embedding: number[] }>;
            embedding?: number[]; // legacy
        };

        const categoryGroups = new Map<string, { pos: number[][]; neg: number[][]; searchIds: string[] }>();
        for (const search of defaultSearches) {
            const examples = search.examples as Example[] | null | undefined;
            if (!examples || examples.length === 0) continue;

            const posEmb: number[][] = [];
            const negEmb: number[][] = [];
            for (const ex of examples) {
                if (ex.include && Array.isArray(ex.include)) {
                    posEmb.push(
                        ...ex.include
                            .map(pe => pe.embedding)
                            .filter(emb => Array.isArray(emb) && emb.length > 0)
                    );
                }
                if (ex.exclude && Array.isArray(ex.exclude)) {
                    negEmb.push(
                        ...ex.exclude
                            .map(ne => ne.embedding)
                            .filter(emb => Array.isArray(emb) && emb.length > 0)
                    );
                }
                // legacy single embedding treated as positive
                if (ex.embedding && ex.embedding.length > 0) {
                    posEmb.push(ex.embedding);
                }
            }

            if (posEmb.length === 0) continue;

            const existing = categoryGroups.get(search.category) || { pos: [], neg: [], searchIds: [] };
            existing.pos.push(...posEmb);
            if (negEmb.length > 0) existing.neg.push(...negEmb);
            existing.searchIds.push(search.id);
            categoryGroups.set(search.category, existing);
        }

        // 4) Query per category using optimized contrastive SQL helper
        const categoryResults: SentimentCategoryResult[] = [];
        const posThreshold = 0.7; // align with semantic search defaults
        const margin = 0.1; // require positives to beat negatives by this margin

        for (const [category, group] of categoryGroups.entries()) {
            try {
                if (!group.pos || group.pos.length === 0) continue;
                const { count } = await countSimilarCommentsContrastiveOptimized(
                    videoId,
                    group.pos,
                    group.neg,
                    posThreshold,
                    margin,
                    0
                );
                categoryResults.push({
                    category,
                    title: category,
                    count,
                    semanticSearchId: group.searchIds[0] || 'combined'
                });
                console.log(`[SENTIMENT_ANALYSIS] Category "${category}": ${count} matches (pos ${group.pos.length}${group.neg.length ? `, neg ${group.neg.length}` : ''})`);
            } catch (err) {
                console.error(`[SENTIMENT_ANALYSIS] Error analyzing category "${category}":`, err);
            }
        }

        // 5) Return summary
        const result: SentimentAnalysisResult = {
            totalComments,
            analyzedAt: new Date().toISOString(),
            categories: categoryResults,
            threshold: posThreshold
        };
        console.log(`[SENTIMENT_ANALYSIS] Completed optimized contrastive analysis with ${categoryResults.length} categories`);
        return result;
    } catch (error) {
        console.error(`[SENTIMENT_ANALYSIS] Error performing sentiment analysis:`, error);
        return null;
    }
}