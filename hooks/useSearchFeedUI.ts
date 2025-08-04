import { useMemo } from 'react';
import type { 
  PostSearchRSSData,
  SearchRenderState, 
  SearchEmptyStateProps,
  UseSearchFeedUIReturn 
} from '@/lib/types';

/**
 * Custom hook for SearchRSSFeedClient UI logic
 * Determines render state and prepares empty state props
 * Optimized with proper memoization for production performance
 */
export const useSearchFeedUI = (
  searchData: PostSearchRSSData | null, 
  searchQuery: string
): UseSearchFeedUIReturn => {
  // Determine render state with memoization
  const renderState = useMemo((): SearchRenderState => {
    if (!searchData) return 'loading';
    if (!searchData.entries || searchData.entries.length === 0) return 'empty';
    return 'results';
  }, [searchData]);
  
  // Memoized empty state props for performance
  const emptyStateProps = useMemo((): SearchEmptyStateProps => {
    const hasQuery = searchQuery && searchQuery.trim().length > 0;
    
    if (hasQuery) {
      return {
        message: `No results found for "${searchQuery}"`,
        suggestion: "Try different keywords or check your spelling."
      };
    }
    
    return {
      message: "No content available",
      suggestion: "This feed appears to be empty."
    };
  }, [searchQuery]);
  
  return {
    renderState,
    emptyStateProps
  };
}; 