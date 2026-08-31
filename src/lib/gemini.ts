
import { GoogleGenAI } from "@google/genai";
import { kmeans } from 'ml-kmeans';
import { PCA } from "ml-pca";
import { euclidean } from 'ml-distance-euclidean';
import { prisma } from "./db";


// const embeddingModelName = 'text-embedding-3-small';
// Ensure GOOGLE_API_KEY is provided, otherwise GoogleGenAI will attempt Application Default Credentials
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    throw new Error('Missing GOOGLE_API_KEY environment variable. Please set GOOGLE_API_KEY to your Google AI API key.');
}
const genAI = new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
const modelName = 'gemini-embedding-001';


type TGroupedClusters = {
    commentIDs: string[];
    name: string;
};

export const ClusterCommentsWithEmbeddings = async (
    commentsMap: { commentID: string, embedding?: number[] }[],
    numClusters: number = 10,
    targetDimensionality: number = 5
) => {
    console.log(`[CLUSTER] Starting to cluster ${commentsMap.length} comments with pre-computed embeddings into ${numClusters} groups.`);

    if (commentsMap.length < numClusters) {
        console.warn(`[CLUSTER] Cannot create ${numClusters} clusters with only ${commentsMap.length} comments.`);
        return [];
    }

    // 1. Filter to only comments with valid embeddings and keep track of their original indices
    const validComments = commentsMap
        .map((c, originalIndex) => ({ ...c, originalIndex }))
        .filter(c => c.embedding && c.embedding.length > 0);

    if (validComments.length === 0) {
        console.error('[CLUSTER] No comments with valid embeddings found');
        return [];
    }

    console.log(`[CLUSTER] Using ${validComments.length} comments with valid embeddings out of ${commentsMap.length} total`);

    const embeddings: number[][] = validComments.map(c => c.embedding!);

    // 2. Cluster the embeddings
    const clusterLabels = clusterEmbeddings(embeddings, numClusters, targetDimensionality);

    // 3. Map the cluster labels back to the original comments
    const groupedClusters: TGroupedClusters[] = Array.from({ length: numClusters }, () => ({ commentIDs: [], name: '' }));

    clusterLabels.clusters.forEach((label, index) => {
        if (groupedClusters[label]) {
            const commentID = validComments[index].commentID;
            // Validate commentID before adding
            if (!commentID || typeof commentID !== 'string' || commentID.length < 8) {
                console.error(`[CLUSTER] Invalid commentID at index ${index}: ${commentID}`);
                return;
            }
            // Use validComments[index] instead of commentsMap[index] to avoid index mismatch
            groupedClusters[label].commentIDs.push(commentID);
        } else {
            console.warn(`[CLUSTER] Invalid cluster label ${label} for comment index ${index}`);
        }
    });

    // Log cluster sizes after mapping
    console.log(`[CLUSTER] Cluster sizes after mapping:`, groupedClusters.map((c, i) => `Cluster ${i}: ${c.commentIDs.length} comments`).join(', '));

    // 4. Get the representative comments
    const representativeIndices = findClosestComments(
        clusterLabels.reducedEmbeddings || embeddings,
        clusterLabels.clusters,
        clusterLabels.centroids,
        15
    );
    const MAX_CENTROID_COMMENTS = 15;
    const representativeCommentsIDs = Array.from({ length: numClusters }, () => [] as string[]);
    // Now, retrieve the original comment text using the indices
    for (const clusterId in representativeIndices) {
        const indices = representativeIndices[clusterId];
        console.log(`[CLUSTER] Representative comments for cluster ${clusterId}: ${indices}`);
        indices.forEach(index => {
            if (representativeCommentsIDs[clusterId].length < MAX_CENTROID_COMMENTS) {
                // Use validComments[index] instead of commentsMap[index] to match filtered array
                representativeCommentsIDs[clusterId].push(validComments[index].commentID);
            }
        });
    }
    console.log(`[CLUSTER] Representative comment IDs for clusters:`, representativeCommentsIDs.map(c => c.length));
    // 5. query comments text for cluster[] if comments ids
    const clusterComments: Array<{ id: string; text: string }> = await prisma.comment.findMany({
        select: { id: true, text: true },
        where: {
            id: {
                in: representativeCommentsIDs.flat()
            }
        }
    });

    // 6. Prepare representative comment texts for batch naming
    const representativeCommentTextsPerCluster: string[][] = representativeCommentsIDs.map(clusterIDsArr =>
        clusterIDsArr.map(id => {
            const foundComment = clusterComments.find(c => c.id === id);
            return foundComment ? foundComment.text : "";
        }).filter(Boolean)
    );

    // 7. Get names in a single LLM call for all clusters (with fallback to legacy per-cluster naming)
    let clustersNames: string[] = []; // Initialize an array to hold cluster names
    try {
        clustersNames = await nameClustersBatch(representativeCommentTextsPerCluster);
        // Ensure we always return exactly numClusters names (pad or trim if necessary)
        if (clustersNames.length !== numClusters) {
            throw new Error(`[CLUSTER] Batch naming returned ${clustersNames.length} names, expected ${numClusters}. Falling back to per-cluster naming.`);
            // clustersNames = await legacyPerClusterNaming(representativeCommentTextsPerCluster);
        }
    } catch (err) {
        console.error(`[CLUSTER] Batch cluster naming failed:`, err);
        clustersNames = await legacyPerClusterNaming(representativeCommentTextsPerCluster);
    }

    console.log(`[CLUSTER] Named clusters:`, clustersNames);

    groupedClusters.forEach((cluster, index) => {
        cluster.name = clustersNames[index];
    });

    // Final validation before returning
    console.log(`[CLUSTER] Final cluster summary before returning:`);
    groupedClusters.forEach((cluster, index) => {
        console.log(`  - Cluster ${index} "${cluster.name}": ${cluster.commentIDs.length} comment IDs`);
        if (cluster.commentIDs.length > 0) {
            console.log(`    Sample IDs:`, cluster.commentIDs.slice(0, 2));
        }
    });

    return groupedClusters;
};


