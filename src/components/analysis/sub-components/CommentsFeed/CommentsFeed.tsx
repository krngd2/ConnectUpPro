"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { AnalysisData } from "@/lib/analysis";
import {
  ArrowDown,
  ArrowUp,
  ThumbsUp,
  MessageSquare,
  Loader2,
  Filter,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EnhancedHooksType } from "../../analysis-view";
import { CommentItem } from "./CommentItem";
import { WordFilters } from "./WordFilters";
import { SemanticSearchResult } from "@/lib/types";

interface CommentsFeedProps {
  hooks: EnhancedHooksType;
  selectedCategory?: string;
}

// Comment Skeleton Component
const CommentSkeleton = () => (
  <div className="border border-border rounded-lg p-4 bg-card">
    <div className="flex gap-3">
      {/* Avatar skeleton */}
      <div className="w-10 h-10 bg-muted animate-shimmer rounded-full flex-shrink-0"></div>

      {/* Comment content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <div className="h-4 bg-muted animate-shimmer rounded w-32"></div>
          <div className="h-4 bg-muted animate-shimmer rounded w-20"></div>
        </div>
        <div className="h-4 bg-muted animate-shimmer rounded w-full"></div>
        <div className="h-4 bg-muted animate-shimmer rounded w-4/5"></div>
        <div className="flex gap-3 mt-2">
          <div className="h-4 bg-muted animate-shimmer rounded w-16"></div>
          <div className="h-4 bg-muted animate-shimmer rounded w-16"></div>
        </div>
      </div>
    </div>
  </div>
);

// Loading Skeleton for multiple comments
const CommentsLoadingSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <CommentSkeleton key={i} />
    ))}
  </div>
);

// Simple Virtual List Component for performance
const VirtualCommentList = React.memo(
  ({
    comments,
    renderComment,
  }: {
    comments: (AnalysisData["comments"][0] | SemanticSearchResult)[];
    renderComment: (
      comment: AnalysisData["comments"][0] | SemanticSearchResult
    ) => React.ReactNode;
  }) => {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
    const containerRef = useRef<HTMLDivElement>(null);
    // Estimated row height (px). Includes item + spacing.
    const ESTIMATED_ROW_HEIGHT = 180;
    const OVERSCAN = 10;

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateRange = () => {
        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        const totalItems = comments.length;

        // Derive start index from scrollTop and estimated row height.
        const itemsPerViewport = Math.max(
          1,
          Math.ceil(clientHeight / ESTIMATED_ROW_HEIGHT) + 3 // render a few extra to avoid bottom gaps
        );
        let start = Math.max(
          0,
          Math.floor(scrollTop / ESTIMATED_ROW_HEIGHT) - OVERSCAN
        );
        let end = Math.min(
          totalItems,
          start + itemsPerViewport + OVERSCAN * 2
        );

        // If we've reached the end but the viewport isn't filled due to under-estimation,
        // backfill the start so we render enough items to cover the viewport.
        if (end >= totalItems) {
          const desiredCount = itemsPerViewport + OVERSCAN * 2;
          start = Math.max(0, totalItems - desiredCount);
          end = totalItems;
        }

        setVisibleRange({ start, end });
      };

      // Initial computation and on scroll/resize.
      updateRange();
      const onScroll = () => updateRange();
      const onResize = () => updateRange();
      container.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      return () => {
        container.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      };
    }, [comments.length]);

    const visibleComments = comments.slice(
      visibleRange.start,
      visibleRange.end
    );

    return (
      <div
        ref={containerRef}
        className="space-y-4 max-h-[600px] overflow-y-auto"
        style={{ minHeight: "400px" }}
      >
        {/* Spacer for items before visible range */}
        {visibleRange.start > 0 && (
          <div style={{ height: `${Math.max(0, visibleRange.start) * ESTIMATED_ROW_HEIGHT}px` }} />
        )}

        {visibleComments.map((comment) => (
          <div key={comment.id}>{renderComment(comment)}</div>
        ))}

        {/* Spacer for items after visible range */}
        {visibleRange.end < comments.length && (
          <div
            style={{
              height: `${Math.max(0, comments.length - visibleRange.end) * ESTIMATED_ROW_HEIGHT}px`,
            }}
          />
        )}
      </div>
    );
  }
);

