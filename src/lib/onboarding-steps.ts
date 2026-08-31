import { OnboardingStep } from "@/components/ui/OnboardingModal";

export const analysisOnboardingSteps: OnboardingStep[] = [
  {
    title: "Welcome to Video Analysis!",
    description:
      "This is your analysis dashboard where you can explore insights from your video comments. Let's take a quick tour to help you get the most out of this tool.",
    // You can add your own GIF/video URLs here
    // mediaUrl: "/onboarding/welcome.gif",
    // mediaType: "image",
  },
  {
    title: "Navigate Clusters & Categories",
    description:
      "Use the sidebar to browse through comment clusters and categories. Clusters group similar comments together using AI, making it easy to identify common themes and topics in your video.",
    // mediaUrl: "/onboarding/sidebar-navigation.gif",
    // mediaType: "image",
  },
  {
    title: "Explore Comments & Semantic Search",
    description:
      "View individual comments in threads, perform semantic searches to find specific topics, and analyze sentiment. You can save custom searches and filter comments by various criteria to dive deeper into your audience feedback.",
    // mediaUrl: "/onboarding/comments-search.gif",
    // mediaType: "image",
  },
];
