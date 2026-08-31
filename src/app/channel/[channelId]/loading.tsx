export default function ChannelLoading() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container py-6 pl-4 md:pl-8">
        {/* Back button skeleton */}
        <div className="mb-6">
          <div className="h-10 bg-muted animate-shimmer rounded w-40"></div>
        </div>

        {/* Channel Header Skeleton */}
        <div className="mb-8">
          <div className="border border-border rounded-lg p-6">
            <div className="flex items-start gap-6">
              {/* Channel Avatar Skeleton */}
              <div className="flex-shrink-0">
                <div className="w-30 h-30 rounded-full bg-muted animate-shimmer"></div>
              </div>

              {/* Channel Info Skeleton */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="h-8 bg-muted animate-shimmer rounded w-2/3"></div>
                <div className="h-5 bg-muted animate-shimmer rounded w-1/3"></div>
                <div className="h-4 bg-muted animate-shimmer rounded w-full"></div>
                <div className="h-4 bg-muted animate-shimmer rounded w-5/6"></div>

                {/* Channel Stats Skeleton */}
                <div className="grid grid-cols-3 gap-6 max-w-md pt-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="text-center space-y-2">
                      <div className="h-4 bg-muted animate-shimmer rounded w-8 mx-auto"></div>
                      <div className="h-6 bg-muted animate-shimmer rounded w-16 mx-auto"></div>
                      <div className="h-3 bg-muted animate-shimmer rounded w-20 mx-auto"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Videos Section Skeleton */}
        <div>
          <div className="mb-6 space-y-2">
            <div className="h-7 bg-muted animate-shimmer rounded w-48"></div>
            <div className="h-4 bg-muted animate-shimmer rounded w-64"></div>
          </div>

          {/* Videos Grid Skeleton */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="border border-border rounded-lg overflow-hidden bg-card"
              >
                {/* Thumbnail skeleton */}
                <div className="aspect-video bg-muted animate-shimmer"></div>

                {/* Content skeleton */}
                <div className="p-4 space-y-3">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted animate-shimmer rounded w-full"></div>
                    <div className="h-4 bg-muted animate-shimmer rounded w-4/5"></div>
                  </div>

                  <div className="h-3 bg-muted animate-shimmer rounded w-32"></div>

                  <div className="h-3 bg-muted animate-shimmer rounded w-full"></div>

                  {/* Stats skeleton */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-4 bg-muted animate-shimmer rounded"></div>
                    <div className="h-4 bg-muted animate-shimmer rounded"></div>
                    <div className="h-4 bg-muted animate-shimmer rounded"></div>
                  </div>

                  {/* Button skeleton */}
                  <div className="h-9 bg-muted animate-shimmer rounded w-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
