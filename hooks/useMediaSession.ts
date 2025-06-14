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
   * Detect image type from URL
   */
  const getImageType = useCallback((imageUrl: string): string => {
    const url = imageUrl.toLowerCase();
    if (url.includes('.png') || url.includes('png')) return 'image/png';
    if (url.includes('.webp') || url.includes('webp')) return 'image/webp';
    if (url.includes('.gif') || url.includes('gif')) return 'image/gif';
    if (url.includes('.svg') || url.includes('svg')) return 'image/svg+xml';
    // Default to JPEG for most podcast artwork
    return 'image/jpeg';
  }, []);

  /**
   * Convert text to title case (capitalize every word)
   */
  const toTitleCase = useCallback((text: string): string => {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        
        // Always capitalize first letter of each word for podcast titles
        // (keeping it simple for better readability on lock screen)
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }, []);

  /**
   * Get artist name from track creator or extract from title as fallback
   */
  const getArtistName = useCallback((track: { title: string; creator?: string }): string => {
    // Use the creator field if available
    if (track.creator) {
      return track.creator;
    }
    
    // Fallback: Try to extract podcast name from title patterns
    // Common patterns: "Episode Title - Podcast Name", "Podcast Name: Episode Title"
    const title = track.title;
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      if (parts.length >= 2) {
        // Use the last part as the podcast name
        return parts[parts.length - 1].trim();
      }
    }
    if (title.includes(': ')) {
      const parts = title.split(': ');
      if (parts.length >= 2) {
        // Use the first part as the podcast name
        return parts[0].trim();
      }
    }
    // Final fallback to generic name
    return 'FocusFix Podcast';
  }, []);

  /**
   * Update Media Session metadata with improved iOS compatibility
   */
  const updateMetadata = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      if (currentTrack) {
        const artistName = getArtistName(currentTrack);
        const imageType = currentTrack.image ? getImageType(currentTrack.image) : 'image/jpeg';
        
        // Create artwork array with multiple sizes for better iOS compatibility
        const artwork = currentTrack.image ? [
          { 
            src: currentTrack.image, 
            sizes: '512x512', 
            type: imageType 
          },
          { 
            src: currentTrack.image, 
            sizes: '256x256', 
            type: imageType 
          },
          { 
            src: currentTrack.image, 
            sizes: '128x128', 
            type: imageType 
          },
          { 
            src: currentTrack.image, 
            sizes: '96x96', 
            type: imageType 
          }
        ] : [];

        const formattedTitle = toTitleCase(currentTrack.title);

        console.log('Setting Media Session metadata:', {
          title: formattedTitle,
          artist: artistName,
          album: 'Podcast',
          artwork: artwork
        });

        navigator.mediaSession.metadata = new MediaMetadata({
          title: formattedTitle,
          artist: artistName,
          album: 'Podcast',
          artwork: artwork
        });
      } else {
        console.log('Clearing Media Session metadata');
        navigator.mediaSession.metadata = null;
      }
    } catch (error) {
      console.error('Failed to update Media Session metadata:', error);
    }
  }, [currentTrack, getArtistName, getImageType, toTitleCase]);

  /**
   * Update Media Session playback state
   */
  const updatePlaybackState = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      const state = isPlaying ? 'playing' : 'paused';
      console.log('Setting Media Session playback state:', state);
      navigator.mediaSession.playbackState = state;
    } catch (error) {
      console.error('Failed to update Media Session playback state:', error);
    }
  }, [isPlaying]);

  /**
   * Update Media Session position state
   */
  const updatePositionState = useCallback(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;

    if (duration > 0) {
      try {
        const positionState = {
          duration: duration,
          playbackRate: 1.0,
          position: Math.min(seek, duration) // Ensure position doesn't exceed duration
        };
        
        console.log('Setting Media Session position state:', positionState);
        navigator.mediaSession.setPositionState(positionState);
      } catch (error) {
        console.warn('Failed to set Media Session position state:', error);
      }
    }
  }, [duration, seek]);

  /**
   * Set up Media Session action handlers
   */
  const setupActionHandlers = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      // Play/Pause handlers
      navigator.mediaSession.setActionHandler('play', () => {
        console.log('Media Session play action triggered');
        if (!isPlaying) {
          togglePlayPause();
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        console.log('Media Session pause action triggered');
        if (isPlaying) {
          togglePlayPause();
        }
      });

      // Seek handlers
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || seekOffset;
        const newPosition = Math.max(0, seek - skipTime);
        console.log('Media Session seek backward:', { skipTime, newPosition });
        handleSeek([newPosition]);
        onSeekBackward?.();
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || seekOffset;
        const newPosition = Math.min(duration, seek + skipTime);
        console.log('Media Session seek forward:', { skipTime, newPosition });
        handleSeek([newPosition]);
        onSeekForward?.();
      });

      // Seek to specific position
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          const newPosition = Math.max(0, Math.min(duration, details.seekTime));
          console.log('Media Session seek to:', { seekTime: details.seekTime, newPosition });
          handleSeek([newPosition]);
        }
      });

      // Previous/Next track handlers (optional - you can implement these later)
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        console.log('Media Session previous track requested');
        // TODO: Implement previous track functionality
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        console.log('Media Session next track requested');
        // TODO: Implement next track functionality  
      });

      console.log('Media Session action handlers set up successfully');
    } catch (error) {
      console.error('Failed to set up Media Session action handlers:', error);
    }
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
        try {
          console.log('Cleaning up Media Session');
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
        } catch (error) {
          console.error('Error during Media Session cleanup:', error);
        }
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