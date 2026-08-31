"use client";

import { ReactNode } from "react";
import { MainHeader } from "./MainHeader";
import { TooltipProvider } from "../ui/tooltip";

export interface UserDisplayInfo {
  email?: string;
  name?: string;
  avatarUrl?: string | null;
}

interface DashboardLayoutProps {
  children: ReactNode;
  user: UserDisplayInfo;
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <MainHeader user={user} />
        <main className="bg-background">{children}</main>
      </div>
    </TooltipProvider>
  );
}
