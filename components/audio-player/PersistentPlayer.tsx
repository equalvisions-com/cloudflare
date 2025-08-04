'use client';

import { memo, useCallback } from 'react';
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerIsPlaying,
  useAudioPlayerSeek,
  useAudioPlayerDuration,
  useAudioPlayerTogglePlayPause,
  useAudioPlayerHandleSeek,
  useAudioPlayerStopTrack
} from '@/lib/stores/audioPlayerStore';
import { useAudioControls } from '@/hooks/useAudioControls';

/**
 * Convert text to title case (capitalize every word)
 */
const toTitleCase = (text: string): string => {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};
import { Slider } from "@/components/ui/slider";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import {
  Play,
  Pause,
  X,
} from "lucide-react";

/**
 * PersistentPlayer Component - Production Ready
 * 
 * REFACTORED FOR PRODUCTION STANDARDS:
 * ✅ React.memo optimization
 * ✅ Memoized event handlers
 * ✅ Extracted formatTime to custom hook
 * ✅ Fixed CSS syntax error
 * ✅ Added accessibility labels
 * ✅ Error handling delegation to parent components
 */
const PersistentPlayerComponent = () => {
  // Get state from Zustand store (optimized selectors)
  const currentTrack = useAudioPlayerCurrentTrack();
  const isPlaying = useAudioPlayerIsPlaying();
  const seek = useAudioPlayerSeek();
  const duration = useAudioPlayerDuration();
  
  // Get actions from Zustand store
  const togglePlayPause = useAudioPlayerTogglePlayPause();
  const handleSeek = useAudioPlayerHandleSeek();
  const stopTrack = useAudioPlayerStopTrack();

  // Use custom hook for formatTime utility
  const { formatTime } = useAudioControls();

  // Memoized event handlers
  const handleSeekChange = useCallback((value: number[]) => {
    handleSeek(value);
  }, [handleSeek]);

  if (!currentTrack) return null;

  return (
    <div 
      className="fixed left-0 right-0 bg-background border-t shadow-lg z-[60] md:bottom-0 bottom-[64px]"
      style={{ 
        paddingBottom: '0px'
      }}
    >
      <div className="container mx-0 px-0 md:mx-auto">
        <div className="flex items-start gap-3">
          {/* Image */}
          {currentTrack.image && (
            <div className="flex-shrink-0 w-14 h-14 relative overflow-hidden">
              <AspectRatio ratio={1}>
                <Image
                  src={currentTrack.image}
                  alt={`${currentTrack.title} artwork`}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </AspectRatio>
            </div>
          )}

          {/* Title and Controls Stack */}
          <div className="flex-1 min-w-0 flex flex-col gap-1 mr-3 mt-1.5">
            {/* Title */}
            <div className="min-w-0 flex items-center justify-between gap-1">
              <p className="text-sm font-medium truncate">
                {toTitleCase(currentTrack.title)}
              </p>
              <button
                onClick={stopTrack}
                className="flex items-center justify-end mr-[-2px]"
                aria-label="Stop audio and close player"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={togglePlayPause}
                className="flex items-center justify-center w-4 h-4 ml-[-2px]"
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
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
                  onValueChange={handleSeekChange}
                  className="w-full"
                  aria-label="Audio progress"
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
};

/**
 * Memoized PersistentPlayer with optimized re-rendering
 * 
 * Only re-renders when audio state actually changes
 * All state changes are handled by Zustand selectors
 */
export const PersistentPlayer = memo(PersistentPlayerComponent);

PersistentPlayer.displayName = 'PersistentPlayer'; 