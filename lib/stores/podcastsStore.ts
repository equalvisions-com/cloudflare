import { create } from 'zustand';
import { PodcastsState, PodcastItem } from '@/lib/types';

interface PodcastsStore extends PodcastsState {
  // Accessibility state
  lastAction: string | null;
  announceMessage: string | null;
  
  // Actions
  setItems: (items: PodcastItem[]) => void;
  setSelectedCategory: (category: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAnnouncement: (message: string | null) => void;
  reset: () => void;
}

const initialState: PodcastsState = {
  items: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
};

export const usePodcastsStore = create<PodcastsStore>((set, get) => ({
  ...initialState,
  lastAction: null,
  announceMessage: null,
  
  setItems: (items) => {
    const count = items.length;
    const message = count > 0 
      ? `Loaded ${count} podcast${count === 1 ? '' : 's'} successfully`
      : 'No podcasts available';
    
    set({ 
      items, 
      error: null, 
      lastAction: 'items_loaded',
      announceMessage: message
    });
  },
  
  setSelectedCategory: (category) => {
    const message = category 
      ? `Selected ${category} category`
      : 'Showing all podcasts';
    
    set({ 
      selectedCategory: category,
      lastAction: 'category_changed',
      announceMessage: message
    });
  },
  
  setLoading: (loading) => {
    const message = loading 
      ? 'Loading podcasts...' 
      : null;
    
    set({ 
      isLoading: loading,
      lastAction: loading ? 'loading_started' : 'loading_ended',
      announceMessage: message
    });
  },
  
  setError: (error) => {
    const message = error 
      ? `Error: ${error}`
      : null;
    
    set({ 
      error, 
      isLoading: false,
      lastAction: 'error_occurred',
      announceMessage: message
    });
  },
  
  setAnnouncement: (message) =>
    set({ announceMessage: message }),
  
  reset: () => set({
    ...initialState,
    lastAction: 'reset',
    announceMessage: 'Podcast data cleared'
  }),
})); 