/**
 * Clusters embeddings using PCA for dimensionality reduction and then K-means.
 * @param embeddings - An array of 1536-dimensional embedding vectors (from text-embedding-3-small).
 * @param numClusters - The target number of clusters (K for K-means).
 * @param targetDimensionality - The intermediate dimensionality for PCA.
 * @returns An array of cluster labels corresponding to each embedding.
 */
export const clusterEmbeddings = (
    embeddings: number[][],
    numClusters: number,
    targetDimensionality: number
): { clusters: number[]; centroids: number[][]; reducedEmbeddings?: number[][] } => {
    if (embeddings.length <= 15) {
        console.warn(`[Clustering] Only ${embeddings.length} embeddings, using simple clustering.`);
        // Return a simple clustering (e.g., assign each to a cluster round-robin)
        return {
            clusters: embeddings.map((_, i) => i % numClusters),
            centroids: [],
            reducedEmbeddings: undefined
        };
    }
    console.log(`[DEBUG] Original embedding dimensions: ${embeddings[0].length}`);
    try {
        // Use PCA to reduce dimensionality to a reasonable size for K-means
        const pcaDimensions = Math.min(Math.max(targetDimensionality, 10), embeddings.length - 1);
        console.log(`[PCA] Reducing ${embeddings.length} embeddings from ${embeddings[0].length} to ${pcaDimensions} dimensions.`);

        const pca = new PCA(embeddings);
        const pcaResult = pca.predict(embeddings, { nComponents: pcaDimensions });

        // Convert Matrix to regular array
        const reducedEmbeddings: number[][] = [];
        for (let i = 0; i < pcaResult.rows; i++) {
            const row: number[] = [];
            for (let j = 0; j < pcaResult.columns; j++) {
                row.push(pcaResult.get(i, j));
            }
            reducedEmbeddings.push(row);
        }

        console.log(`[PCA] Reduced embeddings shape: ${reducedEmbeddings.length} x ${reducedEmbeddings[0].length}`);

        // Cluster the PCA-reduced embeddings directly with K-means (skip UMAP)
        console.log(`[K-Means] Clustering PCA-reduced embeddings into ${numClusters} groups.`);
        const kmeansResult = kmeans(reducedEmbeddings, numClusters, { seed: 42 });

        return {
            clusters: kmeansResult.clusters,
            centroids: kmeansResult.centroids,
            reducedEmbeddings: reducedEmbeddings
        };
    } catch (error) {
        console.error('[Clustering] Error during clustering:', error);
        // Fallback to simple clustering
        console.log('[Clustering] Falling back to simple round-robin clustering');
        return {
            clusters: embeddings.map((_, i) => i % numClusters),
            centroids: []
        };
    }
};


/**
 * Creates embeddings for a list of texts in batches using Google Gemini.
 * @param {string[]} texts - An array of strings to embed.
 * @param {function(string):void} logger - A function to log progress updates.
 * @returns {Promise<Array<number[]>>} - A promise that resolves to an array of embedding vectors.
 */
