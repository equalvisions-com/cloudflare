import { create } from 'zustand';
import { createContext, useContext } from 'react';
import type { 
  FeedTabsStore, 
  FeedTabsState, 
  FeedTabsRSSData,
  FeedTabsFeaturedData,
  FeedTabsLoadingState,
  FeedTabsErrorState,
  FeedTabsFetchProgress,
  FeedTabsAuthState
} from '@/lib/types';

// Initial state factory functions for better organization
const createInitialLoadingState = (): FeedTabsLoadingState => ({
  isRSSLoading: false,
  isFeaturedLoading: false,
});

const createInitialErrorState = (): FeedTabsErrorState => ({
  rssError: null,
  featuredError: null,
});

const createInitialFetchProgress = (): FeedTabsFetchProgress => ({
  rssFetchInProgress: false,
  featuredFetchInProgress: false,
});

const createInitialAuthState = (): FeedTabsAuthState => ({
  isAuthenticated: false,
  displayName: '',
  isBoarded: false,
  profileImage: null,
  pendingFriendRequestCount: 0,
});

// Create initial state factory
const createInitialState = (): FeedTabsState => ({
  activeTabIndex: 0,
  rssData: null,
  featuredData: null,
  loading: createInitialLoadingState(),
  errors: createInitialErrorState(),
  fetchProgress: createInitialFetchProgress(),
  auth: createInitialAuthState(),
  pageSize: 20,
  hasInitialized: false,
});

// SOLUTION: Create store factory function instead of global singleton
// This follows Zustand Next.js best practices for per-component stores
export const createFeedTabsStore = () => create<FeedTabsStore>((set, get) => ({
  // Initial state
  ...createInitialState(),

  // Tab management actions
  setActiveTabIndex: (index: number) => {
    set({ activeTabIndex: index });
  },

  // Data management actions
  setRSSData: (data: FeedTabsRSSData | null) => {
    set({ rssData: data });
  },

  setFeaturedData: (data: FeedTabsFeaturedData | null) => {
    set({ featuredData: data });
  },

  // Loading state actions
  setRSSLoading: (loading: boolean) => {
    set((state) => ({
      loading: { ...state.loading, isRSSLoading: loading },
    }));
  },

  setFeaturedLoading: (loading: boolean) => {
    set((state) => ({
      loading: { ...state.loading, isFeaturedLoading: loading },
    }));
  },

  // Error management actions
  setRSSError: (error: string | null) => {
    set((state) => ({
      errors: { ...state.errors, rssError: error },
    }));
  },

  setFeaturedError: (error: string | null) => {
    set((state) => ({
      errors: { ...state.errors, featuredError: error },
    }));
  },

  // Fetch progress actions
  setRSSFetchInProgress: (inProgress: boolean) => {
    set((state) => ({
      fetchProgress: { ...state.fetchProgress, rssFetchInProgress: inProgress },
    }));
  },

  setFeaturedFetchInProgress: (inProgress: boolean) => {
    set((state) => ({
      fetchProgress: { ...state.fetchProgress, featuredFetchInProgress: inProgress },
    }));
  },

  // Authentication actions
  setAuthState: (auth: Partial<FeedTabsAuthState>) => {
    set((state) => ({
      auth: { ...state.auth, ...auth },
    }));
  },

  // Configuration actions
  setPageSize: (size: number) => {
    set({ pageSize: size });
  },

  // Initialization actions
  setInitialized: (initialized: boolean) => {
    set({ hasInitialized: initialized });
  },

  // Utility actions
  reset: () => {
    set(createInitialState());
  },

  initialize: (initialData) => {
    const {
      rssData,
      featuredData,
      pageSize = 20,
      auth = {},
    } = initialData;

    set({
      activeTabIndex: 0,
      rssData: rssData || null,
      featuredData: featuredData || null,
      loading: createInitialLoadingState(),
      errors: createInitialErrorState(),
      fetchProgress: createInitialFetchProgress(),
      auth: { ...createInitialAuthState(), ...auth },
      pageSize,
      hasInitialized: true,
    });
  },
}));

// Create context for the store
export const FeedTabsStoreContext = createContext<ReturnType<typeof createFeedTabsStore> | null>(null);

// Hook to use the store from context
export const useFeedTabsStore = () => {
  const store = useContext(FeedTabsStoreContext);
  if (!store) {
    throw new Error('useFeedTabsStore must be used within FeedTabsStoreProvider');
  }
  return store;
};

// ===================================================================
// SELECTOR HOOKS - Prevent unnecessary re-renders
// ===================================================================

// State selectors
export const useFeedTabsActiveTabIndex = () => useFeedTabsStore()((state) => state.activeTabIndex);
export const useFeedTabsRSSData = () => useFeedTabsStore()((state) => state.rssData);
export const useFeedTabsFeaturedData = () => useFeedTabsStore()((state) => state.featuredData);
export const useFeedTabsLoading = () => useFeedTabsStore()((state) => state.loading);
export const useFeedTabsErrors = () => useFeedTabsStore()((state) => state.errors);
export const useFeedTabsFetchProgress = () => useFeedTabsStore()((state) => state.fetchProgress);
export const useFeedTabsAuth = () => useFeedTabsStore()((state) => state.auth);
export const useFeedTabsPageSize = () => useFeedTabsStore()((state) => state.pageSize);
export const useFeedTabsHasInitialized = () => useFeedTabsStore()((state) => state.hasInitialized);

