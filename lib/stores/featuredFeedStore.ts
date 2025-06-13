import { create } from 'zustand';
import type {
  FeaturedFeedState,
  FeaturedFeedActions,
  FeaturedFeedStore,
  FeaturedFeedEntryWithData,
  FeaturedFeedPostMetadata
} from '@/lib/types';

// Factory function to create isolated store instances
export const createFeaturedFeedStore = () => {
  return create<FeaturedFeedStore>()((set, get) => ({
    // ============================================================================
    // STATE - Featured Feed State Management (matching types.ts structure)
    // ============================================================================
    
    // Core data
    entries: [],
    
    // Pagination state
    pagination: {
      currentPage: 0,
      hasMore: true,
      totalEntries: 0,
      visibleEntries: 0
    },
    
    // Loading state
    loading: {
      isLoading: false,
      isRefreshing: false,
      hasRefreshed: false,
      fetchError: null,
      refreshError: null
    },
    
    // UI state
    ui: {
      commentDrawerOpen: false,
      selectedCommentEntry: null,
      showNotification: false,
      notificationCount: 0,
      notificationImages: [],
      isActive: false
    },
    
    // Memory management
    memory: {
      entryCache: new Map(),
      metadataCache: new Map(),
      requestCache: new Map(),
      abortControllers: new Set()
    },
    
    // Accessibility state
    accessibility: {
      announcements: [],
      focusedEntryId: null,
      keyboardNavigationEnabled: true,
      screenReaderMode: false
    },
    
    // Performance tracking
    performance: {
      renderCount: 0,
      lastRenderTime: 0,
      memoryUsage: 0,
      bundleSize: 0
    },
    
    // Initialization flag
    hasInitialized: false,
    
    // ============================================================================
    // ACTIONS - Featured Feed Actions (matching types.ts structure)
    // ============================================================================
    
    // Entry management
    setEntries: (entries: FeaturedFeedEntryWithData[]) =>
      set((state) => ({
        ...state,
        entries,
        pagination: {
          ...state.pagination,
          totalEntries: entries.length
        }
      })),
      
    addEntries: (entries: FeaturedFeedEntryWithData[]) =>
      set((state) => {
        const existingIds = new Set(state.entries.map(e => e.entry.guid));
        const uniqueNewEntries = entries.filter(e => !existingIds.has(e.entry.guid));
        return {
          ...state,
          entries: [...state.entries, ...uniqueNewEntries],
          pagination: {
            ...state.pagination,
            totalEntries: state.entries.length + uniqueNewEntries.length
          }
        };
      }),
      
    prependEntries: (entries: FeaturedFeedEntryWithData[]) =>
      set((state) => {
        const existingIds = new Set(state.entries.map(e => e.entry.guid));
        const uniqueNewEntries = entries.filter(e => !existingIds.has(e.entry.guid));
        return {
          ...state,
          entries: [...uniqueNewEntries, ...state.entries],
          pagination: {
            ...state.pagination,
            totalEntries: state.entries.length + uniqueNewEntries.length
          }
        };
      }),
      
    updateEntryMetrics: (entryGuid: string, metrics: FeaturedFeedEntryWithData['initialData']) =>
      set((state) => ({
        ...state,
        entries: state.entries.map(entry =>
          entry.entry.guid === entryGuid
            ? { ...entry, initialData: metrics }
            : entry
        )
      })),
      
    // Pagination actions
    setCurrentPage: (page: number) =>
      set((state) => ({
        ...state,
        pagination: { ...state.pagination, currentPage: page }
      })),
      
    setHasMore: (hasMore: boolean) =>
      set((state) => ({
        ...state,
        pagination: { ...state.pagination, hasMore }
      })),
      
    setTotalEntries: (total: number) =>
      set((state) => ({
        ...state,
        pagination: { ...state.pagination, totalEntries: total }
      })),
      
    setVisibleEntries: (count: number) =>
      set((state) => ({
        ...state,
        pagination: { ...state.pagination, visibleEntries: count }
      })),
      
    // Loading actions
    setLoading: (isLoading: boolean) =>
      set((state) => ({
        ...state,
        loading: { ...state.loading, isLoading }
      })),
      
    setRefreshing: (isRefreshing: boolean) =>
      set((state) => ({
        ...state,
        loading: { ...state.loading, isRefreshing }
      })),
      
    setHasRefreshed: (hasRefreshed: boolean) =>
      set((state) => ({
        ...state,
        loading: { ...state.loading, hasRefreshed }
      })),
      
    setFetchError: (error: Error | null) =>
      set((state) => ({
        ...state,
        loading: { ...state.loading, fetchError: error }
      })),
      
    setRefreshError: (error: string | null) =>
      set((state) => ({
        ...state,
        loading: { ...state.loading, refreshError: error }
      })),
      
    // UI actions
    setActive: (isActive: boolean) =>
      set((state) => ({
        ...state,
        ui: { ...state.ui, isActive }
      })),
      
    openCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) =>
      set((state) => ({
        ...state,
        ui: {
          ...state.ui,
          commentDrawerOpen: true,
          selectedCommentEntry: { entryGuid, feedUrl, initialData }
        }
      })),
      
    closeCommentDrawer: () =>
      set((state) => ({
        ...state,
        ui: {
          ...state.ui,
          commentDrawerOpen: false,
          selectedCommentEntry: null
        }
      })),
      
    setNotification: (show: boolean, count?: number, images?: string[]) =>
      set((state) => ({
        ...state,
        ui: {
          ...state.ui,
          showNotification: show,
          ...(count !== undefined && { notificationCount: count }),
          ...(images !== undefined && { notificationImages: images })
        }
      })),
      
    // Memory management actions
    updateEntryCache: (entryGuid: string, entry: FeaturedFeedEntryWithData) =>
      set((state) => {
        const newCache = new Map(state.memory.entryCache);
        newCache.set(entryGuid, entry);
        return {
          ...state,
          memory: { ...state.memory, entryCache: newCache }
        };
      }),
      
    updateMetadataCache: (feedUrl: string, metadata: FeaturedFeedPostMetadata) =>
      set((state) => {
        const newCache = new Map(state.memory.metadataCache);
        newCache.set(feedUrl, metadata);
        return {
          ...state,
          memory: { ...state.memory, metadataCache: newCache }
        };
      }),
      
    clearCache: () =>
      set((state) => ({
        ...state,
        memory: {
          ...state.memory,
          entryCache: new Map(),
          metadataCache: new Map(),
          requestCache: new Map()
        }
      })),
      
    addAbortController: (controller: AbortController) =>
      set((state) => {
        const newControllers = new Set(state.memory.abortControllers);
        newControllers.add(controller);
        return {
          ...state,
          memory: { ...state.memory, abortControllers: newControllers }
        };
      }),
      
    removeAbortController: (controller: AbortController) =>
      set((state) => {
        const newControllers = new Set(state.memory.abortControllers);
        newControllers.delete(controller);
        return {
          ...state,
          memory: { ...state.memory, abortControllers: newControllers }
        };
      }),
      
    // Accessibility actions
    addAnnouncement: (message: string) =>
      set((state) => {
        const newAnnouncements = [...state.accessibility.announcements, message];
        // Keep only last 5 announcements
        if (newAnnouncements.length > 5) {
          newAnnouncements.shift();
        }
        return {
          ...state,
          accessibility: { ...state.accessibility, announcements: newAnnouncements }
        };
      }),
      
    clearAnnouncements: () =>
      set((state) => ({
        ...state,
        accessibility: { ...state.accessibility, announcements: [] }
      })),
      
    setFocusedEntry: (entryId: string | null) =>
      set((state) => ({
        ...state,
        accessibility: { ...state.accessibility, focusedEntryId: entryId }
      })),
      
    setKeyboardNavigation: (enabled: boolean) =>
      set((state) => ({
        ...state,
        accessibility: { ...state.accessibility, keyboardNavigationEnabled: enabled }
      })),
      
    setScreenReaderMode: (enabled: boolean) =>
      set((state) => ({
        ...state,
        accessibility: { ...state.accessibility, screenReaderMode: enabled }
      })),
      
    // Performance actions
    incrementRenderCount: () =>
      set((state) => ({
        ...state,
        performance: { ...state.performance, renderCount: state.performance.renderCount + 1 }
      })),
      
    updateRenderTime: (time: number) =>
      set((state) => ({
        ...state,
        performance: { ...state.performance, lastRenderTime: time }
      })),
      
    updateMemoryUsage: (usage: number) =>
      set((state) => ({
        ...state,
        performance: { ...state.performance, memoryUsage: usage }
      })),
      
    updateBundleSize: (size: number) =>
      set((state) => ({
        ...state,
        performance: { ...state.performance, bundleSize: size }
      })),
      
    // Utility actions
    reset: () =>
      set(() => ({
        entries: [],
        pagination: {
          currentPage: 0,
          hasMore: true,
          totalEntries: 0,
          visibleEntries: 0
        },
        loading: {
          isLoading: false,
          isRefreshing: false,
          hasRefreshed: false,
          fetchError: null,
          refreshError: null
        },
        ui: {
          commentDrawerOpen: false,
          selectedCommentEntry: null,
          showNotification: false,
          notificationCount: 0,
          notificationImages: [],
          isActive: false
        },
        memory: {
          entryCache: new Map(),
          metadataCache: new Map(),
          requestCache: new Map(),
          abortControllers: new Set()
        },
        accessibility: {
          announcements: [],
          focusedEntryId: null,
          keyboardNavigationEnabled: true,
          screenReaderMode: false
        },
        performance: {
          renderCount: 0,
          lastRenderTime: 0,
          memoryUsage: 0,
          bundleSize: 0
        },
        hasInitialized: false
      })),
      
    initialize: (initialData: {
      entries: FeaturedFeedEntryWithData[];
      totalEntries: number;
      hasMore?: boolean;
    }) =>
      set((state) => ({
        ...state,
        entries: initialData.entries,
        pagination: {
          ...state.pagination,
          totalEntries: initialData.totalEntries,
          hasMore: initialData.hasMore ?? true
        },
        hasInitialized: true
      }))
  }));
};

// Export type for store instance
export type FeaturedFeedStoreInstance = ReturnType<typeof createFeaturedFeedStore>; 