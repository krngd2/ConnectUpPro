// Sentiment analysis types
export interface SentimentCategoryResult {
    category: string;
    title: string;
    count: number;
    semanticSearchId: string;
}

export interface SentimentAnalysisResult {
    totalComments: number;
    analyzedAt: string;
    categories: SentimentCategoryResult[];
    threshold: number;
}
