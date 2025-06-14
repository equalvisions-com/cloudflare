'use client';

import React, { useMemo } from 'react';
import { 
  createFeaturedFeedStore, 
  FeaturedFeedStoreContext 
} from '@/lib/stores/featuredFeedStore';

interface FeaturedFeedStoreProviderProps {
  children: React.ReactNode;
}

/**
 * Featured Feed Store Provider Component
 * 
 * This creates a fresh store instance for each featured feed component,
 * preventing state pollution across client-side navigation.
 * 
 * Following the established pattern from RSSEntriesDisplayStoreProvider.
 */
export const FeaturedFeedStoreProvider: React.FC<FeaturedFeedStoreProviderProps> = ({ 
  children 
}) => {
  // Create a unique store instance for this component tree
  // This prevents state sharing between different featured feed instances
  const store = useMemo(() => createFeaturedFeedStore(), []);
  
  return (
    <FeaturedFeedStoreContext.Provider value={store}>
      {children}
    </FeaturedFeedStoreContext.Provider>
  );
}; 