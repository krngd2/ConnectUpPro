export default function DashboardLoading() {
  return (
    <div className="bg-background min-h-screen">
      {/* Header Section Skeleton */}
      <div className="border-b border-border bg-background">
        <div className="py-6 px-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-8 bg-muted animate-shimmer rounded w-64"></div>
              <div className="h-4 bg-muted animate-shimmer rounded w-96"></div>
            </div>
            <div className="h-10 w-28 bg-muted animate-shimmer rounded"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-6 px-6">
        {/* Projects Grid Skeleton */}
        <div className="mb-12">
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
        </div>

        {/* Channels Section Skeleton */}
        <div className="mt-12">
          <div className="mb-6 space-y-1">
            <div className="h-6 bg-muted animate-shimmer rounded w-48"></div>
            <div className="h-4 bg-muted animate-shimmer rounded w-96"></div>
          </div>

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
        </div>
      </div>
    </div>
  );
}
