'use client';

import { useAudio } from './AudioContext';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import {
  Play,
  Pause,
} from "lucide-react";

export function PersistentPlayer() {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    seek,
    duration,
    handleSeek,
  } = useAudio();

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-start gap-4">
          {/* Image */}
          {currentTrack.image && (
            <div className="flex-shrink-0 w-16 h-16 relative rounded-md overflow-hidden border border-border">
              <AspectRatio ratio={1}>
                <Image
                  src={currentTrack.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </AspectRatio>
            </div>
          )}

          {/* Title and Controls Stack */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Title */}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {currentTrack.title}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                className="h-8 w-8"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>

              {/* Time and Progress */}
              <div className="flex items-center gap-4 flex-1">
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {formatTime(seek)}
                </span>
                <Slider
                  value={[seek]}
                  min={0}
                  max={duration}
                  step={0.1}
                  onValueChange={(value) => handleSeek(value[0])}
                  className="w-full"
                />
                <span className="text-sm text-muted-foreground w-12">
                  {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 