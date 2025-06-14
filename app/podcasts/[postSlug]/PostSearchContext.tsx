"use client";

import React from 'react';
import { usePostSearchProvider } from '@/hooks/usePostSearchProvider';
import type { PostSearchProviderProps } from '@/lib/types';

// Re-export centralized hooks for backward compatibility
export { usePostSearch } from '@/hooks/usePostSearch';
export { useSearchResults } from '@/hooks/useSearchResults';

/**
 * PostSearchProvider - Manages search state cleanup
 * Uses Zustand store for state management instead of React Context
 * Provides cleanup logic when component unmounts
 */
export const PostSearchProvider = React.memo(function PostSearchProvider({ 
  children 
}: PostSearchProviderProps) {
  // Use custom hook for provider logic
  usePostSearchProvider();
  
  // Simply render children - state is managed by Zustand
  return <>{children}</>;
}); 