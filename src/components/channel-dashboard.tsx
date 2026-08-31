"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Users,
  Eye,
  Video,
  Play,
  ThumbsUp,
  MessageSquare,
  Calendar,
  Loader2,
  BarChart3,
  RefreshCw,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { VIDEO_STATUS } from "@/lib/constants";

// Types matching the API
interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
  customUrl?: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  duration: string;
  tags?: string[];
}

interface ChannelData {
  channel: YouTubeChannel;
  videos: YouTubeVideo[];
}

interface VideoAnalysisStatus {
  isAnalyzed: boolean;
  status: string | null;
  videoId: string | null;
  commentsCount: number;
  canRetry: boolean;
}

function formatNumber(num: string) {
  const number = parseInt(num);
  if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + "M";
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + "K";
  }
  return number.toLocaleString();
}

function formatDuration(duration: string) {
  // YouTube duration format: PT#M#S or PT#H#M#S
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return duration;

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function VideoCard({
  video,
  onAnalyze,
  isAnalyzing,
  analysisStatus,
  onSync,
  isSyncing,
  router,
}: {
  video: YouTubeVideo;
  onAnalyze: (videoId: string, videoUrl: string) => void;
  isAnalyzing: boolean;
  analysisStatus: VideoAnalysisStatus | null;
  onSync: (videoId: string, videoUrl: string) => void;
  isSyncing: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const handleAnalyze = async () => {
    const videoUrl = `https://youtube.com/watch?v=${video.id}`;
    onAnalyze(video.id, videoUrl);
  };

  const handleSync = async () => {
    const videoUrl = `https://youtube.com/watch?v=${video.id}`;
    onSync(video.id, videoUrl);
  };

  const handleViewAnalysis = () => {
    if (analysisStatus?.videoId) {
      router.push(`/analysis/${analysisStatus.videoId}`);
    }
  };
  return (
    <Card className="transition-all hover:shadow-md hover:scale-[1.02] group">
      <div className="relative">
        {/* Thumbnail */}
        <div className="aspect-video rounded-t-lg overflow-hidden bg-muted relative">
          <Image
            src={video.thumbnailUrl}
            alt={video.title}
            width={480}
            height={270}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          {/* Duration overlay */}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
            {formatDuration(video.duration)}
          </div>
          {/* Status overlay for failed videos */}
          {analysisStatus?.status === VIDEO_STATUS.FAILED && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Failed
            </div>
          )}
          {/* Play button overlay on hover */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div className="bg-red-600 rounded-full p-3">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
        </div>
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="text-sm line-clamp-2 leading-tight">
          {video.title}
        </CardTitle>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDate(video.publishedAt)}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Description */}
          {video.description && (
            <p className="text-xs text-gray-600 line-clamp-2">
              {video.description}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3 text-gray-500" />
              <span className="text-gray-500">
                {formatNumber(video.viewCount)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-gray-500" />
              <span className="text-gray-500">
                {formatNumber(video.likeCount)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-gray-500" />
              <span className="text-gray-500">
                {formatNumber(video.commentCount)}
              </span>
            </div>
          </div>

          {/* Action Button */}
          {parseInt(video.commentCount) > 10 &&
            (() => {
              // If completed, show "View Analysis" with sync button
              if (analysisStatus?.status === VIDEO_STATUS.COMPLETED) {
                return (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleViewAnalysis}
                    >
                      <BarChart3 className="h-3 w-3 mr-2" />
                      View Analysis ({analysisStatus.commentsCount} comments)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      onClick={handleSync}
                      disabled={isSyncing}
                      title="Sync new comments"
                    >
                      {isSyncing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                );
              }

              // If failed, show "Retry Analysis"
              if (analysisStatus?.status === VIDEO_STATUS.FAILED) {
                return (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full mt-3"
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-2" />
                        Retry Analysis
                      </>
                    )}
                  </Button>
                );
              }

              // If in progress, show current status
              const inProgressStatuses = [
                VIDEO_STATUS.PENDING,
                VIDEO_STATUS.FETCHING_DETAILS,
                VIDEO_STATUS.DOWNLOADING_COMMENTS,
                VIDEO_STATUS.ANALYZING_COMMENTS,
              ];
              if (
                analysisStatus?.status &&
                inProgressStatuses.some(
                  (status) => status === analysisStatus.status
                )
              ) {
                const statusLabels = {
                  [VIDEO_STATUS.PENDING]: "Pending...",
                  [VIDEO_STATUS.FETCHING_DETAILS]: "Fetching details...",
                  [VIDEO_STATUS.DOWNLOADING_COMMENTS]:
                    "Downloading comments...",
                  [VIDEO_STATUS.ANALYZING_COMMENTS]: "Analyzing comments...",
                };

                return (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full mt-3"
                    disabled
                  >
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    {statusLabels[
                      analysisStatus.status as keyof typeof statusLabels
                    ] || "Processing..."}
                  </Button>
                );
              }

              // If not analyzed, show "Analyse"
              return (
                <Button
                  variant="default"
                  size="sm"
                  className="w-full mt-3"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-3 w-3 mr-2" />
                      Analyse
                    </>
                  )}
                </Button>
              );
            })()}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChannelDashboard({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [channelData, setChannelData] = useState<ChannelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzingVideos, setAnalyzingVideos] = useState<Set<string>>(
    new Set()
  );
  const [syncingVideos, setSyncingVideos] = useState<Set<string>>(new Set());
  const [analysisStatuses, setAnalysisStatuses] = useState<
    Record<string, VideoAnalysisStatus>
  >({});

  // Function to check analysis status for all videos
  const checkAnalysisStatus = async (videos: YouTubeVideo[]) => {
    try {
      const videoUrls = videos.map(
        (video) => `https://youtube.com/watch?v=${video.id}`
      );

      const response = await fetch("/api/videos/analysis-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoUrls }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysisStatuses(result.analysisStatus || {});
      }
    } catch (error) {
      console.error("Error checking analysis status:", error);
    }
  };

  const handleVideoAnalyze = async (videoId: string, videoUrl: string) => {
    setAnalyzingVideos((prev) => new Set(prev).add(videoId));

    try {
      const response = await fetch("/api/videos/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl,
          channelId,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // Show success message (you might want to add a toast notification here)
        console.log("Video analysis started:", result.message);

        // Refresh analysis status after successful analysis
        if (channelData?.videos) {
          await checkAnalysisStatus(channelData.videos);
        }
      } else {
        throw new Error(result.error || "Failed to analyze video");
      }
    } catch (error) {
      console.error("Error analyzing video:", error);
    } finally {
      setAnalyzingVideos((prev) => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  const handleVideoSync = async (videoId: string, videoUrl: string) => {
    setSyncingVideos((prev) => new Set(prev).add(videoId));

    try {
      const response = await fetch("/api/videos/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl,
          channelId,
          forceSync: true, // This flag will indicate to re-download comments
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log("Video sync started:", result.message);

        // Refresh analysis status after successful sync
        if (channelData?.videos) {
          await checkAnalysisStatus(channelData.videos);
        }
      } else {
        throw new Error(result.error || "Failed to sync video");
      }
    } catch (error) {
      console.error("Error syncing video:", error);
    } finally {
      setSyncingVideos((prev) => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    const fetchChannelData = async () => {
      try {
        const response = await fetch(`/api/channels/${channelId}/videos`);
        const result = await response.json();

        if (response.ok) {
          setChannelData(result);
          // After getting channel data, check analysis status for all videos
          if (result.videos && result.videos.length > 0) {
            await checkAnalysisStatus(result.videos);
          }
        } else {
          setError(result.error || "Failed to load channel data");
        }
      } catch {
        setError("Network error. Please check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchChannelData();
  }, [channelId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container py-6 pl-4 md:pl-8">
          <div className="text-center py-12">
            <div className="mx-auto max-w-md">
              <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-900" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Loading channel...</h3>
              <p className="text-gray-600">
                Please wait while we fetch the channel information and videos
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !channelData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="container py-6 pl-4 md:pl-8">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <div className="text-center py-12">
            <div className="mx-auto max-w-md">
              <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <Video className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Error loading channel
              </h3>
              <p className="text-gray-600 mb-6">
                {error || "Failed to load channel data"}
              </p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { channel, videos } = channelData;

  return (
    <div className="min-h-screen bg-white">
      <div className="container py-6 pl-4 md:pl-8">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Channel Header */}
        <div className="mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {/* Channel Avatar */}
                <div className="flex-shrink-0">
                  <Image
                    src={channel.thumbnailUrl}
                    alt={channel.title}
                    width={120}
                    height={120}
                    className="w-30 h-30 rounded-full object-cover"
                  />
                </div>

                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-bold mb-2">{channel.title}</h1>
                  {channel.customUrl && (
                    <p className="text-blue-600 mb-3">
                      @{channel.customUrl.replace("@", "")}
                    </p>
                  )}
                  {channel.description && (
                    <p className="text-gray-600 mb-4 line-clamp-3">
                      {channel.description}
                    </p>
                  )}

                  {/* Channel Stats */}
                  <div className="grid grid-cols-3 gap-6 max-w-md">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="text-xl font-bold">
                        {formatNumber(channel.subscriberCount)}
                      </div>
                      <div className="text-sm text-gray-500">Subscribers</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Video className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="text-xl font-bold">
                        {formatNumber(channel.videoCount)}
                      </div>
                      <div className="text-sm text-gray-500">Videos</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Eye className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="text-xl font-bold">
                        {formatNumber(channel.viewCount)}
                      </div>
                      <div className="text-sm text-gray-500">Total Views</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Videos Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Recent Videos</h2>
              <p className="text-gray-600 mt-1">
                Latest uploads from this channel
              </p>
            </div>
          </div>

          {/* Videos Grid */}
          {videos.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto max-w-md">
                <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Video className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No videos found</h3>
                <p className="text-gray-600">
                  This channel doesn&apos;t have any public videos yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {videos.map((video) => {
                const videoUrl = `https://youtube.com/watch?v=${video.id}`;
                const analysisStatus = analysisStatuses[videoUrl] || null;

                return (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onAnalyze={handleVideoAnalyze}
                    isAnalyzing={analyzingVideos.has(video.id)}
                    analysisStatus={analysisStatus}
                    onSync={handleVideoSync}
                    isSyncing={syncingVideos.has(video.id)}
                    router={router}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
