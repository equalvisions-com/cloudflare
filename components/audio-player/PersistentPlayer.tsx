'use client';

import { useAudio } from './AudioContext';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";

export function PersistentPlayer() {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    seek,
    duration,
    volume,
    setVolume,
    muted,
    toggleMute,
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
        <div className="flex items-center gap-4">
          {/* Title */}
          <div className="flex-1 min-w-0">
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
            <div className="hidden sm:flex items-center gap-4 min-w-[300px]">
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

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                className="h-8 w-8"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
              <Slider
                value={[muted ? 0 : volume]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(value) => setVolume(value[0])}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 