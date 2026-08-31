import { AnalysisView } from "@/components/analysis/analysis-view"
import { getVideoAnalysisSummary } from "@/lib/analysis"

interface AnalysisPageProps {
  params: Promise<{
    projectId: string
  }>
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { projectId } = await params
  
  // Fetch the video analysis summary (without comments)
  const analysisSummary = await getVideoAnalysisSummary(projectId)
  if (!analysisSummary) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analysis Not Found</h1>
          <p className="text-gray-600">The video analysis you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
        </div>
      </div>
    )
  }

  // Convert summary to AnalysisData format for backward compatibility
  const analysisData = {
    ...analysisSummary,
    comments: [] // Comments will be loaded on-demand
  }
  
  return <AnalysisView videoId={projectId} analysisData={analysisData} />
}
