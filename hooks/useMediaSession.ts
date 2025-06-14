'use client';

import { useEffect, useCallback } from 'react';
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerIsPlaying,
  useAudioPlayerSeek,
  useAudioPlayerDuration,
  useAudioPlayerTogglePlayPause,
  useAudioPlayerHandleSeek
} from '@/lib/stores/audioPlayerStore';

interface UseMediaSessionProps {
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  seekOffset?: number; // seconds to seek forward/backward
}

/**
 * Custom hook for Media Session API integration
 * 
 * Provides native OS-level media controls with:
 * - Rich metadata (title, artist, artwork)
 * - Play/pause controls
 * - Seek forward/backward
 * - Position state updates
 */
export const useMediaSession = ({ 
  onSeekBackward, 
  onSeekForward, 
  seekOffset = 10 
}: UseMediaSessionProps = {}) => {
  // Get state from Zustand store
  const currentTrack = useAudioPlayerCurrentTrack();
  const isPlaying = useAudioPlayerIsPlaying();
  const seek = useAudioPlayerSeek();
  const duration = useAudioPlayerDuration();
  
  // Get actions
  const togglePlayPause = useAudioPlayerTogglePlayPause();
  const handleSeek = useAudioPlayerHandleSeek();

  /**
   * Update Media Session metadata
   */
  const updateMetadata = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: 'FocusFix Podcast', // You can make this dynamic if you have artist info
        album: 'Podcast', // You can make this dynamic if you have album/series info
        artwork: currentTrack.image ? [
          { 
            src: currentTrack.image, 
            sizes: '512x512', 
            type: 'image/jpeg' 
          },
          { 
            src: currentTrack.image, 
            sizes: '256x256', 
            type: 'image/jpeg' 
          },
          { 
            src: currentTrack.image, 
            sizes: '128x128', 
            type: 'image/jpeg' 
          }
        ] : []
      });
    } else {
      navigator.mediaSession.metadata = null;
    }
  }, [currentTrack]);

  /**
   * Update Media Session playback state
   */
  const updatePlaybackState = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  /**
   * Update Media Session position state
   */
  const updatePositionState = useCallback(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;

    if (duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: seek
        });
      } catch (error) {
        // Some browsers might not support all position state features
        console.warn('Failed to set position state:', error);
      }
    }
  }, [duration, seek]);

  /**
   * Set up Media Session action handlers
   */
  const setupActionHandlers = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    // Play/Pause handlers
    navigator.mediaSession.setActionHandler('play', () => {
      if (!isPlaying) {
        togglePlayPause();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (isPlaying) {
        togglePlayPause();
      }
    });

    // Seek handlers
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skipTime = details.seekOffset || seekOffset;
      const newPosition = Math.max(0, seek - skipTime);
      handleSeek([newPosition]);
      onSeekBackward?.();
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skipTime = details.seekOffset || seekOffset;
      const newPosition = Math.min(duration, seek + skipTime);
      handleSeek([newPosition]);
      onSeekForward?.();
    });

    // Seek to specific position
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        const newPosition = Math.max(0, Math.min(duration, details.seekTime));
        handleSeek([newPosition]);
      }
    });

    // Previous/Next track handlers (optional - you can implement these later)
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      // TODO: Implement previous track functionality
      console.log('Previous track requested');
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      // TODO: Implement next track functionality  
      console.log('Next track requested');
    });

  }, [isPlaying, seek, duration, seekOffset, togglePlayPause, handleSeek, onSeekBackward, onSeekForward]);

  // Update metadata when track changes
  useEffect(() => {
    updateMetadata();
  }, [updateMetadata]);

  // Update playback state when playing state changes
  useEffect(() => {
    updatePlaybackState();
  }, [updatePlaybackState]);

  // Update position state when seek or duration changes
  useEffect(() => {
    updatePositionState();
  }, [updatePositionState]);

  // Set up action handlers once
  useEffect(() => {
    setupActionHandlers();
  }, [setupActionHandlers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
        
        // Clear all action handlers
        const actions = ['play', 'pause', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'];
        actions.forEach(action => {
          try {
            navigator.mediaSession.setActionHandler(action as any, null);
          } catch (error) {
            // Some browsers might not support all actions
          }
        });
      }
    };
  }, []);

  return {
    isSupported: 'mediaSession' in navigator,
    updateMetadata,
    updatePlaybackState,
    updatePositionState
  };
}; 