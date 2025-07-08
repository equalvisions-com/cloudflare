import { useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { 
  useAudioPlayerSetLoading,
  useAudioPlayerSetDuration,
  useAudioPlayerSetSeek,
  useAudioPlayerSetPlaying,
  useAudioPlayerSetError,
  useAudioPlayerIsPlaying,
  useAudioPlayerIsLoading,
  useAudioPlayerStore,
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
   * Initialize Howler instance with proper error handling and network resilience
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

    // Get network resilience methods from store
    const { backupCurrentState, restoreFromBackup, incrementRetryCount, resetRetryCount, networkRetryCount } = useAudioPlayerStore.getState();

    try {
      howlerRef.current = new Howl({
        src: [audioSrc],
        html5: true,
        preload: false, // Don't preload - load on demand only
        onload: () => {
          // Backup state when successfully loaded
          backupCurrentState();
          setLoading(false);
          setDuration(howlerRef.current?.duration() || 0);
          resetRetryCount(); // Reset retry count on successful load
          
          // Auto-play if the store indicates this track should be playing
          // Get fresh state from store to avoid stale closure values
          const currentState = useAudioPlayerStore.getState();
          if (currentState.isPlaying && howlerRef.current && !howlerRef.current.playing()) {
            howlerRef.current.play();
          }
          
          onLoad?.();
        },
        onplay: () => {
          // Backup state when playback starts successfully
          backupCurrentState();
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
          console.error('Audio load error:', error);
          incrementRetryCount();
          
          // Try to restore from backup if available and retry count is low
          const currentRetryCount = useAudioPlayerStore.getState().networkRetryCount;
          if (currentRetryCount < 3) {
            console.log('Attempting to restore from backup state...');
            restoreFromBackup();
            // Retry after a brief delay with exponential backoff
            setTimeout(() => {
              const currentTrack = useAudioPlayerStore.getState().currentTrack;
              if (currentTrack?.src) {
                initializeHowler(currentTrack.src);
              }
            }, 1000 * (currentRetryCount + 1));
          } else {
            const errorMessage = `Failed to load audio after ${currentRetryCount} retries: ${error}`;
            setError(errorMessage);
            setLoading(false);
            onError?.(new Error(errorMessage));
          }
        },
        onplayerror: (id, error) => {
          console.error('Audio play error:', error);
          incrementRetryCount();
          
          // Try to restore from backup if available and retry count is low
          const currentRetryCount = useAudioPlayerStore.getState().networkRetryCount;
          if (currentRetryCount < 3) {
            console.log('Attempting to restore from backup state...');
            restoreFromBackup();
            // Brief pause before retry
            setTimeout(() => {
              if (howlerRef.current) {
                howlerRef.current.play();
              }
            }, 500 * (currentRetryCount + 1));
          } else {
            const errorMessage = `Playback error after ${currentRetryCount} retries: ${error}`;
            setError(errorMessage);
            setPlaying(false);
            onError?.(new Error(errorMessage));
          }
        }
      });
    } catch (error) {
      const errorMessage = `Failed to create Howl instance: ${error}`;
      setError(errorMessage);
      setLoading(false);
      onError?.(new Error(errorMessage));
    }
  }, [cleanupHowler, setLoading, setDuration, setPlaying, setSeek, setError, isPlaying, onLoad, onPlay, onPause, onStop, onEnd, onError]);

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
  }, [src]); // Simplified dependencies to prevent infinite loop

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

  // Set up seek position updates and periodic state backup - runs when playing state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Clear any existing interval
    if (seekIntervalRef.current) {
      clearInterval(seekIntervalRef.current);
      seekIntervalRef.current = null;
    }
    
    // Only set up interval when we're playing AND Howler is loaded (not loading)
    if (isPlaying && howlerRef.current && !isLoading) {
      let backupCounter = 0;
      seekIntervalRef.current = setInterval(() => {
        updateSeekPosition();
        
        // Backup state every 5 seconds (every 50 updates at 100ms interval)
        backupCounter++;
        if (backupCounter >= 50) {
          const { backupCurrentState } = useAudioPlayerStore.getState();
          backupCurrentState();
          backupCounter = 0;
        }
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