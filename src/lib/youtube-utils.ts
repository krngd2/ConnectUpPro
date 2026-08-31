// Client-safe YouTube utilities (no server dependencies)


/**
 * Extract video ID from YouTube URL - Client-safe version
 */
export function extractVideoIdFromYTUrl(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * Check if a YouTube URL is valid
 */
export function isValidYouTubeUrl(url: string): boolean {
    return extractVideoIdFromYTUrl(url) !== null;
}