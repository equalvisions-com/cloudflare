import { create } from 'zustand';
import { BookmarkLoadingState, BookmarkSearchState } from '@/lib/types';

interface BookmarkStore {
  // Loading states
  loading: BookmarkLoadingState;
  setLoading: (loading: Partial<BookmarkLoadingState>) => void;
  
  // Search state
  search: BookmarkSearchState;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: BookmarkSearchState['results']) => void;
  clearSearch: () => void;
  
  // Actions
  reset: () => void;
}

const initialState = {
  loading: {
    isLoading: false,
    isSearching: false,
  },
  search: {
    query: '',
    results: null,
  },
};

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  ...initialState,
  
  setLoading: (loading) =>
    set((state) => ({
      loading: { ...state.loading, ...loading },
    })),
  
  setSearchQuery: (query) =>
    set((state) => ({
      search: { ...state.search, query },
    })),
  
  setSearchResults: (results) =>
    set((state) => ({
      search: { ...state.search, results },
    })),
  
  clearSearch: () =>
    set((state) => ({
      search: { query: '', results: null },
      loading: { ...state.loading, isSearching: false },
    })),
  
  reset: () => set(initialState),
})); 