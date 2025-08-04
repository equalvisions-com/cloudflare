import { useCallback } from 'react';
import { 
  useAudioPlayerVolume,
  useAudioPlayerIsMuted,
  useAudioPlayerHandleSeek,
  useAudioPlayerHandleVolume,
  useAudioPlayerTogglePlayPause,
  useAudioPlayerToggleMute
} from '@/lib/stores/audioPlayerStore';
import type { UseAudioControlsReturn } from '@/lib/types';

/**
 * Custom hook for audio control handlers
 * 
 * FIXES APPLIED:
 * ✅ Fixed infinite re-render loop - using individual action selectors
 * ✅ Prevents object recreation on every render
 * ✅ Memoized event handlers for UI controls
 * ✅ Volume and seek management
 * ✅ Time formatting utilities
 * ✅ Optimized re-renders via Zustand selectors
 * 
 * Extracts control logic from components following production patterns
 */
export const useAudioControls = (): UseAudioControlsReturn => {
  // Get current state for control logic
  const volume = useAudioPlayerVolume();
  const isMuted = useAudioPlayerIsMuted();
  
  // Get individual actions to prevent object recreation
  const storeHandleSeek = useAudioPlayerHandleSeek();
  const storeHandleVolume = useAudioPlayerHandleVolume();
  const togglePlayPause = useAudioPlayerTogglePlayPause();
  const toggleMute = useAudioPlayerToggleMute();

  /**
   * Handle seek slider changes
   * Memoized to prevent unnecessary re-renders
   */
  const handleSeek = useCallback((value: number[]) => {
    storeHandleSeek(value);
  }, [storeHandleSeek]);

  /**
   * Handle volume slider changes
   * Memoized to prevent unnecessary re-renders
   */
  const handleVolume = useCallback((value: number[]) => {
    storeHandleVolume(value);
  }, [storeHandleVolume]);

  /**
   * Format time in MM:SS format
   * Utility function for displaying time
   */
  const formatTime = useCallback((secs: number): string => {
    if (!isFinite(secs) || isNaN(secs)) return '0:00';
    
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    // Control handlers
    handleSeek,
    handleVolume,
    togglePlayPause,
    toggleMute,
    
    // Utility functions
    formatTime
  };
}; 