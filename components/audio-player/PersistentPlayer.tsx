'use client';

import { useAudio } from './AudioContext';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import {
  Play,
  Pause,
  X,
} from "lucide-react";

export function PersistentPlayer() {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    seek,
    duration,
    handleSeek,
    stopTrack,
  } = useAudio();

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed left-0 right-0 bg-background border-t shadow-lg z-50 bottom-[calc(57px+env(safe-area-inset-bottom))] md:bottom-0">
      <div className="container mx-0 px-0 md:mx-auto">
        <div className="flex items-start gap-3">
          {/* Image */}
          {currentTrack.image && (
            <div className="flex-shrink-0 w-14 h-14 relative overflow-hidden">
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
          <div className="flex-1 min-w-0 flex flex-col gap-1 mr-3 mt-1.5">
            {/* Title */}
            <div className="min-w-0 flex items-center justify-between gap-1">
              <p className="text-sm font-medium truncate">
                {currentTrack.title}
              </p>
              <button
                onClick={stopTrack}
                className="flex items-center justify-end mr-[-2px]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={togglePlayPause}
                className="flex items-center justify-center w-4 h-4 ml-[-2px]"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </button>

              {/* Time and Progress */}
              <div className="flex items-center gap-2 flex-1">
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