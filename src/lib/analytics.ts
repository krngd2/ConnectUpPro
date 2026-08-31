/**
 * Google Analytics helper functions for tracking custom events
 */

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

type EventParams = {
  [key: string]: string | number | boolean | undefined;
};

/**
 * Send a custom event to Google Analytics
 * @param eventName - Name of the event
 * @param eventParams - Additional parameters for the event
 */
export const trackEvent = (eventName: string, eventParams?: EventParams) => {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, eventParams);
  }
};

/**
 * Track video analysis events
 */
export const trackVideoAnalysis = (action: string, videoId?: string) => {
  trackEvent("video_analysis", {
    action,
    video_id: videoId,
  });
};

/**
 * Track cluster analysis events
 */
export const trackClusterAnalysis = (action: string, videoId?: string, clusterId?: string) => {
  trackEvent("cluster_analysis", {
    action,
    video_id: videoId,
    cluster_id: clusterId,
  });
};

/**
 * Track search events
 */
export const trackSearch = (searchType: string, query?: string) => {
  trackEvent("search", {
    search_type: searchType,
    search_term: query,
  });
};

/**
 * Track navigation events
 */
export const trackNavigation = (destination: string) => {
  trackEvent("navigation", {
    destination,
  });
};

/**
 * Track errors
 */
export const trackError = (errorType: string, errorMessage?: string) => {
  trackEvent("error", {
    error_type: errorType,
    error_message: errorMessage,
  });
};

/**
 * Track engagement time
 */
export const trackEngagement = (feature: string, timeSpent: number) => {
  trackEvent("engagement", {
    feature,
    time_spent: timeSpent,
  });
};
