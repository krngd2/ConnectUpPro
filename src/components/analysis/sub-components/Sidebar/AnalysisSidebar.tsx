"use client";

import { MessageSquare, Search } from "lucide-react";
import { useAnalysisView } from "@/hooks/useAnalysisView";
import { TopicsTab } from "./TopicsTab";
import { SemanticSearchTab } from "./SemanticSearchTab";

interface AnalysisSidebarProps {
  hooks: ReturnType<typeof useAnalysisView>;
}

export function AnalysisSidebar({ hooks }: AnalysisSidebarProps) {
  const {
    activeTab,
    setActiveTab,
    sidebarOpen,
    setSidebarOpen,
    currentAnalysisData,
    handleClusterClick,
    selectedCluster,
    loadingComments,
    setShowCreateModal,
    setShowManageModal,
    semanticSearches,
    performSemanticSearch,
    selectedSemanticSearch,
    loadingSemanticResults,
    loadingSemanticSearches,
    recountSemanticSearchResults,
    recountingSegmentResults,
  } = hooks;

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-80 youtube-sidebar shadow-lg transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:relative lg:flex-shrink-0 lg:w-80`}
      >
        <div className="flex flex-col h-full lg:h-screen lg:sticky lg:top-0">
          {/* <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">Search & Topics</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-youtube-hover-light dark:hover:bg-youtube-hover-dark"
            >
              <X className="h-5 w-5" />
            </button>
          </div> */}

          <div className="flex-1 overflow-y-auto p-4">
            <div
              className="flex space-x-1 mb-4 p-1 pb-3 bg-muted border-b-2 border-border" 
            >
              <button
                onClick={() => setActiveTab("topics")}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "topics"
                    ? "bg-primary text-primary-foreground shadow-sm  border border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Topics ({currentAnalysisData.summary.clusters.length})
                </div>
              </button>
              <button
                onClick={() => setActiveTab("semantic")}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "semantic"
                    ? "bg-primary text-primary-foreground shadow-sm border border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Search className="h-4 w-4" />
                  Similarity Search
                </div>
              </button>
            </div>

            {activeTab === "topics" && (
              <TopicsTab
                videoTitle={
                  currentAnalysisData.project.title ||
                  currentAnalysisData.project.name
                }
                clusters={currentAnalysisData.summary.clusters}
                totalComments={currentAnalysisData.project.totalComments}
                videoId={currentAnalysisData.project.id}
                handleClusterClick={(cluster) => {
                  handleClusterClick(cluster);
                  setSidebarOpen(false);
                }}
                selectedCluster={selectedCluster}
                loadingComments={loadingComments}
              />
            )}

            {activeTab === "semantic" && (
              <SemanticSearchTab
                setShowCreateModal={setShowCreateModal}
                setShowManageModal={setShowManageModal}
                semanticSearches={semanticSearches}
                performSemanticSearch={(id) => {
                  performSemanticSearch(id);
                  setSidebarOpen(false);
                }}
                selectedSemanticSearch={selectedSemanticSearch}
                loadingSemanticResults={loadingSemanticResults}
                loadingSemanticSearches={loadingSemanticSearches}
                recountSemanticSearchResults={recountSemanticSearchResults}
                recountingSegmentResults={recountingSegmentResults}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
