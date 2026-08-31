import { NextResponse } from 'next/server';
import { youtube } from '../../../../../lib/youtube';

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  duration: string;
  tags?: string[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    // First, get the channel info to get the uploads playlist ID
    const channelResponse = await youtube.channels.list({
      part: ['contentDetails', 'snippet', 'statistics'],
      id: [channelId],
    });

    if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const channel = channelResponse.data.items[0];
    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json({ error: 'No uploads playlist found for this channel' }, { status: 404 });
    }

    // Get the channel info for the response
    const channelInfo = {
      id: channel.id || '',
      title: channel.snippet?.title || 'Unknown Channel',
      description: channel.snippet?.description || '',
      thumbnailUrl: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || '',
      subscriberCount: channel.statistics?.subscriberCount || '0',
      videoCount: channel.statistics?.videoCount || '0',
      viewCount: channel.statistics?.viewCount || '0',
      customUrl: channel.snippet?.customUrl || undefined,
    };

    // Get videos from the uploads playlist
    const playlistResponse = await youtube.playlistItems.list({
      part: ['snippet'],
      playlistId: uploadsPlaylistId,
      maxResults: 50, // Get up to 50 videos
    });

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      return NextResponse.json({
        channel: channelInfo,
        videos: [],
        message: 'No videos found for this channel.'
      });
    }

    // Get video IDs to fetch detailed statistics
    const videoIds = playlistResponse.data.items
      .map(item => item.snippet?.resourceId?.videoId)
      .filter(Boolean) as string[];

    // Get detailed video information
    const videosResponse = await youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    const videos: YouTubeVideo[] = videosResponse.data.items?.map((video) => {
      const snippet = video.snippet;
      const statistics = video.statistics;
      const contentDetails = video.contentDetails;
      
      return {
        id: video.id || '',
        title: snippet?.title || 'Unknown Video',
        description: snippet?.description || '',
        thumbnailUrl: snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url || '',
        publishedAt: snippet?.publishedAt || '',
        viewCount: statistics?.viewCount || '0',
        likeCount: statistics?.likeCount || '0',
        commentCount: statistics?.commentCount || '0',
        duration: contentDetails?.duration || '',
        tags: snippet?.tags || [],
      };
    }) || [];

    return NextResponse.json({
      channel: channelInfo,
      videos,
      success: true
    });

  } catch (error: unknown) {
    console.error('Error fetching channel videos:', JSON.stringify(error, null, 2));
    
    const errorObj = error as { code?: number; message?: string };
    const status = errorObj.code || 500;
    let message = 'Failed to fetch videos from YouTube API';

    if (status === 401) {
      message = 'YouTube API authentication failed. Check GOOGLE_API_KEY.';
    } else if (status === 403) {
      if (errorObj.message && errorObj.message.includes('quota')) {
        message = 'YouTube API quota exceeded. Please try again later.';
        return NextResponse.json({ error: message }, { status: 429 });
      }
      message = 'YouTube API access forbidden. Check that YouTube Data API v3 is enabled for GOOGLE_API_KEY.';
    } else if (errorObj.message) {
      message = errorObj.message;
    }

    return NextResponse.json(
      { error: message },
      { status: status }
    );
  }
}
