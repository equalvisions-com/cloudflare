import { create } from 'zustand';
import React, { createContext, useContext } from 'react';
import type { 
  FeaturedFeedStore, 
  FeaturedFeedState, 
  FeaturedFeedEntryWithData,
  FeaturedFeedPaginationState,
  FeaturedFeedLoadingState,
  FeaturedFeedUIState,
  FeaturedFeedMetadataState
} from '@/lib/types';

// Initial state factory functions for better organization
const createInitialPaginationState = (): FeaturedFeedPaginationState => ({
  currentPage: 1,
  hasMore: false,
  totalEntries: 0,
});

const createInitialLoadingState = (): FeaturedFeedLoadingState => ({
  isLoading: false,
  fetchError: null,
});

const createInitialUIState = (): FeaturedFeedUIState => ({
  commentDrawerOpen: false,
  selectedCommentEntry: null,
  isActive: true,
});

const createInitialMetadataState = (): FeaturedFeedMetadataState => ({
  feedMetadataCache: {},
});

// Create initial state factory
const createInitialState = (): FeaturedFeedState => ({
  entries: [],
  pagination: createInitialPaginationState(),
  loading: createInitialLoadingState(),
  ui: createInitialUIState(),
  metadata: createInitialMetadataState(),
  hasInitialized: false,
});

// Create store factory function following Zustand Next.js best practices
export const createFeaturedFeedStore = () => create<FeaturedFeedStore>((set) => ({
  // Initial state
  ...createInitialState(),

  // Entry management actions
  setEntries: (entries: FeaturedFeedEntryWithData[]) => {
    set({ entries });
  },

  addEntries: (newEntries: FeaturedFeedEntryWithData[]) => {
    set((state) => ({
      entries: [...state.entries, ...newEntries],
    }));
  },

  updateEntryMetrics: (entryGuid: string, metrics: FeaturedFeedEntryWithData['initialData']) => {
    set((state) => ({
      entries: state.entries.map(entry => 
        entry.entry.guid === entryGuid 
          ? { ...entry, initialData: { ...entry.initialData, ...metrics } }
          : entry
      ),
    }));
  },

  // Pagination actions
  setCurrentPage: (page: number) => {
    set((state) => ({
      pagination: { ...state.pagination, currentPage: page },
    }));
  },

  setHasMore: (hasMore: boolean) => {
    set((state) => ({
      pagination: { ...state.pagination, hasMore },
    }));
  },

  setTotalEntries: (total: number) => {
    set((state) => ({
      pagination: { ...state.pagination, totalEntries: total },
    }));
  },

  // Loading actions
  setLoading: (isLoading: boolean) => {
    set((state) => ({
      loading: { ...state.loading, isLoading },
    }));
  },

  setFetchError: (error: Error | null) => {
    set((state) => ({
      loading: { ...state.loading, fetchError: error },
    }));
  },

  // UI actions
  setActive: (isActive: boolean) => {
    set((state) => ({
      ui: { ...state.ui, isActive },
    }));
  },

  openCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    set((state) => ({
      ui: {
        ...state.ui,
        commentDrawerOpen: true,
        selectedCommentEntry: { entryGuid, feedUrl, initialData },
      },
    }));
  },

  closeCommentDrawer: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        commentDrawerOpen: false,
        selectedCommentEntry: null,
      },
    }));
  },

  // Metadata actions
  updateFeedMetadataCache: (feedUrl: string, metadata: FeaturedFeedEntryWithData['postMetadata']) => {
    set((state) => ({
      metadata: {
        ...state.metadata,
        feedMetadataCache: {
          ...state.metadata.feedMetadataCache,
          [feedUrl]: metadata,
        },
      },
    }));
  },

  // Utility actions
  reset: () => {
    set(createInitialState());
  },

  initialize: (initialData: {
    entries: FeaturedFeedEntryWithData[];
    totalEntries: number;
  }) => {
    set((state) => ({
      entries: initialData.entries,
      pagination: {
        ...state.pagination,
        totalEntries: initialData.totalEntries,
        hasMore: false, // Featured feed doesn't paginate like RSS
      },
      hasInitialized: true,
    }));
  },
}));

// Create context for the store
export const FeaturedFeedStoreContext = createContext<ReturnType<typeof createFeaturedFeedStore> | null>(null);

// Hook to use the store from context
export const useFeaturedFeedStore = () => {
  const store = useContext(FeaturedFeedStoreContext);
  if (!store) {
    throw new Error('useFeaturedFeedStore must be used within FeaturedFeedStoreProvider');
  }
  return store;
};

// Selector hooks for state access
export const useFeaturedFeedEntries = () => useFeaturedFeedStore()((state) => state.entries);
export const useFeaturedFeedHasInitialized = () => useFeaturedFeedStore()((state) => state.hasInitialized);
export const useFeaturedFeedIsLoading = () => useFeaturedFeedStore()((state) => state.loading.isLoading);
export const useFeaturedFeedFetchError = () => useFeaturedFeedStore()((state) => state.loading.fetchError);
export const useFeaturedFeedCurrentPage = () => useFeaturedFeedStore()((state) => state.pagination.currentPage);
export const useFeaturedFeedHasMore = () => useFeaturedFeedStore()((state) => state.pagination.hasMore);
export const useFeaturedFeedTotalEntries = () => useFeaturedFeedStore()((state) => state.pagination.totalEntries);
export const useFeaturedFeedCommentDrawerOpen = () => useFeaturedFeedStore()((state) => state.ui.commentDrawerOpen);
export const useFeaturedFeedSelectedCommentEntry = () => useFeaturedFeedStore()((state) => state.ui.selectedCommentEntry);

// Action hooks for state mutations
export const useFeaturedFeedSetEntries = () => useFeaturedFeedStore()((state) => state.setEntries);
export const useFeaturedFeedSetLoading = () => useFeaturedFeedStore()((state) => state.setLoading);
export const useFeaturedFeedSetFetchError = () => useFeaturedFeedStore()((state) => state.setFetchError);
export const useFeaturedFeedSetCurrentPage = () => useFeaturedFeedStore()((state) => state.setCurrentPage);
export const useFeaturedFeedSetHasMore = () => useFeaturedFeedStore()((state) => state.setHasMore);
export const useFeaturedFeedSetTotalEntries = () => useFeaturedFeedStore()((state) => state.setTotalEntries);
export const useFeaturedFeedOpenCommentDrawer = () => useFeaturedFeedStore()((state) => state.openCommentDrawer);
export const useFeaturedFeedCloseCommentDrawer = () => useFeaturedFeedStore()((state) => state.closeCommentDrawer);
export const useFeaturedFeedInitialize = () => useFeaturedFeedStore()((state) => state.initialize); 