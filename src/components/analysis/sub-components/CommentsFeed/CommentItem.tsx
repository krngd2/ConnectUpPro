import React from "react";
import { AnalysisData } from "@/lib/analysis";
import { SemanticSearchResult } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Filter,
  ThumbsUp, 
} from "lucide-react";
import Image from "next/image";

// Memoized Comment Component for performance
export const CommentItem = React.memo(
  ({
    comment,
    isReply = false,
    isSelected,
    youtubeVideoId,
    expandedThreads,
    onSelectComment,
    onFilterBySimilarity,
    onToggleThread,
    onOpenYoutube,
    loadingSimilarComments,
  }: {
    comment: AnalysisData["comments"][0] | SemanticSearchResult;
    isReply: boolean;
    isSelected: boolean;
    youtubeVideoId: string | null;
    expandedThreads: Set<string>;
    onSelectComment: () => void;
    onFilterBySimilarity: () => void;
    onToggleThread: () => void;
    onOpenYoutube: () => void;
    loadingSimilarComments: boolean;
  }) => {
    const isActualReply = "isReply" in comment ? comment.isReply : isReply;

    const getAuthorName = (
      comment: AnalysisData["comments"][0] | SemanticSearchResult
    ) => {
      return "authorName" in comment ? comment.authorName : comment.author;
    };
 

    const getTimestamp = (
      comment: AnalysisData["comments"][0] | SemanticSearchResult
    ) => {
      if ("authorName" in comment) {
        // comment.timestamp is a Date object
        return formatTimeAgo(comment.timestamp);
      } else {
        // SemanticSearchResult already has formatted timestamp
        return comment.timestamp;
      }
    };

    // const getSentimentIcon = (sentiment?: string) => {
    //   switch (sentiment) {
    //     case "positive":
    //       return <Smile className="h-4 w-4 text-green-500" />;
    //     case "negative":
    //       return <Frown className="h-4 w-4 text-red-500" />;
    //     case "neutral":
    //       return <Meh className="h-4 w-4 text-gray-500" />;
    //     default:
    //       return <Meh className="h-4 w-4 text-gray-500" />;
    //   }
    // };

    return (
      <div
        className={`rounded-lg ${
          isSelected ? "ring-2 ring-primary/20 bg-primary/10" : ""
        } overflow-hidden`}
      >
        <div className="border-b border-border pb-2 last:border-b-0 max-w-full overflow-hidden">
          <div className="flex items-start space-x-4">
            {comment.authorAvatarUrl ? (
              <Image
                src={comment.authorAvatarUrl}
                alt={`${getAuthorName(comment)} avatar`}
                width={40}
                height={40}
                sizes="40px"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
                onClick={onSelectComment}
                className="h-10 w-10 rounded-full object-cover cursor-pointer"
              />
            ) : (
              <div
                className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground select-none"
                onClick={onSelectComment}
              >
                {getAuthorName(comment)?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">
                    {getAuthorName(comment)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getTimestamp(comment)}
                  </p>
                  {isActualReply && (
                    <div className="flex items-center gap-1">
                      <CornerDownRight className="h-3 w-3 text-primary" />
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                        Reply
                      </span>
                    </div>
                  )}
                  {"similarity" in comment && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {Math.round(comment.similarity * 100)}% similar
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* {getSentimentIcon(comment.sentiment)} */}
                  {youtubeVideoId && comment.platformId && (
                    <button
                      onClick={onOpenYoutube}
                      className="text-gray-500"
                      title="Open comment on YouTube"  
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-youtube-icon lucide-youtube"
                      >
                        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
                        <path d="m10 15 5-3-5-3z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <p
                className="mt-2 text-sm break-words overflow-wrap-anywhere word-break max-w-full"
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  hyphens: "auto",
                }}
              >
                {comment.text}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1 text-gray-500 text-xs">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{comment.likes}</span>
                </div>
                <button
                  onClick={onFilterBySimilarity}
                  className="flex items-center gap-1 hover:text-orange-600 cursor-pointer transition-colors text-gray-500"
                  disabled={loadingSimilarComments}
                >
                  <Filter className="h-3 w-3" />
                  {loadingSimilarComments
                    ? "Filtering..."
                    : "Filter comments like this"}
                </button>
                {"replies" in comment &&
                  comment.replies &&
                  comment.replies.length > 0 && (
                    <button
                      onClick={onToggleThread}
                      className="flex items-center gap-1 text-sm text-primary"
                    >
                      {expandedThreads.has(comment.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {comment.replies.length} replies
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>

        {!isReply &&
          "replies" in comment &&
          comment.replies &&
          comment.replies.length > 0 &&
          expandedThreads.has(comment.id) && (
            <div className="mt-2 space-y-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isReply={true}
                  isSelected={false}
                  youtubeVideoId={youtubeVideoId}
                  expandedThreads={expandedThreads}
                  onSelectComment={() => {}}
                  onFilterBySimilarity={() => {}}
                  onToggleThread={() => {}}
                  onOpenYoutube={() => {}}
                  loadingSimilarComments={loadingSimilarComments}
                />
              ))}
            </div>
          )}
      </div>
    );
  }
);

CommentItem.displayName = "CommentItem";
