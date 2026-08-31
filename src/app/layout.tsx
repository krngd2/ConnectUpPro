import { Roboto } from "next/font/google";
import LayoutComponent from "@/components/dashboard/layout-component";
import "@/lib/video-processing-queue"; // side-effect: starts queue processor (server only)
import NotificationPermissionPrompt from "@/components/NotificationPermissionPrompt";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={roboto.variable}>
      <LayoutComponent>{children}</LayoutComponent>
      {/* Client-side notification permission prompt */}
      <NotificationPermissionPrompt />
    </div>
  );
}
