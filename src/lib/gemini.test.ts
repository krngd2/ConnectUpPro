
// // import { ClusterComments, clusterEmbeddings } from './gemini.ts'
// // import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
// import { kmeans } from 'ml-kmeans';
// import { PCA } from 'ml-pca'; 

// const comments = [
//     "This is a great video!",
//     "I learned a lot from this tutorial.",
//     "The explanation was clear and concise.",
//     "I love the examples used in this video.",
//     "This video helped me understand the topic better.",
//     "I appreciate the effort put into making this content.",
//     "The visuals were very helpful.", 
//     // negative comments
//     "This video was boring.",
//     "I didn't find this video useful.",
//     "The content was not engaging.",
//     "I expected more from this tutorial.",
//     "The pacing was too slow.",
//     "I didn't like the presenter's style.",
//     // spammy comments
//     "Check out my channel for more videos!",
//     "Subscribe to my channel for daily content!",
//     "Follow me on Instagram for more updates!",
//     "Visit my website for exclusive content!",
//     "Join my Discord server for community discussions!",
//     // promotional comments
//     "Get 50% off on my course using code VIDEO50!",
//     "Download my free ebook on this topic!",
//     "Sign up for my newsletter for weekly tips!",
//     // video suggestions
//     "You should watch this related video!",
//     "This video reminds me of another great tutorial.",
//     "If you liked this, check out my other videos!",
//     "I recommend watching this video next.",
//     // feedback comments
//     "I think the video could be improved by adding more examples.",
//     "It would be great if you could cover this topic in more detail.",
//     "I would love to see a follow-up video on this subject.",
//     "The audio quality could be better.",
//     "The video was too long, it could be shorter.",
//     "I found the background music distracting.",
//     "The video was too short, I wanted more information.",
// ]

// /**
//  * Clusters embeddings using UMAP for dimensionality reduction and then K-means.
//  * @param embeddings - An array of 768-dimensional embedding vectors.
//  * @param numClusters - The target number of clusters (K for K-means).
//  * @param targetDimensionality - The intermediate dimensionality for UMAP.
//  * @returns An array of cluster labels corresponding to each embedding.
//  */
// export const clusterEmbeddings = (
//     embeddings: number[][],
//     numClusters: number,
//     targetDimensionality: number
// ) => {
//     if (embeddings.length <= 15) {
//         console.warn(`[Clustering] Only ${embeddings.length} embeddings, using simple clustering.`);
//         // Return a simple clustering (e.g., assign each to a cluster round-robin)
//         return embeddings.map((_, i) => i % numClusters);
//     }
//     console.log(`[DEBUG] Original embedding dimensions: ${embeddings[0].length}`);
//     try {
//         // Use PCA to reduce dimensionality to a reasonable size for K-means
//         const pcaDimensions = Math.min(Math.max(targetDimensionality, 10), embeddings.length - 1);
//         console.log(`[PCA] Reducing ${embeddings.length} embeddings from ${embeddings[0].length} to ${pcaDimensions} dimensions.`);
        
//         const pca = new PCA(embeddings);
//         const pcaResult = pca.predict(embeddings, { nComponents: pcaDimensions });
        
//         // Convert Matrix to regular array
//         const reducedEmbeddings: number[][] = [];
//         for (let i = 0; i < pcaResult.rows; i++) {
//             const row: number[] = [];
//             for (let j = 0; j < pcaResult.columns; j++) {
//                 row.push(pcaResult.get(i, j));
//             }
//             reducedEmbeddings.push(row);
//         }
        
//         console.log(`[PCA] Reduced embeddings shape: ${reducedEmbeddings.length} x ${reducedEmbeddings[0].length}`);

//         // Cluster the PCA-reduced embeddings directly with K-means (skip UMAP)
//         console.log(`[K-Means] Clustering PCA-reduced embeddings into ${numClusters} groups.`);
//         const kmeansResult = kmeans(reducedEmbeddings, numClusters, { seed: 42 });

//         return kmeansResult.clusters;
//     } catch (error) {
//         console.error('[Clustering] Error during clustering:', error);
//         // Fallback to simple clustering
//         console.log('[Clustering] Falling back to simple round-robin clustering');
//         return embeddings.map((_, i) => i % numClusters);
//     }
// };

// export async function clusterComments() {
//     // const clusters = await ClusterComments(comments, 3, apiKey);
//     // console.log('Clusters:', clusters);
//     // return clusters;
//     // read embeddings from a file
//     const embeddingsFromFile = JSON.parse(Deno.readTextFileSync('./embeddings.json'));
//     const embeddings = embeddingsFromFile.filter(
//         (e: unknown): e is number[] => Array.isArray(e) && e.length > 0
//     );
//     if (embeddings.length === 0) {
//         console.log('No valid embeddings found.');
//         return [];
//     }
    
//     // Validate and clean embeddings data
//     const cleanedEmbeddings = embeddings.map((embedding: number[], index: number) => {
//         // Check for NaN, Infinity, or undefined values
//         const cleanedEmbedding = embedding.map((val: number) => {
//             if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) {
//                 console.warn(`Invalid value found in embedding ${index}:`, val);
//                 return 0; // Replace with 0
//             }
//             return val;
//         });
//         return cleanedEmbedding;
//     });
    
//     console.log('Loaded embeddings:', cleanedEmbeddings.length);
//     console.log('Embedding dimensions:', cleanedEmbeddings[0]?.length);
    
//     const clusters = clusterEmbeddings(cleanedEmbeddings, 5, 5);
//     console.log('Clusters:', clusters);
//     const combinedComments = Array(5).fill(null).map(() => []);

//     clusters.forEach((clusterId, index) => {
//         combinedComments[clusterId].push(comments[index]);
//     });
//     console.log('Combined comments by cluster:', combinedComments); 
//     return combinedComments;
// }
// // Load environment variables from .env file
// await load({ export: true });

// // Access the environment variable using Deno.env
// // const apiKey = Deno.env.get("GOOGLE_API_KEY"); 

// // clusterComments().catch(console.error);