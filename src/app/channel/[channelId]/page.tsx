import { ChannelDashboard } from "@/components/channel-dashboard"

interface PageProps {
  params: Promise<{
    channelId: string
  }>
}

export default async function ChannelPage({ params }: PageProps) {
  const { channelId } = await params
  
  return <ChannelDashboard channelId={channelId} />
}
