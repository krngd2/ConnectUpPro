"use client";

import {
  RefreshCw,
  Play, 
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { useAnalysisView } from "@/hooks/useAnalysisView";
import { trackVideoAnalysis, trackEvent } from "@/lib/analytics";
import Image from "next/image";
import { Tooltip, TooltipTrigger } from "@radix-ui/react-tooltip";
import { TooltipContent } from "@/components/ui/tooltip";

interface AnalysisHeaderProps {
  hooks: ReturnType<typeof useAnalysisView>;
}

export function AnalysisHeader({ hooks }: AnalysisHeaderProps) {
  const {
    currentAnalysisData,
    handleResyncAnalysis,
    isResyncing,
    performSemanticSearchByCategory,
    loadingVideoStats,
    currentVideoStats,
    // fetchCurrentVideoStats,
    loadingSentimentAnalysis,
    handleDeleteVideo,
    isDeleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
  } = hooks;

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-4 w-full place-content-between">

          {/* Header: Title + CTA */}
          <div className="flex-6 gap-4 items-start justify-between">
            <div className="min-w-0 mb-4 flex"> 
              {currentAnalysisData.project.thumbnailUrl && (
                <Image
                  src={currentAnalysisData.project.thumbnailUrl}
                  alt="Video thumbnail"
                  width={160}
                  height={96}
                  className="rounded-lg object-cover border"
                />
              )} 
              <div className="mt-2 ml-4 items-center gap-8 text-sm text-muted-foreground">
                <h1 className="text-l font-bold">
                  {currentAnalysisData.project.title ||
                    currentAnalysisData.project.name}
                </h1>
                <div className="flex gap-2 items-center">
                  <div className="">
                    <span >Status:{" "}</span>
                    <span
                      className={`ml-1 font-medium ${
                        currentAnalysisData.project.status === "COMPLETED"
                          ? "text-green-600"
                          : currentAnalysisData.project.status === "FAILED"
                          ? "text-red-600"
                          : "text-primary"
                      }`}
                    >
                      {currentAnalysisData.project.status}
                    </span>
                    {currentAnalysisData.project.status !== "COMPLETED" &&
                      currentAnalysisData.project.status !== "FAILED" && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            trackEvent("status_refresh", {
                              video_id: currentAnalysisData.project.id,
                              current_status: currentAnalysisData.project.status,
                            });
                            window.location.reload();
                          }}
                          className="flex items-center gap-2 w-full justify-center"
                        >
                          <Play className="h-4 w-4" />
                          Refresh Status
                        </Button>
                      )}
                  </div>
                  {currentAnalysisData.project.status === "COMPLETED" && (
                    <>
                      <div className="flex items-center gap-1">
                        <span>Analysised Comments:</span>
                        <span className="font-semibold text-foreground">
                          {currentAnalysisData.project.analyzedComments ??
                            currentAnalysisData.project.totalComments}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Comments on YouTube:</span>
                        {loadingVideoStats ? (
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </span>
                        ) : currentVideoStats ? (
                          <>
                            <span className="font-semibold text-foreground">
                              {currentVideoStats.currentCommentCount.toLocaleString()}
                            </span>
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    trackVideoAnalysis("sync_started", currentAnalysisData.project.id);
                                    handleResyncAnalysis();
                                  }}
                                  className="flex items-center gap-2 justify-center"
                                  title="Sync New Comments"
                                >
                                  {isResyncing ? (
                                    <>
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                      Resyncing...
                                    </>
                                  ) : (
                                    <>
                                      <RefreshCw className="h-4 w-4" /> 
                                    </>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="center" sideOffset={10}>
                                <p>Sync New Comments</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip delayDuration={200}>
                              <TooltipTrigger>
                                <Button
                                  variant="destructive"
                                  onClick={() => {
                                    trackEvent("video_delete_initiated", {
                                      video_id: currentAnalysisData.project.id,
                                      comment_count: currentAnalysisData.project.totalComments || 0,
                                    });
                                    setShowDeleteConfirm(true);
                                  }}
                                  disabled={isDeleting}
                                  className="flex items-center gap-2 justify-center"
                                  title="Delete Video"
                                >
                                  {isDeleting ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-4 w-4" /> 
                                    </>
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="center" sideOffset={10}>
                                <p>Delete Video</p>
                              </TooltipContent>
                            </Tooltip>
                          </>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Sentiment Analysis */}
            {currentAnalysisData.project.status === "COMPLETED" && (
              <div >
                {/* Stats */}
                {loadingSentimentAnalysis ? (
                  <div className="md:col-span-8 flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">
                      Loading sentiment analysis...
                    </span>
                  </div>
                ) : (
                  <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox
                      // use svg image from analysisHeader/positive.svg
                      icon={<Image src="/analysisHeader/positive.svg" alt="Positive" width={60} height={60} />}
                      label="Positive"
                      value={
                        currentAnalysisData.summary.sentimentBreakdown
                          .positive || 0
                      }
                      onSelect={(label) =>
                        performSemanticSearchByCategory(label)
                      }
                    />
                    <StatBox
                      icon={<Image src="/analysisHeader/negative.svg" alt="Negative" width={60} height={60} />}
                      label="Negative"
                      value={
                        currentAnalysisData.summary.sentimentBreakdown
                          .negative || 0
                      }
                      onSelect={(label) =>
                        performSemanticSearchByCategory(label)
                      }
                    />
                    <StatBox
                      icon={<Image src="/analysisHeader/neutral.svg" alt="Neutral" width={60} height={60} />}
                      label="Neutral"
                      value={
                        currentAnalysisData.summary.sentimentBreakdown
                          .neutral || 0
                      }
                      onSelect={(label) =>
                        performSemanticSearchByCategory(label)
                      }
                    />
                    <StatBox
                      icon={<Image src="/analysisHeader/offensive.svg" alt="Offensive" width={60} height={60} />}
                      label="Offensive"
                      value={
                        currentAnalysisData.summary.sentimentBreakdown
                          .offensive ?? 0
                      }
                      onSelect={() =>
                        performSemanticSearchByCategory("Abusive")
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div> 
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Video"
        description={`Are you sure you want to permanently delete "${
          currentAnalysisData.project.title || currentAnalysisData.project.name
        }"? This will remove the video and all ${
          currentAnalysisData.project.totalComments || 0
        } associated comments and clusters from the database. This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleDeleteVideo}
        isLoading={isDeleting}
      />
    </>
  );
}

function StatBox({
  icon,
  label,
  value,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onSelect?: (categoryLabel: string) => void;
}) {
  return (
    <div className="relative rounded-xl border p-2 flex flex-col items-center justify-center text-center bg-background">
      <button
        type="button"
        onClick={() => {
          trackEvent("sentiment_filter_clicked", {
            sentiment: label.toLowerCase(),
            count: value,
          });
          onSelect?.(label);
        }} 
        style={{
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
        className="flex  w-full hover:opacity-80 transition-opacity"
      >
        <div className="text-left pl-2">
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-sm text-muted-foreground">
            {label}
          </div>
        </div>
        <div style={{margin: '0px -15px -15px 0px'}}>
          {icon}
        </div>
      </button>
    </div>
  );
}
