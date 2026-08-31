"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Video, MessageSquare, Layers, Loader2 } from "lucide-react";

interface UserStatsData {
  totalVideos: number;
  totalComments: number;
  totalClusters: number;
  clusterHierarchy: {
    topLevel: number;
    deepestLevel: number;
    levels: Array<{ level: number; count: number }>;
  };
  semanticSearches: {
    total: number;
    default: number;
    byCategory: Record<string, number>;
    categories: string[];
  };
}

export const UserStatsCard: React.FC = () => {
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/user-stats");

        if (!response.ok) {
          throw new Error("Failed to fetch user statistics");
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("Error fetching user stats:", err);
        setError("Unable to load statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" />
            Your Analysis Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Loading your statistics...
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return null;
  }

  return (
    <Card className="mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5" />
          Your Analysis Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Total Videos */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Video className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground font-medium">
                Videos
              </p>
            </div>
            <p className="text-2xl font-bold">{stats.totalVideos}</p>
            <p className="text-xs text-muted-foreground mt-1">analyzed</p>
          </div>

          {/* Total Comments */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground font-medium">
                Comments
              </p>
            </div>
            <p className="text-2xl font-bold">
              {stats.totalComments.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">processed</p>
          </div>

          {/* Total Clusters */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground font-medium">
                Clusters
              </p>
            </div>
            <p className="text-2xl font-bold">{stats.totalClusters}</p>
            <p className="text-xs text-muted-foreground mt-1">created</p>
          </div>

          {/* Hierarchy Depth */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground font-medium">Depth</p>
            </div>
            <p className="text-2xl font-bold">
              {stats.clusterHierarchy.deepestLevel + 1}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              hierarchy levels
            </p>
          </div>

          {/* Semantic Searches */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-indigo-500" />
              <p className="text-xs text-muted-foreground font-medium">
                Searches
              </p>
            </div>
            <p className="text-2xl font-bold">{stats.semanticSearches.total}</p>
            <p className="text-xs text-muted-foreground mt-1">
              custom templates
            </p>
          </div>
        </div>

        {/* Cluster Breakdown by Level */}
        {stats.clusterHierarchy.levels.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Cluster Distribution by Level
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.clusterHierarchy.levels.map((level) => (
                <div
                  key={level.level}
                  className="bg-background rounded p-2 border border-border/50 text-center"
                >
                  <p className="text-xs text-muted-foreground">
                    Level {level.level}
                  </p>
                  <p className="text-lg font-semibold">{level.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Semantic Searches Breakdown */}
        {stats.semanticSearches.total > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Semantic Search Templates
            </p>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-background rounded p-3 border border-border/50">
                <span className="text-xs text-muted-foreground">
                  Total Templates
                </span>
                <span className="text-lg font-semibold">
                  {stats.semanticSearches.total}
                </span>
              </div>
              <div className="flex justify-between items-center bg-background rounded p-3 border border-border/50">
                <span className="text-xs text-muted-foreground">
                  Default Templates
                </span>
                <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {stats.semanticSearches.default}
                </span>
              </div>
              {stats.semanticSearches.categories.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    By Category
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {stats.semanticSearches.categories.map((category) => (
                      <div
                        key={category}
                        className="bg-background rounded p-2 border border-border/50 text-center"
                      >
                        <p className="text-xs text-muted-foreground truncate">
                          {category}
                        </p>
                        <p className="text-sm font-semibold">
                          {stats.semanticSearches.byCategory[category]}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
