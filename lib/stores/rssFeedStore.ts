import { create } from 'zustand';
import { createContext, useContext } from 'react';
import type { 
  RSSFeedStore, 
  RSSFeedState, 
  RSSFeedEntry,
  RSSFeedLoadingState,
  RSSFeedPaginationState,
  RSSFeedCommentDrawerState,
  RSSFeedUIState
} from '@/lib/types';

// Initial state factory functions for better organization
const createInitialLoadingState = (): RSSFeedLoadingState => ({
  isLoading: false,
  isInitialRender: true,
  fetchError: null,
});

const createInitialPaginationState = (): RSSFeedPaginationState => ({
  currentPage: 1,
  hasMore: false,
  totalEntries: 0,
});

const createInitialCommentDrawerState = (): RSSFeedCommentDrawerState => ({
  isOpen: false,
  selectedEntry: null,
});

const createInitialUIState = (): RSSFeedUIState => ({
  isActive: true,
  isSearchMode: false,
});

const createInitialFeedMetadata = () => ({
  postTitle: '',
  feedUrl: '',
  featuredImg: undefined,
  mediaType: undefined,
  verified: false,
  pageSize: 30,
});

// SOLUTION: Create store factory function instead of global singleton
// This follows Zustand Next.js best practices for per-component stores
export const createRSSFeedStore = () => create<RSSFeedStore>((set, get) => ({
  // Initial state
  entries: [],
  pagination: createInitialPaginationState(),
  loading: createInitialLoadingState(),
  commentDrawer: createInitialCommentDrawerState(),
  ui: createInitialUIState(),
  feedMetadata: createInitialFeedMetadata(),

  // Entry management actions
  setEntries: (entries: RSSFeedEntry[]) => {
    set({ entries });
  },

  addEntries: (newEntries: RSSFeedEntry[]) => {
    set((state) => ({
      entries: [...state.entries, ...newEntries],
    }));
  },

  updateEntryMetrics: (entryGuid: string, metrics: RSSFeedEntry['initialData']) => {
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

  setInitialRender: (isInitialRender: boolean) => {
    set((state) => ({
      loading: { ...state.loading, isInitialRender },
    }));
  },

  setFetchError: (error: Error | null) => {
    set((state) => ({
      loading: { ...state.loading, fetchError: error },
    }));
  },

  // Comment drawer actions
  openCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    set((state) => ({
      commentDrawer: {
        isOpen: true,
        selectedEntry: { entryGuid, feedUrl, initialData },
      },
    }));
  },

  closeCommentDrawer: () => {
    set((state) => ({
      commentDrawer: {
        isOpen: false,
        selectedEntry: null,
      },
    }));
  },

  // UI actions
  setActive: (isActive: boolean) => {
    set((state) => ({
      ui: { ...state.ui, isActive },
    }));
  },

  setSearchMode: (isSearchMode: boolean) => {
    set((state) => ({
      ui: { ...state.ui, isSearchMode },
    }));
  },

  // Feed metadata actions
  setFeedMetadata: (metadata: Partial<RSSFeedState['feedMetadata']>) => {
    set((state) => ({
      feedMetadata: { ...state.feedMetadata, ...metadata },
    }));
  },

  // Utility actions
  reset: () => {
    set({
      entries: [],
      pagination: createInitialPaginationState(),
      loading: createInitialLoadingState(),
      commentDrawer: createInitialCommentDrawerState(),
      ui: createInitialUIState(),
      feedMetadata: createInitialFeedMetadata(),
    });
  },

  initialize: (initialData) => {
    const {
      entries,
      totalEntries,
      hasMore,
      postTitle,
      feedUrl,
      featuredImg,
      mediaType,
      verified = false,
      pageSize = 30,
    } = initialData;

    set({
      entries,
      pagination: {
        currentPage: 1,
        hasMore,
        totalEntries,
      },
      loading: {
        isLoading: false,
        isInitialRender: true,
        fetchError: null,
      },
      commentDrawer: createInitialCommentDrawerState(),
      ui: {
        isActive: true,
        isSearchMode: false,
      },
      feedMetadata: {
        postTitle,
        feedUrl,
        featuredImg,
        mediaType,
        verified,
        pageSize,
      },
    });
  },
}));

