'use client';

import React, { useMemo } from 'react';
import { 
  createFeaturedFeedStore, 
  FeaturedFeedStoreContext 
} from '@/lib/stores/featuredFeedStore';

// Global store registry to keep stores alive between tab switches
const storeRegistry = new Map<string, ReturnType<typeof createFeaturedFeedStore>>();

interface FeaturedFeedStoreProviderProps {
  children: React.ReactNode;
  storeKey?: string;
}

/**
 * Featured Feed Store Provider Component
 * 
 * This creates a fresh store instance for each featured feed component,
 * preventing state pollution across client-side navigation.
 * 
 * If a storeKey is provided, the store will be persistent and reused when
 * the same key is used again (useful for tab switching).
 * 
 * Following the established pattern from RSSEntriesDisplayStoreProvider.
 */
export const FeaturedFeedStoreProvider: React.FC<FeaturedFeedStoreProviderProps> = ({ 
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
      const newStore = createFeaturedFeedStore();
      storeRegistry.set(storeKey, newStore);
      return newStore;
    }
    
    // No key provided, create a fresh store (original behavior)
    return createFeaturedFeedStore();
  }, [storeKey]);
  
  return (
    <FeaturedFeedStoreContext.Provider value={store}>
      {children}
    </FeaturedFeedStoreContext.Provider>
  );
}; 