import { create } from 'zustand';
import { EntriesState, EntriesActions, EntriesRSSEntry } from '@/lib/types';

interface EntriesStore extends EntriesState, EntriesActions {}

export const useEntriesStore = create<EntriesStore>((set, get) => ({
  // Initial state
  entries: [],
  page: 1,
  hasMore: true,
  lastSearchQuery: '',
  loadingState: {
    isLoading: false,
    isInitialLoad: true,
    isMetricsLoading: false,
  },
  commentDrawerOpen: false,
  selectedCommentEntry: null,

  // Actions
  setEntries: (entries: EntriesRSSEntry[]) => {
    set({ entries });
  },

  addEntries: (newEntries: EntriesRSSEntry[]) => {
    set((state) => ({
      entries: [...state.entries, ...newEntries],
    }));
  },

  setPage: (page: number) => {
    set({ page });
  },

  setHasMore: (hasMore: boolean) => {
    set({ hasMore });
  },

  setLastSearchQuery: (query: string) => {
    set({ lastSearchQuery: query });
  },

  setLoading: (isLoading: boolean) => {
    console.log('🔄 Zustand setLoading called with:', isLoading);
    set((state) => ({
      loadingState: {
        ...state.loadingState,
        isLoading,
      },
    }));
  },

  setInitialLoad: (isInitialLoad: boolean) => {
    set((state) => ({
      loadingState: {
        ...state.loadingState,
        isInitialLoad,
      },
    }));
  },

  setMetricsLoading: (isMetricsLoading: boolean) => {
    set((state) => ({
      loadingState: {
        ...state.loadingState,
        isMetricsLoading,
      },
    }));
  },

  setCommentDrawerOpen: (open: boolean) => {
    set({ commentDrawerOpen: open });
  },

  setSelectedCommentEntry: (entry: EntriesState['selectedCommentEntry']) => {
    set({ selectedCommentEntry: entry });
  },

  reset: () => {
    set({
      entries: [],
      page: 1,
      hasMore: true,
      lastSearchQuery: '',
      loadingState: {
        isLoading: false,
        isInitialLoad: true,
        isMetricsLoading: false,
      },
      commentDrawerOpen: false,
      selectedCommentEntry: null,
    });
  },
})); 