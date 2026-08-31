"use client";

import React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { PlayCircle, Settings, Menu } from "lucide-react";
import { UserDisplayInfo } from "./dashboard-layout";
import { usePathname } from "next/navigation";

// Helper function to generate initials for AvatarFallback
const getInitials = (name?: string, email?: string): string => {
  if (name) {
    const words = name.split(" ").filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length > 0) {
      return words[0].substring(0, Math.min(words[0].length, 2)).toUpperCase();
    }
  }
  if (email) {
    const prefix = email.split("@")[0];
    if (prefix && prefix.length > 0) {
      return prefix.substring(0, Math.min(prefix.length, 2)).toUpperCase();
    }
  }
  return "??";
};
export const MainHeader: React.FC<{
  user: UserDisplayInfo;
}> = ({ user }) => {
  const pathname = usePathname();
  const isAnalysisPage = pathname.startsWith("/analysis");

  const handleMenuClick = () => {
    // Dispatch custom event to toggle sidebar
    window.dispatchEvent(new CustomEvent("toggleAnalysisSidebar"));
  };

  return (
    <header className="youtube-header h-14 flex items-center justify-between px-4 border-b border-border top-0 z-10">
      <div className="flex items-center gap-4">
        {/* Mobile menu button for analysis page */}
        {isAnalysisPage && (
          <button
            onClick={handleMenuClick}
            className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <YouTubeLogo />
        {/* Navigation links */}
        {isAnalysisPage && (
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-md transition-colors"
          >
            ← Dashboard
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />

        {/* Settings Link */}
        <Link
          href="/settings"
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>

        {/* User dropdown/profile */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-sm font-medium">
              {user?.name || user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-xs text-muted-foreground">
              {user?.email || "No email provided"}
            </p>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={user?.avatarUrl ?? undefined}
              alt={user?.name || "User Avatar"}
            />
            <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
};

const YouTubeLogo = () => (
  <Link
    href="/"
    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
  >
    <div className="w-8 h-8 bg-red-500 rounded-sm flex items-center justify-center">
      <PlayCircle className="h-5 w-5 text-white" />
    </div>
    <span className="text-xl font-medium text-foreground">ConnectUpPro</span>
  </Link>
);
