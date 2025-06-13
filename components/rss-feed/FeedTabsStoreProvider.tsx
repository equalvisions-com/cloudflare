"use client";

import React, { useMemo } from 'react';
import { createFeedTabsStore, FeedTabsStoreContext } from '@/lib/stores/feedTabsStore';
import type { FeedTabsStoreProviderProps } from '@/lib/types';

/**
 * Feed Tabs Store Provider Component
 * 
 * This creates a fresh store instance for each feed tabs container component,
 * preventing state pollution across client-side navigation.
 * 
 * Following the established pattern from RSSEntriesDisplayStoreProvider for per-component stores.
 * 
 * Key Benefits:
 * - Prevents state persistence across navigation
 * - Isolates state between different feed tabs instances
 * - Follows Zustand Next.js best practices
 * - Enables proper cleanup on unmount
 */
export const FeedTabsStoreProvider: React.FC<FeedTabsStoreProviderProps> = ({ 
  children 
}) => {
  // Create a unique store instance for this component tree
  // This prevents state sharing between different feed tabs instances
  const store = useMemo(() => createFeedTabsStore(), []);
  
  return (
    <FeedTabsStoreContext.Provider value={store}>
      {children}
    </FeedTabsStoreContext.Provider>
  );
}; 