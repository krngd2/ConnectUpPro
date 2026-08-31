"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThumbsUp, MessageSquare, Search, Cloud } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { EnhancedHooksType } from "../../analysis-view";
import { AnalysisData } from "@/lib/analysis";
import { SemanticSearchResult } from "@/lib/types";
import { WordCloud } from "./WordCloud";

interface WordFiltersProps {
  hooks: EnhancedHooksType;
  selectedWord: string;
  setSelectedWord: (word: string) => void;
  expandedThreads: Set<string>;
  setExpandedThreads: (threads: Set<string>) => void;
}

export function WordFilters({
  hooks,
  selectedWord,
  setSelectedWord,
  expandedThreads,
  setExpandedThreads,
}: WordFiltersProps) {
  // Local state for dynamic words only
  const [dynamicWords, setDynamicWords] = useState<string[]>(["all"]);

  // Store the latest generated words for components to access
  const [latestDynamicWords, setLatestDynamicWords] = useState<string[]>([
    "all",
  ]);

  // Word cloud modal state
  const [showWordCloud, setShowWordCloud] = useState<boolean>(false);
  const [wordCloudData, setWordCloudData] = useState<
    Array<{ word: string; count: number }>
  >([]);

  const {
    selectedComments,
    setSelectedComments,
    selectedCluster,
    clusterComments,
    handleCreateSemanticSearchFromSelected,
    handleBulkAction,
    filterReferenceComments,
    similarComments,
    loadingComments,
    streamingComments,
    currentAnalysisData,
    selectedSemanticSearch,
    semanticSearchResults,
    loadingSemanticResults,
    loadingSimilarComments,
  } = hooks;

  // Unified loading flag and UI-friendly delay to ensure shimmer is visible briefly
  const unifiedLoading =
    loadingComments ||
    streamingComments ||
    loadingSemanticResults ||
    loadingSimilarComments;
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const loadingStartRef = useRef<number | null>(null);

  useEffect(() => {
    const MIN_SHOW_MS = 350; // ensure shimmer is visible briefly for perception
    if (unifiedLoading) {
      loadingStartRef.current = Date.now();
      setShowLoadingUI(true);
      return;
    }
    // not loading -> hide after minimum duration
    const startedAt = loadingStartRef.current;
    if (!startedAt) {
      setShowLoadingUI(false);
      return;
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed >= MIN_SHOW_MS) {
      setShowLoadingUI(false);
    } else {
      const t = setTimeout(() => setShowLoadingUI(false), MIN_SHOW_MS - elapsed);
      return () => clearTimeout(t);
    }
  }, [unifiedLoading]);

  // Update local words when hook provides new ones
  useEffect(() => {
    setDynamicWords(latestDynamicWords);
  }, [latestDynamicWords]);

  // Reset selected word and dynamic words when changing view
  useEffect(() => {
    console.log('[WordFilters] View changed, resetting filters');
    setSelectedWord("all");
    setDynamicWords(["all"]);
    setLatestDynamicWords(["all"]);
  }, [
    selectedCluster,
    selectedSemanticSearch,
    filterReferenceComments.length,
    setSelectedWord,
  ]);

  // Debug loading states
  useEffect(() => {
    console.log('[WordFilters] Loading states:', {
      loadingComments,
      streamingComments,
      loadingSemanticResults,
      loadingSimilarComments,
      dynamicWordsLength: dynamicWords.length,
      dynamicWords
    });
  }, [loadingComments, streamingComments, loadingSemanticResults, loadingSimilarComments, dynamicWords]);

  // Memoize the word generation function to prevent unnecessary recreations
  const generateDynamicWords = useCallback((): string[] => {
    console.log("generateDynamicWords called");

    // Determine which comments to use based on current filter state
    let commentsToAnalyze: Array<
      AnalysisData["comments"][0] | SemanticSearchResult
    > = [];

    if (filterReferenceComments.length > 0 && similarComments.length > 0) {
      commentsToAnalyze = similarComments;
      console.log("Using similarComments:", similarComments.length);
    } else if (selectedSemanticSearch && semanticSearchResults.length > 0) {
      commentsToAnalyze = semanticSearchResults;
      console.log("Using semanticSearchResults:", semanticSearchResults.length);
    } else if (selectedCluster && clusterComments.length > 0) {
      commentsToAnalyze = clusterComments;
      console.log("Using clusterComments:", clusterComments.length);
    } else {
      commentsToAnalyze = currentAnalysisData.comments || [];
      console.log(
        "Using currentAnalysisData.comments:",
        currentAnalysisData.comments?.length || 0
      );
    }

    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "must",
      "shall",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "her",
      "its",
      "our",
      "their",
      "mine",
      "yours",
      "hers",
      "ours",
      "theirs",
      "what",
      "where",
      "when",
      "why",
      "how",
      "who",
      "which",
      "whose",
      "whom",
      "up",
      "down",
      "out",
      "off",
      "over",
      "under",
      "again",
      "further",
      "then",
      "once",
      "here",
      "there",
      "everywhere",
      "anywhere",
      "somewhere",
      "nowhere",
      "now",
      "then",
      "today",
      "yesterday",
      "tomorrow",
      "always",
      "never",
      "often",
      "sometimes",
      "very",
      "too",
      "so",
      "just",
      "only",
      "even",
      "also",
      "still",
      "already",
      "yet",
      "not",
      "no",
      "yes",
      "maybe",
      "perhaps",
      "probably",
      "certainly",
      "definitely",
      "all",
      "some",
      "any",
      "many",
      "much",
      "few",
      "little",
      "more",
      "most",
      "less",
      "least",
      "good",
      "bad",
      "great",
      "nice",
      "awesome",
      "amazing",
      "cool",
      "wow",
      "lol",
      "haha",
      "yeah",
      "ok",
      "okay",
      "like",
      "love",
      "get",
      "make",
      "made",
      "take",
      "come",
      "go",
      "see",
      "know",
      "think",
      "feel",
      "look",
      "way",
      "time",
      "day",
      "year",
      "work",
      "life",
      "man",
      "woman",
      "people",
      "world",
      "place",
      "thing",
      "really",
      "actually",
      "probably",
      "definitely",
      "absolutely",
      "totally",
      "completely",
      "literally",
      // Common internet/video comment words
      "video",
      "comment",
      "comments",
      "watch",
      "watching",
      "watched",
      "channel",
      "subscribe",
      "first",
      "guys",
      "thanks",
      "thank",
      "please",
      "right",
      "true",
      "false",
      "said",
      "says",
      "saying",
      "want",
      "need",
      "hope",
      "better",
      "best",
      "worst",
      "pretty",
      "stupid",
      "smart",
      "funny",
      "back",
      "keep",
      "going",
      "find",
      "found",
      "tell",
      "told",
      "long",
      "short",
      "same",
      "different",
      "new",
      "old",
      "big",
      "small",
      "high",
      "low",
      "next",
      "last",
      "first",
      "second",
      "third",
      "other",
      "another",
      "each",
      "every",
      "both",
      "either",
      "neither",
      "such",
      "same",
      "own",
      "while",
      "during",
      "before",
      "after",
      "above",
      "below",
      "between",
      "through",
      "into",
      "from",
      "part",
      "parts",
      "whole",
      "point",
      "points",
      "fact",
      "facts",
      "case",
      "cases",
      "example",
      "examples",
    ]);

    const wordFrequency: { [key: string]: number } = {};

    if (commentsToAnalyze.length === 0) {
      console.log("No comments available for word generation");
      return ["all"];
    }

    // Extract words from all comments
    commentsToAnalyze.forEach((comment) => {
      // Process main comment text
      const words = comment.text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 4 && // Minimum 4 characters for more meaningful words
            !stopWords.has(word) && // Not a stop word
            !/^\d+$/.test(word) && // Not just numbers
            /^[a-z]+$/.test(word) && // Only alphabetic characters (no mixed alphanumeric)
            // Additional filters for more meaningful words
            (!word.endsWith("ing") || word.length > 6) && // Skip short -ing words unless they're longer
            (!word.endsWith("tion") || word.length > 7) // Skip short -tion words unless they're longer
        );

      words.forEach((word) => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });

      // Process replies if they exist (only for AnalysisData comments, not SemanticSearchResult)
      if ("replies" in comment && comment.replies) {
        comment.replies.forEach((reply: AnalysisData["comments"][0]) => {
          const replyWords = reply.text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(
              (word: string) =>
                word.length >= 4 &&
                !stopWords.has(word) &&
                !/^\d+$/.test(word) &&
                /^[a-z]+$/.test(word) &&
                // Additional filters for more meaningful words
                (!word.endsWith("ing") || word.length > 6) && // Skip short -ing words unless they're longer
                (!word.endsWith("tion") || word.length > 7) // Skip short -tion words unless they're longer
            );

          replyWords.forEach((word: string) => {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
          });
        });
      }
    });

    // Sort by frequency and get top 5-6 meaningful words with minimum frequency threshold
    const minimumFrequency = Math.max(
      2,
      Math.floor(commentsToAnalyze.length * 0.02)
    ); // At least 2% of comments or minimum 2
    const sortedWords = Object.entries(wordFrequency)
      .filter(([, count]) => count >= minimumFrequency) // Only include words that appear frequently enough
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6) // Get top 6 words instead of 3
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1)); // Capitalize first letter

    // Create dynamic words: only 'all' and top words (no sentiment words)
    const words = ["all", ...sortedWords];

    // Log for debugging
    console.log("Generated dynamic words:", words);
    console.log(
      "Word frequencies (top 10):",
      Object.entries(wordFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    );

    return words;
  }, [
    clusterComments,
    currentAnalysisData.comments,
    filterReferenceComments,
    selectedCluster,
    selectedSemanticSearch,
    semanticSearchResults,
    similarComments,
  ]);

  // Generate dynamic words only when comments finish loading completely
  useEffect(() => {
    // Always regenerate words when any comment source changes
    // Don't wait for loading to finish - regenerate as comments stream in
    const hasComments =
      (clusterComments && clusterComments.length > 0) ||
      (currentAnalysisData.comments &&
        currentAnalysisData.comments.length > 0) ||
      (semanticSearchResults && semanticSearchResults.length > 0) ||
      (similarComments && similarComments.length > 0);

    if (hasComments) {
      const words = generateDynamicWords();
      setLatestDynamicWords(words);
    }
  }, [
    clusterComments,
    currentAnalysisData.comments,
    semanticSearchResults,
    similarComments,
    filterReferenceComments.length,
    selectedSemanticSearch,
    selectedCluster,
    loadingComments,
    streamingComments,
    generateDynamicWords,
  ]);

  // Helper function to get comment count with current selected word
  const getCommentCount = (word: string) => {
    return getCommentCountForWord(word);
  };

  // Get count of comments for a specific word
  const getCommentCountForWord = (word: string) => {
    // Get the current visible comments based on what's being displayed
    let currentComments: Array<
      AnalysisData["comments"][0] | SemanticSearchResult
    > = [];

    if (filterReferenceComments.length > 0 && similarComments.length > 0) {
      currentComments = similarComments;
    } else if (selectedSemanticSearch && semanticSearchResults.length > 0) {
      currentComments = semanticSearchResults;
    } else if (selectedCluster && clusterComments.length > 0) {
      currentComments = clusterComments;
    } else {
      currentComments = currentAnalysisData.comments || [];
    }

    if (word === "all") {
      return currentComments.length;
    }

    // Check if it's a word-based word (search in comment text)
    return currentComments.filter((comment) =>
      comment.text.toLowerCase().includes(word.toLowerCase())
    ).length;
  };

  // Generate word cloud data for all meaningful words with their frequencies
  const handleOpenWordCloud = useCallback(() => {
    // Get all comments from current source
    let currentComments: Array<
      AnalysisData["comments"][0] | SemanticSearchResult
    > = [];

    if (filterReferenceComments.length > 0 && similarComments.length > 0) {
      currentComments = similarComments;
    } else if (selectedSemanticSearch && semanticSearchResults.length > 0) {
      currentComments = semanticSearchResults;
    } else if (selectedCluster && clusterComments.length > 0) {
      currentComments = clusterComments;
    } else {
      currentComments = currentAnalysisData.comments || [];
    }

    // Build word frequency map (same logic as generateDynamicWords but include all words)
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "must",
      "shall",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "its",
      "our",
      "their",
      "what",
      "where",
      "when",
      "why",
      "how",
      "who",
      "which",
      "whose",
      "whom",
    ]);

    const wordFrequency: { [key: string]: number } = {};

    currentComments.forEach((comment) => {
      const words = comment.text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 4 &&
            !stopWords.has(word) &&
            !/^\d+$/.test(word) &&
            /^[a-z]+$/.test(word)
        );

      words.forEach((word) => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });

      if ("replies" in comment && comment.replies) {
        comment.replies.forEach((reply: AnalysisData["comments"][0]) => {
          const replyWords = reply.text
            .toLowerCase()
            .replace(/[^\w\s]/g, " ")
            .split(/\s+/)
            .filter(
              (word: string) =>
                word.length >= 4 &&
                !stopWords.has(word) &&
                !/^\d+$/.test(word) &&
                /^[a-z]+$/.test(word)
            );

          replyWords.forEach((word: string) => {
            wordFrequency[word] = (wordFrequency[word] || 0) + 1;
          });
        });
      }
    });

    // Sort by frequency and convert to array format for display
    const data = Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50) // Top 50 words for word cloud
      .map(([word, count]) => ({
        word: word.charAt(0).toUpperCase() + word.slice(1),
        count,
        // Add random positioning for scatter chart (distributed across the space)
        x: Math.random() * 100,
        y: Math.random() * 100,
      }));

    setWordCloudData(data);
    setShowWordCloud(true);
  }, [
    clusterComments,
    currentAnalysisData.comments,
    filterReferenceComments,
    selectedCluster,
    selectedSemanticSearch,
    semanticSearchResults,
    similarComments,
  ]);

  return (
    <div className="flex items-center justify-between p-6">
      {selectedComments.length === 0 && !filterReferenceComments?.length ? (
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {showLoadingUI ? (
                <Skeleton className="h-7 w-7 rounded-md" />
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenWordCloud}
                        className="h-7 px-2 flex items-center gap-1"
                      >
                        <Cloud className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View word cloud visualization</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex gap-1 flex-wrap">
                {showLoadingUI ? (
                  // Show skeleton loaders when loading
                  <>
                    <Skeleton className="h-7 w-16 rounded-full" />
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-12 rounded-full" />
                    <Skeleton className="h-7 w-28 rounded-full" />
                  </>
                ) : (
                  dynamicWords
                    .filter((word) => {
                      // Always show "all", but filter out other words with 0 count
                      if (word === "all") return true;
                      const count = getCommentCount(word);
                      return count > 0;
                    })
                    .map((word) => {
                      const count = getCommentCount(word);
                      const isWordCategory = word !== "all";

                      return (
                        <button
                          key={word}
                          onClick={() => setSelectedWord(word)}
                          className={`px-3 py-1 text-xs rounded-full capitalize flex items-center gap-1 transition-colors ${
                            selectedWord === word
                              ? isWordCategory
                                ? "bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-100/20 dark:text-purple-300 dark:border-purple-300/50"
                                : "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-100/20 dark:text-blue-300 dark:border-blue-300/50"
                              : isWordCategory
                              ? "bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 dark:bg-purple-50/10 dark:text-purple-400 dark:hover:bg-purple-100/20 dark:border-purple-200/30"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted/80"
                          }`}
                          title={
                            isWordCategory
                              ? `Filter by comments containing "${word.toLowerCase()}"`
                              : "Show all comments"
                          }
                        >
                          <span>{word}</span>
                          <span className="text-xs font-medium opacity-75">
                            ({count})
                          </span>
                        </button>
                      );
                    })
                )}
              </div>
              {!showLoadingUI && dynamicWords.some((cat) => cat !== "all") && (
                <div className="text-xs text-muted-foreground ml-2">
                  <span className="text-purple-600 dark:text-purple-400">
                    ●
                  </span>{" "}
                  Most frequent words
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedCluster && clusterComments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const commentsWithReplies = clusterComments.filter(
                    (c) => c.replies && c.replies.length > 0
                  );
                  if (expandedThreads.size === commentsWithReplies.length) {
                    setExpandedThreads(new Set());
                  } else {
                    setExpandedThreads(
                      new Set(commentsWithReplies.map((c) => c.id))
                    );
                  }
                }}
              >
                {expandedThreads.size > 0 ? "Collapse All" : "Expand All"}
              </Button>
            )}
          </div>
        </>
      ) : filterReferenceComments?.length > 0 && similarComments.length > 0 ? (
        // Show "Create Semantic Search" when similarity filtering is active
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {similarComments.length} similar comment
                {similarComments.length !== 1 ? "s" : ""} found
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSemanticSearchFromSelected}
            >
              <Search className="h-4 w-4 mr-2" />
              Create Semantic Search ({filterReferenceComments.length})
            </Button>
          </div>
        </>
      ) : (
        // Show bulk actions when comments are selected
        <>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedComments.length} comment
                {selectedComments.length !== 1 ? "s" : ""} selected
              </span>
              <button
                onClick={() => setSelectedComments([])}
                className="text-xs text-primary hover:text-primary/80 underline"
              >
                Clear selection
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction("like")}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Like Selected ({selectedComments.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction("reply")}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Reply to Selected ({selectedComments.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSemanticSearchFromSelected}
            >
              <Search className="h-4 w-4 mr-2" />
              Create Semantic Search ({selectedComments.length})
            </Button>
            {selectedCluster && clusterComments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const commentsWithReplies = clusterComments.filter(
                    (c) => c.replies && c.replies.length > 0
                  );
                  if (expandedThreads.size === commentsWithReplies.length) {
                    setExpandedThreads(new Set());
                  } else {
                    setExpandedThreads(
                      new Set(commentsWithReplies.map((c) => c.id))
                    );
                  }
                }}
              >
                {expandedThreads.size > 0 ? "Collapse All" : "Expand All"}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Word Cloud Modal */}
      {showWordCloud && (
        <WordCloud
          setShowWordCloud={setShowWordCloud}
          setSelectedWord={setSelectedWord}
          wordCloudData={wordCloudData}
        />
      )}
    </div>
  );
}
