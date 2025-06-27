'use client';

import React, { useMemo } from 'react';
import { 
  createRSSEntriesDisplayStore, 
  RSSEntriesDisplayStoreContext 
} from '@/lib/stores/rssEntriesDisplayStore';

interface RSSEntriesDisplayStoreProviderProps {
  children: React.ReactNode;
  storeKey?: string; // Optional key for persistent stores
}

// Global store registry to keep stores alive between tab switches
const storeRegistry = new Map<string, ReturnType<typeof createRSSEntriesDisplayStore>>();

/**
 * RSS Entries Display Store Provider Component
 * 
 * This creates a fresh store instance for each RSS entries display component,
 * preventing state pollution across client-side navigation.
 * 
 * If a storeKey is provided, the store will be persistent and reused when
 * the same key is used again (useful for tab switching).
 * 
 * Following the established pattern from RSSFeedClient for per-component stores.
 */
export const RSSEntriesDisplayStoreProvider: React.FC<RSSEntriesDisplayStoreProviderProps> = ({ 
  children,
  storeKey
}) => {
  // Create a unique store instance for this component tree
  // If storeKey is provided, reuse existing store or create new one
  const store = useMemo(() => {
    if (storeKey) {
      // Check if we already have a store for this key
      if (storeRegistry.has(storeKey)) {
        return storeRegistry.get(storeKey)!;
      }
      
      // Create new store and register it
      const newStore = createRSSEntriesDisplayStore();
      storeRegistry.set(storeKey, newStore);
      return newStore;
    }
    
    // No key provided, create a fresh store (original behavior)
    return createRSSEntriesDisplayStore();
  }, [storeKey]);
  
  return (
    <RSSEntriesDisplayStoreContext.Provider value={store}>
      {children}
    </RSSEntriesDisplayStoreContext.Provider>
  );
}; 