import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFeedTabsMemoryManagement } from './useFeedTabsMemoryManagement';
import {
  useFeedTabsSetRSSData,
  useFeedTabsSetFeaturedData,
  useFeedTabsSetRSSLoading,
  useFeedTabsSetFeaturedLoading,
  useFeedTabsSetRSSError,
  useFeedTabsSetFeaturedError,
  useFeedTabsSetRSSFetchInProgress,
  useFeedTabsSetFeaturedFetchInProgress,
  useFeedTabsRSSData,
  useFeedTabsFeaturedData,
  useFeedTabsIsRSSLoading,
  useFeedTabsIsFeaturedLoading,
  useFeedTabsRSSFetchInProgress,
  useFeedTabsFeaturedFetchInProgress
} from '@/lib/stores/feedTabsStore';
import type { 
  UseFeedTabsDataFetchingProps, 
  UseFeedTabsDataFetchingReturn,
  FeedTabsRSSData,
  FeedTabsFeaturedData
} from '@/lib/types';

/**
 * Custom hook for managing data fetching logic in FeedTabsContainer
 * 
 * Extracts all data fetching business logic from the component following
 * the established production patterns:
 * - Centralized state management via Zustand
 * - Proper error handling and loading states
 * - Request deduplication and abort handling
 * - Authentication-aware fetching
 * 
 * @param props - Hook configuration props
 * @returns Data fetching functions and utilities
 */
export const useFeedTabsDataFetching = ({
  isAuthenticated,
  router
}: UseFeedTabsDataFetchingProps): UseFeedTabsDataFetchingReturn => {
  // Memory management for Edge Runtime optimization
  const { 
    createManagedAbortController, 
    deduplicateRequest, 
    optimizeDataForEdge,
    cleanup: memoryCleanup
  } = useFeedTabsMemoryManagement();

  // Zustand store selectors
  const rssData = useFeedTabsRSSData();
  const featuredData = useFeedTabsFeaturedData();
  const isRSSLoading = useFeedTabsIsRSSLoading();
  const isFeaturedLoading = useFeedTabsIsFeaturedLoading();
  const rssFetchInProgress = useFeedTabsRSSFetchInProgress();
  const featuredFetchInProgress = useFeedTabsFeaturedFetchInProgress();

  // Zustand store actions
  const setRSSData = useFeedTabsSetRSSData();
  const setFeaturedData = useFeedTabsSetFeaturedData();
  const setRSSLoading = useFeedTabsSetRSSLoading();
  const setFeaturedLoading = useFeedTabsSetFeaturedLoading();
  const setRSSError = useFeedTabsSetRSSError();
  const setFeaturedError = useFeedTabsSetFeaturedError();
  const setRSSFetchInProgress = useFeedTabsSetRSSFetchInProgress();
  const setFeaturedFetchInProgress = useFeedTabsSetFeaturedFetchInProgress();

  // Refs for request management
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetches featured data with proper error handling and deduplication
   */
  const fetchFeaturedData = useCallback(async (): Promise<void> => {
    // Skip if data is already loaded, loading is in progress, or a fetch has been initiated
    if (featuredData !== null || isFeaturedLoading || featuredFetchInProgress) {
      return;
    }

    // Set fetch in progress to prevent duplicate requests
    setFeaturedFetchInProgress(true);
    setFeaturedLoading(true);
    setFeaturedError(null);

    try {

      
      const response = await fetch('/api/featured-feed-data');
      
      if (!response.ok) {
        // Try to get a more specific error message from the response
        let errorText = 'Failed to fetch featured data';
        try {
          const errorData = await response.json();
          if (errorData?.error) {
            errorText = errorData.error;
          }
        } catch {
          // If parsing JSON fails, use status-based error message
          errorText = `Failed to fetch featured data (status: ${response.status})`;
        }
        throw new Error(errorText);
      }

      const data: FeedTabsFeaturedData = await response.json();
      setFeaturedData(data);
      
      
    } catch (error: any) {
      
      setFeaturedError(error.message || 'Failed to load featured content. Please try again.');
    } finally {
      setFeaturedLoading(false);
      setFeaturedFetchInProgress(false);
    }
  }, [
    featuredData,
    isFeaturedLoading,
    featuredFetchInProgress,
    setFeaturedData,
    setFeaturedLoading,
    setFeaturedError,
    setFeaturedFetchInProgress
  ]);

  /**
   * Fetches RSS data with authentication checks and proper error handling
   */
  const fetchRSSData = useCallback(async (): Promise<void> => {
    // Skip if data is already loaded, loading is in progress, or a fetch has been initiated
    if (rssData !== null || isRSSLoading || rssFetchInProgress) {
      return;
    }

    // Check authentication before fetching RSS data
    if (!isAuthenticated) {
      router.push('/signin');
      return;
    }

    // Use request deduplication and managed abort controller for Edge Runtime optimization
    return deduplicateRequest('rss-data', async () => {
      // Create a managed AbortController for this request
      const controller = createManagedAbortController();
      const signal = controller.signal;

      // Set fetch in progress to prevent duplicate requests
      setRSSFetchInProgress(true);
      setRSSLoading(true);
      setRSSError(null);

      try {
        const response = await fetch('/api/rss-feed', { signal });
        
        if (!response.ok) {
          throw new Error('Failed to fetch RSS feed data');
        }

        const rawData: FeedTabsRSSData = await response.json();
        
        // Ensure feedUrls and mediaTypes are properly set
        const processedData: FeedTabsRSSData = {
          ...rawData,
          // If server feedUrls exist, use those directly instead of extracting from entries
          feedUrls: rawData.feedUrls || 
                    [...new Set(rawData.entries?.map(entry => entry.entry.feedUrl) || [])],
          // Always prioritize server-provided mediaTypes and avoid defaulting to 'article'
          mediaTypes: rawData.mediaTypes || 
                     [...new Set(rawData.entries?.map(entry => entry.postMetadata?.mediaType).filter((type): type is string => Boolean(type)) || [])]
        };
        
        // Optimize data for Edge Runtime memory constraints
        const optimizedData = optimizeDataForEdge(processedData, 100); // Limit to 100 RSS entries
        
        setRSSData(optimizedData);
      } catch (error: any) {
        // Don't set error if it was aborted (user signed out)
        if (error.name !== 'AbortError') {
  
          setRSSError('Failed to load RSS feed data. Please try again.');
        }
        throw error; // Re-throw for deduplication cleanup
      } finally {
        if (!signal.aborted) {
          setRSSLoading(false);
          setRSSFetchInProgress(false);
        }
      }
    });
  }, [
    rssData,
    isRSSLoading,
    rssFetchInProgress,
    isAuthenticated,
    router,
    setRSSData,
    setRSSLoading,
    setRSSError,
    setRSSFetchInProgress,
    deduplicateRequest,
    createManagedAbortController,
    optimizeDataForEdge
  ]);

  /**
   * Cleanup function to abort any in-progress requests and clean up memory
   */
  const cleanup = useCallback(() => {
    // Legacy cleanup for any remaining abortController
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Use memory management cleanup for comprehensive cleanup
    memoryCleanup();
  }, [memoryCleanup]);

  return {
    fetchRSSData,
    fetchFeaturedData,
    cleanup
  };
}; 