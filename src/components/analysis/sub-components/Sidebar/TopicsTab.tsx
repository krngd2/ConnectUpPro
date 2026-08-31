import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { AnalysisDataCluster } from "@/lib/analysis";
import {
  Loader2,
  MessageSquare,
  RefreshCw,
  PieChart,
  GitBranch,
  MoreVertical,
} from "lucide-react";
import { TopicPieChartModel } from "./TopicPieChartModel";
import { Tooltip, TooltipTrigger } from "@radix-ui/react-tooltip"; 
import { TooltipContent } from "@/components/ui/tooltip";

export function TopicsTab({
  clusters,
  totalComments,
  videoId,
  handleClusterClick,
  selectedCluster,
  loadingComments,
  videoTitle,
}: {
  clusters: AnalysisDataCluster[];
  totalComments: number;
  videoId: string;
  handleClusterClick: (cluster: AnalysisDataCluster) => void;
  selectedCluster: AnalysisDataCluster | null;
  loadingComments: boolean;
  videoTitle: string;
}) {
  // Local copy so we can refresh clusters without full page reload
  const [localClusters, setLocalClusters] =
    useState<AnalysisDataCluster[]>(clusters);
  const [regeneratingClusters, setRegeneratingClusters] = useState(false);
  const [isPieChartModalOpen, setIsPieChartModalOpen] = useState(false);
  const [creatingSubClusters, setCreatingSubClusters] = useState<string | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(
    new Set()
  );
  // Section level loading (either regenerating topics or creating sub clusters)
  const [sectionLoading, setSectionLoading] = useState(false);

  // Sync incoming prop changes (e.g., when parent re-renders with new clusters)
  useEffect(() => {
    setLocalClusters(clusters);
  }, [clusters]);

  const fetchLatestClusters = async () => {
    try {
      const res = await fetch(`/api/clusters?videoId=${videoId}`);
      if (!res.ok) throw new Error("Failed to fetch updated clusters");
      const data = await res.json();
      if (Array.isArray(data.clusters)) {
        // Expecting hierarchical data; fallback to empty array on stub response
        setLocalClusters(data.clusters as AnalysisDataCluster[]);
      }
    } catch (err) {
      console.error("Error fetching latest clusters", err);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpen(null);
    };

    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpen]);

  const handleRegenerateClusters = async () => {
    if (regeneratingClusters) return;

    setRegeneratingClusters(true);
    setSectionLoading(true);
    try {
      const response = await fetch("/api/regenerate-clusters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to regenerate clusters");
      }

      console.log("Clusters regenerated successfully:", result);
      // Fetch latest clusters instead of full page reload
      await fetchLatestClusters();
    } catch (error) {
      console.error("Error regenerating clusters:", error);
      alert(
        error instanceof Error ? error.message : "Failed to regenerate clusters"
      );
    } finally {
      setRegeneratingClusters(false);
      setSectionLoading(false);
    }
  };

  const toggleClusterExpansion = (clusterId: string) => {
    setExpandedClusters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId);
      } else {
        newSet.add(clusterId);
      }
      return newSet;
    });
  };

  const handleCreateSubClusters = async (clusterId: string) => {
    if (creatingSubClusters) return;

    setCreatingSubClusters(clusterId);
    setSectionLoading(true);
    setMenuOpen(null); // Close the menu

    try {
      const response = await fetch("/api/create-sub-clusters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clusterId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create sub-clusters");
      }

      console.log("Sub-clusters created successfully:", result);
      // Refresh clusters only
      await fetchLatestClusters();
    } catch (error) {
      console.error("Error creating sub-clusters:", error);
      alert(
        error instanceof Error ? error.message : "Failed to create sub-clusters"
      );
    } finally {
      setCreatingSubClusters(null);
      setSectionLoading(false);
    }
  };

  const renderCluster = (cluster: AnalysisDataCluster, level: number = 0) => {
    const isExpanded = expandedClusters.has(cluster.id);
    const hasSubClusters =
      cluster.subClusters && cluster.subClusters.length > 0;
    const indentClass = level > 0 ? `ml-${level * 4}` : "";

    return (
      <div key={cluster.id}>
        <div className={`relative ${indentClass}`}>
          <div
            onClick={() => handleClusterClick(cluster)}
            className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer ${
              selectedCluster?.id === cluster.id
                ? "border-primary"
                : "border-border bg-card hover:shadow-md hover:bg-youtube-hover-light dark:hover:bg-youtube-hover-dark"
            }`}
            style={
              selectedCluster?.id === cluster.id
                ? { backgroundColor: "#171717" }
                : undefined
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0 flex-1">
                {hasSubClusters && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleClusterExpansion(cluster.id);
                    }}
                    className="p-1 rounded hover:bg-muted"
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                )}
                <span
                  className="text-sm"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {cluster.name}
                </span>
                {selectedCluster?.id === cluster.id && loadingComments && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!hasSubClusters && (
                  <span className="text-sm text-muted-foreground">
                    {cluster.commentCount || cluster.commentIDs.length}
                  </span>
                )}
                {!hasSubClusters && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === cluster.id ? null : cluster.id);
                    }}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Context Menu */}
          {menuOpen === cluster.id && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-10 min-w-[160px]">
              <button
                onClick={() => handleCreateSubClusters(cluster.id)}
                disabled={creatingSubClusters === cluster.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: "hsl(var(--youtube-light-bg))" }}
              >
                {creatingSubClusters === cluster.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="h-4 w-4" />
                )}
                {creatingSubClusters === cluster.id
                  ? "Creating..."
                  : "Create Sub Topics"}
              </button>
            </div>
          )}
        </div>

        {/* Render sub-clusters */}
        {hasSubClusters && isExpanded && (
          <div className="mt-2">
            {cluster.subClusters!.map((subCluster) =>
              renderCluster(subCluster, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-center mb-4">
        {/* <p className="text-sm text-muted-foreground">
          Click on any topic to view related comments with threaded replies
        </p> */}
          <div className="flex items-center gap-2">
            <Tooltip delayDuration={200}>
                <TooltipTrigger>
                    <Button
                      onClick={handleRegenerateClusters}
                      disabled={regeneratingClusters}
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      {regeneratingClusters ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {/* {regeneratingClusters ? "Regenerating..." : "Regenerate Topics"} */}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" sideOffset={10}>
                  <p>Regenerate Topics</p>
                </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={200}>
                <TooltipTrigger>
                  <Button
                    onClick={() => setIsPieChartModalOpen(true)}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <PieChart className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center" sideOffset={10}>
                  <p>Data Visuals</p>
                </TooltipContent>
            </Tooltip>
          </div>
      </div>

      <div className="space-y-2">
        <div
          onClick={() =>
            handleClusterClick({
              name: "all-topics",
              id: "all-topics",
              commentIDs: [],
            })
          }
          className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer ${
            selectedCluster?.id === "all-topics"
              ? "border-primary"
              : "border-border bg-card hover:shadow-md hover:bg-youtube-hover-light dark:hover:bg-youtube-hover-dark"
          }`}
          style={
            selectedCluster?.id === "all-topics"
              ? { backgroundColor: "#171717" }
              : undefined
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm truncate">All Topics</span>
              {selectedCluster?.id === "all-topics" && loadingComments && (
                <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
              )}
            </div>
            <span className="text-sm text-muted-foreground flex-shrink-0">
              {totalComments}
            </span>
          </div>
        </div>
        {localClusters.length > 0 ? (
          <>{localClusters.map((topic) => renderCluster(topic))}</>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <div>
              <p>No topics available yet.</p>
              <p className="text-sm">
                Topics will appear once comment analysis is completed.
              </p>
            </div>
          </div>
        )}
      </div>

      {isPieChartModalOpen && (
        <TopicPieChartModel
          isPieChartModalOpen={isPieChartModalOpen}
          setIsPieChartModalOpen={setIsPieChartModalOpen}
          clusters={localClusters}
          videoTitle={videoTitle}
        />
      )}

      {sectionLoading && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-md">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">Updating topics...</p>
        </div>
      )}
    </div>
  );
}
