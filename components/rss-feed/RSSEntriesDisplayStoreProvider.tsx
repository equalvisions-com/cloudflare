'use client';

import React, { useMemo } from 'react';
import { 
  createRSSEntriesDisplayStore, 
  RSSEntriesDisplayStoreContext 
} from '@/lib/stores/rssEntriesDisplayStore';

interface RSSEntriesDisplayStoreProviderProps {
  children: React.ReactNode;
}

/**
 * RSS Entries Display Store Provider Component
 * 
 * This creates a fresh store instance for each RSS entries display component,
 * preventing state pollution across client-side navigation.
 * 
 * Following the established pattern from RSSFeedClient for per-component stores.
 */
export const RSSEntriesDisplayStoreProvider: React.FC<RSSEntriesDisplayStoreProviderProps> = ({ 
  children 
}) => {
  // Create a unique store instance for this component tree
  // This prevents state sharing between different RSS entries display instances
  const store = useMemo(() => createRSSEntriesDisplayStore(), []);
  
  return (
    <RSSEntriesDisplayStoreContext.Provider value={store}>
      {children}
    </RSSEntriesDisplayStoreContext.Provider>
  );
}; 