VirtualCommentList.displayName = "VirtualCommentList";

// Reusable Filter/Sort Controls Component
const CommentControls = React.memo(
  ({
    title,
    count,
    // sortOrder,
    replyFilter,
    onSortChange,
    onReplyFilterChange,
    getSortButtonContent,
  }: {
    title: string;
    count: number;
    sortOrder: "newest" | "oldest" | "liked" | "similarity";
    replyFilter: "all" | "main" | "replies";
    onSortChange: () => void;
    onReplyFilterChange: (filter: "all" | "main" | "replies") => void;
    getSortButtonContent: () => {
      icon: React.ReactNode;
      label: string;
      title: string;
    };
  }) => {
    const buttonContent = getSortButtonContent();
    return (
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          {title} ({count} {count === 1 ? "comment" : "comments"})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSortChange}
            className="h-7 px-2 text-xs flex items-center gap-1"
            title={buttonContent.title}
          >
            {buttonContent.icon}
            {buttonContent.label}
          </Button>
          <span className="text-xs text-muted-foreground">Show:</span>
          <div className="flex items-center gap-1">
            <Button
              variant={replyFilter === "all" ? "outline" : "default"}
              size="sm"
              onClick={() => onReplyFilterChange("all")}
              className="h-7 px-2 text-xs"
            >
              All
            </Button>
            <Button
              variant={replyFilter === "main" ? "outline" : "default"}
              size="sm"
              onClick={() => onReplyFilterChange("main")}
              className="h-7 px-2 text-xs"
            >
              Main
            </Button>
            <Button
              variant={replyFilter === "replies" ? "outline" : "default"}
              size="sm"
              onClick={() => onReplyFilterChange("replies")}
              className="h-7 px-2 text-xs"
            >
              Replies
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

CommentControls.displayName = "CommentControls";

export function CommentsFeed({ hooks }: CommentsFeedProps) {
  // Shared state for category filtering between components
  const [selectedWord, setSelectedWord] = useState<string>("all");
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    new Set()
  );

  const [replyFilter, setReplyFilter] = useState<
    "all" | "main" | "replies"
  >("all");
  const [sortOrder, setSortOrder] = useState<
    "newest" | "oldest" | "liked" | "similarity"
  >("liked");
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(
    null
  );

  const {
    currentAnalysisData,
    loadingSimilarComments,
    filterReferenceComments,
    similarComments,
    selectedSemanticSearch,
    loadingSemanticResults,
    semanticSearchResults,
    selectedCluster,
    loadingComments,
    streamingComments,
    streamingExpectedTotal,
    clusterComments,
    selectedComments,
    setSelectedComments,
    handleFilterCommentsBySimilarity,
    clearSimilarityFilter,
    removeReferenceComment,
    videoId,
  } = hooks;

  // Set sort order to "similarity" when semantic search is active
  useEffect(() => {
    if (selectedSemanticSearch && semanticSearchResults.length > 0) {
      setSortOrder("similarity");
    }
  }, [selectedSemanticSearch, semanticSearchResults.length]);

  // Reset selectedWord when switching between different views
  useEffect(() => {
    setSelectedWord("all");
  }, [selectedCluster?.id, selectedSemanticSearch, filterReferenceComments.length]);

  // Fetch YouTube video ID when component mounts
  useEffect(() => {
    const fetchVideoDetails = async () => {
      try {
        const response = await fetch(`/api/videos/${videoId}/analysis`);
        if (response.ok) {
          const result = await response.json();
          const videoUrl = result.data.video.url;
          // Extract YouTube video ID from URL
          const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
          ];

          for (const pattern of patterns) {
            const match = videoUrl.match(pattern);
            if (match) {
              setYoutubeVideoId(match[1]);
              break;
            }
          }
        }
      } catch (error) {
        console.error("Error fetching video details:", error);
      }
    };

    if (videoId) {
      fetchVideoDetails();
    }
  }, [videoId]);

  // Function to generate YouTube comment URL
  const getYoutubeCommentUrl = useCallback(
    (comment: AnalysisData["comments"][0] | SemanticSearchResult) => {
      if (!youtubeVideoId) return null;

      const platformId = comment.platformId;
      if (!platformId) return null;

      return `https://www.youtube.com/watch?v=${youtubeVideoId}&lc=${platformId}`;
    },
    [youtubeVideoId]
  );

  const getAuthorName = (
    comment: AnalysisData["comments"][0] | SemanticSearchResult
  ) => {
    return "authorName" in comment ? comment.authorName : comment.author;
  };

  const getTimestamp = (
    comment: AnalysisData["comments"][0] | SemanticSearchResult
  ) => {
    if ("authorName" in comment) {
      // This is SemanticSearchResult
      return new Date(comment.timestamp).toLocaleDateString();
    } else {
      // This is AnalysisData comment
      return comment.timestamp;
    }
  };

  const filterCommentsByReplyStatus = useCallback(
    (comments: (AnalysisData["comments"][0] | SemanticSearchResult)[]) => {
      if (replyFilter === "all") return comments;
      if (replyFilter === "main")
        return comments.filter(
          (comment) => !("isReply" in comment) || !comment.isReply
        );
      if (replyFilter === "replies")
        return comments.filter(
          (comment) => "isReply" in comment && comment.isReply
        );
      return comments;
    },
    [replyFilter]
  );

  const getNextSortOrder = useCallback(() => {
    // If we're in semantic search mode, cycle through all 4 options
    if (selectedSemanticSearch && semanticSearchResults.length > 0) {
      if (sortOrder === "similarity") return "newest";
      if (sortOrder === "newest") return "oldest";
      if (sortOrder === "oldest") return "liked";
      return "similarity"; // "liked" -> "similarity"
    }

    // Otherwise, cycle through the original 3 options
    if (sortOrder === "newest") return "oldest";
    if (sortOrder === "oldest") return "liked";
    return "newest"; // "liked" -> "newest"
  }, [sortOrder, selectedSemanticSearch, semanticSearchResults.length]);

  const getSortButtonContent = useCallback(() => {
    switch (sortOrder) {
      case "similarity":
        return {
          icon: <Filter className="h-3 w-3" />,
          label: "Similarity",
          title: "Sort by newest first",
        };
      case "newest":
        return {
          icon: <ArrowDown className="h-3 w-3" />,
          label: "Newest",
          title: "Sort by oldest first",
        };
      case "oldest":
        return {
          icon: <ArrowUp className="h-3 w-3" />,
          label: "Oldest",
          title: "Sort by most liked first",
        };
      case "liked":
        return {
          icon: <ThumbsUp className="h-3 w-3" />,
          label: "Most Liked",
          title:
            selectedSemanticSearch && semanticSearchResults.length > 0
              ? "Sort by similarity"
              : "Sort by newest first",
        };
      default:
        return {
          icon: <ArrowDown className="h-3 w-3" />,
          label: "Newest",
          title: "Sort by oldest first",
        };
    }
  }, [sortOrder, selectedSemanticSearch, semanticSearchResults.length]);

  const sortComments = useCallback(
    (comments: (AnalysisData["comments"][0] | SemanticSearchResult)[]) => {
      return [...comments].sort((a, b) => {
        if (sortOrder === "similarity") {
          // Sort by similarity score (highest first) - only for similarity search results
          const similarityA = "similarity" in a ? a.similarity : 0;
          const similarityB = "similarity" in b ? b.similarity : 0;
          return similarityB - similarityA;
        }

        if (sortOrder === "liked") {
          // Sort by likes (highest first)
          const likesA = a.likes || 0;
          const likesB = b.likes || 0;
          return likesB - likesA;
        }

        // Get timestamp for comparison
        const getCommentTimestamp = (
          comment: AnalysisData["comments"][0] | SemanticSearchResult
        ) => {
          if ("authorName" in comment) {
            // SemanticSearchResult - timestamp is a string
            return new Date(comment.timestamp).getTime();
          } else {
            // AnalysisData comment - use rawTimestamp if available, otherwise parse the formatted timestamp
            if (comment.rawTimestamp) {
              // Handle case where rawTimestamp might be a string or Date object
              const timestamp =
                comment.rawTimestamp instanceof Date
                  ? comment.rawTimestamp
                  : new Date(comment.rawTimestamp);
              return timestamp.getTime();
            }
            // Fallback: try to parse the formatted timestamp string
            const parsed = new Date(comment.timestamp);
            return isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
          }
        };

        const timestampA = getCommentTimestamp(a);
        const timestampB = getCommentTimestamp(b);

        return sortOrder === "newest"
          ? timestampB - timestampA // Newest first (descending)
          : timestampA - timestampB; // Oldest first (ascending)
      });
    },
    [sortOrder]
  );

  const toggleThread = useCallback((commentId: string) => {
    setExpandedThreads((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(commentId)) {
        newExpanded.delete(commentId);
      } else {
        newExpanded.add(commentId);
      }
      return newExpanded;
    });
  }, []);

  const renderComment = useCallback(
    (
      comment: AnalysisData["comments"][0] | SemanticSearchResult,
      isReply = false
    ) => {
      return (
        <CommentItem
          key={comment.id}
          comment={comment}
          isReply={isReply}
          isSelected={selectedComments.includes(comment.id)}
          youtubeVideoId={youtubeVideoId}
          expandedThreads={expandedThreads}
          onSelectComment={() => {
            setSelectedComments((prev) =>
              prev.includes(comment.id)
                ? prev.filter((id) => id !== comment.id)
                : [...prev, comment.id]
            );
          }}
          onFilterBySimilarity={() => handleFilterCommentsBySimilarity(comment)}
          onToggleThread={() => toggleThread(comment.id)}
          onOpenYoutube={() => {
            const url = getYoutubeCommentUrl(comment);
            if (url) {
              window.open(url, "_blank", "noopener,noreferrer");
            }
          }}
          loadingSimilarComments={loadingSimilarComments}
        />
      );
    },
    [
      selectedComments,
      youtubeVideoId,
      expandedThreads,
      setSelectedComments,
      handleFilterCommentsBySimilarity,
      getYoutubeCommentUrl,
      loadingSimilarComments,
      toggleThread,
    ]
  );

  // Filter comments based on selected category
  const filterCommentsByWord = <
    T extends AnalysisData["comments"][0] | SemanticSearchResult
  >(
    comments: T[],
    selectedCategory: string = "all"
  ): T[] => {
    if (selectedCategory === "all") {
      return comments;
    }

    // Check if it's a word-based category (search in comment text)
    return comments.filter((comment) => {
      const text = comment.text.toLowerCase();
      return text.includes(selectedCategory.toLowerCase());
    });
  };

  const renderFeedContent = () => {
    if (
      currentAnalysisData.project.status === "DOWNLOADING_COMMENTS" ||
      currentAnalysisData.project.status === "ANALYZING_COMMENTS"
    ) {
      return (
        <div className="space-y-4">
          {/* Status message */}
          <div className="text-center py-4">
            <p className="text-lg font-semibold text-foreground">
              Analysis in Progress
            </p>
            <p className="text-muted-foreground text-sm">
              Comments are being analyzed. This may take a few minutes.
            </p>
          </div>
          {/* Skeleton loading */}
          <CommentsLoadingSkeleton count={5} />
        </div>
      );
    }

    if (loadingSimilarComments) {
      return <CommentsLoadingSkeleton count={6} />;
    }

    if (filterReferenceComments?.length > 0) {
      return (
        <div className="space-y-4">
          {/* Clear filter button */}
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 dark:bg-gray-950/30 dark:border-gray-800/50">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300">
                Filtered by similarity to {filterReferenceComments.length}{" "}
                reference comment{filterReferenceComments.length > 1 ? "s" : ""}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSimilarityFilter}
              className="text-orange-600 border-orange-300 hover:bg-orange-100 dark:text-orange-400 dark:border-orange-600/50 dark:hover:bg-orange-900/50"
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filter
            </Button>
          </div>

          {/* Reference comments (highlighted) */}
          <div className="bg-gray-50/50 border-2 border-gray-200 rounded-lg p-4 dark:bg-gray-900/30 dark:border-gray-700 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Reference Comment{filterReferenceComments.length > 1 ? "s" : ""}{" "}
                ({filterReferenceComments.length})
              </span>
            </div>
            <div className="space-y-3">
              {filterReferenceComments.map((refComment, index) => (
                <div
                  key={refComment.id}
                  className="bg-gradient-to-r from-orange-50 to-orange-100/50 rounded-lg p-4 border-l-4 border-orange-500 shadow-sm dark:bg-gradient-to-r dark:from-gray-800 dark:to-gray-900/50 dark:border-orange-500"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {getAuthorName(refComment)}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {getTimestamp(refComment)}
                        </span>
                        <span className="text-xs font-medium text-orange-800 bg-orange-200/70 px-2 py-1 rounded-full dark:text-orange-200 dark:bg-orange-900/60 border border-orange-300 dark:border-orange-800">
                          Reference #{index + 1}
                        </span>
                      </div>
                      <div
                        className="text-sm text-gray-900 leading-relaxed break-words overflow-wrap-anywhere word-break max-w-full dark:text-gray-200"
                        style={{
                          wordBreak: "break-word",
                          overflowWrap: "anywhere",
                          hyphens: "auto",
                        }}
                      >
                        {refComment.text}
                      </div>
                    </div>
                    <div className="flex items-start gap-2 ml-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeReferenceComment(refComment.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-400 px-2 py-1 h-7 transition-colors border-red-200 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/50 dark:hover:border-red-600 dark:border-red-800"
                        title={`Remove "${refComment.text.substring(0, 30)}${
                          refComment.text.length > 30 ? "..." : ""
                        }" from references`}
                        disabled={loadingSimilarComments}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Similar comments */}
          {similarComments.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Similar Comments (sorted by average similarity to all
                  references)
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(getNextSortOrder())}
                    className="h-7 px-2 text-xs flex items-center gap-1"
                    title={getSortButtonContent().title}
                  >
                    {getSortButtonContent().icon}
                    {getSortButtonContent().label}
                  </Button>
                  <span className="text-xs text-muted-foreground">Show:</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={replyFilter === "all" ? "outline" : "default"}
                      size="sm"
                      onClick={() => setReplyFilter("all")}
                      className="h-7 px-2 text-xs"
                    >
                      All
                    </Button>
                    <Button
                      variant={replyFilter === "main" ? "outline" : "default"}
                      size="sm"
                      onClick={() => setReplyFilter("main")}
                      className="h-7 px-2 text-xs"
                    >
                      Main
                    </Button>
                    <Button
                      variant={
                        replyFilter === "replies" ? "outline" : "default"
                      }
                      size="sm"
                      onClick={() => setReplyFilter("replies")}
                      className="h-7 px-2 text-xs"
                    >
                      Replies
                    </Button>
                  </div>
                </div>
              </div>
              {(() => {
                const commentsToRender = sortComments(
                  filterCommentsByReplyStatus(
                    filterCommentsByWord(similarComments, selectedWord)
                  )
                );

                // Use virtual scrolling for large lists (>100 items)
                if (commentsToRender.length > 100) {
                  return (
                    <VirtualCommentList
                      comments={commentsToRender}
                      renderComment={renderComment}
                    />
                  );
                }

                // For smaller lists, render normally
                return (
                  <div className="space-y-4">
                    {commentsToRender.map((comment) => renderComment(comment))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>No similar comments found.</p>
              <p className="text-sm">
                Try selecting different reference comments or check if
                embeddings are available.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (selectedSemanticSearch && loadingSemanticResults) {
      return <CommentsLoadingSkeleton count={6} />;
    }

    if (
      selectedSemanticSearch &&
      semanticSearchResults.length === 0 &&
      !loadingSemanticResults
    ) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No comments found for this similarity search.
        </div>
      );
    }

    if (selectedSemanticSearch && semanticSearchResults.length > 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              Similarity Search Results
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(getNextSortOrder())}
                className="h-7 px-2 text-xs flex items-center gap-1"
                title={getSortButtonContent().title}
              >
                {getSortButtonContent().icon}
                {getSortButtonContent().label}
              </Button>
              <span className="text-xs text-muted-foreground">Show:</span>
              <div className="flex items-center gap-1">
                <Button
                  variant={replyFilter === "all" ? "outline":"default"}
                  size="sm"
                  onClick={() => setReplyFilter("all")}
                  className="h-7 px-2 text-xs"
                >
                  All
                </Button>
                <Button
                  variant={replyFilter === "main" ? "outline":"default"}
                  size="sm"
                  onClick={() => setReplyFilter("main")}
                  className="h-7 px-2 text-xs"
                >
                  Main
                </Button>
                <Button
                  variant={replyFilter === "replies" ? "outline":"default"}
                  size="sm"
                  onClick={() => setReplyFilter("replies")}
                  className="h-7 px-2 text-xs"
                >
                  Replies
                </Button>
              </div>
            </div>
          </div>
          {(() => {
            const commentsToRender = sortComments(
              filterCommentsByReplyStatus(
                filterCommentsByWord(semanticSearchResults, selectedWord)
              )
            );

            // Use virtual scrolling for large lists (>100 items)
            if (commentsToRender.length > 100) {
              return (
                <VirtualCommentList
                  comments={commentsToRender}
                  renderComment={renderComment}
                />
              );
            }

            // For smaller lists, render normally
            return (
              <div className="space-y-4">
                {commentsToRender.map((comment) => renderComment(comment))}
              </div>
            );
          })()}
        </div>
      );
    }

    if (!selectedCluster) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Select a topic from the sidebar or perform a semantic search to view related comments.
        </div>
      );
    }

    if (loadingComments && clusterComments.length === 0) {
      // Initial loading state (no comments yet)
      return <CommentsLoadingSkeleton count={6} />;
    }

    if ((loadingComments && clusterComments.length > 0) || streamingComments) {
      // Streaming mode - show comments as they load with progress indicator
      return (
        <div className="space-y-4">
          {/* Streaming progress indicator */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-2 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                Cluster Comments ({clusterComments.length} loaded)
              </h3>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-primary font-medium">
                  Loading...
                  {streamingExpectedTotal > 0 && (
                    <>
                      {Math.round(
                        (clusterComments.length / streamingExpectedTotal) * 100
                      )}
                      %
                    </>
                  )}
                </span>
              </div>
            </div>
            <div className="mt-2 bg-primary/20 rounded-full h-1.5 w-full">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{
                  width: `${
                    streamingExpectedTotal > 0
                      ? Math.min(
                          (clusterComments.length / streamingExpectedTotal) *
                            100,
                          100
                        )
                      : Math.min(
                          (clusterComments.length /
                            (currentAnalysisData.project.totalComments || 1)) *
                            100,
                          100
                        )
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Display comments as they stream in */}
          {(() => {
            const commentsToRender = sortComments(
              filterCommentsByReplyStatus(
                filterCommentsByWord(clusterComments, selectedWord)
              )
            );

            // Use virtual scrolling for large lists (>100 items)
            if (commentsToRender.length > 100) {
              return (
                <VirtualCommentList
                  comments={commentsToRender}
                  renderComment={renderComment}
                />
              );
            }

            // For smaller lists, render normally
            return (
              <div className="space-y-4">
                {commentsToRender.map((comment) => renderComment(comment))}
              </div>
            );
          })()}
        </div>
      );
    }

    if (clusterComments.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No comments found for this topic.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Cluster Comments ({clusterComments.length} total)
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(getNextSortOrder())}
              className="h-7 px-2 text-xs flex items-center gap-1"
              title={getSortButtonContent().title}
            >
              {getSortButtonContent().icon}
              {getSortButtonContent().label}
            </Button>
            <span className="text-xs text-muted-foreground">Show:</span>
            <div className="flex items-center gap-1">
              <Button
                variant={replyFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setReplyFilter("all")}
                className="h-7 px-2 text-xs"
              >
                All
              </Button>
              <Button
                variant={replyFilter === "main" ? "default" : "outline"}
                size="sm"
                onClick={() => setReplyFilter("main")}
                className="h-7 px-2 text-xs"
              >
                Main
              </Button>
              <Button
                variant={replyFilter === "replies" ? "default" : "outline"}
                size="sm"
                onClick={() => setReplyFilter("replies")}
                className="h-7 px-2 text-xs"
              >
                Replies
              </Button>
            </div>
          </div>
        </div>
        {(() => {
          const commentsToRender = sortComments(
            filterCommentsByReplyStatus(
              filterCommentsByWord(clusterComments, selectedWord)
            )
          );

          // Use virtual scrolling for large lists (>100 items)
          if (commentsToRender.length > 100) {
            return (
              <VirtualCommentList
                comments={commentsToRender}
                renderComment={renderComment}
              />
            );
          }

          // For smaller lists, render normally
          return (
            <div className="space-y-4">
              {commentsToRender.map((comment) => renderComment(comment))}
            </div>
          );
        })()}
      </div>
    );
  };
 

  return (
    <>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
        <CardDescription>
          {filterReferenceComments?.length > 0
            ? `Showing comments similar to ${
                filterReferenceComments.length
              } selected reference comment${
                filterReferenceComments.length > 1 ? "s" : ""
              } (${
                filterCommentsByReplyStatus(similarComments).length
              } comments shown${
                replyFilter !== "all"
                  ? `, filtered to show ${
                      replyFilter === "main" ? "main comments" : "replies"
                    } only`
                  : ""
              })`
            : selectedSemanticSearch && semanticSearchResults.length > 0
            ? `Similarity search results (${
                filterCommentsByReplyStatus(semanticSearchResults).length
              } comments shown${
                replyFilter !== "all"
                  ? `, filtered to show ${
                      replyFilter === "main" ? "main comments" : "replies"
                    } only`
                  : ""
              })`
            : selectedCluster
            ? `Topic: ${selectedCluster.name} (${
                filterCommentsByReplyStatus(clusterComments).length
              } comments shown${
                replyFilter !== "all"
                  ? `, filtered to show ${
                      replyFilter === "main" ? "main comments" : "replies"
                    } only`
                  : ""
              })`
            : "Select a topic from the sidebar or perform a similarity search to view related comments"}
        </CardDescription>
      </CardHeader>
      <Card>
        {(selectedCluster || selectedSemanticSearch) && <WordFilters
          hooks={hooks}
          selectedWord={selectedWord}
          setSelectedWord={setSelectedWord}
          expandedThreads={expandedThreads}
          setExpandedThreads={setExpandedThreads}
        />}
        <CardContent className="overflow-hidden max-w-full">
          {renderFeedContent()}
        </CardContent>
      </Card>
    </>
  );
}
