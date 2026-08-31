import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ThemeProvider } from "@/components/theme-provider";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { Suspense } from "react";
import "../../app/globals.css"; // Ensure global styles are imported

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "ConnectUpPro - YouTube Analytics Dashboard",
  description: "Advanced analytics and insights for YouTube creators",
};

export default async function LayoutComponent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const userDisplayInfo = {
    name: process.env.LOCAL_USER_NAME || "Local Workspace",
    email: process.env.LOCAL_USER_EMAIL || "local@connectuppro.local",
    avatarUrl: null,
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${roboto.variable} font-roboto antialiased`}
        suppressHydrationWarning={true}
      >
        <Suspense fallback={null}>
          <GoogleAnalytics measurementId={process.env.GA_MEASUREMENT_ID || ""} />
        </Suspense>
        <ThemeProvider defaultTheme="system" storageKey="connectuppro-ui-theme">
          <DashboardLayout user={userDisplayInfo}>{children}</DashboardLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
