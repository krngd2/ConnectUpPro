export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-6 pl-4 md:pl-8">
        {/* Page Header Skeleton */}
        <div className="mb-6">
          <div className="h-9 bg-muted animate-shimmer rounded w-40 mb-4"></div>
          <div className="space-y-2">
            <div className="h-8 bg-muted animate-shimmer rounded w-32"></div>
            <div className="h-4 bg-muted animate-shimmer rounded w-64"></div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar Skeleton */}
          <div className="col-span-3">
            <div className="border border-border rounded-lg p-0">
              <div className="space-y-1">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-muted animate-shimmer rounded-none first:rounded-t-lg last:rounded-b-lg"
                  ></div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="col-span-9">
            <div className="border border-border rounded-lg">
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="h-6 bg-muted animate-shimmer rounded w-48"></div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="h-5 bg-muted animate-shimmer rounded w-32"></div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-muted animate-shimmer rounded" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
