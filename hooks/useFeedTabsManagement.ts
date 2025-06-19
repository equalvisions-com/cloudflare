import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  useFeedTabsActiveTabIndex,
  useFeedTabsSetActiveTabIndex,
  useFeedTabsRSSData,
  useFeedTabsFeaturedData,
  useFeedTabsIsRSSLoading,
  useFeedTabsIsFeaturedLoading,
  useFeedTabsRSSFetchInProgress,
  useFeedTabsFeaturedFetchInProgress,
  useFeedTabsSetRSSData,
  useFeedTabsReset
} from '@/lib/stores/feedTabsStore';
import type { 
  UseFeedTabsManagementProps, 
  UseFeedTabsManagementReturn
} from '@/lib/types';

/**
 * Custom hook for managing tab switching and authentication logic in FeedTabsContainer
 * 
 * Extracts all tab management business logic from the component following
 * the established production patterns:
 * - Authentication-aware tab switching
 * - Proper cleanup on sign-out
 * - Data fetching coordination with active tab
 * - Request abortion on authentication changes
 * 
 * @param props - Hook configuration props
 * @returns Tab management functions and utilities
 */
export const useFeedTabsManagement = ({
  isAuthenticated,
  router
}: UseFeedTabsManagementProps): UseFeedTabsManagementReturn => {
  // Zustand store selectors
  const activeTabIndex = useFeedTabsActiveTabIndex();
  const rssData = useFeedTabsRSSData();
  const featuredData = useFeedTabsFeaturedData();
  const isRSSLoading = useFeedTabsIsRSSLoading();
  const isFeaturedLoading = useFeedTabsIsFeaturedLoading();
  const rssFetchInProgress = useFeedTabsRSSFetchInProgress();
  const featuredFetchInProgress = useFeedTabsFeaturedFetchInProgress();

  // Zustand store actions
  const setActiveTabIndex = useFeedTabsSetActiveTabIndex();
  const setRSSData = useFeedTabsSetRSSData();
  const reset = useFeedTabsReset();

  // Track previous authentication state to detect changes
  const prevAuthRef = useRef(isAuthenticated);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Handle tab change with authentication checks
   */
  const handleTabChange = useCallback((index: number) => {
    // If switching to the "Following" tab (index 1), check authentication
    if (index === 1 && !isAuthenticated) {
      router.push('/signin');
      return;
    }
    
    // Only update active tab index if not redirecting
    setActiveTabIndex(index);
  }, [isAuthenticated, router, setActiveTabIndex]);

  /**
   * Reset to Discover tab when user signs out
   */
  useEffect(() => {
    // Check if authentication status changed from authenticated to unauthenticated
    if (prevAuthRef.current && !isAuthenticated) {
  
      
      // Reset to Discover tab
      setActiveTabIndex(0);
      
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear RSS data to prevent further requests
      setRSSData(null);
    }
    
    // Update the previous auth state
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, setActiveTabIndex, setRSSData]);

  /**
   * Data fetching coordination effect
   * This will be used by the component to trigger data fetching based on active tab
   */
  const shouldFetchFeaturedData = useCallback(() => {
    return activeTabIndex === 0 && 
           featuredData === null && 
           !isFeaturedLoading && 
           !featuredFetchInProgress;
  }, [activeTabIndex, featuredData, isFeaturedLoading, featuredFetchInProgress]);

  const shouldFetchRSSData = useCallback(() => {
    return activeTabIndex === 1 && 
           isAuthenticated && 
           rssData === null && 
           !isRSSLoading && 
           !rssFetchInProgress;
  }, [activeTabIndex, isAuthenticated, rssData, isRSSLoading, rssFetchInProgress]);

  /**
   * Check if user should be redirected to sign-in for RSS tab
   */
  const shouldRedirectToSignIn = useCallback(() => {
    return activeTabIndex === 1 && !isAuthenticated;
  }, [activeTabIndex, isAuthenticated]);

  return {
    handleTabChange,
    shouldFetchFeaturedData,
    shouldFetchRSSData,
    shouldRedirectToSignIn
  };
}; 