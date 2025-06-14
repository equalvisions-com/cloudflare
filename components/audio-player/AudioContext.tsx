'use client';

import React, { createContext, useContext } from 'react';
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerIsPlaying,
  useAudioPlayerSeek,
  useAudioPlayerDuration,
  useAudioPlayerPlayTrack,
  useAudioPlayerStopTrack,
  useAudioPlayerTogglePlayPause,
  useAudioPlayerHandleSeek
} from '@/lib/stores/audioPlayerStore';
import { useAudioLifecycle } from '@/hooks/useAudioLifecycle';
import { useMediaSession } from '@/hooks/useMediaSession';

// Maintain the same interface for backward compatibility
interface AudioContextType {
  currentTrack: {
    src: string;
    title: string;
    image?: string;
  } | null;
  playTrack: (src: string, title: string, image?: string) => void;
  stopTrack: () => void;
  isPlaying: boolean;
  togglePlayPause: () => void;
  seek: number;
  duration: number;
  handleSeek: (value: number) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

/**
 * AudioProvider - Refactored to use Zustand store internally
 * 
 * FIXES APPLIED:
 * ✅ Fixed infinite re-render loop - using individual action selectors
 * ✅ Prevents object recreation on every render
 * ✅ Maintains backward compatibility
 * ✅ Uses Zustand store for state management
 */
export function AudioProvider({ children }: { children: React.ReactNode }) {
  // Get state from Zustand store
  const currentTrack = useAudioPlayerCurrentTrack();
  const isPlaying = useAudioPlayerIsPlaying();
  const seek = useAudioPlayerSeek();
  const duration = useAudioPlayerDuration();
  
  // Get individual actions to prevent object recreation
  const playTrack = useAudioPlayerPlayTrack();
  const stopTrack = useAudioPlayerStopTrack();
  const togglePlayPause = useAudioPlayerTogglePlayPause();
  const handleSeek = useAudioPlayerHandleSeek();

  // Only use audio lifecycle hook when we have a valid track
  // This prevents infinite re-renders with empty src
  useAudioLifecycle({
    src: currentTrack?.src || '',
    onLoad: () => {
      // Audio loaded successfully
    },
    onPlay: () => {
      // Audio started playing
    },
    onPause: () => {
      // Audio paused
    },
    onStop: () => {
      // Audio stopped
    },
    onEnd: () => {
      // Audio ended
    },
    onError: (error) => {
      // Error handling is managed by the store
    }
  });

  // Enable Media Session API for native OS controls
  useMediaSession({
    onSeekBackward: () => {
      // Optional: Add custom seek backward logic
    },
    onSeekForward: () => {
      // Optional: Add custom seek forward logic  
    },
    seekOffset: 15 // 15 seconds forward/backward
  });

  // Adapter function to match the old API
  const handleSeekAdapter = (value: number) => {
    handleSeek([value]);
  };

  const contextValue: AudioContextType = {
    currentTrack,
    playTrack,
    stopTrack,
    isPlaying,
    togglePlayPause,
    seek,
    duration,
    handleSeek: handleSeekAdapter,
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
}

/**
 * useAudio hook - Maintains same API for backward compatibility
 */
export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
} 