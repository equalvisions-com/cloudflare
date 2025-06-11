import { useCallback, useMemo } from 'react';
import { 
  useRSSFeedCommentDrawer, 
  useRSSFeedMetadata,
  useRSSFeedOpenCommentDrawer,
  useRSSFeedCloseCommentDrawer,
  useRSSFeedSetInitialRender
} from '@/lib/stores/rssFeedStore';
import type { UseRSSFeedUIReturn } from '@/lib/types';

/**
 * Custom hook for RSS Feed UI logic
 * Handles comment drawer management and provides utility functions
 * Extracted from RSSFeedClient to separate concerns
 * 
 * NOTE: Auto-loading is handled by useDelayedIntersectionObserver in FeedContent
 * to prevent "Maximum update depth exceeded" errors
 */
export const useRSSFeedUI = (): UseRSSFeedUIReturn => {
  // Get state and actions from Zustand store
  const commentDrawer = useRSSFeedCommentDrawer();
  const feedMetadata = useRSSFeedMetadata();
  
  // Get individual actions from store (prevents object recreation)
  const openCommentDrawer = useRSSFeedOpenCommentDrawer();
  const closeCommentDrawer = useRSSFeedCloseCommentDrawer();
  const setInitialRender = useRSSFeedSetInitialRender();
  
  // Comment drawer handlers with proper memoization
  const handleCommentDrawer = useMemo(() => ({
    open: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
      openCommentDrawer(entryGuid, feedUrl, initialData);
    },
    close: () => {
      closeCommentDrawer();
    },
    isOpen: commentDrawer.isOpen,
    selectedEntry: commentDrawer.selectedEntry
  }), [
    openCommentDrawer,
    closeCommentDrawer,
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