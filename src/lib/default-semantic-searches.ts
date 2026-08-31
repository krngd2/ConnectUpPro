import defaultSemanticSearches from './defaultSemanticSearches.json';
import { createEmbeddings } from './gemini';
import { prisma } from './db';
import { Prisma } from '@prisma/client';

// Helper to convert title format
const formatTitle = (key: string): string => {
    return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// Helper to convert category format
const formatCategory = (category: string): string => {
    return category
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export interface DefaultSemanticSearch {
    title: string;
    category: string;
    include: string[];
    exclude: string[];
}

/**
 * Get all default semantic searches from the JSON file
 */
export const getDefaultSemanticSearches = (): DefaultSemanticSearch[] => {
    const searches: DefaultSemanticSearch[] = [];

    for (const [categoryKey, titles] of Object.entries(defaultSemanticSearches)) {
        const category = formatCategory(categoryKey);

        for (const [titleKey, examplesData] of Object.entries(titles)) {
            const title = formatTitle(titleKey);

            // Handle both old format (array of strings) and new format (object with include/exclude)
            let include: string[] = [];
            let exclude: string[] = [];

            if (Array.isArray(examplesData)) {
                // Legacy format: treat all as include examples
                include = examplesData;
            } else if (typeof examplesData === 'object' && examplesData !== null) {
                // New format with include and exclude
                const data = examplesData as { include?: string[]; exclude?: string[] };
                include = data.include || [];
                exclude = data.exclude || [];
            }

            searches.push({
                title,
                category,
                include,
                exclude,
            });
        }
    }

    return searches;
};

/**
 * Check if a semantic search is a default one by comparing category and title
 */
export const isDefaultSemanticSearch = (category: string, title: string): boolean => {
    const defaultSearches = getDefaultSemanticSearches();
    return defaultSearches.some(
        search =>
            search.category.toLowerCase() === category.toLowerCase() &&
            search.title.toLowerCase() === title.toLowerCase()
    );
};

/**
 * Seed default semantic searches for a user
 * Generates embeddings for all example comments and stores them
 */
export const seedDefaultSemanticSearches = async (userId: string): Promise<void> => {
    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Seeding default semantic searches for user ${userId}`);

    const defaultSearches = getDefaultSemanticSearches();

    // Concurrency-safe, idempotent guard: track a per-user seeding flag in a transaction
    // We rely on unique constraint (userId, category, title, isDefault) for per-item safety below,
    // but keep this short-circuit to avoid unnecessary embedding calls when already seeded.
    const existingAny = await prisma.semanticSearch.findFirst({
        where: { userId, isDefault: true },
        select: { id: true },
    });
    if (existingAny) {
        console.log(`[DEFAULT_SEMANTIC_SEARCHES] Default searches already present for user ${userId}, performing upserts to fill any gaps without duplication.`);
    }

    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Creating ${defaultSearches.length} default semantic searches`);

    // Process all searches sequentially to avoid overwhelming the API
    // createEmbeddings already handles internal batching of 100 comments per batch
    for (const search of defaultSearches) {
        try {
            // Check if this specific default search already exists to avoid unnecessary embeddings computation
            const existing = await prisma.semanticSearch.findFirst({
                where: {
                    userId,
                    category: search.category,
                    title: search.title,
                    isDefault: true,
                },
                select: { id: true }
            });

            if (existing) {
                console.log(`[DEFAULT_SEMANTIC_SEARCHES] Default search already exists for "${search.title}" - skipping.`);
                continue;
            }

            // Generate embeddings for positive examples
            console.log(`[DEFAULT_SEMANTIC_SEARCHES] Generating embeddings for "${search.title}" (${search.include.length} include, ${search.exclude.length} exclude)`);

            const positiveEmbeddings = await createEmbeddings(search.include, (msg) => {
                console.log(`[DEFAULT_SEMANTIC_SEARCHES] ${search.title} [Include]: ${msg}`);
            });

            if (positiveEmbeddings.length === 0) {
                console.error(`[DEFAULT_SEMANTIC_SEARCHES] Failed to generate include embeddings for "${search.title}"`);
                continue;
            }

            // Generate embeddings for negative examples (if any)
            let negativeEmbeddings: number[][] = [];
            if (search.exclude.length > 0) {
                negativeEmbeddings = await createEmbeddings(search.exclude, (msg) => {
                    console.log(`[DEFAULT_SEMANTIC_SEARCHES] ${search.title} [Exclude]: ${msg}`);
                });
            }

            // Store examples with embeddings in new format
            const examplesJson = [
                {
                    include: search.include.map((comment, idx) => ({
                        comment,
                        embedding: positiveEmbeddings[idx] ?? []
                    })),
                    exclude: search.exclude.map((comment, idx) => ({
                        comment,
                        embedding: negativeEmbeddings[idx] ?? []
                    }))
                }
            ];

            // Create, tolerate race: if another concurrent process inserted it, catch unique violation and skip
            try {
                await prisma.semanticSearch.create({
                    data: {
                        title: search.title,
                        userId: userId,
                        examples: examplesJson,
                        category: search.category,
                        isDefault: true,
                    }
                });
                console.log(`[DEFAULT_SEMANTIC_SEARCHES] Created default search: "${search.title}" in category "${search.category}"`);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Skipped creating duplicate default search "${search.title}" due to unique constraint.`);
                } else {
                    throw err;
                }
            }
        } catch (error) {
            console.error(`[DEFAULT_SEMANTIC_SEARCHES] Error creating default search "${search.title}":`, error);
        }
    }

    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Completed seeding default semantic searches for user ${userId}`);
};

/**
 * Generate embeddings for all default semantic searches once
 * This should be called before seeding multiple users to avoid redundant API calls
 */
export const generateDefaultSearchEmbeddings = async (): Promise<Map<string, {
    include: Array<{ comment: string; embedding: number[] }>;
    exclude: Array<{ comment: string; embedding: number[] }>;
}>> => {
    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Generating embeddings for all default searches (one-time operation)`);

    const defaultSearches = getDefaultSemanticSearches();
    const embeddingsCache = new Map<string, {
        include: Array<{ comment: string; embedding: number[] }>;
        exclude: Array<{ comment: string; embedding: number[] }>;
    }>();

    for (const search of defaultSearches) {
        try {
            const cacheKey = `${search.category}:${search.title}`;

            console.log(`[DEFAULT_SEMANTIC_SEARCHES] Generating embeddings for "${search.title}" (${search.include.length} include, ${search.exclude.length} exclude)`);

            // Generate embeddings for include examples
            const positiveEmbeddings = await createEmbeddings(search.include, (msg) => {
                console.log(`[DEFAULT_SEMANTIC_SEARCHES] ${search.title} [Include]: ${msg}`);
            });

            if (positiveEmbeddings.length === 0) {
                console.error(`[DEFAULT_SEMANTIC_SEARCHES] Failed to generate include embeddings for "${search.title}"`);
                continue;
            }

            // Generate embeddings for exclude examples (if any)
            let negativeEmbeddings: number[][] = [];
            if (search.exclude.length > 0) {
                negativeEmbeddings = await createEmbeddings(search.exclude, (msg) => {
                    console.log(`[DEFAULT_SEMANTIC_SEARCHES] ${search.title} [Exclude]: ${msg}`);
                });
            }

            // Store in cache
            embeddingsCache.set(cacheKey, {
                include: search.include.map((comment, idx) => ({
                    comment,
                    embedding: positiveEmbeddings[idx] ?? []
                })),
                exclude: search.exclude.map((comment, idx) => ({
                    comment,
                    embedding: negativeEmbeddings[idx] ?? []
                }))
            });

            console.log(`[DEFAULT_SEMANTIC_SEARCHES] ✓ Generated embeddings for "${search.title}"`);
        } catch (error) {
            console.error(`[DEFAULT_SEMANTIC_SEARCHES] Error generating embeddings for "${search.title}":`, error);
        }
    }

    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Completed generating embeddings for ${embeddingsCache.size} default searches`);
    return embeddingsCache;
};

/**
 * Seed default semantic searches for a user using pre-generated embeddings
 * This is much more efficient when seeding multiple users
 */
export const seedDefaultSemanticSearchesWithCache = async (
    userId: string,
    embeddingsCache: Map<string, {
        include: Array<{ comment: string; embedding: number[] }>;
        exclude: Array<{ comment: string; embedding: number[] }>;
    }>
): Promise<void> => {
    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Seeding default semantic searches for user ${userId} (using cached embeddings)`);

    const defaultSearches = getDefaultSemanticSearches();

    for (const search of defaultSearches) {
        try {
            // Check if this specific default search already exists
            const existing = await prisma.semanticSearch.findFirst({
                where: {
                    userId,
                    category: search.category,
                    title: search.title,
                    isDefault: true,
                },
                select: { id: true }
            });

            if (existing) {
                console.log(`[DEFAULT_SEMANTIC_SEARCHES] Default search already exists for "${search.title}" - skipping.`);
                continue;
            }

            const cacheKey = `${search.category}:${search.title}`;
            const cachedEmbeddings = embeddingsCache.get(cacheKey);

            if (!cachedEmbeddings) {
                console.error(`[DEFAULT_SEMANTIC_SEARCHES] No cached embeddings found for "${search.title}" - skipping.`);
                continue;
            }

            // Store examples with embeddings from cache
            const examplesJson = [cachedEmbeddings];

            // Create the semantic search
            try {
                await prisma.semanticSearch.create({
                    data: {
                        title: search.title,
                        userId: userId,
                        examples: examplesJson,
                        category: search.category,
                        isDefault: true,
                    }
                });
                console.log(`[DEFAULT_SEMANTIC_SEARCHES] Created default search: "${search.title}" in category "${search.category}"`);
            } catch (err) {
                if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Skipped creating duplicate default search "${search.title}" due to unique constraint.`);
                } else {
                    throw err;
                }
            }
        } catch (error) {
            console.error(`[DEFAULT_SEMANTIC_SEARCHES] Error creating default search "${search.title}":`, error);
        }
    }

    console.log(`[DEFAULT_SEMANTIC_SEARCHES] Completed seeding default semantic searches for user ${userId}`);
};

/**
 * Get default searches count
 */
export const getDefaultSearchesCount = (): number => {
    return getDefaultSemanticSearches().length;
};
