"use client";

import React from 'react';
import { PostSearchProvider as BasePostSearchProvider } from '@/lib/contexts/PostSearchContext';
import { SearchResultsProvider } from '@/lib/contexts/SearchResultsContext';
import type { PostSearchProviderProps } from '@/lib/types';

// Re-export centralized hooks for backward compatibility
export { usePostSearch } from '@/hooks/usePostSearch';
export { useSearchResults } from '@/hooks/useSearchResults';

/**
 * PostSearchProvider - Provides search state management using React Context
 * Migrated from Zustand to React Context + useReducer for better React/Next.js practices
 * Combines both PostSearch and SearchResults contexts for newsletter pages
 */
export const PostSearchProvider = React.memo(function PostSearchProvider({ 
  children 
}: PostSearchProviderProps) {
  return (
    <BasePostSearchProvider>
      <SearchResultsProvider>
        {children}
      </SearchResultsProvider>
    </BasePostSearchProvider>
  );
}); 