import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { useAnalysisView } from "@/hooks/useAnalysisView";
import { SemanticSearch } from "@/lib/types";
import React from "react";

interface SemanticSearchModalsProps {
  hooks: ReturnType<typeof useAnalysisView>;
}

export function SemanticSearchModals({ hooks }: SemanticSearchModalsProps) {
  const {
    showCreateModal,
    setShowCreateModal,
    createForm,
    setCreateForm,
    createSemanticSearch,
    updateSemanticSearch,
    creatingSemanticSearch,
    editingSemanticSearch,
    editingSearchId,
    setEditingSearchId,
    showManageModal,
    setShowManageModal,
    semanticSearches,
    startEditingSemanticSearch,
    deleteSemanticSearch,
    deletingSemanticSearch,
  } = hooks;

  // Check if currently editing search is a default one
  const editingSearch = editingSearchId
    ? semanticSearches.find((s) => s.id === editingSearchId)
    : null;
  const isEditingDefault = editingSearch?.isDefault || false;

  const addExampleField = () => {
    if (createForm.positiveExamples.length < 10) {
      setCreateForm({
        ...createForm,
        positiveExamples: [...createForm.positiveExamples, ""],
      });
    }
  };

  const addNegativeExampleField = () => {
    if (createForm.negativeExamples.length < 10) {
      setCreateForm({
        ...createForm,
        negativeExamples: [...createForm.negativeExamples, ""],
      });
    }
  };

  const removeExampleField = (index: number) => {
    const newExamples = createForm.positiveExamples.filter(
      (_, i) => i !== index
    );
    setCreateForm({
      ...createForm,
      positiveExamples: newExamples.length > 0 ? newExamples : [""],
    });
  };

  const removeNegativeExampleField = (index: number) => {
    const newExamples = createForm.negativeExamples.filter(
      (_, i) => i !== index
    );
    setCreateForm({
      ...createForm,
      negativeExamples: newExamples,
    });
  };

  const updateExample = (index: number, value: string) => {
    const newExamples = [...createForm.positiveExamples];
    newExamples[index] = value;
    setCreateForm({
      ...createForm,
      positiveExamples: newExamples,
    });
  };

  const updateNegativeExample = (index: number, value: string) => {
    const newExamples = [...createForm.negativeExamples];
    newExamples[index] = value;
    setCreateForm({
      ...createForm,
      negativeExamples: newExamples,
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

  const handleSaveSemanticSearch = () => {
    if (editingSearchId) {
      updateSemanticSearch();
    } else {
      createSemanticSearch();
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setCreateForm({
      title: "",
      positiveExamples: [""],
      negativeExamples: [],
      category: "",
    });
    setEditingSearchId(null);
  };

  return (
    <>
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        title={
          editingSearchId
            ? "Edit Semantic Search"
            : "Create New Semantic Search"
        }
        size="lg"
      >
        <div className="p-6">
          <div className="space-y-6">
            <div className=" flex gap-4">
              <div className="flex-1">
                <Label htmlFor="search-title">Search Title</Label>
                <Input
                  id="search-title"
                  value={createForm.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateForm({ ...createForm, title: e.target.value })
                  }
                  placeholder="e.g., Questions about pricing"
                  className="mt-2"
                  disabled={creatingSemanticSearch || isEditingDefault}
                />
                {isEditingDefault && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Title cannot be edited for default searches
                  </p>
                )}
              </div>
              <div className="flex-1">
                <Label htmlFor="search-category">Category</Label>
                <Input
                  id="search-category"
                  value={createForm.category}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setCreateForm({ ...createForm, category: e.target.value })
                  }
                  placeholder="e.g., Sentiment analysis, Feature requests"
                  className="mt-2"
                  disabled={creatingSemanticSearch || isEditingDefault}
                />
                {isEditingDefault && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Category cannot be edited for default searches
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label>Positive Example Comments</Label>
                <span className="text-xs text-muted-foreground">
                  (Required)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Comments that <strong>should</strong> match this search category
              </p>
              <div className="space-y-2">
                {createForm.positiveExamples.map((example, index) => (
                  <div key={`pos-${index}`} className="flex items-center gap-2">
                    <Input
                      value={example}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateExample(index, e.target.value)
                      }
                      placeholder={`Positive example ${index + 1}`}
                      disabled={creatingSemanticSearch}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExampleField(index)}
                      disabled={
                        createForm.positiveExamples.length === 1 ||
                        creatingSemanticSearch
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addExampleField}
                className="mt-2"
                disabled={
                  createForm.positiveExamples.length >= 10 ||
                  creatingSemanticSearch
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Positive Example
              </Button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label>Negative Example Comments</Label>
                <span className="text-xs text-muted-foreground">
                  (Optional)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Comments that <strong>should NOT</strong> match this search
                category (anti-patterns)
              </p>
              {createForm.negativeExamples.length === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addNegativeExampleField}
                  disabled={creatingSemanticSearch}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Negative Examples
                </Button>
              ) : (
                <>
                  <div className="space-y-2">
                    {createForm.negativeExamples.map((example, index) => (
                      <div
                        key={`neg-${index}`}
                        className="flex items-center gap-2"
                      >
                        <Input
                          value={example}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateNegativeExample(index, e.target.value)
                          }
                          placeholder={`Negative example ${index + 1}`}
                          disabled={creatingSemanticSearch}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeNegativeExampleField(index)}
                          disabled={creatingSemanticSearch}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addNegativeExampleField}
                    className="mt-2"
                    disabled={
                      createForm.negativeExamples.length >= 10 ||
                      creatingSemanticSearch
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Negative Example
                  </Button>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={handleCloseModal}
                disabled={
                  creatingSemanticSearch || editingSemanticSearch !== null
                }
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSemanticSearch}
                disabled={
                  creatingSemanticSearch || editingSemanticSearch !== null
                }
              >
                {creatingSemanticSearch || editingSemanticSearch !== null ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingSearchId ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>{editingSearchId ? "Update Search" : "Create Search"}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title="Manage Semantic Searches"
        size="xl"
      >
        <div className="p-6">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {semanticSearches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No semantic searches created yet.</p>
                <p className="text-sm mt-2">
                  Create your first semantic search to get started.
                </p>
              </div>
            ) : (
              Object.entries(
                groupSemanticSearchesByCategory(semanticSearches)
              ).map(([category, searches]: [string, SemanticSearch[]]) => (
                <div key={category} className="mb-4">
                  <h3 className="font-semibold text-lg">{category}</h3>
                  {searches.map((search: SemanticSearch) => (
                    <div
                      key={search.id}
                      className="p-4 border border-border dark:border-gray-700 rounded-lg flex justify-between items-start bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          {search.title}
                          {search.isDefault && (
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                              Default
                            </span>
                          )}
                        </h4>

                        {/* Display examples based on format */}
                        {search.examples.length > 0 && (
                          <>
                            {search.examples[0].include ? (
                              // New format with positive/negative examples
                              <div className="mt-2 space-y-2">
                                <div>
                                  <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                                    ✓ Positive Examples:
                                  </p>
                                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                    {search.examples[0].include
                                      ?.slice(0, 3)
                                      .map((ex, i) => (
                                        <li
                                          key={`pos-${i}`}
                                          className="truncate"
                                        >
                                          {ex.comment}
                                        </li>
                                      ))}
                                    {(search.examples[0].include
                                      ?.length || 0) > 3 && (
                                      <li className="text-xs italic">
                                        +
                                        {(search.examples[0].include
                                          ?.length || 0) - 3}{" "}
                                        more...
                                      </li>
                                    )}
                                  </ul>
                                </div>

                                {search.examples[0].exclude &&
                                  search.examples[0].exclude.length >
                                    0 && (
                                    <div>
                                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                                        ✗ Negative Examples:
                                      </p>
                                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                        {search.examples[0].exclude
                                          .slice(0, 3)
                                          .map((ex, i) => (
                                            <li
                                              key={`neg-${i}`}
                                              className="truncate"
                                            >
                                              {ex.comment}
                                            </li>
                                          ))}
                                        {search.examples[0].exclude
                                          .length > 3 && (
                                          <li className="text-xs italic">
                                            +
                                            {search.examples[0]
                                              .exclude.length -
                                              3}{" "}
                                            more...
                                          </li>
                                        )}
                                      </ul>
                                    </div>
                                  )}
                              </div>
                            ) : (
                              // Legacy format - single list of examples
                              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                                {search.examples
                                  .filter((ex) => ex.comment)
                                  .slice(0, 3)
                                  .map((ex, i) => (
                                    <li key={i} className="truncate">
                                      {ex.comment}
                                    </li>
                                  ))}
                                {search.examples.length > 3 && (
                                  <li className="text-xs italic">
                                    +{search.examples.length - 3} more...
                                  </li>
                                )}
                              </ul>
                            )}
                          </>
                        )}
                      </div>
                      <div className="ml-4 flex-shrink-0 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditingSemanticSearch(search)}
                          disabled={deletingSemanticSearch === search.id}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteSemanticSearch(search.id)}
                          disabled={
                            deletingSemanticSearch === search.id ||
                            search.isDefault
                          }
                          title={
                            search.isDefault
                              ? "Default searches cannot be deleted"
                              : ""
                          }
                        >
                          {deletingSemanticSearch === search.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
