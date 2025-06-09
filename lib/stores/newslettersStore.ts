import { create } from 'zustand';
import { NewslettersState, NewsletterItem } from '@/lib/types';

interface NewslettersStore extends NewslettersState {
  // Accessibility state
  lastAction: string | null;
  announceMessage: string | null;
  
  // Actions
  setItems: (items: NewsletterItem[]) => void;
  setSelectedCategory: (category: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAnnouncement: (message: string | null) => void;
  reset: () => void;
}

const initialState: NewslettersState = {
  items: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
};

export const useNewslettersStore = create<NewslettersStore>((set, get) => ({
  ...initialState,
  lastAction: null,
  announceMessage: null,
  
  setItems: (items) => {
    const count = items.length;
    const message = count > 0 
      ? `Loaded ${count} newsletter${count === 1 ? '' : 's'} successfully`
      : 'No newsletters available';
    
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
      : 'Showing all newsletters';
    
    set({ 
      selectedCategory: category,
      lastAction: 'category_changed',
      announceMessage: message
    });
  },
  
  setLoading: (loading) => {
    const message = loading 
      ? 'Loading newsletters...' 
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
    announceMessage: 'Newsletter data cleared'
  }),
})); 