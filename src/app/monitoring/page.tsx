import { Suspense } from "react";
import VideoMonitoringDashboard from "@/components/monitoring/VideoMonitoringDashboard";

export default function MonitoringPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Processing Monitor</h1>
        <p className="text-gray-600">
          Monitor and manage video analysis processes. Detect stuck videos and
          resolve processing issues.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading monitoring data...</span>
          </div>
        }
      >
        <VideoMonitoringDashboard />
      </Suspense>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">How to Use This Monitor:</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>
            • <strong>Stuck Videos:</strong> Videos that have exceeded their
            timeout thresholds
          </li>
          <li>
            • <strong>Warning Videos:</strong> Videos approaching their timeout
            thresholds (70% of limit)
          </li>
          <li>
            • <strong>Process Stuck:</strong> Automatically marks stuck videos
            as FAILED
          </li>
          <li>
            • <strong>Retry:</strong> Resets failed videos to PENDING status for
            re-processing
          </li>
          <li>
            • <strong>Auto-refresh:</strong> Data refreshes every 5 minutes
            automatically
          </li>
        </ul>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold mb-2">Timeout Thresholds:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <strong>PENDING:</strong>
            <br />
            60 minutes
          </div>
          <div>
            <strong>FETCHING_DETAILS:</strong>
            <br />
            10 minutes
          </div>
          <div>
            <strong>DOWNLOADING_COMMENTS:</strong>
            <br />
            120 minutes (2 hours)
          </div>
          <div>
            <strong>ANALYZING_COMMENTS:</strong>
            <br />
            180 minutes (3 hours)
          </div>
        </div>
      </div>
    </div>
  );
}
