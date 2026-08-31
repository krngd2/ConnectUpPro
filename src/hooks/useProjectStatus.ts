"use client"

import { useState, useEffect } from 'react';

interface VideoStatus {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
  videosCount: number;
  commentsCount: number;
}

export function useVideoStatus(videoId: string | null, pollingInterval = 5000) {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId) return;

    const fetchStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/videos-analysis/${videoId}/status`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch video status');
        }
        
        const data = await response.json();
        setStatus(data);
        
        // Stop polling if video analysis is completed or failed
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          return; // Don't set up another timeout
        }
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchStatus();

    // Set up polling only if status is not final
    let intervalId: NodeJS.Timeout;
    
    if (status?.status !== 'COMPLETED' && status?.status !== 'FAILED') {
      intervalId = setInterval(fetchStatus, pollingInterval);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [videoId, pollingInterval, status?.status]);

  return { status, loading, error };
}

// Backward compatibility export
export function useProjectStatus(projectId: string | null, pollingInterval = 5000) {
  return useVideoStatus(projectId, pollingInterval);
}
