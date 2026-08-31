import { Button } from "@/components/ui/button";
import { SemanticSearch } from "@/lib/types";
import {
  Loader2,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ActivityIcon,
} from "lucide-react";
import { Fragment, useState } from "react";

export function SemanticSearchTab({
  setShowCreateModal,
  setShowManageModal,
  semanticSearches,
  performSemanticSearch,
  selectedSemanticSearch,
  loadingSemanticResults,
  loadingSemanticSearches,
  recountSemanticSearchResults,
  recountingSegmentResults,
}: {
  setShowCreateModal: (show: boolean) => void;
  setShowManageModal: (show: boolean) => void;
  semanticSearches: SemanticSearch[];
  performSemanticSearch: (id: string) => void;
  selectedSemanticSearch: string | null;
  loadingSemanticResults: boolean;
  loadingSemanticSearches: boolean;
  recountSemanticSearchResults?: () => void;
  recountingSegmentResults?: boolean;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };
  const groupSemanticSearchesByCategory = (searches: SemanticSearch[]) => {
    return searches.reduce((acc, search) => {
      if (!acc[search.category]) {
        acc[search.category] = [];
      }
      acc[search.category].push(search);
      return acc;
    }, {} as Record<string, SemanticSearch[]>);
  };
  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 w-full"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              New Search
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowManageModal(true)}
              className="flex items-center gap-2 w-full"
              size="sm"
            >
              <Search className="h-4 w-4" />
              Manage Searches
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={recountSemanticSearchResults}
            className="flex items-center gap-2 w-full"
            size="sm"
            disabled={recountingSegmentResults}
          >
            {recountingSegmentResults ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ActivityIcon className="h-4 w-4" />
            )}
            {recountingSegmentResults
              ? "Recounting..."
              : "Recount Sentiment Results"}
          </Button>
        </div>
      </div>

      {loadingSemanticSearches && (
        <div className="text-center py-4">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground mt-2">
            Loading semantic searches...
          </p>
        </div>
      )}

      {!loadingSemanticSearches && semanticSearches.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-3">
            Quick search with existing patterns:
          </p>
          <div className="space-y-2">
            {Object.entries(
              groupSemanticSearchesByCategory(semanticSearches)
            ).map(([category, searches]) => {
              const isExpanded = expandedCategories.has(category);
              return (
                <Fragment key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 w-full text-left p-2 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase flex-1">
                      {category} ({searches.length})
                    </p>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="ml-2 space-y-2">
                      {searches.map((search) => (
                        <Button
                          key={search.id}
                          variant="outline"
                          onClick={() => performSemanticSearch(search.id)}
                          className={`w-full text-left p-3 h-auto justify-start hover:bg-youtube-hover-light dark:hover:bg-youtube-hover-dark ${
                            selectedSemanticSearch === search.id
                              ? "bg-primary/10 border-primary text-primary"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="text-left flex-1 min-w-0">
                              <div className="font-medium text-sm truncate flex items-center gap-2">
                                {search.title} ({search.examples.length})
                                {search.isDefault && (
                                  <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                                    Default
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedSemanticSearch === search.id &&
                            loadingSemanticResults ? (
                              <Loader2 className="h-4 w-4 animate-spin ml-2 flex-shrink-0" />
                            ) : (
                              <Search className="h-4 w-4 ml-2 flex-shrink-0" />
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
          {/* {semanticSearches.length > 8 && (
            <p className="text-sm text-muted-foreground text-center">
              And {semanticSearches.length - 8} more...
              <button
                onClick={() => setShowManageModal(true)}
                className="text-primary hover:text-primary/80 ml-1"
              >
                View all
              </button>
            </p>
          )} */}
        </div>
      )}

      {!loadingSemanticSearches && semanticSearches.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p>No semantic searches created yet.</p>
          <p className="text-sm mb-4">
            Create your first semantic search to find similar comments.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create First Search
          </Button>
        </div>
      )}
    </div>
  );
}
