import { create } from 'zustand';
import type { AudioPlayerStore, AudioTrack } from '@/lib/types';

// Global reference to the seek callback for Howler integration
let seekCallback: ((position: number) => void) | null = null;

// Function to register the seek callback from useAudioLifecycle
export const registerSeekCallback = (callback: (position: number) => void) => {
  seekCallback = callback;
};

// Function to unregister the seek callback
export const unregisterSeekCallback = () => {
  seekCallback = null;
};

// Initial state factory function for better organization
const createInitialState = () => ({
  // Playback state
  isPlaying: false,
  isLoading: true,
  duration: 0,
  seek: 0,
  volume: 1,
  isMuted: false,
  
  // Current track
  currentTrack: null as AudioTrack | null,
  
  // Error state
  error: null as string | null,
});

export const useAudioPlayerStore = create<AudioPlayerStore>((set, get) => ({
  // Initial state
  ...createInitialState(),

  // Track management actions
  playTrack: (src: string, title: string, image?: string, creator?: string) => {
    const { currentTrack, isPlaying } = get();
    const newTrack: AudioTrack = { src, title, image, creator };
    
    // Check if this is the same track that's already loaded
    if (currentTrack && currentTrack.src === src) {
      // Same track - just ensure it's playing, don't reset seek position
      if (!isPlaying) {
        set({ isPlaying: true });
      }
      // If already playing, do nothing (maintain current position)
      return;
    }
    
    // Different track - load new track and reset position
    set({ 
      currentTrack: newTrack,
      isLoading: true,
      isPlaying: true, // Always auto-play when switching tracks
      seek: 0, // Reset seek position for new track
      error: null 
    });
  },

  stopTrack: () => {
    set({ 
      currentTrack: null,
      isPlaying: false,
      seek: 0,
      duration: 0,
      isLoading: true,
      error: null 
    });
  },

  togglePlayPause: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },

  // Control actions
  handleSeek: (value: number[]) => {
    if (value.length > 0) {
      const newSeek = value[0];
      set({ seek: newSeek });
      
      // Also trigger the actual seek in Howler if callback is registered
      if (seekCallback) {
        seekCallback(newSeek);
      }
    }
  },

  handleVolume: (value: number[]) => {
    if (value.length > 0) {
      const newVolume = value[0];
      set({ 
        volume: newVolume,
        isMuted: newVolume === 0 
      });
    }
  },

  toggleMute: () => {
    const { isMuted, volume } = get();
    if (isMuted) {
      // Unmute: restore previous volume or set to 1 if it was 0
      set({ 
        isMuted: false,
        volume: volume > 0 ? volume : 1 
      });
    } else {
      // Mute: set volume to 0 but keep the previous volume value
      set({ isMuted: true });
    }
  },

  // Internal state management actions
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setDuration: (duration: number) => {
    set({ duration });
  },

  setSeek: (seek: number) => {
    set({ seek });
  },

  setVolume: (volume: number) => {
    set({ volume });
  },

  setPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  // Utility actions
  reset: () => {
    set(createInitialState());
  },
}));

// Selector hooks for optimized re-renders (following established patterns)
export const useAudioPlayerCurrentTrack = () => useAudioPlayerStore((state) => state.currentTrack);
export const useAudioPlayerIsPlaying = () => useAudioPlayerStore((state) => state.isPlaying);
export const useAudioPlayerIsLoading = () => useAudioPlayerStore((state) => state.isLoading);
export const useAudioPlayerDuration = () => useAudioPlayerStore((state) => state.duration);
export const useAudioPlayerSeek = () => useAudioPlayerStore((state) => state.seek);
export const useAudioPlayerVolume = () => useAudioPlayerStore((state) => state.volume);
export const useAudioPlayerIsMuted = () => useAudioPlayerStore((state) => state.isMuted);
export const useAudioPlayerError = () => useAudioPlayerStore((state) => state.error);

// Individual action selectors to prevent object recreation
export const useAudioPlayerPlayTrack = () => useAudioPlayerStore((state) => state.playTrack);
export const useAudioPlayerStopTrack = () => useAudioPlayerStore((state) => state.stopTrack);
export const useAudioPlayerTogglePlayPause = () => useAudioPlayerStore((state) => state.togglePlayPause);
export const useAudioPlayerHandleSeek = () => useAudioPlayerStore((state) => state.handleSeek);
export const useAudioPlayerHandleVolume = () => useAudioPlayerStore((state) => state.handleVolume);
export const useAudioPlayerToggleMute = () => useAudioPlayerStore((state) => state.toggleMute);
export const useAudioPlayerSetLoading = () => useAudioPlayerStore((state) => state.setLoading);
export const useAudioPlayerSetDuration = () => useAudioPlayerStore((state) => state.setDuration);
export const useAudioPlayerSetSeek = () => useAudioPlayerStore((state) => state.setSeek);
export const useAudioPlayerSetVolume = () => useAudioPlayerStore((state) => state.setVolume);
export const useAudioPlayerSetPlaying = () => useAudioPlayerStore((state) => state.setPlaying);
export const useAudioPlayerSetError = () => useAudioPlayerStore((state) => state.setError);
export const useAudioPlayerReset = () => useAudioPlayerStore((state) => state.reset); 