export async function createEmbeddings(comments: string[], logger: (message: string) => void = () => { }) {
    if (comments.length === 0) {
        logger("No comments provided for embedding.");
        return [];
    }

    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < comments.length; i += batchSize) {
        let batch = comments.slice(i, i + batchSize);
        batch = batch.map(comment => {
            if (comment.split(' ').length > 1400) { // 2048 tokens is roughly 1500 words Google Embeddings Limit
                logger(`Comment truncated to 2048 tokens: ${comment}`);
                return comment.split(' ').slice(0, 1400).join(' ');
            }
            return comment;
        });
        batches.push(batch);
        logger(`Created batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(comments.length / batchSize)}`);
    }

    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
        try {
            // embedContent is the latest api and getGenerativeModel is deprecated
            const response = await genAI.models.embedContent({
                model: modelName,
                contents: batch,
                config: {
                    taskType: 'SEMANTIC_SIMILARITY',
                    outputDimensionality: 768, // Ensure we get 768-dimensional embeddings
                }
            });
            response.embeddings?.forEach((emb) => {
                if (emb.values) {
                    allEmbeddings.push(emb.values);
                }
            });
        } catch (error) {
            console.error('[EMBEDDINGS] Error creating embeddings with Google API:', error);
            logger(`Error creating embeddings for batch: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    logger(`Created ${allEmbeddings.length} embeddings.`);
    if (allEmbeddings.length === 0) {
        logger("No embeddings created. Check your API key and model.");
        return [];
    }

    return allEmbeddings;
}

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
        const embeddingArray = embeddingStr.split(/\n|,/).map((val: string) => parseFloat(val.trim()));

        // Validate that all values are valid numbers
        if (embeddingArray.some((val: number) => isNaN(val))) {
            return null;
        }

        return embeddingArray;
    } catch (error) {
        console.warn('[EMBEDDINGS] Failed to parse pgvector string:', error);
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
        console.warn('[EMBEDDINGS] Failed to convert to pgvector string:', error);
        return null;
    }
}

/**
 * Calculate cosine similarity between two vectors
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Cosine similarity score between -1 and 1
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Vectors must have the same length');
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
 * Compute contrastive similarity score using positive and negative examples
 * @param commentEmbedding - The comment embedding to score
 * @param positiveEmbeddings - Array of positive example embeddings
 * @param negativeEmbeddings - Array of negative example embeddings (anti-patterns)
 * @returns Contrastive score (positive_similarity - negative_similarity)
 */
export function computeContrastiveSimilarity(
    commentEmbedding: number[],
    positiveEmbeddings: number[][],
    negativeEmbeddings: number[][]
): number {
    if (!positiveEmbeddings || positiveEmbeddings.length === 0) {
        return 0;
    }

    // Calculate average similarity to positive examples
    const positiveSimilarities = positiveEmbeddings.map(emb =>
        cosineSimilarity(commentEmbedding, emb)
    );
    const posAvg = positiveSimilarities.reduce((sum, sim) => sum + sim, 0) / positiveSimilarities.length;

    // Calculate average similarity to negative examples (if provided)
    let negAvg = 0;
    if (negativeEmbeddings && negativeEmbeddings.length > 0) {
        const negativeSimilarities = negativeEmbeddings.map(emb =>
            cosineSimilarity(commentEmbedding, emb)
        );
        negAvg = negativeSimilarities.reduce((sum, sim) => sum + sim, 0) / negativeSimilarities.length;
    }

    // Return contrastive score (positive - negative)
    // This emphasizes comments that are similar to positive examples
    // but dissimilar to negative examples
    return posAvg - negAvg;
}

/**
 * Find most similar comments using cosine similarity
 * @param queryEmbeddings - Array of embeddings to search for
 * @param comments - Array of comments with embeddings
 * @param threshold - Minimum similarity threshold (default: 0.7)
 * @param maxResults - Maximum number of results to return (default: 50)
 * @returns Array of comments sorted by similarity score
 */
export function findSimilarComments(
    queryEmbeddings: number[][],
    comments: Array<{
        id: string;
        text: string;
        authorName: string;
        timestamp: Date;
        embedding?: number[];
        platformId: string;
        likeCount?: number;
    }>,
    threshold: number = 0.7
): Array<{
    id: string;
    text: string;
    authorName: string;
    timestamp: string;
    platformId: string;
    likes: number;
    similarity: number;
    sentiment?: string;
}> {
    const results: Array<{
        id: string;
        text: string;
        authorName: string;
        timestamp: string;
        platformId: string;
        likes: number;
        similarity: number;
        sentiment?: string;
    }> = [];

    for (const comment of comments) {
        if (!comment.embedding || comment.embedding.length === 0) {
            continue;
        }

        // Calculate max similarity against all query embeddings
        let maxSimilarity = -1;
        for (const queryEmbedding of queryEmbeddings) {
            const similarity = cosineSimilarity(queryEmbedding, comment.embedding);
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // Only include comments above threshold
        if (maxSimilarity >= threshold) {
            results.push({
                id: comment.id,
                text: comment.text,
                authorName: comment.authorName,
                timestamp: comment.timestamp.toISOString(),
                platformId: comment.platformId,
                likes: comment.likeCount || 0,
                similarity: maxSimilarity,
                sentiment: 'neutral' // Can be enhanced with actual sentiment analysis
            });
        }
    }

    // Sort by similarity (highest first) and limit results
    return results
        .sort((a, b) => b.similarity - a.similarity)
    // .slice(0, maxResults);
}


const nameClusters = async (comments: string[], previousCategories: string[] = []): Promise<string> => {
    const prompt = `You are an AI assistant tasked with analyzing YouTube comments. I have identified a cluster of comments that are semantically similar. Based on the following examples from this cluster, please provide a short, descriptive category name (2-5 words) that summarizes the core topic or sentiment.

Notice you should only return the category name, nothing else. No explanations, no extra text.

Examples of categories name output: "Suggestions to Improve Audio", "Feedback on video Quality", "Random Spam", "Abusive Comments related to [TOPIC]" etc.

${previousCategories.length > 1 ? `These are the comments in previous cluster, you have to give this specific category name other than the previously generated category names: \n` + previousCategories.slice(0, 10).join("\n") + "\n" : ""}

Comments:
${comments.join("\n")}
`;
    let clustersName = "";
    try {
        const llmResponse = await genAI.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: prompt,
            config: {
                maxOutputTokens: 10,
                temperature: 0.5,
            }
        });
        // response.candidates[0].content.parts.map(t => t.text).join(' ')
        const clusterText = llmResponse.candidates?.[0]?.content?.parts?.map(t => t.text).join(' ').trim();
        console.log(`[NAME_CLUSTERS] Generated name for cluster with ${comments.length} comments. ${clusterText}`);

        clustersName = clusterText || "";
    } catch (error) {
        console.error(`[NAME_CLUSTERS] Google Error generating name for cluster :`, error);
        clustersName = 'Cluster';
    }
    if (!clustersName) {
        console.warn(`[NAME_CLUSTERS] Cluster name generation failed.`);
        // find the most repeated word and make it cluster name
        const words = comments.join(" ").split(" ");
        const mostFrequentWord = words.sort((a, b) =>
            words.filter(v => v === a).length - words.filter(v => v === b).length
        ).pop() || "";
        clustersName = mostFrequentWord || "Generic Cluster"; // Ensure we always have a name
    }
    return clustersName || "Generic Cluster";
}

/**
 * Batch cluster naming using a single Gemini call requesting a JSON array of names.
 * Falls back to keyword-based naming if Gemini fails.
 */
const nameClustersBatch = async (clustersComments: string[][]): Promise<string[]> => {
    if (!clustersComments || clustersComments.length === 0) return [];

    const instructions = `You are an AI assistant helping categorize clusters of YouTube comments.
For each cluster, you are given a list of representative comments. Return ONLY a valid JSON array of strings, where each string is a concise (2-5 words) descriptive, title-cased category name for the corresponding cluster index.

Rules:
1. Output must be ONLY a JSON array of strings. No backticks, no prefix, no explanation.
2. Each name must be unique and avoid repeating earlier names.
3. Prefer succinct, specific phrases (e.g., "Audio Quality Suggestions", "Editing Style Praise", "Spam / Promotions").
4. If comments are random/low-signal, name accordingly (e.g., "Miscellaneous Chatter", "Low-Signal Noise").
5. Avoid using quotation marks inside the strings (regular JSON string quotes are fine). No trailing punctuation.
6. Length: 2 to 5 words ideally.
7. Return exactly ${clustersComments.length} items.
`;

    const clustersBlock = clustersComments.map((comments, idx) => {
        const sample = comments.slice(0, 50); // cap to avoid overly large prompts
        return `Cluster ${idx} Comments:\n${sample.join('\n')}`;
    }).join('\n\n');

    const prompt = `${instructions}\n\n${clustersBlock}`;

    const tryParseNames = (raw: string): string[] => {
        if (!raw) return [];
        // Strip code fences if present
        raw = raw.trim().replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
        // Sometimes the model may prepend text before JSON; attempt to extract first JSON array
        const firstBracket = raw.indexOf('[');
        const lastBracket = raw.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            raw = raw.slice(firstBracket, lastBracket + 1);
        }
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(v => typeof v === 'string' ? v.trim() : '').filter(Boolean);
            }
        } catch { /* ignore */ }
        // Fallback: split lines / commas heuristically
        return raw
            .split(/\n|,/) // split by line breaks or commas
            .map((s: string) => s.replace(/^["'\-\s]+|["'\s]+$/g, ''))
            .filter((s: string) => s.length > 0)
            .slice(0, clustersComments.length);
    };

    let names: string[] = [];
    try {
        const llmResponse = await genAI.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: { temperature: 0.5 }
        });
        const text = llmResponse.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ');
        if (!text) throw new Error('No content from Gemini');
        names = tryParseNames(text);
        console.log(`[NAME_CLUSTERS_BATCH] Gemini raw:`, text);
    } catch (error) {
        console.error('[NAME_CLUSTERS_BATCH] Gemini batch naming error:', error);
    }

    if (names.length !== clustersComments.length) {
        console.warn(`[NAME_CLUSTERS_BATCH] Expected ${clustersComments.length} names, got ${names.length}. Using keyword fallback.`);
    }

    // Final heuristic fallback if still mismatched
    if (names.length !== clustersComments.length) {
        console.warn(`[NAME_CLUSTERS_BATCH] Expected ${clustersComments.length} names, got ${names.length}. Filling heuristically.`);
        const existing = new Set<string>();
        names.forEach(n => existing.add(n));
        for (let i = names.length; i < clustersComments.length; i++) {
            const words = clustersComments[i].join(' ').split(/\s+/).filter(Boolean);
            let fallback = 'Cluster ' + (i + 1);
            if (words.length) {
                const freq: Record<string, number> = {};
                for (const w of words) {
                    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (!clean || clean.length < 4) continue;
                    freq[clean] = (freq[clean] || 0) + 1;
                }
                const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
                if (sorted.length) {
                    fallback = sorted.slice(0, 2).map(e => e[0]).join(' ');
                }
            }
            const title = fallback.replace(/\b\w/g, c => c.toUpperCase());
            let attempt = title;
            let counter = 2;
            while (existing.has(attempt)) {
                attempt = `${title} ${counter++}`;
            }
            existing.add(attempt);
            names.push(attempt);
        }
    }

    // Trim / normalize formatting
    names = names.map(n => n.replace(/"/g, '').trim()).slice(0, clustersComments.length);
    return names;
};

// Legacy per-cluster naming fallback using existing single-cluster function
const legacyPerClusterNaming = async (clustersComments: string[][]): Promise<string[]> => {
    const names: string[] = [];
    for (const comments of clustersComments) {
        const name = await nameClusters(comments, names);
        names.push(name);
    }
    return names;
};


/**
 * Finds the 5 comments closest to the centroid for each cluster.
 * @param embeddings The original (or PCA-reduced) comment embeddings.
 * @param clusters The cluster labels for each embedding.
 * @param centroids The centroids of all clusters.
 * @returns A map where each key is a cluster ID and the value is an array of the top 5 comment indices.
 */
export const findClosestComments = (
    embeddings: number[][],
    clusters: number[],
    centroids: number[][],
    maxPerCluster: number = 5
) => {
    // Handle case where centroids is empty (fallback clustering)
    if (!centroids || centroids.length === 0) {
        console.log(`[FIND_CLOSEST] No centroids provided, skipping representative comment calculation`);
        return {};
    }

    const clusterDistances: { [clusterId: number]: { index: number, distance: number }[] } = {};

    // Initialize the structure for all possible cluster IDs
    const maxClusterId = Math.max(...clusters);
    for (let i = 0; i <= maxClusterId; i++) {
        clusterDistances[i] = [];
    }

    // Calculate distance for each comment to its cluster's centroid
    for (let i = 0; i < embeddings.length; i++) {
        const clusterId = clusters[i];
        const embedding = embeddings[i];

        // Check if centroid exists for this cluster
        if (!centroids[clusterId]) {
            console.warn(`[FIND_CLOSEST] No centroid found for cluster ${clusterId}`);
            continue;
        }

        const centroid = centroids[clusterId];

        // Ensure embedding and centroid have the same dimensionality
        if (embedding.length !== centroid.length) {
            console.error(`[FIND_CLOSEST] Dimension mismatch for cluster ${clusterId}: embedding ${embedding.length}, centroid ${centroid.length}`);
            continue;
        }

        const distance = euclidean(embedding, centroid);

        clusterDistances[clusterId].push({
            index: i,
            distance: distance,
        });
    }

    // Sort and get the top 5 for each cluster
    const representativeComments: { [clusterId: number]: number[] } = {};
    for (const clusterId in clusterDistances) {
        const clusterIdNum = parseInt(clusterId);
        // Sort by distance (ascending)
        clusterDistances[clusterIdNum].sort((a, b) => a.distance - b.distance);

        // Take the top maxPerCluster indices (or all if there are fewer than maxPerCluster)
        const topComments = clusterDistances[clusterIdNum].slice(0, maxPerCluster).map(item => item.index);
        if (topComments.length > 0) {
            representativeComments[clusterIdNum] = topComments;
        }
    }

    return representativeComments;
};

/**
 * Optimized semantic similarity search using pgvector's native cosine distance operator.
 * This function leverages database-level similarity computation instead of fetching all embeddings.
 * 
 * @param videoId - The video ID to search comments within
 * @param queryEmbeddings - Array of embedding vectors to search for (from semantic search examples)
 * @param threshold - Similarity threshold (0-1, where 1 is identical). Default: 0.7
 * @param maxResults - Maximum number of results to return. Default: 50
 * @param returnFullText - Whether to return full comment text or truncated. Default: false
 * @returns Array of matching comments with similarity scores
 */
export async function findSimilarCommentsOptimized(
    videoId: string,
    positiveQueryEmbeddings: number[][],
    negativeQueryEmbeddings: number[][] = [],
    posThreshold: number = 0.7,
    margin: number = 0.1,
    maxResults: number = 100,
    returnFullText: boolean = false
): Promise<Array<{
    id: string;
    text: string;
    authorName: string;
    authorAvatarUrl: string;
    timestamp: string;
    platformId: string;
    likes: number;
    similarity: number; // contrastive score: posSimilarity - negSimilarity
    isReply: boolean;
    posSimilarity: number;
    negSimilarity: number;
}>> {
    if (!positiveQueryEmbeddings || positiveQueryEmbeddings.length === 0) {
        console.warn('[OPTIMIZED_SEARCH] No positive query embeddings provided');
        return [];
    }

    try {
        // Convert embeddings to pgvector format
        const posVectorStrings = positiveQueryEmbeddings
            .filter(emb => emb && emb.length > 0)
            .map(emb => toPgVectorString(emb))
            .filter((v): v is string => !!v);

        if (posVectorStrings.length === 0) {
            console.warn('[OPTIMIZED_SEARCH] No valid positive embeddings to search with');
            return [];
        }

        const negVectorStrings = (negativeQueryEmbeddings || [])
            .filter(emb => emb && emb.length > 0)
            .map(emb => toPgVectorString(emb))
            .filter((v): v is string => !!v);

        const posVectorArraySQL = posVectorStrings.map(vs => `'${vs}'::vector`).join(',');
        const negVectorArraySQL = negVectorStrings.map(vs => `'${vs}'::vector`).join(',');
        const withNegCTE = negVectorStrings.length > 0;
        const textSelection = returnFullText ? 'c.text' : 'LEFT(c.text, 500)';

        const ctes = [
            `pos_embeddings AS (SELECT unnest(ARRAY[${posVectorArraySQL}]) AS embedding)`,
            withNegCTE ? `neg_embeddings AS (SELECT unnest(ARRAY[${negVectorArraySQL}]) AS embedding)` : null,
            `scored_comments AS (
                SELECT
                    c.id,
                    ${textSelection} AS text,
                    c."authorName",
                    c."authorAvatar" AS "authorAvatarUrl",
                    c.timestamp,
                    c."platformId",
                    c."likeCount",
                    c."isReply",
                    c."replyCount",
                    (1 - (
                        SELECT MIN(c.embedding <=> pe.embedding)
                        FROM pos_embeddings pe
                    )) AS pos_similarity,
                    ${withNegCTE
                ? `(1 - (SELECT MIN(c.embedding <=> ne.embedding) FROM neg_embeddings ne))`
                : `0`}
                    AS neg_similarity
                FROM "Comment" c
                WHERE c."videoId" = $1 AND c.embedding IS NOT NULL
            )`
        ].filter(Boolean).join(',\n');

        const query = `
            WITH ${ctes}
            SELECT 
                id,
                text,
                "authorName",
                "authorAvatarUrl",
                timestamp,
                "platformId",
                "likeCount",
                "isReply",
                "replyCount",
                (pos_similarity - neg_similarity) AS similarity,
                pos_similarity AS "posSimilarity",
                neg_similarity AS "negSimilarity"
            FROM scored_comments
            WHERE pos_similarity >= $2 AND (pos_similarity - neg_similarity) >= $3
            ORDER BY similarity DESC
            LIMIT $4
        `;

        const results = await prisma.$queryRawUnsafe(
            query,
            videoId,
            posThreshold,
            margin,
            maxResults
        ) as Array<{
            id: string;
            text: string;
            authorName: string;
            authorAvatarUrl: string;
            timestamp: Date;
            platformId: string;
            likeCount: number;
            isReply: boolean;
            replyCount: number;
            similarity: number;
            posSimilarity: number;
            negSimilarity: number;
        }>;

        // Format results
        return results.map(r => ({
            id: r.id,
            text: r.text,
            authorName: r.authorName,
            timestamp: r.timestamp.toISOString(),
            platformId: r.platformId,
            likes: r.likeCount,
            similarity: Number(r.similarity.toFixed(4)),
            isReply: r.isReply,
            authorAvatarUrl: r.authorAvatarUrl,
            posSimilarity: Number(r.posSimilarity?.toFixed?.(4) ?? r.posSimilarity),
            negSimilarity: Number(r.negSimilarity?.toFixed?.(4) ?? r.negSimilarity),
            replyCount: r.replyCount
        }));

    } catch (error) {
        console.error('[OPTIMIZED_SEARCH] Error performing contrastive similarity search:', error);
        throw error;
    }
}

/**
 * Optimized count-only version for sentiment analysis.
 * Only counts matches without retrieving full comment data.
 * 
 * @param videoId - The video ID to search comments within
 * @param queryEmbeddings - Array of embedding vectors to search for
 * @param threshold - Similarity threshold (0-1). Default: 0.7
 * @param includeExamples - Number of top examples to include. Default: 5
 * @returns Object with count and optional top examples
 */
export async function countSimilarCommentsOptimized(
    videoId: string,
    queryEmbeddings: number[][],
    threshold: number = 0.7,
    includeExamples: number = 5
): Promise<{
    count: number;
    examples: Array<{
        id: string;
        text: string;
        authorName: string;
        similarity: number;
    }>;
}> {
    if (!queryEmbeddings || queryEmbeddings.length === 0) {
        return { count: 0, examples: [] };
    }

    const distanceThreshold = 1 - threshold;

    try {
        const vectorStrings = queryEmbeddings
            .filter(emb => emb && emb.length > 0)
            .map(emb => toPgVectorString(emb));

        if (vectorStrings.length === 0) {
            return { count: 0, examples: [] };
        }

        // Build the array of vectors for the SQL query
        const vectorArraySQL = vectorStrings.map(vs => `'${vs}'::vector`).join(',');

        // Get count and top examples in a single query using $queryRawUnsafe
        const query = `
            WITH search_embeddings AS (
                SELECT unnest(ARRAY[${vectorArraySQL}]) as embedding
            ),
            matched_comments AS (
                SELECT DISTINCT ON (c.id)
                    c.id,
                    LEFT(c.text, 150) as text,
                    c."authorName",
                    (1 - MIN(c.embedding <=> se.embedding)) as similarity
                FROM "Comment" c
                CROSS JOIN search_embeddings se
                WHERE c."videoId" = $1
                    AND c.embedding IS NOT NULL
                GROUP BY c.id, c.text, c."authorName"
                HAVING MIN(c.embedding <=> se.embedding) <= $2
            )
            SELECT 
                COUNT(*) as total_count,
                json_agg(
                    json_build_object(
                        'id', id,
                        'text', text,
                        'authorName', "authorName",
                        'similarity', similarity
                    ) ORDER BY similarity DESC
                ) FILTER (WHERE id IN (
                    SELECT id FROM matched_comments ORDER BY similarity DESC LIMIT $3
                )) as top_examples
            FROM matched_comments
        `;

        const results = await prisma.$queryRawUnsafe(
            query,
            videoId,
            distanceThreshold,
            includeExamples
        ) as Array<{
            total_count: bigint;
            top_examples: Array<{
                id: string;
                text: string;
                authorName: string;
                similarity: number;
            }> | null;
        }>;

        const result = results[0];
        return {
            count: Number(result?.total_count || 0),
            examples: result?.top_examples || []
        };

    } catch (error) {
        console.error('[OPTIMIZED_SEARCH] Error counting similar comments:', error);
        return { count: 0, examples: [] };
    }
}

/**
 * Optimized contrastive count: prefers comments similar to positives and dissimilar to negatives.
 * Uses pgvector in SQL to compute per-comment positive similarity and negative similarity, then
 * filters by a positive threshold and a margin (posSim - negSim >= margin).
 *
 * - posSimilarity is computed as 1 - MIN(c.embedding <=> positive_embedding)
 * - negSimilarity is computed as 1 - MIN(c.embedding <=> negative_embedding) (0 when no negatives)
 *
 * @param videoId - The video ID to search comments within
 * @param positiveEmbeddings - Positive example embeddings
 * @param negativeEmbeddings - Negative (anti-example) embeddings
 * @param posThreshold - Minimum positive similarity required (default: 0.7)
 * @param margin - Minimum difference posSim - negSim (default: 0.1)
 * @param includeExamples - Number of top examples to include, ranked by (posSim - negSim) (default: 5)
 */
export async function countSimilarCommentsContrastiveOptimized(
    videoId: string,
    positiveEmbeddings: number[][],
    negativeEmbeddings: number[][] = [],
    posThreshold: number = 0.7,
    margin: number = 0.1,
    includeExamples: number = 5
): Promise<{
    count: number;
    examples: Array<{
        id: string;
        text: string;
        authorName: string;
        similarity: number; // contrastive score = posSim - negSim
        posSimilarity: number;
        negSimilarity: number;
    }>;
}> {
    try {
        if (!positiveEmbeddings || positiveEmbeddings.length === 0) {
            return { count: 0, examples: [] };
        }

        // Prepare vector strings for SQL
        const posVectorStrings = positiveEmbeddings
            .filter((emb) => emb && emb.length > 0)
            .map((emb) => toPgVectorString(emb))
            .filter((v): v is string => !!v);

        if (posVectorStrings.length === 0) {
            return { count: 0, examples: [] };
        }

        const negVectorStrings = (negativeEmbeddings || [])
            .filter((emb) => emb && emb.length > 0)
            .map((emb) => toPgVectorString(emb))
            .filter((v): v is string => !!v);

        const posVectorArraySQL = posVectorStrings.map((vs) => `'${vs}'::vector`).join(',');
        const negVectorArraySQL = negVectorStrings.map((vs) => `'${vs}'::vector`).join(',');

        // Build SQL with optional negative embeddings CTE and score computation
        const withNegCTE = negVectorStrings.length > 0;
        const ctes = [
            `pos_embeddings AS (SELECT unnest(ARRAY[${posVectorArraySQL}]) AS embedding)`,
            withNegCTE ? `neg_embeddings AS (SELECT unnest(ARRAY[${negVectorArraySQL}]) AS embedding)` : null,
            `scored_comments AS (
                SELECT
                    c.id,
                    LEFT(c.text, 150) AS text,
                    c."authorName",
                    (1 - (
                        SELECT MIN(c.embedding <=> pe.embedding)
                        FROM pos_embeddings pe
                    )) AS pos_similarity,
                    ${withNegCTE
                ? `(1 - (SELECT MIN(c.embedding <=> ne.embedding) FROM neg_embeddings ne))`
                : `0`}
                    AS neg_similarity
                FROM "Comment" c
                WHERE c."videoId" = $1 AND c.embedding IS NOT NULL
            )`
        ].filter(Boolean).join(',\n');

        const query = `
            WITH ${ctes}
            SELECT 
                COUNT(*) AS total_count,
                json_agg(
                    json_build_object(
                        'id', id,
                        'text', text,
                        'authorName', "authorName",
                        'similarity', (pos_similarity - neg_similarity),
                        'posSimilarity', pos_similarity,
                        'negSimilarity', neg_similarity
                    )
                    ORDER BY (pos_similarity - neg_similarity) DESC
                ) FILTER (WHERE id IN (
                    SELECT id FROM scored_comments
                    WHERE pos_similarity >= $2 AND (pos_similarity - neg_similarity) >= $3
                    ORDER BY (pos_similarity - neg_similarity) DESC
                    LIMIT $4
                )) AS top_examples
            FROM scored_comments
            WHERE pos_similarity >= $2 AND (pos_similarity - neg_similarity) >= $3
        `;

        const result = await prisma.$queryRawUnsafe(
            query,
            videoId,
            posThreshold,
            margin,
            includeExamples
        ) as Array<{
            total_count: bigint;
            top_examples: Array<{
                id: string;
                text: string;
                authorName: string;
                similarity: number;
                posSimilarity: number;
                negSimilarity: number;
            }> | null;
        }>;

        const row = result?.[0];
        return {
            count: Number(row?.total_count || 0),
            examples: row?.top_examples || []
        };
    } catch (error) {
        console.error('[OPTIMIZED_SEARCH] Error counting contrastive similar comments:', error);
        return { count: 0, examples: [] };
    }
}
