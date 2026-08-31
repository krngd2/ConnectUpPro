"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Play, Users } from "lucide-react";
import { Project, ProjectCard } from "./ProjectCard";
import { ChannelCard } from "./ChannelCard";
import { NewAnalysisModal } from "./NewAnalysisModal";
import { toast } from "sonner";
import { useOnboarding } from "@/hooks/useOnboarding";

// YouTube Channel type definition
type YouTubeChannel = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
  customUrl?: string;
};

export function ProjectsDashboard() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [channels, setChannels] = useState<YouTubeChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Onboarding state
  const {
    hasCompletedDashboardTour,
    loading: onboardingLoading,
    completeDashboardTour,
  } = useOnboarding();
  const [showTour, setShowTour] = useState(false);

  // Fetch video analyses from API
  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/videos-analysis");
      const result = await response.json();

      if (response.ok) {
        setProjects(result.projects || []);
      } else {
        console.error("Error fetching video analyses:", result.error);

        // Show specific error messages based on status
        if (response.status === 503) {
          toast("Database Connection Error", {
            description:
              "Cannot connect to the database. Please check your environment variables and database configuration.",
          });
        } else {
          toast("Error loading analyses", {
            description:
              result.error ||
              "Failed to load your video analyses. Please refresh the page.",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching video analyses:", error);
      toast("Network Error", {
        description:
          "Cannot connect to the server. Please check your connection and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch channels from API
  const fetchChannels = async () => {
    try {
      const response = await fetch("/api/channels");
      const result = await response.json();

      if (response.ok) {
        setChannels(result.channels || []);
      } else {
        toast("Error loading channels", {
          description: result.error || "Failed to load YouTube channels.",
        });
      }
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast("Network Error", {
        description:
          "Cannot connect to the server. Please check your connection and try again.",
      });
    } finally {
      setChannelsLoading(false);
    }
  };

  // Load projects and channels on component mount
  useEffect(() => {
    fetchProjects();
    fetchChannels();
  }, []);

  // Show tour for new users after data loads
  useEffect(() => {
    if (!loading && !onboardingLoading && !hasCompletedDashboardTour) {
      // Show tour after a brief delay for better UX
      const timer = setTimeout(() => {
        setShowTour(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, onboardingLoading, hasCompletedDashboardTour]);

  const handleSelectProject = (projectId: string) => {
    router.push(`/analysis/${projectId}`);
  };

  const handleSelectChannel = (channelId: string) => {
    router.push(`/channel/${channelId}`);
  };

  // Prefetch routes on hover for instant navigation
  const handlePrefetchProject = (projectId: string) => {
    router.prefetch(`/analysis/${projectId}`);
  };

  const handlePrefetchChannel = (channelId: string) => {
    router.prefetch(`/channel/${channelId}`);
  };

  return (
    <div className="bg-background">
      {/* YouTube-style Header Section */}
      <div className="border-b border-border bg-background">
        <div className="py-6 px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-medium text-foreground">
                Your Video Analyses
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Analyze individual YouTube videos and their comment data
              </p>
            </div>
            <div className="flex items-center gap-3">
              {showTour && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground animate-[slide_1s_ease-in-out_infinite]">
                    Click here to get started →
                  </span>
                </div>
              )}
              <button
                id="create-analysis-button"
                onClick={() => {
                  setIsModalOpen(true);
                  if (showTour) {
                    setShowTour(false);
                    completeDashboardTour();
                  }
                }}
                className="youtube-button flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide {
          0%,
          100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-10px);
          }
        }
      `}</style>

      {/* Main Content */}
      <div className="container py-6 px-6">
        {/* Projects Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-card rounded-xl overflow-hidden border border-border"
              >
                {/* Thumbnail skeleton */}
                <div className="aspect-video bg-muted animate-shimmer"></div>

                {/* Content skeleton */}
                <div className="p-3">
                  <div className="flex gap-3">
                    {/* Avatar skeleton */}
                    <div className="w-9 h-9 rounded-full bg-muted animate-shimmer flex-shrink-0"></div>

                    {/* Text content skeleton */}
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted animate-shimmer rounded w-full"></div>
                      <div className="h-4 bg-muted animate-shimmer rounded w-3/4"></div>
                      <div className="h-3 bg-muted animate-shimmer rounded w-1/2"></div>
                    </div>
                  </div>

                  {/* Footer skeleton */}
                  <div className="mt-3 flex justify-between items-center">
                    <div className="h-3 bg-muted animate-shimmer rounded w-24"></div>
                    <div className="h-3 bg-muted animate-shimmer rounded w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto max-w-md">
              <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
                <Play className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-2">No analyses yet</h3>
              <p className="text-muted-foreground mb-8 text-sm">
                Get started by analyzing your first YouTube video to understand
                your audience
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="youtube-button flex items-center gap-2 mx-auto"
              >
                <Plus className="h-4 w-4" />
                Analyze Your First Video
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onSelect={() => handleSelectProject(project.id)}
                onMouseEnter={() => handlePrefetchProject(project.id)}
              />
            ))}
          </div>
        )}

        {/* Channels Section */}
        <div className="mt-12">
          <div className="mb-6">
            <h2 className="text-xl font-medium text-foreground mb-1">
              YouTube Channels
            </h2>
            <p className="text-muted-foreground text-sm">
              Channels accessible with your YouTube API configuration
            </p>
          </div>

          {/* Channels Grid */}
          {channelsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex items-start gap-3 mb-4">
                    {/* Channel avatar skeleton */}
                    <div className="w-14 h-14 rounded-full bg-muted animate-shimmer flex-shrink-0"></div>

                    {/* Channel info skeleton */}
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted animate-shimmer rounded w-full"></div>
                      <div className="h-3 bg-muted animate-shimmer rounded w-3/4"></div>
                    </div>
                  </div>

                  {/* Stats skeleton */}
                  <div className="space-y-2">
                    <div className="h-3 bg-muted animate-shimmer rounded w-full"></div>
                    <div className="flex justify-between">
                      <div className="h-3 bg-muted animate-shimmer rounded w-20"></div>
                      <div className="h-3 bg-muted animate-shimmer rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto max-w-md">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-6">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No channels found</h3>
                <p className="text-muted-foreground text-sm">
                  No YouTube channels are accessible with the current API
                  configuration
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onSelect={() => handleSelectChannel(channel.id)}
                  onMouseEnter={() => handlePrefetchChannel(channel.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Analysis Modal */}
      {isModalOpen && (
        <NewAnalysisModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          fetchProjects={fetchProjects}
          setSubmitting={setSubmitting}
          submitting={submitting}
        />
      )}

    </div>
  );
}
