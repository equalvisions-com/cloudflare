"use client";

import { memo, useEffect } from "react";
import { Slider } from "../ui/slider";
import { Button } from "../ui/button";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerIsPlaying,
  useAudioPlayerIsLoading,
  useAudioPlayerDuration,
  useAudioPlayerSeek,
  useAudioPlayerVolume,
  useAudioPlayerIsMuted,
  useAudioPlayerError,
  useAudioPlayerPlayTrack
} from "@/lib/stores/audioPlayerStore";
import { useAudioControls } from "@/hooks/useAudioControls";
import { useAudioLifecycle } from "@/hooks/useAudioLifecycle";
import type { AudioPlayerProps } from "@/lib/types";

/**
 * AudioPlayer Component - Production Ready
 * 
 * REFACTORED FOR PRODUCTION STANDARDS:
 * ❌ Removed 6 useState hooks → ✅ Zustand selectors
 * ❌ Removed 2 useEffect hooks → ✅ Custom hooks
 * ❌ No memoization → ✅ React.memo optimization
 * ❌ Inline logic → ✅ Separated business logic
 * ❌ No error handling → ✅ Comprehensive error states
 * 
 * FIXES APPLIED:
 * ✅ Fixed infinite loop - using individual action selectors
 * ✅ Prevents object recreation on every render
 * ✅ Moved playTrack to useEffect
 * ✅ Proper dependency management
 * ✅ Conditional track initialization
 */
const AudioPlayerComponent = ({ src, title }: AudioPlayerProps) => {
  // Get state from Zustand store (optimized selectors)
  const currentTrack = useAudioPlayerCurrentTrack();
  const isPlaying = useAudioPlayerIsPlaying();
  const isLoading = useAudioPlayerIsLoading();
  const duration = useAudioPlayerDuration();
  const seek = useAudioPlayerSeek();
  const volume = useAudioPlayerVolume();
  const isMuted = useAudioPlayerIsMuted();
  const error = useAudioPlayerError();
  
  // Get individual action to prevent object recreation
  const playTrack = useAudioPlayerPlayTrack();
  
  // Use custom hooks for business logic
  const { handleSeek, handleVolume, togglePlayPause, toggleMute, formatTime } = useAudioControls();
  
  // Initialize track in useEffect to prevent infinite loops
  useEffect(() => {
    if (src && src.trim() !== '' && (!currentTrack || currentTrack.src !== src)) {
      playTrack(src, title || 'Audio Track');
    }
  }, [src, title, currentTrack, playTrack]);
  
  // Use audio lifecycle hook for Howler management
  useAudioLifecycle({
    src: currentTrack?.src || '',
    onLoad: () => {
      // Audio loaded successfully
    },
    onError: (error) => {
      // Error handling is managed by the store
    }
  });

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-center p-4 text-destructive">
          <div className="text-center">
            <p className="text-sm font-medium">Audio Error</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border bg-card p-4 shadow-sm">
      {title && (
        <div className="mb-4 text-sm font-medium text-muted-foreground">
          {title}
        </div>
      )}
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlayPause}
            className="h-10 w-10"
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>
          
          <div className="flex-1">
            <Slider
              value={[seek]}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
              aria-label="Audio progress"
            />
          </div>
          
          <div className="min-w-[4rem] text-right text-sm text-muted-foreground">
            {formatTime(seek)} / {formatTime(duration)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-8 w-8"
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          
          <Slider
            value={[isMuted ? 0 : volume]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={handleVolume}
            className="w-24"
            aria-label="Volume control"
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Memoized AudioPlayer with optimized prop comparison
 * 
 * Only re-renders when src or title actually change
 * All other state changes are handled by Zustand selectors
 */
export const AudioPlayer = memo(AudioPlayerComponent, (prevProps, nextProps) => {
  return (
    prevProps.src === nextProps.src &&
    prevProps.title === nextProps.title
  );
});

AudioPlayer.displayName = 'AudioPlayer'; 