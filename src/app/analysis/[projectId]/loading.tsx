export default function AnalysisLoading() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Skeleton */}
      <div className="w-80 border-r border-border bg-card flex-shrink-0 h-screen overflow-hidden">
        <div className="p-6 space-y-4">
          {/* Header skeleton */}
          <div className="space-y-3">
            <div className="h-6 bg-muted animate-shimmer rounded w-3/4"></div>
            <div className="h-4 bg-muted animate-shimmer rounded w-1/2"></div>
          </div>

          {/* Search bar skeleton */}
          <div className="h-10 bg-muted animate-shimmer rounded"></div>

          {/* Clusters skeleton */}
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-12 bg-muted animate-shimmer rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="container py-6 px-4 md:px-8">
            <div className="max-w-7xl mx-auto">
              {/* Header Skeleton */}
              <div className="mb-6 space-y-4">
                <div className="flex items-start gap-4">
                  {/* Video thumbnail skeleton */}
                  <div className="w-48 h-27 bg-muted animate-shimmer rounded-lg flex-shrink-0"></div>

                  {/* Video info skeleton */}
                  <div className="flex-1 space-y-3">
                    <div className="h-7 bg-muted animate-shimmer rounded w-3/4"></div>
                    <div className="h-4 bg-muted animate-shimmer rounded w-1/2"></div>
                    <div className="flex gap-4">
                      <div className="h-4 bg-muted animate-shimmer rounded w-20"></div>
                      <div className="h-4 bg-muted animate-shimmer rounded w-20"></div>
                      <div className="h-4 bg-muted animate-shimmer rounded w-20"></div>
                    </div>
                  </div>
                </div>

                {/* Action buttons skeleton */}
                <div className="flex gap-2">
                  <div className="h-9 bg-muted animate-shimmer rounded w-32"></div>
                  <div className="h-9 bg-muted animate-shimmer rounded w-32"></div>
                </div>
              </div>

              {/* Comments Feed Skeleton */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="border border-border rounded-lg p-4 bg-card"
                  >
                    <div className="flex gap-3">
                      {/* Avatar skeleton */}
                      <div className="w-10 h-10 bg-muted animate-shimmer rounded-full flex-shrink-0"></div>

                      {/* Comment content skeleton */}
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <div className="h-4 bg-muted animate-shimmer rounded w-32"></div>
                          <div className="h-4 bg-muted animate-shimmer rounded w-20"></div>
                        </div>
                        <div className="h-4 bg-muted animate-shimmer rounded w-full"></div>
                        <div className="h-4 bg-muted animate-shimmer rounded w-4/5"></div>
                        <div className="flex gap-3 mt-2">
                          <div className="h-4 bg-muted animate-shimmer rounded w-16"></div>
                          <div className="h-4 bg-muted animate-shimmer rounded w-16"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
