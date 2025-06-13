import { create } from 'zustand';
import { createContext, useContext } from 'react';
import type { 
  RSSEntriesDisplayStore, 
  RSSEntriesDisplayState, 
  RSSEntriesDisplayEntry,
  RSSEntriesDisplayPaginationState,
  RSSEntriesDisplayLoadingState,
  RSSEntriesDisplayUIState,
  RSSEntriesDisplayMetadataState
} from '@/lib/types';

// Initial state factory functions for better organization
const createInitialPaginationState = (): RSSEntriesDisplayPaginationState => ({
  currentPage: 1,
  hasMore: false,
  totalEntries: 0,
});

const createInitialLoadingState = (): RSSEntriesDisplayLoadingState => ({
  isLoading: false,
  isRefreshing: false,
  hasRefreshed: false,
  fetchError: null,
  refreshError: null,
});

const createInitialUIState = (): RSSEntriesDisplayUIState => ({
  commentDrawerOpen: false,
  selectedCommentEntry: null,
  showNotification: false,
  notificationCount: 0,
  notificationImages: [],
  isActive: true,
});

const createInitialMetadataState = (): RSSEntriesDisplayMetadataState => ({
  postTitles: [],
  feedUrls: [],
  mediaTypes: [],
  feedMetadataCache: {},
  newEntries: [],
});

// Create initial state factory
const createInitialState = (): RSSEntriesDisplayState => ({
  entries: [],
  pagination: createInitialPaginationState(),
  loading: createInitialLoadingState(),
  ui: createInitialUIState(),
  metadata: createInitialMetadataState(),
  hasInitialized: false,
});

