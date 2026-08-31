"use client";

import { useEffect, useState } from "react";
import { useAnalysisView } from "@/hooks/useAnalysisView";
import { AnalysisData } from "@/lib/analysis";
import { AnalysisSidebar } from "./sub-components/Sidebar/AnalysisSidebar";
import { AnalysisHeader } from "./sub-components/AnalysisHeader";
import { CommentsFeed } from "./sub-components/CommentsFeed/CommentsFeed";
import { SemanticSearchModals } from "./sub-components/Sidebar/SemanticSearchModals";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingModal } from "@/components/ui/OnboardingModal";
import { analysisOnboardingSteps } from "@/lib/onboarding-steps";

interface AnalysisViewProps {
  videoId?: string;
  analysisData: AnalysisData;
}

// Extended hooks type that includes category filtering state
export type EnhancedHooksType = ReturnType<typeof useAnalysisView> & {
  videoId: string;
};

export function AnalysisView({
  videoId = "1",
  analysisData,
}: AnalysisViewProps) {
  const hooks = useAnalysisView(videoId, analysisData);

  // Onboarding state
  const {
    hasCompletedAnalysisTour,
    loading: onboardingLoading,
    completeAnalysisTour,
  } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding modal for new users
  useEffect(() => {
    if (!onboardingLoading && !hasCompletedAnalysisTour) {
      // Show after a brief delay for better UX
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [onboardingLoading, hasCompletedAnalysisTour]);

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    completeAnalysisTour();
  };

  const handleSkipOnboarding = () => {
    setShowOnboarding(false);
    completeAnalysisTour();
  };

  // Enhanced hooks object to pass to child components
  const enhancedHooks: EnhancedHooksType = {
    ...hooks,
    videoId,
  };

  return (
    <div className="min-h-screen bg-background lg:flex">
      <AnalysisSidebar hooks={enhancedHooks} />

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container py-6 px-4 md:px-8">
            <div className="max-w-7xl mx-auto">
              <AnalysisHeader hooks={enhancedHooks} />

              <div className="space-y-6 mt-6">
                <CommentsFeed hooks={enhancedHooks} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SemanticSearchModals hooks={enhancedHooks} />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        steps={analysisOnboardingSteps}
        onComplete={handleCompleteOnboarding}
        onSkip={handleSkipOnboarding}
      />
    </div>
  );
}
