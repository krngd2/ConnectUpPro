"use client";

import { useState, useEffect } from "react";

interface OnboardingMetadata {
  hasCompletedDashboardTour: boolean;
  hasCompletedAnalysisTour: boolean;
}

interface UseOnboardingReturn {
  hasCompletedDashboardTour: boolean;
  hasCompletedAnalysisTour: boolean;
  loading: boolean;
  completeDashboardTour: () => Promise<void>;
  completeAnalysisTour: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export function useOnboarding(): UseOnboardingReturn {
  const [metadata, setMetadata] = useState<OnboardingMetadata>({
    hasCompletedDashboardTour: false,
    hasCompletedAnalysisTour: false,
  });
  const [loading, setLoading] = useState(true);

  // Fetch current onboarding status
  useEffect(() => {
    const fetchOnboardingStatus = async () => {
      try {
        const response = await fetch("/api/user/onboarding");
        if (response.ok) {
          const data = await response.json();
          setMetadata(data.metadata);
        }
      } catch (error) {
        console.error("Error fetching onboarding status:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOnboardingStatus();
  }, []);

  const completeDashboardTour = async () => {
    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasCompletedDashboardTour: true }),
      });

      if (response.ok) {
        setMetadata((prev) => ({ ...prev, hasCompletedDashboardTour: true }));
      }
    } catch (error) {
      console.error("Error completing dashboard tour:", error);
    }
  };

  const completeAnalysisTour = async () => {
    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasCompletedAnalysisTour: true }),
      });

      if (response.ok) {
        setMetadata((prev) => ({ ...prev, hasCompletedAnalysisTour: true }));
      }
    } catch (error) {
      console.error("Error completing analysis tour:", error);
    }
  };

  const resetOnboarding = async () => {
    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hasCompletedDashboardTour: false,
          hasCompletedAnalysisTour: false,
        }),
      });

      if (response.ok) {
        setMetadata({
          hasCompletedDashboardTour: false,
          hasCompletedAnalysisTour: false,
        });
      }
    } catch (error) {
      console.error("Error resetting onboarding:", error);
    }
  };

  return {
    hasCompletedDashboardTour: metadata.hasCompletedDashboardTour,
    hasCompletedAnalysisTour: metadata.hasCompletedAnalysisTour,
    loading,
    completeDashboardTour,
    completeAnalysisTour,
    resetOnboarding,
  };
}
