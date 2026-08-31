"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Play,
} from "lucide-react";

interface VideoDebugInfo {
  id: string;
  url: string;
  title: string;
  status: string;
  timing: {
    createdAt: string;
    updatedAt: string;
    lastSynced: string | null;
    minutesSinceCreated: number;
    minutesSinceUpdated: number;
    minutesSinceLastSync: number | null;
  };
  counts: {
    comments: number;
    clusters: number;
  };
  health: {
    isStuck: boolean;
    isWarning: boolean;
    threshold: number;
    statusSince: number;
  };
}

interface ProcessingStats {
  total: number;
  byStatus: Record<string, number>;
  stuck: number;
  warning: number;
  averageMinutesSinceUpdate: number;
}

interface MonitoringData {
  summary: ProcessingStats;
  videos: VideoDebugInfo[];
  generatedAt: string;
}

const VideoMonitoringDashboard: React.FC = () => {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/videos/debug?detailed=false");
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const processStuckVideos = async () => {
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/videos/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process_stuck" }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Stuck videos processed:", result);

      // Refresh data after processing
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProcessing(false);
    }
  };

  const retryVideo = async (videoId: string) => {
    try {
      const response = await fetch("/api/videos/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear_stuck_analysis",
          videoId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to retry: ${response.statusText}`);
      }

      console.log(`Video ${videoId} reset for retry`);
      await fetchData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "ANALYZING_COMMENTS":
        return "bg-blue-100 text-blue-800";
      case "DOWNLOADING_COMMENTS":
        return "bg-yellow-100 text-yellow-800";
      case "PENDING":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (
    status: string,
    isStuck: boolean,
    isWarning: boolean
  ) => {
    if (isStuck) return <XCircle className="h-4 w-4 text-red-500" />;
    if (isWarning) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;

    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  if (error) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <XCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Error loading monitoring data: {error}</p>
            <Button onClick={fetchData} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Video Processing Monitor
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={fetchData}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                onClick={processStuckVideos}
                disabled={processing || !data?.summary.stuck}
                variant="destructive"
                size="sm"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Process Stuck ({data?.summary.stuck || 0})
              </Button>
            </div>
          </div>
          {lastRefresh && (
            <p className="text-sm text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
      </Card>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">{data.summary.total}</div>
              <div className="text-sm text-gray-500">Total Videos</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {data.summary.stuck}
              </div>
              <div className="text-sm text-gray-500">Stuck</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {data.summary.warning}
              </div>
              <div className="text-sm text-gray-500">Warning</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {data.summary.byStatus.COMPLETED || 0}
              </div>
              <div className="text-sm text-gray-500">Completed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold">
                {data.summary.averageMinutesSinceUpdate}
              </div>
              <div className="text-sm text-gray-500">Avg Minutes</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Breakdown */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.summary.byStatus).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <Badge className={getStatusColor(status)}>{status}</Badge>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video List */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>Video Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.videos.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No videos in processing states
                </p>
              ) : (
                data.videos.map((video) => (
                  <div
                    key={video.id}
                    className={`p-3 rounded border ${
                      video.health.isStuck
                        ? "border-red-200 bg-red-50"
                        : video.health.isWarning
                        ? "border-yellow-200 bg-yellow-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(
                          video.status,
                          video.health.isStuck,
                          video.health.isWarning
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{video.title}</p>
                          <p className="text-sm text-gray-500 truncate">
                            {video.url}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(video.status)}>
                              {video.status}
                            </Badge>
                            <span className="text-gray-500">
                              {video.timing.minutesSinceUpdated}m ago
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {video.counts.comments} comments,{" "}
                            {video.counts.clusters} clusters
                          </div>
                        </div>

                        {(video.health.isStuck ||
                          video.status === "FAILED") && (
                          <Button
                            onClick={() => retryVideo(video.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>

                    {video.health.isStuck && (
                      <div className="mt-2 text-sm text-red-600">
                        ⚠️ Stuck for {video.health.statusSince} minutes
                        (threshold: {video.health.threshold} minutes)
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VideoMonitoringDashboard;