// Specific loading state selectors
export const useFeedTabsIsRSSLoading = () => useFeedTabsStore()((state) => state.loading.isRSSLoading);
export const useFeedTabsIsFeaturedLoading = () => useFeedTabsStore()((state) => state.loading.isFeaturedLoading);

// Error state selectors
export const useFeedTabsRSSError = () => useFeedTabsStore()((state) => state.errors.rssError);
export const useFeedTabsFeaturedError = () => useFeedTabsStore()((state) => state.errors.featuredError);

// Fetch progress selectors
export const useFeedTabsRSSFetchInProgress = () => useFeedTabsStore()((state) => state.fetchProgress.rssFetchInProgress);
export const useFeedTabsFeaturedFetchInProgress = () => useFeedTabsStore()((state) => state.fetchProgress.featuredFetchInProgress);

// Auth state selectors
export const useFeedTabsIsAuthenticated = () => useFeedTabsStore()((state) => state.auth.isAuthenticated);
export const useFeedTabsDisplayName = () => useFeedTabsStore()((state) => state.auth.displayName);
export const useFeedTabsIsBoarded = () => useFeedTabsStore()((state) => state.auth.isBoarded);
export const useFeedTabsProfileImage = () => useFeedTabsStore()((state) => state.auth.profileImage);
export const useFeedTabsPendingFriendRequestCount = () => useFeedTabsStore()((state) => state.auth.pendingFriendRequestCount);

// ===================================================================
// ACTION HOOKS - Prevent object recreation and infinite re-renders
// ===================================================================

// Tab management actions
export const useFeedTabsSetActiveTabIndex = () => useFeedTabsStore()((state) => state.setActiveTabIndex);

// Data management actions
export const useFeedTabsSetRSSData = () => useFeedTabsStore()((state) => state.setRSSData);
export const useFeedTabsSetFeaturedData = () => useFeedTabsStore()((state) => state.setFeaturedData);

// Loading state actions
export const useFeedTabsSetRSSLoading = () => useFeedTabsStore()((state) => state.setRSSLoading);
export const useFeedTabsSetFeaturedLoading = () => useFeedTabsStore()((state) => state.setFeaturedLoading);

// Error management actions
export const useFeedTabsSetRSSError = () => useFeedTabsStore()((state) => state.setRSSError);
export const useFeedTabsSetFeaturedError = () => useFeedTabsStore()((state) => state.setFeaturedError);

// Fetch progress actions
export const useFeedTabsSetRSSFetchInProgress = () => useFeedTabsStore()((state) => state.setRSSFetchInProgress);
export const useFeedTabsSetFeaturedFetchInProgress = () => useFeedTabsStore()((state) => state.setFeaturedFetchInProgress);

// Authentication actions
export const useFeedTabsSetAuthState = () => useFeedTabsStore()((state) => state.setAuthState);

// Configuration actions
export const useFeedTabsSetPageSize = () => useFeedTabsStore()((state) => state.setPageSize);

// Initialization actions
export const useFeedTabsSetInitialized = () => useFeedTabsStore()((state) => state.setInitialized);

// Utility actions
export const useFeedTabsReset = () => useFeedTabsStore()((state) => state.reset);
export const useFeedTabsInitialize = () => useFeedTabsStore()((state) => state.initialize);

// ===================================================================
// COMPUTED SELECTORS - Derived state
// ===================================================================

// Check if any loading is in progress
export const useFeedTabsIsAnyLoading = () => useFeedTabsStore()((state) => 
  state.loading.isRSSLoading || state.loading.isFeaturedLoading
);

// Check if any fetch is in progress
export const useFeedTabsIsAnyFetchInProgress = () => useFeedTabsStore()((state) => 
  state.fetchProgress.rssFetchInProgress || state.fetchProgress.featuredFetchInProgress
);

// Check if there are any errors
export const useFeedTabsHasErrors = () => useFeedTabsStore()((state) => 
  Boolean(state.errors.rssError || state.errors.featuredError)
);

// Get all errors as array
export const useFeedTabsAllErrors = () => useFeedTabsStore()((state) => 
  [state.errors.rssError, state.errors.featuredError].filter(Boolean)
);

// Check if data is ready for display
export const useFeedTabsIsDataReady = () => useFeedTabsStore()((state) => 
  state.hasInitialized && (state.rssData !== null || state.featuredData !== null)
);

// Get current tab data based on active tab
export const useFeedTabsCurrentTabData = () => useFeedTabsStore()((state) => {
  if (state.activeTabIndex === 0) {
    return state.rssData;
  } else if (state.activeTabIndex === 1) {
    return state.featuredData;
  }
  return null;
});

// Check if current tab is loading
export const useFeedTabsIsCurrentTabLoading = () => useFeedTabsStore()((state) => {
  if (state.activeTabIndex === 0) {
    return state.loading.isRSSLoading;
  } else if (state.activeTabIndex === 1) {
    return state.loading.isFeaturedLoading;
  }
  return false;
});

// Get current tab error
export const useFeedTabsCurrentTabError = () => useFeedTabsStore()((state) => {
  if (state.activeTabIndex === 0) {
    return state.errors.rssError;
  } else if (state.activeTabIndex === 1) {
    return state.errors.featuredError;
  }
  return null;
}); 