import React, { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import Image from "next/image";
import { extractVideoIdFromYTUrl } from "@/lib/youtube-utils";
import { YouTubeVideo } from "@/lib/types";

interface NewAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  fetchProjects: () => void; // Optional prop to refresh projects
  setSubmitting: (submitting: boolean) => void; // Optional prop to set submitting state
  submitting: boolean; // Optional prop to check if submitting
}

// Form Schema - initially only URL
const urlFormSchema = z.object({
  videoUrl: z
    .string()
    .min(1, { message: "YouTube URL is required." })
    .refine(
      (url) => {
        const videoId = extractVideoIdFromYTUrl(url);
        return videoId !== null;
      },
      {
        message:
          "Please enter a valid YouTube video URL (e.g., https://youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID).",
      }
    ),
});

// Form Schema - with title after video details are fetched
const fullFormSchema = z.object({
  videoUrl: z.string().url({
    message: "Please enter a valid YouTube video URL.",
  }),
  analysisName: z.string().min(1, {
    message: "Analysis name is required.",
  }),
});

export const NewAnalysisModal: React.FC<NewAnalysisModalProps> = ({
  // isOpen,
  onClose,
  fetchProjects,
  setSubmitting,
  submitting,
}) => {
  const [videoDetails, setVideoDetails] = useState<YouTubeVideo | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [urlValidated, setUrlValidated] = useState(false);

  const form = useForm<z.infer<typeof urlFormSchema>>({
    resolver: zodResolver(urlFormSchema),
    defaultValues: {
      videoUrl: "",
    },
  });

  const fullForm = useForm<z.infer<typeof fullFormSchema>>({
    resolver: zodResolver(fullFormSchema),
    defaultValues: {
      videoUrl: "",
      analysisName: "",
    },
  });

  // Function to fetch video details when URL changes
  const fetchVideoDetails = useCallback(
    async (url: string) => {
      const videoId = extractVideoIdFromYTUrl(url);
      if (!videoId) {
        setVideoDetails(null);
        setUrlValidated(false);
        return;
      }

      setLoadingVideo(true);
      try {
        const response = await fetch("/api/video-details", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ videoUrl: url }),
        });

        const result = await response.json();

        if (response.ok) {
          setVideoDetails(result.videoDetails);
          setUrlValidated(true);
          // Set the default title in the full form
          fullForm.setValue("analysisName", result.videoDetails.title);
          fullForm.setValue("videoUrl", url);
        } else {
          setVideoDetails(null);
          setUrlValidated(false);
          toast("Invalid YouTube URL", {
            description:
              result.error ||
              "Could not fetch video details. Please check the URL.",
          });
        }
      } catch (error) {
        console.error("Error fetching video details:", error);
        setVideoDetails(null);
        setUrlValidated(false);
        toast("Error fetching video", {
          description: "Failed to load video details. Please try again.",
        });
      } finally {
        setLoadingVideo(false);
      }
    },
    [fullForm]
  );

  // Watch for URL changes to fetch video details
  useEffect(() => {
    const subscription = form.watch((value) => {
      const url = value.videoUrl;
      if (url && url !== "") {
        // Debounce the API call
        const timeoutId = setTimeout(() => {
          fetchVideoDetails(url);
        }, 500);
        return () => clearTimeout(timeoutId);
      } else {
        setVideoDetails(null);
        setUrlValidated(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, fetchVideoDetails]);

  function onSubmit(data: z.infer<typeof fullFormSchema>) {
    setSubmitting(true);

    // Call the API to create the video analysis
    fetch("/api/videos-analysis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: data.analysisName,
        videoUrl: data.videoUrl,
      }),
    })
      .then(async (response) => {
        const result = await response.json();

        if (response.ok) {
          const isExisting = result.video?.isExisting;
          const status = result.video?.status;

          if (isExisting && status === "COMPLETED") {
            toast("Video analysis already exists", {
              description: `Analysis for this video already completed.`,
            });
          } else {
            toast("Video analysis created successfully", {
              description: isExisting
                ? "Found existing video, analysis resuming in background."
                : "New video created, analysis running in background.",
            });
          }

          //   setIsModalOpen(false);
          onClose();
          form.reset();
          fullForm.reset();
          setVideoDetails(null);
          setUrlValidated(false);
          // Refresh the projects list
          fetchProjects();
        } else {
          toast("Error creating analysis", {
            description:
              result.error || "Something went wrong. Please try again.",
          });
        }
      })
      .catch((error) => {
        console.error("Error creating analysis:", error);
        toast("Error creating analysis", {
          description:
            "Network error. Please check your connection and try again.",
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/20 backdrop-blur-sm">
      <Card
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border shadow-lg"
        style={{ backgroundColor: "hsl(var(--card))" }}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="p-4 pb-0">
            <CardTitle className="text-xl">New Video Analysis</CardTitle>
            <CardDescription>
              Analyze comments from a YouTube video
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onClose()}>
            <Plus className="h-4 w-4 rotate-45" />
          </Button>
        </CardHeader>

        <CardContent>
          {!urlValidated ? (
            // Step 1: URL Input Only
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(() => {})}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube Video URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://youtube.com/watch?v=..."
                          {...field}
                          disabled={loadingVideo}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter a YouTube video URL to analyze its comments.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {loadingVideo && (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-2"></div>
                    <span className="text-sm text-muted-foreground">
                      Fetching video details...
                    </span>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onClose()}
                    disabled={loadingVideo}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={!urlValidated || loadingVideo}
                    className="youtube-button"
                    onClick={() => {
                      // Move to step 2 - this is handled by the useEffect watching URL changes
                    }}
                  >
                    Next
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            // Step 2: Video Details with Editable Title
            <Form {...fullForm}>
              <form
                onSubmit={fullForm.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* Video Preview */}
                {videoDetails && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <div className="flex items-start space-x-4">
                      <Image
                        src={videoDetails.thumbnailUrl}
                        alt={videoDetails.title}
                        width={96}
                        height={72}
                        className="object-cover rounded-md flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-muted-foreground mb-1">
                          Video Preview
                        </h3>
                        <p className="text-sm text-foreground line-clamp-2">
                          {videoDetails.title}
                        </p>
                        {videoDetails.commentCount !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {videoDetails.commentCount.toLocaleString()}{" "}
                            comments
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <FormField
                  control={fullForm.control}
                  name="analysisName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Analysis Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter analysis name" {...field} />
                      </FormControl>
                      <FormDescription>
                        Customize the name for this video analysis (defaults to
                        video title).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUrlValidated(false);
                      setVideoDetails(null);
                      form.reset();
                      fullForm.reset();
                    }}
                    disabled={submitting}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="youtube-button"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      "Start Analysis"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
