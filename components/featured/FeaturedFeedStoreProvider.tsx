'use client';

import React, { createContext, useContext, useRef } from 'react';
import { useStore } from 'zustand';
import { createFeaturedFeedStore, type FeaturedFeedStoreInstance } from '@/lib/stores/featuredFeedStore';
import type { FeaturedFeedStoreProviderProps, FeaturedFeedStore } from '@/lib/types';

// Create context for the store
const FeaturedFeedStoreContext = createContext<FeaturedFeedStoreInstance | null>(null);

// Store provider component
export function FeaturedFeedStoreProvider({ children }: FeaturedFeedStoreProviderProps) {
  const storeRef = useRef<FeaturedFeedStoreInstance>();
  
  if (!storeRef.current) {
    storeRef.current = createFeaturedFeedStore();
  }

  return (
    <FeaturedFeedStoreContext.Provider value={storeRef.current}>
      {children}
    </FeaturedFeedStoreContext.Provider>
  );
}

// Hook to use the store
export function useFeaturedFeedStore<T>(selector: (store: FeaturedFeedStore) => T): T {
  const store = useContext(FeaturedFeedStoreContext);
  
  if (!store) {
    throw new Error('useFeaturedFeedStore must be used within FeaturedFeedStoreProvider');
  }
  
  return useStore(store, selector);
}

// Convenience hooks for common store selections
export const useFeaturedFeedEntries = () => useFeaturedFeedStore((state) => state.entries);
export const useFeaturedFeedLoading = () => useFeaturedFeedStore((state) => state.loading);
export const useFeaturedFeedPagination = () => useFeaturedFeedStore((state) => state.pagination);
export const useFeaturedFeedUI = () => useFeaturedFeedStore((state) => state.ui);
export const useFeaturedFeedMemory = () => useFeaturedFeedStore((state) => state.memory);
export const useFeaturedFeedAccessibility = () => useFeaturedFeedStore((state) => state.accessibility);
export const useFeaturedFeedPerformance = () => useFeaturedFeedStore((state) => state.performance);

// Action hooks
export const useFeaturedFeedActions = () => useFeaturedFeedStore((state) => ({
  // Entry management
  setEntries: state.setEntries,
  addEntries: state.addEntries,
  prependEntries: state.prependEntries,
  updateEntryMetrics: state.updateEntryMetrics,
  
  // Pagination actions
  setCurrentPage: state.setCurrentPage,
  setHasMore: state.setHasMore,
  setTotalEntries: state.setTotalEntries,
  setVisibleEntries: state.setVisibleEntries,
  
  // Loading actions
  setLoading: state.setLoading,
  setRefreshing: state.setRefreshing,
  setHasRefreshed: state.setHasRefreshed,
  setFetchError: state.setFetchError,
  setRefreshError: state.setRefreshError,
  
  // UI actions
  setActive: state.setActive,
  openCommentDrawer: state.openCommentDrawer,
  closeCommentDrawer: state.closeCommentDrawer,
  setNotification: state.setNotification,
  
  // Memory management actions
  updateEntryCache: state.updateEntryCache,
  updateMetadataCache: state.updateMetadataCache,
  clearCache: state.clearCache,
  addAbortController: state.addAbortController,
  removeAbortController: state.removeAbortController,
  
  // Accessibility actions
  addAnnouncement: state.addAnnouncement,
  clearAnnouncements: state.clearAnnouncements,
  setFocusedEntry: state.setFocusedEntry,
  setKeyboardNavigation: state.setKeyboardNavigation,
  setScreenReaderMode: state.setScreenReaderMode,
  
  // Performance actions
  incrementRenderCount: state.incrementRenderCount,
  updateRenderTime: state.updateRenderTime,
  updateMemoryUsage: state.updateMemoryUsage,
  updateBundleSize: state.updateBundleSize,
  
  // Utility actions
  reset: state.reset,
  initialize: state.initialize
})); 