// SOLUTION: Create store factory function instead of global singleton
// This follows Zustand Next.js best practices for per-component stores
export const createRSSEntriesDisplayStore = () => create<RSSEntriesDisplayStore>((set, get) => ({
  // Initial state
  ...createInitialState(),

  // Entry management actions
  setEntries: (entries: RSSEntriesDisplayEntry[]) => {
    set({ entries });
  },

  addEntries: (newEntries: RSSEntriesDisplayEntry[]) => {
    set((state) => ({
      entries: [...state.entries, ...newEntries],
    }));
  },

  prependEntries: (newEntries: RSSEntriesDisplayEntry[]) => {
    set((state) => ({
      entries: [...newEntries, ...state.entries],
    }));
  },

  updateEntryMetrics: (entryGuid: string, metrics: RSSEntriesDisplayEntry['initialData']) => {
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

  setRefreshing: (isRefreshing: boolean) => {
    set((state) => ({
      loading: { ...state.loading, isRefreshing },
    }));
  },

  setHasRefreshed: (hasRefreshed: boolean) => {
    set((state) => ({
      loading: { ...state.loading, hasRefreshed },
    }));
  },

  setFetchError: (error: Error | null) => {
    set((state) => ({
      loading: { ...state.loading, fetchError: error },
    }));
  },

  setRefreshError: (error: string | null) => {
    set((state) => ({
      loading: { ...state.loading, refreshError: error },
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

  setNotification: (show: boolean, count?: number, images?: string[]) => {
    set((state) => ({
      ui: {
        ...state.ui,
        showNotification: show,
        notificationCount: count || 0,
        notificationImages: images || [],
      },
    }));
  },

  // Metadata actions
  setPostTitles: (titles: string[]) => {
    set((state) => ({
      metadata: { ...state.metadata, postTitles: titles },
    }));
  },

  setFeedUrls: (urls: string[]) => {
    set((state) => ({
      metadata: { ...state.metadata, feedUrls: urls },
    }));
  },

  setMediaTypes: (types: string[]) => {
    set((state) => ({
      metadata: { ...state.metadata, mediaTypes: types },
    }));
  },

  updateFeedMetadataCache: (feedUrl: string, metadata: RSSEntriesDisplayEntry['postMetadata']) => {
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

  setNewEntries: (entries: RSSEntriesDisplayEntry[]) => {
    set((state) => ({
      metadata: { ...state.metadata, newEntries: entries },
    }));
  },

  clearNewEntries: () => {
    set((state) => ({
      metadata: { ...state.metadata, newEntries: [] },
    }));
  },

  // Utility actions
  reset: () => {
    set(createInitialState());
  },

  initialize: (initialData) => {
    const {
      entries,
      totalEntries,
      hasMore,
      postTitles,
      feedUrls,
      mediaTypes,
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
        isRefreshing: false,
        hasRefreshed: false,
        fetchError: null,
        refreshError: null,
      },
      ui: createInitialUIState(),
      metadata: {
        postTitles,
        feedUrls,
        mediaTypes,
        feedMetadataCache: {},
        newEntries: [],
      },
      hasInitialized: true,
    });
  },
}));

// Create context for the store
export const RSSEntriesDisplayStoreContext = createContext<ReturnType<typeof createRSSEntriesDisplayStore> | null>(null);

// Hook to use the store from context
export const useRSSEntriesDisplayStore = () => {
  const store = useContext(RSSEntriesDisplayStoreContext);
  if (!store) {
    throw new Error('useRSSEntriesDisplayStore must be used within RSSEntriesDisplayStoreProvider');
  }
  return store;
};

// PHASE 1: Basic selector hooks for state access
export const useRSSEntriesDisplayEntries = () => useRSSEntriesDisplayStore()((state) => state.entries);
export const useRSSEntriesDisplayPagination = () => useRSSEntriesDisplayStore()((state) => state.pagination);
export const useRSSEntriesDisplayLoading = () => useRSSEntriesDisplayStore()((state) => state.loading);
export const useRSSEntriesDisplayUI = () => useRSSEntriesDisplayStore()((state) => state.ui);
export const useRSSEntriesDisplayMetadata = () => useRSSEntriesDisplayStore()((state) => state.metadata);
export const useRSSEntriesDisplayHasInitialized = () => useRSSEntriesDisplayStore()((state) => state.hasInitialized);

// PHASE 1: Individual selectors for optimal re-renders (removed problematic optimized selectors)

// PHASE 1: Granular selectors for specific values to minimize re-renders
export const useRSSEntriesDisplayEntriesLength = () => useRSSEntriesDisplayStore()((state) => state.entries.length);
export const useRSSEntriesDisplayIsLoading = () => useRSSEntriesDisplayStore()((state) => state.loading.isLoading);
export const useRSSEntriesDisplayIsRefreshing = () => useRSSEntriesDisplayStore()((state) => state.loading.isRefreshing);
export const useRSSEntriesDisplayHasRefreshed = () => useRSSEntriesDisplayStore()((state) => state.loading.hasRefreshed);
export const useRSSEntriesDisplayFetchError = () => useRSSEntriesDisplayStore()((state) => state.loading.fetchError);
export const useRSSEntriesDisplayRefreshError = () => useRSSEntriesDisplayStore()((state) => state.loading.refreshError);
export const useRSSEntriesDisplayHasMore = () => useRSSEntriesDisplayStore()((state) => state.pagination.hasMore);
export const useRSSEntriesDisplayCurrentPage = () => useRSSEntriesDisplayStore()((state) => state.pagination.currentPage);
export const useRSSEntriesDisplayTotalEntries = () => useRSSEntriesDisplayStore()((state) => state.pagination.totalEntries);
export const useRSSEntriesDisplayIsActive = () => useRSSEntriesDisplayStore()((state) => state.ui.isActive);
export const useRSSEntriesDisplayCommentDrawerOpen = () => useRSSEntriesDisplayStore()((state) => state.ui.commentDrawerOpen);
export const useRSSEntriesDisplaySelectedCommentEntry = () => useRSSEntriesDisplayStore()((state) => state.ui.selectedCommentEntry);
export const useRSSEntriesDisplayShowNotification = () => useRSSEntriesDisplayStore()((state) => state.ui.showNotification);
export const useRSSEntriesDisplayNotificationCount = () => useRSSEntriesDisplayStore()((state) => state.ui.notificationCount);
export const useRSSEntriesDisplayNotificationImages = () => useRSSEntriesDisplayStore()((state) => state.ui.notificationImages);
export const useRSSEntriesDisplayPostTitles = () => useRSSEntriesDisplayStore()((state) => state.metadata.postTitles);
export const useRSSEntriesDisplayFeedUrls = () => useRSSEntriesDisplayStore()((state) => state.metadata.feedUrls);
export const useRSSEntriesDisplayMediaTypes = () => useRSSEntriesDisplayStore()((state) => state.metadata.mediaTypes);
export const useRSSEntriesDisplayNewEntries = () => useRSSEntriesDisplayStore()((state) => state.metadata.newEntries);
export const useRSSEntriesDisplayFeedMetadataCache = () => useRSSEntriesDisplayStore()((state) => state.metadata.feedMetadataCache);

// Individual action hooks to prevent object recreation and infinite re-renders
export const useRSSEntriesDisplaySetEntries = () => useRSSEntriesDisplayStore()((state) => state.setEntries);
export const useRSSEntriesDisplayAddEntries = () => useRSSEntriesDisplayStore()((state) => state.addEntries);
export const useRSSEntriesDisplayPrependEntries = () => useRSSEntriesDisplayStore()((state) => state.prependEntries);
export const useRSSEntriesDisplayUpdateEntryMetrics = () => useRSSEntriesDisplayStore()((state) => state.updateEntryMetrics);

export const useRSSEntriesDisplaySetCurrentPage = () => useRSSEntriesDisplayStore()((state) => state.setCurrentPage);
export const useRSSEntriesDisplaySetHasMore = () => useRSSEntriesDisplayStore()((state) => state.setHasMore);
export const useRSSEntriesDisplaySetTotalEntries = () => useRSSEntriesDisplayStore()((state) => state.setTotalEntries);

export const useRSSEntriesDisplaySetLoading = () => useRSSEntriesDisplayStore()((state) => state.setLoading);
export const useRSSEntriesDisplaySetRefreshing = () => useRSSEntriesDisplayStore()((state) => state.setRefreshing);
export const useRSSEntriesDisplaySetHasRefreshed = () => useRSSEntriesDisplayStore()((state) => state.setHasRefreshed);
export const useRSSEntriesDisplaySetFetchError = () => useRSSEntriesDisplayStore()((state) => state.setFetchError);
export const useRSSEntriesDisplaySetRefreshError = () => useRSSEntriesDisplayStore()((state) => state.setRefreshError);

export const useRSSEntriesDisplaySetActive = () => useRSSEntriesDisplayStore()((state) => state.setActive);
export const useRSSEntriesDisplayOpenCommentDrawer = () => useRSSEntriesDisplayStore()((state) => state.openCommentDrawer);
export const useRSSEntriesDisplayCloseCommentDrawer = () => useRSSEntriesDisplayStore()((state) => state.closeCommentDrawer);
export const useRSSEntriesDisplaySetNotification = () => useRSSEntriesDisplayStore()((state) => state.setNotification);

export const useRSSEntriesDisplaySetPostTitles = () => useRSSEntriesDisplayStore()((state) => state.setPostTitles);
export const useRSSEntriesDisplaySetFeedUrls = () => useRSSEntriesDisplayStore()((state) => state.setFeedUrls);
export const useRSSEntriesDisplaySetMediaTypes = () => useRSSEntriesDisplayStore()((state) => state.setMediaTypes);
export const useRSSEntriesDisplayUpdateFeedMetadataCache = () => useRSSEntriesDisplayStore()((state) => state.updateFeedMetadataCache);
export const useRSSEntriesDisplaySetNewEntries = () => useRSSEntriesDisplayStore()((state) => state.setNewEntries);
export const useRSSEntriesDisplayClearNewEntries = () => useRSSEntriesDisplayStore()((state) => state.clearNewEntries);

export const useRSSEntriesDisplayReset = () => useRSSEntriesDisplayStore()((state) => state.reset);
export const useRSSEntriesDisplayInitialize = () => useRSSEntriesDisplayStore()((state) => state.initialize); 