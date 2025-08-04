import { useCallback, useMemo } from 'react';
import type { UseRSSFeedUIReturn } from '@/lib/types';

// Define types for the hook parameters
interface RSSFeedState {
  commentDrawer: {
    isOpen: boolean;
    selectedEntry: {
      entryGuid: string;
      feedUrl: string;
      initialData?: { count: number };
    } | null;
  };
  feedMetadata: {
    postTitle: string;
    feedUrl: string;
    featuredImg?: string;
    mediaType?: string;
    verified: boolean;
    pageSize: number;
  };
}

type RSSFeedAction =
  | { type: 'OPEN_COMMENT_DRAWER'; payload: { entryGuid: string; feedUrl: string; initialData?: { count: number } } }
  | { type: 'CLOSE_COMMENT_DRAWER' }
  | { type: 'SET_INITIAL_RENDER'; payload: boolean };

/**
 * Custom hook for RSS Feed UI logic
 * Handles comment drawer management and provides utility functions
 * Updated to work with useReducer instead of Zustand
 * 
 * NOTE: Auto-loading is handled by useDelayedIntersectionObserver in FeedContent
 * to prevent "Maximum update depth exceeded" errors
 */
export const useRSSFeedUI = (
  state: RSSFeedState,
  dispatch: React.Dispatch<RSSFeedAction>
): UseRSSFeedUIReturn => {
  // Extract state values for easier access
  const { commentDrawer, feedMetadata } = state;
  
  // Comment drawer handlers with proper memoization
  const handleCommentDrawer = useMemo(() => ({
    open: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
      dispatch({ type: 'OPEN_COMMENT_DRAWER', payload: { entryGuid, feedUrl, initialData } });
    },
    close: () => {
      dispatch({ type: 'CLOSE_COMMENT_DRAWER' });
    },
    isOpen: commentDrawer.isOpen,
    selectedEntry: commentDrawer.selectedEntry
  }), [
    dispatch,
    commentDrawer.isOpen,
    commentDrawer.selectedEntry
  ]);
  
  // Utility function for manual height checking (if needed)
  const checkContentHeight = useCallback(() => {
    // This is now primarily for manual checks, not automatic loading
    // Automatic loading is handled by intersection observer in FeedContent
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    return {
      viewportHeight,
      documentHeight,
      needsMoreContent: documentHeight <= viewportHeight
    };
  }, []);
  
  // Return stable object to prevent unnecessary re-renders
  return useMemo(() => ({
    checkContentHeight,
    handleCommentDrawer
  }), [checkContentHeight, handleCommentDrawer]);
}; 