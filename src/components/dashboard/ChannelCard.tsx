import React from "react";
import Image from "next/image";
import { YouTubeChannel } from "@/app/api/channels/route";
import { Users } from "lucide-react";

export function ChannelCard({
  channel,
  onSelect,
  onMouseEnter,
}: {
  channel: YouTubeChannel;
  onSelect: () => void;
  onMouseEnter?: () => void;
}) {
  const formatNumber = (num: string) => {
    const number = parseInt(num);
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + "M";
    } else if (number >= 1000) {
      return (number / 1000).toFixed(1) + "K";
    }
    return number.toLocaleString();
  };

  return (
    <div
      className="bg-card rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] border border-border p-4 relative"
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0">
          {channel.thumbnailUrl ? (
            <Image
              src={channel.thumbnailUrl}
              alt={channel.title}
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground line-clamp-1 mb-1">
            {channel.title}
          </h3>
          {channel.customUrl && (
            <p className="text-xs text-muted-foreground">
              @{channel.customUrl.replace("@", "")}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {channel.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
          {channel.description}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="font-medium text-foreground">
            {formatNumber(channel.subscriberCount)}
          </div>
          <div className="text-muted-foreground">Subscribers</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-foreground">
            {formatNumber(channel.videoCount)}
          </div>
          <div className="text-muted-foreground">Videos</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-foreground">
            {formatNumber(channel.viewCount)}
          </div>
          <div className="text-muted-foreground">Views</div>
        </div>
      </div>
    </div>
  );
}
