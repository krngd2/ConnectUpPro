import { NextResponse } from 'next/server';

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
  customUrl?: string;
}

export async function GET() {
  return NextResponse.json({
    channels: [],
    message: 'Channel discovery is unavailable with API-key-only access. Open a public channel directly by ID.'
  });
}
