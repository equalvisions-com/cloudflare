import { useEffect, useRef, useCallback, useState } from 'react';
import { Howl } from 'howler';
import { 
  useAudioPlayerSetLoading,
  useAudioPlayerSetDuration,
  useAudioPlayerSetSeek,
  useAudioPlayerSetPlaying,
  useAudioPlayerSetError,
  useAudioPlayerIsPlaying,
  useAudioPlayerIsLoading,
  registerSeekCallback,
  unregisterSeekCallback
} from '@/lib/stores/audioPlayerStore';
import type { UseAudioLifecycleProps, UseAudioLifecycleReturn } from '@/lib/types';

/**
 * Custom hook for managing Howler audio lifecycle
 * 
 * FIXES APPLIED:
 * ✅ Fixed infinite re-render loop - using individual action selectors
 * ✅ Prevents object recreation on every render
 * ✅ Prevents initialization with empty src
 * ✅ Proper cleanup and error handling
 * ✅ SSR safety with standard imports
 * ✅ Connected Howler to Zustand store play/pause state
 * ✅ Registered seek callback for UI integration
 */
export const useAudioLifecycle = ({
  src,
  onLoad,
  onPlay,
  onPause,
  onStop,
  onEnd,
  onError
}: UseAudioLifecycleProps): UseAudioLifecycleReturn => {
  const howlerRef = useRef<Howl | null>(null);
  const seekIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSrcRef = useRef<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const baseRetryDelay = 1000; // 1 second
  
  // Get individual actions to prevent object recreation
  const setLoading = useAudioPlayerSetLoading();
  const setDuration = useAudioPlayerSetDuration();
  const setSeek = useAudioPlayerSetSeek();
  const setPlaying = useAudioPlayerSetPlaying();
  const setError = useAudioPlayerSetError();
  
  // Get playing state to sync with Howler
  const isPlaying = useAudioPlayerIsPlaying();
  const isLoading = useAudioPlayerIsLoading();

  /**
   * Clean up Howler instance and intervals
   */
  const cleanupHowler = useCallback(() => {
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    
    if (howlerRef.current) {
      howlerRef.current.unload();
      howlerRef.current = null;
    }
    
    currentSrcRef.current = '';
  }, []);

  /**
   * Play the current audio
   */
  const playAudio = useCallback(() => {
    if (howlerRef.current && !howlerRef.current.playing()) {
      howlerRef.current.play();
    }
  }, []);

  /**
   * Pause the current audio
   */
  const pauseAudio = useCallback(() => {
    if (howlerRef.current && howlerRef.current.playing()) {
      howlerRef.current.pause();
    }
  }, []);

  /**
   * Seek to a specific position
   */
  const seekToPosition = useCallback((position: number) => {
    if (howlerRef.current) {
      howlerRef.current.seek(position);
      setSeek(position);
    }
  }, [setSeek]);

  /**
   * Initialize Howler instance with proper error handling
   */
  const initializeHowler = useCallback((audioSrc: string) => {
    // SSR safety check
    if (typeof window === 'undefined') return;
    
    // Don't reinitialize if src hasn't changed
    if (currentSrcRef.current === audioSrc && howlerRef.current) {
      return;
    }
    
    // Cleanup existing instance
    cleanupHowler();
    
    // Update current src reference
    currentSrcRef.current = audioSrc;

    try {
      howlerRef.current = new Howl({
        src: [audioSrc],
        html5: true,
        onload: () => {
          setLoading(false);
          setDuration(howlerRef.current?.duration() || 0);
          setRetryCount(0); // Reset retry count on successful load
          
          // Auto-play if the store indicates this track should be playing
          // This handles track switching where the new track should auto-play
          if (isPlaying && howlerRef.current && !howlerRef.current.playing()) {
            howlerRef.current.play();
          }
          
          onLoad?.();
        },
        onplay: () => {
          setPlaying(true);
          // Update seek position immediately when playback starts
          updateSeekPosition();
          onPlay?.();
        },
        onpause: () => {
          setPlaying(false);
          onPause?.();
        },
        onstop: () => {
          setPlaying(false);
          setSeek(0);
          onStop?.();
        },
        onend: () => {
          setPlaying(false);
          setSeek(0);
          onEnd?.();
        },
        onloaderror: (id, error) => {
          // Silently fail on load error.
          setError(null);
          setLoading(false);
          setPlaying(false);
          onError?.(new Error(`Failed to load audio: ${error}`));
        },
        onplayerror: (id, error) => {
          // Don't set the main error state here to avoid user-facing messages.
          // The retry logic will handle it.
          setPlaying(false);

          if (retryCount < maxRetries) {
            setLoading(true);
            const retryDelay = baseRetryDelay * Math.pow(2, retryCount);
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              if (howlerRef.current) {
                howlerRef.current.load();
              }
            }, retryDelay);
          } else {
            // Silently fail after max retries.
            // Player will appear paused. User can try again.
            setError(null);
            setLoading(false);
          }
          onError?.(new Error(`Playback error: ${error}`));
        }
      });
    } catch (error) {
      // Silently fail on instance creation error.
      setError(null);
      setLoading(false);
      setPlaying(false);
      onError?.(new Error(`Failed to create Howl instance: ${error}`));
    }
  }, [cleanupHowler, setLoading, setDuration, setPlaying, setSeek, setError, isPlaying, onLoad, onPlay, onPause, onStop, onEnd, onError, retryCount]);

  /**
   * Update seek position from Howler
   */
  const updateSeekPosition = useCallback(() => {
    if (howlerRef.current) {
      const currentSeek = howlerRef.current.seek();
      // Only update if we get a valid number and it's different from current
      if (typeof currentSeek === 'number' && !isNaN(currentSeek)) {
        setSeek(currentSeek);
      }
    }
  }, [setSeek]);

  // Register seek callback for UI integration
  useEffect(() => {
    registerSeekCallback(seekToPosition);
    
    return () => {
      unregisterSeekCallback();
    };
  }, [seekToPosition]);

  // Initialize Howler only when src changes and is not empty
  useEffect(() => {
    if (src && src.trim() !== '') {
      setLoading(true);
      setError(null);
      initializeHowler(src);
    } else if (!src || src.trim() === '') {
      // Clean up when no src
      cleanupHowler();
      setLoading(false);
    }
    
    // Cleanup on unmount or src change
    return () => {
      if (!src || src.trim() === '') {
        cleanupHowler();
      }
    };
  }, [src]);

  // Sync Howler playback with Zustand store state
  useEffect(() => {
    if (!howlerRef.current) return;
    
    const howlerIsPlaying = howlerRef.current.playing();
    
    if (isPlaying && !howlerIsPlaying) {
      // Store says play, but Howler is not playing
      playAudio();
    } else if (!isPlaying && howlerIsPlaying) {
      // Store says pause, but Howler is playing
      pauseAudio();
    }
  }, [isPlaying, playAudio, pauseAudio]);

  // Set up seek position updates - runs when playing state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Clear any existing interval
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    
    // Only set up interval when we're playing AND Howler is loaded (not loading)
    if (isPlaying && howlerRef.current && !isLoading) {
      seekIntervalRef.current = setInterval(() => {
        updateSeekPosition();
      }, 100); // Update more frequently for smoother progress
    }
    
    return () => {
      if (seekIntervalRef.current) {
        clearInterval(seekIntervalRef.current);
        seekIntervalRef.current = null;
      }
    };
  }, [isPlaying, isLoading, updateSeekPosition]); // Also depend on loading state

  // Cleanup on unmount
  useEffect(() => {
    return cleanupHowler;
  }, [cleanupHowler]);

  return {
    initializeHowler,
    cleanupHowler,
    updateSeekPosition,
    playAudio,
    pauseAudio,
    seekToPosition
  };
}; 