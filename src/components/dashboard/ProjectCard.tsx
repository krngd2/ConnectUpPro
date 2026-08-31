import React from "react";
import Image from "next/image";
import { VideoStatus } from "@/lib/constants";
import {
  // Plus,
  Play,
  PlayCircle,
  MessageSquare,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  // Users,
  // Eye,
  // Video,
  Download,
  Brain,
  Search,
} from "lucide-react";

const statusConfig: Record<
  VideoStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    label: string;
  }
> = {
  PENDING: {
    icon: Clock,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    label: "Pending",
  },
  FETCHING_DETAILS: {
    icon: Search,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Fetching Details",
  },
  DOWNLOADING_COMMENTS: {
    icon: Download,
    color: "text-blue-600",
    bg: "bg-blue-600/10",
    label: "Downloading Comments",
  },
  ANALYZING_COMMENTS: {
    icon: Brain,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    label: "Analyzing Comments",
  },
  COMPLETED: {
    icon: CheckCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
    label: "Completed",
  },
  FAILED: {
    icon: AlertCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Failed",
  },
};

// Project type definition
export type Project = {
  id: string;
  name: string;
  videosCount: number;
  commentsAnalyzed: number;
  status: VideoStatus;
  createdAt: Date | string;
  thumbnail?: string;
};
export function ProjectCard({
  project,
  onSelect,
  onMouseEnter,
}: {
  project: Project;
  onSelect: () => void;
  onMouseEnter?: () => void;
}) {
  const status = statusConfig[project.status ?? "FAILED"];
  const StatusIcon = status?.icon;
  const createdAt =
    typeof project.createdAt === "string"
      ? new Date(project.createdAt)
      : project.createdAt;

  return (
    <div
      className="bg-card rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] border border-border"
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-muted relative">
        {project.thumbnail ? (
          <Image
            src={project.thumbnail}
            alt={project.name}
            width={400}
            height={225}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-12 w-12 text-muted-foreground" />
          </div>
        )}

        {/* Status Badge */}
        <div
          className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${status.bg} backdrop-blur-sm`}
        >
          <StatusIcon className={`h-3 w-3 ${status.color}`} />
          <span className={status.color}>{status.label}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex gap-3">
          {/* Channel Avatar Placeholder */}
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
            <PlayCircle className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-5 mb-1">
              {project.name}
            </h3>

            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                <span>
                  {project.commentsAnalyzed.toLocaleString()} comments
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{createdAt.toLocaleDateString()}</span>
              </div>
            </div>

            {/* Action Button */}
            <button
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                project.status === "COMPLETED"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
              disabled={project.status !== "COMPLETED"}
            >
              {project.status === "COMPLETED"
                ? "View Analysis"
                : project.status === "PENDING"
                ? "Waiting..."
                : project.status === "FETCHING_DETAILS"
                ? "Fetching..."
                : project.status === "DOWNLOADING_COMMENTS"
                ? "Downloading..."
                : project.status === "ANALYZING_COMMENTS"
                ? "Analyzing..."
                : "View Details"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