// Create React Context for the store
export const RSSFeedStoreContext = createContext<ReturnType<typeof createRSSFeedStore> | null>(null);

// Custom hook to use the store from context
export const useRSSFeedStore = () => {
  const store = useContext(RSSFeedStoreContext);
  if (!store) {
    throw new Error('useRSSFeedStore must be used within RSSFeedStoreProvider');
  }
  return store;
};

// PHASE 4: Advanced selector hooks with shallow comparison for optimal re-renders
export const useRSSFeedEntries = () => useRSSFeedStore()((state) => state.entries);
export const useRSSFeedPagination = () => useRSSFeedStore()((state) => state.pagination);
export const useRSSFeedLoading = () => useRSSFeedStore()((state) => state.loading);
export const useRSSFeedCommentDrawer = () => useRSSFeedStore()((state) => state.commentDrawer);
export const useRSSFeedUI = () => useRSSFeedStore()((state) => state.ui);
export const useRSSFeedMetadata = () => useRSSFeedStore()((state) => state.feedMetadata);

// PHASE 4: Optimized multi-value selectors for better performance
export const useRSSFeedPaginationOptimized = () => useRSSFeedStore()((state) => ({
  currentPage: state.pagination.currentPage,
  hasMore: state.pagination.hasMore,
  totalEntries: state.pagination.totalEntries,
}));

export const useRSSFeedLoadingOptimized = () => useRSSFeedStore()((state) => ({
  isLoading: state.loading.isLoading,
  isInitialRender: state.loading.isInitialRender,
  fetchError: state.loading.fetchError,
}));

// PHASE 4: Granular selectors for specific values to minimize re-renders
export const useRSSFeedEntriesLength = () => useRSSFeedStore()((state) => state.entries.length);
export const useRSSFeedHasMore = () => useRSSFeedStore()((state) => state.pagination.hasMore);
export const useRSSFeedIsLoading = () => useRSSFeedStore()((state) => state.loading.isLoading);
export const useRSSFeedIsActive = () => useRSSFeedStore()((state) => state.ui.isActive);
export const useRSSFeedFetchError = () => useRSSFeedStore()((state) => state.loading.fetchError);

// Individual action hooks to prevent object recreation and infinite re-renders
export const useRSSFeedSetEntries = () => useRSSFeedStore()((state) => state.setEntries);
export const useRSSFeedAddEntries = () => useRSSFeedStore()((state) => state.addEntries);
export const useRSSFeedUpdateEntryMetrics = () => useRSSFeedStore()((state) => state.updateEntryMetrics);
export const useRSSFeedSetCurrentPage = () => useRSSFeedStore()((state) => state.setCurrentPage);
export const useRSSFeedSetHasMore = () => useRSSFeedStore()((state) => state.setHasMore);
export const useRSSFeedSetTotalEntries = () => useRSSFeedStore()((state) => state.setTotalEntries);
export const useRSSFeedSetLoading = () => useRSSFeedStore()((state) => state.setLoading);
export const useRSSFeedSetInitialRender = () => useRSSFeedStore()((state) => state.setInitialRender);
export const useRSSFeedSetFetchError = () => useRSSFeedStore()((state) => state.setFetchError);
export const useRSSFeedOpenCommentDrawer = () => useRSSFeedStore()((state) => state.openCommentDrawer);
export const useRSSFeedCloseCommentDrawer = () => useRSSFeedStore()((state) => state.closeCommentDrawer);
export const useRSSFeedSetActive = () => useRSSFeedStore()((state) => state.setActive);
export const useRSSFeedSetSearchMode = () => useRSSFeedStore()((state) => state.setSearchMode);
export const useRSSFeedSetFeedMetadata = () => useRSSFeedStore()((state) => state.setFeedMetadata);
export const useRSSFeedReset = () => useRSSFeedStore()((state) => state.reset);
export const useRSSFeedInitialize = () => useRSSFeedStore()((state) => state.initialize); 