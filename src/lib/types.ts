export interface SemanticSearch {
    id: string;
    title: string;
    examples: Array<{
        comment?: string; // Legacy format support
        embedding?: number[]; // Legacy format support
        include?: Array<{
            comment: string;
            embedding: number[];
        }>;
        exclude?: Array<{
            comment: string;
            embedding: number[];
        }>;
    }>;
    createdAt: string;
    category: string;
    isDefault?: boolean;
}

export interface SemanticSearchResult {
    id: string;
    text: string;
    authorName: string;
    authorAvatarUrl: string;
    timestamp: string;
    platformId: string;
    likes: number;
    similarity: number;
    sentiment?: string;
    isReply: boolean;
    replyCount: number;
}


export interface AnalysisData {
    project: {
        id: string;
        name: string;
        title: string;
        status: string;
        totalComments: number;
    };
    summary: {
        clusters: Array<{
            name: string;
            commentIDs: string[];
        }>;
        sentimentBreakdown: {
            positive: number;
            negative: number;
            neutral: number;
        };
    };
    comments: Array<{
        id: string;
        text: string;
        authorName: string;
        timestamp: string;
        platformId: string;
        likes: number;
        sentiment: string;
        embedding: number[];
        replies?: Array<AnalysisData["comments"][0]>;
    }>;
}


export interface YouTubeVideo {
    id: string;
    title: string;
    thumbnailUrl: string;
    commentCount?: number;
}

export interface YouTubeComment {
    id: string;
    text: string;
    authorName: string;
    authorAvatarUrl: string;
    timestamp: Date;
    likeCount: number;
    isReply: boolean;
    replyCount: number;
}