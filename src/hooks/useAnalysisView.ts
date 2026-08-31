"use client";

import { useState, useEffect } from "react";
import { AnalysisData, AnalysisDataCluster } from "@/lib/analysis";
import { SemanticSearch, SemanticSearchResult } from "@/lib/types";
import { sendBrowserNotification, requestNotificationPermission } from "@/lib/notifications.client";
import { YouTubeVideo } from "@/lib/types";

export function useAnalysisView(
    videoId: string,
    analysisData: AnalysisData
) {
    const [selectedComments, setSelectedComments] = useState<string[]>([]);
    const [isResyncing, setIsResyncing] = useState<boolean>(false);
    const [selectedCluster, setSelectedCluster] = useState<AnalysisDataCluster | null>(null);
    const [clusterComments, setClusterComments] = useState<
        AnalysisData["comments"]
    >([]);
    const [loadingComments, setLoadingComments] = useState<boolean>(false);
    const [streamingComments, setStreamingComments] = useState<boolean>(false);
    const [streamingExpectedTotal, setStreamingExpectedTotal] = useState<number>(0);


    // Semantic search state
    const [semanticSearches, setSemanticSearches] = useState<SemanticSearch[]>(
        []
    );
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [showManageModal, setShowManageModal] = useState<boolean>(false);
    const [loadingSemanticSearches, setLoadingSemanticSearches] =
        useState<boolean>(true);
    const [selectedSemanticSearch, setSelectedSemanticSearch] = useState<
        string | null
    >(null);
    const [semanticSearchResults, setSemanticSearchResults] = useState<
        SemanticSearchResult[]
    >([]);
    const [loadingSemanticResults, setLoadingSemanticResults] =
        useState<boolean>(false);
    const [creatingSemanticSearch, setCreatingSemanticSearch] = useState<boolean>(false);
    const [deletingSemanticSearch, setDeletingSemanticSearch] = useState<string | null>(null);
    const [editingSemanticSearch, setEditingSemanticSearch] = useState<string | null>(null);
    const [createForm, setCreateForm] = useState({
        title: "",
        positiveExamples: [""],
        negativeExamples: [] as string[],
        category: "",
    });
    const [editingSearchId, setEditingSearchId] = useState<string | null>(null);

    // Tab state
    const [activeTab, setActiveTab] = useState<"semantic" | "topics">("topics");

    // Sidebar state for mobile
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

    // Sentiment recount state
    const [recountingSegmentResults, setRecountingSegmentResults] = useState<boolean>(false);
    const [loadingSentimentAnalysis, setLoadingSentimentAnalysis] = useState<boolean>(false);

    // Delete video state
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

    // Current video stats state
    const [currentVideoStats, setCurrentVideoStats] = useState<{
        currentCommentCount: number;
        analyzedCommentCount: number;
        difference: number;
        lastChecked: string;
        needsSync: boolean;
        syncType: "incremental" | "full" | "none";
        recommendedAction: string;
        videoDetails: YouTubeVideo;
        thumbnailUrl: string;
    } | null>(null);
    const [loadingVideoStats, setLoadingVideoStats] = useState<boolean>(false);

    // Similarity filtering state
    const [filterReferenceComments, setFilterReferenceComments] = useState<
        Array<AnalysisData["comments"][0] | SemanticSearchResult>
    >([]);
    const [similarComments, setSimilarComments] = useState<
        Array<(AnalysisData["comments"][0] | SemanticSearchResult) & { similarity: number }>
    >([]);
    const [loadingSimilarComments, setLoadingSimilarComments] = useState<boolean>(false);

    // Store previous state when similarity filtering is active
    const [previousState, setPreviousState] = useState<{
        selectedCluster: AnalysisDataCluster | null;
        clusterComments: AnalysisData["comments"];
        selectedSemanticSearch: string | null;
        semanticSearchResults: SemanticSearchResult[];
    } | null>(null);

    // Use the passed analysis data directly
    const currentAnalysisData = analysisData;

    // Listen for sidebar toggle event from MainHeader
    useEffect(() => {
        const handleToggleSidebar = () => {
            setSidebarOpen(prev => !prev);
        };

        window.addEventListener('toggleAnalysisSidebar', handleToggleSidebar);

        return () => {
            window.removeEventListener('toggleAnalysisSidebar', handleToggleSidebar);
        };
    }, []);

    // Status polling for ANALYZING_COMMENTS stage
    useEffect(() => {
        // Only poll if video is in ANALYZING_COMMENTS stage
        if (currentAnalysisData.project.status !== "COMPLETED") {
            console.log(`[STATUS_POLLING] Starting status polling for video ${videoId} in ANALYZING_COMMENTS stage`);

            // Request notification permission when starting to poll (non-blocking)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
                requestNotificationPermission().then(permission => {
                    console.log(`[STATUS_POLLING] Notification permission: ${permission}`);
                });
            }

            const pollStatus = async () => {
                try {
                    const response = await fetch(`/api/videos-analysis/${videoId}/status`);
                    if (response.ok) {
                        const statusData = await response.json();
                        console.log(`[STATUS_POLLING] Current status: ${statusData.status}`);

                        // If status changed to COMPLETED, send notification and reload the page
                        if (statusData.status === "COMPLETED") {
                            console.log(`[STATUS_POLLING] Analysis completed! Sending notification and reloading page...`);

                            // Send browser notification
                            sendBrowserNotification({
                                videoId: videoId,
                                title: currentAnalysisData.project.name,
                                status: 'COMPLETED',
                            });

                            // Small delay to ensure notification is displayed before reload
                            setTimeout(() => {
                                window.location.reload();
                            }, 500);
                        }
                    }
                } catch (error) {
                    console.error("[STATUS_POLLING] Error checking video status:", error);
                }
            };

            // Poll every 10 seconds
            const intervalId = setInterval(pollStatus, 10000);

            // Cleanup on unmount
            return () => {
                console.log(`[STATUS_POLLING] Stopping status polling for video ${videoId}`);
                clearInterval(intervalId);
            };
        }
    }, [videoId, currentAnalysisData.project.status, currentAnalysisData.project.name]);

    const loadSemanticSearches = async () => {
        try {
            const response = await fetch("/api/semantic-searches");
            if (response.ok) {
                const result = await response.json();
                setSemanticSearches(result.data || []);
            }
        } catch (error) {
            console.error("Error loading semantic searches:", error);
        } finally {
            setLoadingSemanticSearches(false);
        }
    };

    const fetchCurrentVideoStats = async () => {
        setLoadingVideoStats(true);
        try {
            const response = await fetch(`/api/videos/${videoId}/current-stats`);
            if (response.ok) {
                const result = await response.json();
                const videoDetails: YouTubeVideo = result.data;
                const analyzedCount = currentAnalysisData.comments?.length || 0;
                const currentCommentCount = videoDetails.commentCount || 0;
                const difference = currentCommentCount - analyzedCount;

                // This logic should be completed based on the original file
                setCurrentVideoStats({
                    currentCommentCount,
                    analyzedCommentCount: analyzedCount,
                    difference,
                    lastChecked: new Date().toISOString(),
                    needsSync: difference > 0,
                    syncType: difference > 0 ? "incremental" : "none",
                    recommendedAction: difference > 0 ? "Sync new comments" : "In sync",
                    videoDetails,
                    thumbnailUrl: videoDetails.thumbnailUrl,
                });
            }
        } catch (error) {
            console.error("Error fetching current video stats:", error);
        } finally {
            setLoadingVideoStats(false);
        }
    };

    useEffect(() => {
        loadSemanticSearches();
        fetchCurrentVideoStats();
        checkAndRunSentimentAnalysis();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    const createSemanticSearch = async () => {
        if (
            !createForm.title.trim() ||
            createForm.positiveExamples.filter((e) => e.trim()).length === 0
        ) {
            alert("Please provide a title and at least one positive example comment");
            return;
        }

        setCreatingSemanticSearch(true);
        try {
            const response = await fetch("/api/semantic-searches", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: createForm.title.trim(),
                    positiveExamples: createForm.positiveExamples.filter((e) => e.trim()),
                    negativeExamples: createForm.negativeExamples.filter((e) => e.trim()),
                    category: createForm.category.trim(),
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                setCreateForm({ title: "", positiveExamples: [""], negativeExamples: [], category: "" });
                loadSemanticSearches();
            } else {
                alert("Failed to create semantic search");
            }
        } catch (error) {
            console.error("Error creating semantic search:", error);
            alert("Error creating semantic search");
        } finally {
            setCreatingSemanticSearch(false);
        }
    };

    const updateSemanticSearch = async () => {
        if (!editingSearchId) return;

        if (
            !createForm.title.trim() ||
            createForm.positiveExamples.filter((e) => e.trim()).length === 0
        ) {
            alert("Please provide a title and at least one positive example comment");
            return;
        }

        setEditingSemanticSearch(editingSearchId);
        try {
            const response = await fetch(`/api/semantic-searches/${editingSearchId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: createForm.title.trim(),
                    positiveExamples: createForm.positiveExamples.filter((e) => e.trim()),
                    negativeExamples: createForm.negativeExamples.filter((e) => e.trim()),
                    category: createForm.category.trim(),
                }),
            });

            if (response.ok) {
                setShowCreateModal(false);
                setCreateForm({ title: "", positiveExamples: [""], negativeExamples: [], category: "" });
                setEditingSearchId(null);
                loadSemanticSearches();
            } else {
                alert("Failed to update semantic search");
            }
        } catch (error) {
            console.error("Error updating semantic search:", error);
            alert("Error updating semantic search");
        } finally {
            setEditingSemanticSearch(null);
        }
    };

    const startEditingSemanticSearch = (search: SemanticSearch) => {
        setEditingSearchId(search.id);

        // Extract positive and negative examples from the search
        let positiveExamples: string[] = [];
        let negativeExamples: string[] = [];

        // Handle both old and new format
        if (search.examples && search.examples.length > 0) {
            const firstExample = search.examples[0];

            // New format with include and exclude
            if (firstExample.include) {
                positiveExamples = firstExample.include.map(ex => ex.comment);
            }
            if (firstExample.exclude) {
                negativeExamples = firstExample.exclude.map(ex => ex.comment);
            }

            // Legacy format - treat all as positive examples
            if (positiveExamples.length === 0 && firstExample.comment) {
                positiveExamples = search.examples
                    .filter(ex => ex.comment)
                    .map(ex => ex.comment!);
            }
        }

        setCreateForm({
            title: search.title,
            positiveExamples: positiveExamples.length > 0 ? positiveExamples : [""],
            negativeExamples: negativeExamples,
            category: search.category || "",
        });
        setShowManageModal(false);
        setShowCreateModal(true);
    };

    const deleteSemanticSearch = async (id: string) => {
        if (!confirm("Are you sure you want to delete this semantic search?")) {
            return;
        }

        setDeletingSemanticSearch(id);
        try {
            const response = await fetch(`/api/semantic-searches/${id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                loadSemanticSearches();
                if (selectedSemanticSearch === id) {
                    setSelectedSemanticSearch(null);
                    setSemanticSearchResults([]);
                }
            } else {
                alert("Failed to delete semantic search");
            }
        } catch (error) {
            console.error("Error deleting semantic search:", error);
            alert("Error deleting semantic search");
        } finally {
            setDeletingSemanticSearch(null);
        }
    };

    const performSemanticSearch = async (searchId: string) => {
        if (selectedSemanticSearch === searchId) {
            setSelectedSemanticSearch(null);
            setSemanticSearchResults([]);
            return;
        }

        // Clear similarity filter when performing a new semantic search
        setFilterReferenceComments([]);
        setSimilarComments([]);
        setPreviousState(null);

        setSelectedCluster(null);
        setClusterComments([]);
        setSelectedSemanticSearch(searchId);
        setLoadingSemanticResults(true);

        try {
            const response = await fetch(
                `/api/videos/${videoId}/semantic-search/${searchId}?threshold=0.7&maxResults=100`
            );

            if (response.ok) {
                const result = await response.json();
                setSemanticSearchResults(result.data || []);
            } else {
                alert("Failed to perform semantic search");
                setSemanticSearchResults([]);
            }
        } catch (error) {
            console.error("Error performing semantic search:", error);
            setSemanticSearchResults([]);
            alert("Error performing semantic search");
        } finally {
            setLoadingSemanticResults(false);
        }
    };

    const performSemanticSearchByCategory = async (categoryLabel: string) => {
        // Get all semantic searches that match this category label
        const matchingSearches = semanticSearches.filter((search) => {
            const cat = (search.category || "").toLowerCase();
            const categoryLabelLower = categoryLabel.toLowerCase();
            return cat.includes(categoryLabelLower);
        });

        if (matchingSearches.length === 0) {
            console.warn(`No semantic searches found for category: ${categoryLabel}`);
            alert("No searches found for this category");
            return;
        }

        // Clear similarity filter when performing a new semantic search
        setFilterReferenceComments([]);
        setSimilarComments([]);
        setPreviousState(null);

        setSelectedCluster(null);
        setClusterComments([]);
        // Use a special ID for category searches so the component knows to display results
        setSelectedSemanticSearch(`category-${categoryLabel}`);
        setLoadingSemanticResults(true);

        try {
            // Combine all examples from all matching searches (positive and negative)
            const posEmbeddings: number[][] = [];
            const negEmbeddings: number[][] = [];

            for (const search of matchingSearches) {
                const examples = search.examples as Array<{
                    comment?: string;
                    embedding?: number[];
                    include?: Array<{ comment: string; embedding: number[] }>;
                    exclude?: Array<{ comment: string; embedding: number[] }>;
                }>;

                if (Array.isArray(examples) && examples.length > 0) {
                    const firstExample = examples[0];

                    // New format: extract include and exclude example embeddings
                    if (firstExample.include) {
                        firstExample.include.forEach(ex => {
                            if (Array.isArray(ex.embedding) && ex.embedding.length > 0) posEmbeddings.push(ex.embedding);
                        });
                    }
                    if (firstExample.exclude) {
                        firstExample.exclude.forEach(ex => {
                            if (Array.isArray(ex.embedding) && ex.embedding.length > 0) negEmbeddings.push(ex.embedding);
                        });
                    }

                    // Legacy format: treat top-level examples as positive
                    if (!firstExample.include && firstExample.comment && firstExample.embedding) {
                        examples.forEach(ex => {
                            if (ex.comment && Array.isArray(ex.embedding) && ex.embedding.length > 0) {
                                posEmbeddings.push(ex.embedding);
                            }
                        });
                    }
                }
            }

            if (posEmbeddings.length === 0) {
                console.warn(`No examples found in category: ${categoryLabel}`);
                alert("No examples found in this category");
                setSemanticSearchResults([]);
                setLoadingSemanticResults(false);
                return;
            }

            console.log(
                `[CATEGORY_SEARCH] Searching with pos:${posEmbeddings.length} neg:${negEmbeddings.length} examples from ${matchingSearches.length} searches in category: ${categoryLabel}`
            );

            // Use the API to search with contrastive embeddings
            const response = await fetch(
                `/api/videos/${videoId}/semantic-search-by-embeddings`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        positiveEmbeddings: posEmbeddings,
                        negativeEmbeddings: negEmbeddings,
                        posThreshold: 0.75,
                        margin: 0.1,
                        maxResults: 100,
                    }),
                }
            );

            if (response.ok) {
                const result = await response.json();
                setSemanticSearchResults(result.data || []);
                console.log(
                    `[CATEGORY_SEARCH] Found ${(result.data || []).length} matching comments`
                );
            } else {
                console.error("Failed to perform category semantic search");
                alert("Failed to perform search for this category");
                setSemanticSearchResults([]);
            }
        } catch (error) {
            console.error("Error performing category semantic search:", error);
            setSemanticSearchResults([]);
            alert("Error performing search for this category");
        } finally {
            setLoadingSemanticResults(false);
        }
    };

    const recountSemanticSearchResults = async () => {
        setRecountingSegmentResults(true);
        try {
            const response = await fetch(`/api/videos-analysis/recount-sentiment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ videoId }),
            });

            if (response.ok) {
                console.log("Sentiment analysis recounted successfully");
                // Reload the page to refresh all analysis data with the new sentiment results
                window.location.reload();
            } else {
                const error = await response.json();
                console.error(`Failed to recount sentiment: ${error.message || error.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Error recounting sentiment results:", error);
        } finally {
            setRecountingSegmentResults(false);
        }
    };

    // Auto-trigger sentiment analysis if missing
    const checkAndRunSentimentAnalysis = async () => {
        // Check if sentiment data is missing or empty
        const hasSentimentData =
            currentAnalysisData.summary?.sentimentBreakdown &&
            (currentAnalysisData.summary.sentimentBreakdown.positive > 0 ||
                currentAnalysisData.summary.sentimentBreakdown.negative > 0 ||
                currentAnalysisData.summary.sentimentBreakdown.neutral > 0);

        if (!hasSentimentData && currentAnalysisData.project.status === "COMPLETED") {
            console.log('[ANALYSIS] Sentiment data missing, triggering auto-recount');
            setLoadingSentimentAnalysis(true);
            try {
                const response = await fetch(`/api/videos-analysis/recount-sentiment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ videoId }),
                });

                if (response.ok) {
                    console.log("Sentiment analysis loaded successfully");
                    // Reload the page to refresh all analysis data with the new sentiment results
                    window.location.reload();
                } else {
                    const error = await response.json();
                    console.error(`Failed to load sentiment analysis: ${error.message || error.error || 'Unknown error'}`);
                    setLoadingSentimentAnalysis(false);
                }
            } catch (error) {
                console.error("Error loading sentiment analysis:", error);
                setLoadingSentimentAnalysis(false);
            }
        }
    };

    const handleClusterClick = async (cluster: AnalysisDataCluster) => {
        if (selectedCluster?.id === cluster.id) {
            setSelectedCluster(null);
            setClusterComments([]);
            return;
        }

        // Clear similarity filter when selecting a new cluster
        setFilterReferenceComments([]);
        setSimilarComments([]);
        setPreviousState(null);

        setSelectedSemanticSearch(null);
        setSemanticSearchResults([]);
        setSelectedCluster(cluster);
        setLoadingComments(true);
        setStreamingComments(false);
        setStreamingExpectedTotal(0);
        setClusterComments([]); // Clear previous comments

        try {
            let useStreaming = false;

            // Check if cluster has many comments - use streaming for large clusters
            if (cluster.id === "all-topics") {
                const totalComments = currentAnalysisData.project.totalComments;
                useStreaming = totalComments > 50;
            } else {
                const foundCluster: AnalysisDataCluster | undefined = currentAnalysisData.summary.clusters.find(c => c.id === cluster.id);
                const commentCount = foundCluster?.commentIDs?.length || 0;
                useStreaming = commentCount > 50;
            }

            if (useStreaming) {
                // Use Server-Sent Events for streaming large datasets
                const streamUrl = cluster.id === "all-topics"
                    ? `/api/videos/${videoId}/comments/stream`
                    : `/api/videos/${videoId}/comments/${encodeURIComponent(cluster.id)}/stream`;

                const eventSource = new EventSource(streamUrl);
                const accumulatedComments: AnalysisData["comments"] = [];

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        switch (data.type) {
                            case 'metadata':
                                console.log(`Starting to load ${data.total} comments for cluster: ${data.clusterName}`);
                                setStreamingComments(true);
                                setStreamingExpectedTotal(data.total || 0);
                                break;

                            case 'batch':
                                // Add new batch of comments
                                accumulatedComments.push(...data.data);
                                setClusterComments([...accumulatedComments]);
                                console.log(`Loaded ${data.progress || accumulatedComments.length} comments so far...`);
                                break;

                            case 'complete':
                                console.log(`Completed loading ${data.total || accumulatedComments.length} comments`);
                                setLoadingComments(false);
                                setStreamingComments(false);
                                eventSource.close();
                                break;

                            case 'error':
                                console.error('Stream error:', data.message);
                                setClusterComments([]);
                                setLoadingComments(false);
                                setStreamingComments(false);
                                eventSource.close();
                                break;
                        }
                    } catch (parseError) {
                        console.error('Error parsing stream data:', parseError);
                    }
                };

                eventSource.onerror = (error) => {
                    console.error('EventSource error:', error);
                    setClusterComments([]);
                    setLoadingComments(false);
                    setStreamingComments(false);
                    eventSource.close();
                };

                // Set a timeout to close the connection if it takes too long
                setTimeout(() => {
                    if (eventSource.readyState !== EventSource.CLOSED) {
                        eventSource.close();
                        setLoadingComments(false);
                        setStreamingComments(false);
                    }
                }, 60000); // 60 second timeout for larger datasets

            } else {
                // Use regular fetch for smaller clusters
                let response;
                if (cluster.id === "all-topics") {
                    response = await fetch(`/api/videos/${videoId}/comments`);
                } else {
                    response = await fetch(
                        `/api/videos/${videoId}/comments/${encodeURIComponent(cluster.id)}`
                    );
                }

                if (response.ok) {
                    const result = await response.json();
                    setClusterComments(result.data || []);
                } else {
                    setClusterComments([]);
                }
                setLoadingComments(false);
            }
        } catch (error) {
            console.error("Error fetching cluster comments:", error);
            setClusterComments([]);
            setLoadingComments(false);
            setStreamingComments(false);
        }
    }; const handleResyncAnalysis = async (forceSync: boolean = false) => {
        setIsResyncing(true);
        try {
            const response = await fetch("/api/videos/resync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    videoId,
                    forceSync,
                }),
            });

            if (response.ok) {
                // Poll for status or just reload
                window.location.reload();
            } else {
                alert("Failed to start resync.");
            }
        } catch (error) {
            console.error("Error resyncing analysis:", error);
        } finally {
            setIsResyncing(false);
        }
    };

    const handleDeleteVideo = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch("/api/videos/delete", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    videoId,
                }),
            });

            if (response.ok) {
                // Redirect to dashboard after successful deletion
                window.location.href = "/";
            } else {
                const error = await response.json();
                alert(error.error || "Failed to delete video. Please try again.");
                setShowDeleteConfirm(false);
            }
        } catch (error) {
            console.error("Error deleting video:", error);
            alert("Failed to delete video. Please try again.");
            setShowDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
        }
    };



    const handleCreateSemanticSearchFromSelected = () => {
        // If similarity filtering is active, use reference comments (not similar comments)
        if (filterReferenceComments.length > 0 && similarComments.length > 0) {
            // Take the reference comments that were used for filtering
            const referenceCommentTexts = filterReferenceComments.slice(0, 10).map(comment => comment.text);

            // Pre-populate the form with reference comments as positive examples
            setCreateForm({
                title: `Search pattern from ${referenceCommentTexts.length} reference comment${referenceCommentTexts.length !== 1 ? 's' : ''}`,
                positiveExamples: referenceCommentTexts,
                negativeExamples: [],
                category: "",
            });

            // Open the modal
            setShowCreateModal(true);
            return;
        }

        // Otherwise, use selected comments (original functionality)
        if (selectedComments.length === 0) {
            alert('Please select some comments first')
            return
        }

        // Get the actual comment text from selected comment IDs
        const selectedCommentTexts: string[] = []

        // Check in cluster comments
        if (clusterComments.length > 0) {
            clusterComments.forEach(comment => {
                if (selectedComments.includes(comment.id)) {
                    selectedCommentTexts.push(comment.text)
                }
                // Also check replies
                if (comment.replies) {
                    comment.replies.forEach(reply => {
                        if (selectedComments.includes(reply.id)) {
                            selectedCommentTexts.push(reply.text)
                        }
                    })
                }
            })
        }

        // Check in semantic search results
        if (semanticSearchResults.length > 0) {
            semanticSearchResults.forEach(result => {
                if (selectedComments.includes(result.id)) {
                    selectedCommentTexts.push(result.text)
                }
            })
        }

        // Check in main analysis data comments
        if (currentAnalysisData.comments) {
            currentAnalysisData.comments.forEach(comment => {
                if (selectedComments.includes(comment.id)) {
                    selectedCommentTexts.push(comment.text)
                }
                // Also check replies
                if (comment.replies) {
                    comment.replies.forEach(reply => {
                        if (selectedComments.includes(reply.id)) {
                            selectedCommentTexts.push(reply.text)
                        }
                    })
                }
            })
        }

        if (selectedCommentTexts.length === 0) {
            alert('Could not find the selected comments')
            return
        }

        // Limit to 10 examples (API constraint)
        const limitedTexts = selectedCommentTexts.slice(0, 10)

        // Pre-populate the form with selected comments as positive examples
        setCreateForm({
            title: `Search pattern from ${limitedTexts.length} selected comment${limitedTexts.length !== 1 ? 's' : ''}`,
            positiveExamples: limitedTexts,
            negativeExamples: [],
            category: "",
        })

        // Open the modal
        setShowCreateModal(true)

        // Clear selections
        setSelectedComments([])
    };

    const handleBulkAction = (action: "like" | "reply") => {
        console.log(`Bulk ${action} for comments:`, selectedComments)
        // TODO: Implement bulk actions
    };

    // Helper functions for similarity filtering
    const parsePgVectorString = (vectorString: string): number[] => {
        try {
            // Remove brackets and split by comma
            const cleanString = vectorString.replace(/[\[\]]/g, '');
            return cleanString.split(',').map(num => parseFloat(num.trim()));
        } catch (error) {
            console.error('Error parsing vector string:', error);
            return [];
        }
    };

    const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
        if (vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (normA * normB);
    };

    // Filter comments by similarity
    const handleFilterCommentsBySimilarity = async (
        referenceComment: AnalysisData["comments"][0] | SemanticSearchResult
    ) => {
        setLoadingSimilarComments(true);

        try {
            // Check if this comment is already in the reference list
            const isAlreadyReference = filterReferenceComments.some(ref => ref.id === referenceComment.id);
            if (isAlreadyReference) {
                setLoadingSimilarComments(false);
                return;
            }

            // Store current state before filtering (only if not already filtering)
            if (filterReferenceComments.length === 0) {
                setPreviousState({
                    selectedCluster,
                    clusterComments,
                    selectedSemanticSearch,
                    semanticSearchResults
                });
            }

            // Add the new reference comment to the list
            const newReferenceComments = [...filterReferenceComments, referenceComment];
            setFilterReferenceComments(newReferenceComments);

            // Get embeddings for all reference comments
            const referenceEmbeddings: number[][] = [];

            for (const refComment of newReferenceComments) {
                let referenceEmbedding: number[] | null = null;

                // Check if the comment already has an embedding
                if ('embedding' in refComment && refComment.embedding) {
                    referenceEmbedding = Array.isArray(refComment.embedding)
                        ? refComment.embedding
                        : parsePgVectorString(refComment.embedding as string);
                } else {
                    // Fallback to API call if embedding is not included in the comment data
                    const response = await fetch(`/api/videos/${videoId}/embedding/${refComment.id}`);
                    if (response.ok) {
                        const result = await response.json();
                        if (result.data?.embedding && typeof result.data.embedding === 'string') {
                            referenceEmbedding = parsePgVectorString(result.data.embedding);
                        }
                    }
                }

                if (referenceEmbedding) {
                    referenceEmbeddings.push(referenceEmbedding);
                }
            }

            if (referenceEmbeddings.length === 0) {
                alert('Could not find embeddings for reference comments. Similarity filtering is not available.');
                setFilterReferenceComments([]);
                setLoadingSimilarComments(false);
                return;
            }

            console.log(`[SIMILARITY] Found ${referenceEmbeddings.length} reference embeddings`);

            // Get all available comments with embeddings
            const allComments: Array<AnalysisData["comments"][0] | SemanticSearchResult> = [];

            // Use the original comments from before filtering (if we're already filtering)
            // or the current view (if this is the first filter)
            if (filterReferenceComments.length > 0 && previousState) {
                // We're already filtering, so use the original comments from previousState
                if (previousState.clusterComments.length > 0) {
                    allComments.push(...previousState.clusterComments);
                    // Add replies too
                    previousState.clusterComments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }

                if (previousState.semanticSearchResults.length > 0) {
                    allComments.push(...previousState.semanticSearchResults);
                }

                // Add main analysis data comments if no other comments available in previous state
                if (allComments.length === 0 && currentAnalysisData.comments) {
                    allComments.push(...currentAnalysisData.comments);
                    // Add replies too
                    currentAnalysisData.comments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }
            } else {
                // This is the first filter, so use current view
                // Add cluster comments if available
                if (clusterComments.length > 0) {
                    allComments.push(...clusterComments);
                    // Add replies too
                    clusterComments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }

                // Add semantic search results if available
                if (semanticSearchResults.length > 0) {
                    allComments.push(...semanticSearchResults);
                }

                // Add main analysis data comments if no other comments available
                if (allComments.length === 0 && currentAnalysisData.comments) {
                    allComments.push(...currentAnalysisData.comments);
                    // Add replies too
                    currentAnalysisData.comments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }
            }

            console.log(`[SIMILARITY] Processing ${allComments.length} comments for similarity matching`);

            // Calculate similarities using multiple references
            const commentsWithSimilarity: Array<(AnalysisData["comments"][0] | SemanticSearchResult) & { similarity: number }> = [];
            let commentsProcessed = 0;
            let commentsWithEmbeddings = 0;
            let commentsAboveThreshold = 0;

            for (const comment of allComments) {
                commentsProcessed++;
                // Skip reference comments themselves
                if (newReferenceComments.some(ref => ref.id === comment.id)) continue;

                let commentEmbedding: number[] | null = null;

                // Check if the comment already has an embedding
                if ('embedding' in comment && comment.embedding) {
                    commentEmbedding = Array.isArray(comment.embedding)
                        ? comment.embedding
                        : parsePgVectorString(comment.embedding as string);
                    commentsWithEmbeddings++;
                } else {
                    // Fallback to API call if embedding is not included in the comment data
                    try {
                        const response = await fetch(`/api/videos/${videoId}/embedding/${comment.id}`);
                        if (response.ok) {
                            const result = await response.json();
                            if (result.data?.embedding && typeof result.data.embedding === 'string') {
                                commentEmbedding = parsePgVectorString(result.data.embedding);
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch embedding for comment ${comment.id}:`, error);
                    }
                }

                if (commentEmbedding) {
                    // Calculate average similarity to all reference comments
                    const similarities = referenceEmbeddings.map(refEmb =>
                        calculateCosineSimilarity(refEmb, commentEmbedding!)
                    );
                    const averageSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

                    if (averageSimilarity > 0.3) { // Only include comments with reasonable similarity
                        commentsAboveThreshold++;
                        commentsWithSimilarity.push({
                            ...comment,
                            similarity: averageSimilarity
                        });
                    }
                }
            }

            console.log(`[SIMILARITY] Results: ${commentsProcessed} processed, ${commentsWithEmbeddings} had embeddings, ${commentsAboveThreshold} above threshold, ${commentsWithSimilarity.length} final results`);

            // Sort by similarity (highest first)
            commentsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

            // Set the similar comments
            setSimilarComments(commentsWithSimilarity);

            // Show alert if no similar comments found
            if (commentsWithSimilarity.length === 0) {
                alert(`No similar comments found. Processed ${commentsProcessed} comments, ${commentsWithEmbeddings} had embeddings, but none exceeded the similarity threshold (0.3).`);
            }

            // Clear current view to show only similarity results
            setSelectedCluster(null);
            setClusterComments([]);
            setSelectedSemanticSearch(null);
            setSemanticSearchResults([]);

        } catch (error) {
            console.error('Error filtering comments by similarity:', error);
            alert('Error filtering comments. Please try again.');
        } finally {
            setLoadingSimilarComments(false);
        }
    };

    // Clear similarity filter
    const clearSimilarityFilter = () => {
        setFilterReferenceComments([]);
        setSimilarComments([]);

        // Restore previous state if it exists
        if (previousState) {
            setSelectedCluster(previousState.selectedCluster);
            setClusterComments(previousState.clusterComments);
            setSelectedSemanticSearch(previousState.selectedSemanticSearch);
            setSemanticSearchResults(previousState.semanticSearchResults);
            setPreviousState(null);
        }
    };

    // Remove individual reference comment
    const removeReferenceComment = async (commentIdToRemove: string) => {
        // Find the comment being removed for confirmation
        const commentToRemove = filterReferenceComments.find(ref => ref.id === commentIdToRemove);
        if (!commentToRemove) return;

        const updatedReferences = filterReferenceComments.filter(ref => ref.id !== commentIdToRemove);
        setFilterReferenceComments(updatedReferences);

        // If no reference comments left, clear the filter completely
        if (updatedReferences.length === 0) {
            clearSimilarityFilter();
            return;
        }

        // Recalculate similarities with remaining reference comments
        setLoadingSimilarComments(true);
        try {
            // Get embeddings for remaining reference comments
            const referenceEmbeddings: number[][] = [];

            for (const refComment of updatedReferences) {
                let referenceEmbedding: number[] | null = null;

                // Check if the comment already has an embedding
                if ('embedding' in refComment && refComment.embedding) {
                    referenceEmbedding = Array.isArray(refComment.embedding)
                        ? refComment.embedding
                        : parsePgVectorString(refComment.embedding as string);
                } else {
                    // Fallback to API call if embedding is not included in the comment data
                    const response = await fetch(`/api/videos/${videoId}/embedding/${refComment.id}`);
                    if (response.ok) {
                        const result = await response.json();
                        if (result.data?.embedding && typeof result.data.embedding === 'string') {
                            referenceEmbedding = parsePgVectorString(result.data.embedding);
                        }
                    }
                }

                if (referenceEmbedding) {
                    referenceEmbeddings.push(referenceEmbedding);
                }
            }

            if (referenceEmbeddings.length === 0) {
                clearSimilarityFilter();
                return;
            }

            // Get all available comments with embeddings (use previous state if available)
            const allComments: Array<AnalysisData["comments"][0] | SemanticSearchResult> = [];

            // If we have previous state, use those comments as the source
            if (previousState) {
                if (previousState.clusterComments.length > 0) {
                    allComments.push(...previousState.clusterComments);
                    // Add replies too
                    previousState.clusterComments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }

                if (previousState.semanticSearchResults.length > 0) {
                    allComments.push(...previousState.semanticSearchResults);
                }

                // Add main analysis data comments if no other comments available in previous state
                if (allComments.length === 0 && currentAnalysisData.comments) {
                    allComments.push(...currentAnalysisData.comments);
                    // Add replies too
                    currentAnalysisData.comments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }
            } else {
                // Fallback to current comments (this shouldn't normally happen during similarity filtering)
                if (clusterComments.length > 0) {
                    allComments.push(...clusterComments);
                    // Add replies too
                    clusterComments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }

                if (semanticSearchResults.length > 0) {
                    allComments.push(...semanticSearchResults);
                }

                // Add main analysis data comments if no other comments available
                if (allComments.length === 0 && currentAnalysisData.comments) {
                    allComments.push(...currentAnalysisData.comments);
                    // Add replies too
                    currentAnalysisData.comments.forEach((comment: AnalysisData["comments"][0]) => {
                        if (comment.replies) {
                            allComments.push(...comment.replies);
                        }
                    });
                }
            }

            // Recalculate similarities using remaining references
            const commentsWithSimilarity: Array<(AnalysisData["comments"][0] | SemanticSearchResult) & { similarity: number }> = [];

            for (const comment of allComments) {
                // Skip reference comments themselves
                if (updatedReferences.some(ref => ref.id === comment.id)) continue;

                let commentEmbedding: number[] | null = null;

                // Check if the comment already has an embedding
                if ('embedding' in comment && comment.embedding) {
                    commentEmbedding = Array.isArray(comment.embedding)
                        ? comment.embedding
                        : parsePgVectorString(comment.embedding as string);
                } else {
                    // Fallback to API call if embedding is not included in the comment data
                    try {
                        const response = await fetch(`/api/videos/${videoId}/embedding/${comment.id}`);
                        if (response.ok) {
                            const result = await response.json();
                            if (result.data?.embedding && typeof result.data.embedding === 'string') {
                                commentEmbedding = parsePgVectorString(result.data.embedding);
                            }
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch embedding for comment ${comment.id}:`, error);
                    }
                }

                if (commentEmbedding) {
                    // Calculate average similarity to remaining reference comments
                    const similarities = referenceEmbeddings.map(refEmb =>
                        calculateCosineSimilarity(refEmb, commentEmbedding!)
                    );
                    const averageSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

                    if (averageSimilarity > 0.3) { // Only include comments with reasonable similarity
                        commentsWithSimilarity.push({
                            ...comment,
                            similarity: averageSimilarity
                        });
                    }
                }
            }

            // Sort by similarity (highest first)
            commentsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

            // Update similar comments
            setSimilarComments(commentsWithSimilarity);

        } catch (error) {
            console.error('Error recalculating similarities after removing reference:', error);
        } finally {
            setLoadingSimilarComments(false);
        }
    };

    return {
        selectedComments,
        setSelectedComments,
        isResyncing,
        selectedCluster,
        clusterComments,
        loadingComments,
        streamingComments,
        streamingExpectedTotal,
        semanticSearches,
        showCreateModal,
        setShowCreateModal,
        showManageModal,
        setShowManageModal,
        loadingSemanticSearches,
        selectedSemanticSearch,
        semanticSearchResults,
        loadingSemanticResults,
        createForm,
        setCreateForm,
        creatingSemanticSearch,
        deletingSemanticSearch,
        editingSemanticSearch,
        editingSearchId,
        setEditingSearchId,
        recountingSegmentResults,
        loadingSentimentAnalysis,
        activeTab,
        setActiveTab,
        sidebarOpen,
        setSidebarOpen,
        currentVideoStats,
        loadingVideoStats,
        currentAnalysisData,
        loadSemanticSearches,
        fetchCurrentVideoStats,
        createSemanticSearch,
        updateSemanticSearch,
        startEditingSemanticSearch,
        deleteSemanticSearch,
        performSemanticSearch,
        performSemanticSearchByCategory,
        recountSemanticSearchResults,
        handleClusterClick,
        handleResyncAnalysis,
        handleDeleteVideo,
        isDeleting,
        showDeleteConfirm,
        setShowDeleteConfirm,
        // Similarity filtering properties and functions
        filterReferenceComments,
        setFilterReferenceComments,
        similarComments,
        setSimilarComments,
        loadingSimilarComments,
        setLoadingSimilarComments,
        previousState,
        setPreviousState,
        handleFilterCommentsBySimilarity,
        clearSimilarityFilter,
        removeReferenceComment,
        // Dynamic category functions 
        handleCreateSemanticSearchFromSelected,
        handleBulkAction,
    };
}
