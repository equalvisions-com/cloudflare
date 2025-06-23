import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFeedTabsMemoryManagement } from './useFeedTabsMemoryManagement';
import type { 
  UseFeedTabsDataFetchingProps, 
  UseFeedTabsDataFetchingReturn,
  FeedTabsRSSData,
  FeedTabsFeaturedData
} from '@/lib/types';

/**
 * Custom hook for managing data fetching logic in FeedTabsContainer
 * 
 * Uses callback props for state management:
 * - Accepts callback functions for state updates
 * - Preserves all data fetching business logic
 * - Maintains proper error handling and loading states
 * - Keeps request deduplication and abort handling
 * - Authentication-aware fetching
 * 
 * @param props - Hook configuration props with callbacks
 * @returns Data fetching functions and utilities
 */
export const useFeedTabsDataFetching = ({
  isAuthenticated,
  router,
  onRSSDataFetched,
  onFeaturedDataFetched,
  onRSSLoadingChange,
  onFeaturedLoadingChange,
  onRSSError,
  onFeaturedError
}: UseFeedTabsDataFetchingProps): UseFeedTabsDataFetchingReturn => {
  // Memory management for Edge Runtime optimization
  const { 
    createManagedAbortController, 
    deduplicateRequest, 
    optimizeDataForEdge,
    cleanup: memoryCleanup
  } = useFeedTabsMemoryManagement();

  // Refs for request management and state tracking
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchInProgressRef = useRef({
    rss: false,
    featured: false
  });
  
  // Circuit breaker to prevent infinite retry loops
  const errorCountRef = useRef({ rss: 0, featured: 0 });
  const lastErrorTimeRef = useRef({ rss: 0, featured: 0 });
  const MAX_ERROR_COUNT = 3;
  const ERROR_RESET_TIME = 60000; // 1 minute

  /**
   * Fetches featured data with proper error handling and deduplication
   */
  const fetchFeaturedData = useCallback(async (): Promise<void> => {
    // Skip if fetch is already in progress
    if (fetchInProgressRef.current.featured) {
      return;
    }
    
    // Circuit breaker: Check if too many recent errors
    const now = Date.now();
    if (errorCountRef.current.featured >= MAX_ERROR_COUNT) {
      if (now - lastErrorTimeRef.current.featured < ERROR_RESET_TIME) {
        console.warn('Circuit breaker: Too many featured data fetch errors, skipping request');
        onFeaturedError('Service temporarily unavailable. Please try again later.');
        return;
      } else {
        // Reset error count after timeout
        errorCountRef.current.featured = 0;
      }
    }

    // Use request deduplication and managed abort controller for Edge Runtime optimization
    return deduplicateRequest('featured-data', async () => {
      // Create a managed AbortController for this request
      const controller = createManagedAbortController();
      const signal = controller.signal;

      // Set fetch in progress to prevent duplicate requests
      fetchInProgressRef.current.featured = true;
      onFeaturedLoadingChange(true);
      onFeaturedError(null);

      try {
        const response = await fetch('/api/featured-feed-data', { signal });
        
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
        
        // Optimize data for Edge Runtime memory constraints
        const optimizedData = optimizeDataForEdge(data, 100); // Limit entries if needed
        
        onFeaturedDataFetched(optimizedData);
        
      } catch (error: any) {
        // Don't set error if it was aborted
        if (error.name !== 'AbortError') {
          // Increment error count for circuit breaker
          errorCountRef.current.featured++;
          lastErrorTimeRef.current.featured = Date.now();
          
          onFeaturedError(error.message || 'Failed to load featured content. Please try again.');
        }
        throw error; // Re-throw for deduplication cleanup
      } finally {
        if (!signal.aborted) {
          onFeaturedLoadingChange(false);
          fetchInProgressRef.current.featured = false;
        }
      }
    });
  }, [
    onFeaturedDataFetched,
    onFeaturedLoadingChange,
    onFeaturedError,
    deduplicateRequest,
    createManagedAbortController,
    optimizeDataForEdge
  ]);

  /**
   * Fetches RSS data with authentication checks and proper error handling
   */
  const fetchRSSData = useCallback(async (): Promise<void> => {
    // Skip if fetch is already in progress
    if (fetchInProgressRef.current.rss) {
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
      fetchInProgressRef.current.rss = true;
      onRSSLoadingChange(true);
      onRSSError(null);

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
        
        onRSSDataFetched(optimizedData);
      } catch (error: any) {
        // Don't set error if it was aborted (user signed out)
        if (error.name !== 'AbortError') {
          onRSSError('Failed to load RSS feed data. Please try again.');
        }
        throw error; // Re-throw for deduplication cleanup
      } finally {
        if (!signal.aborted) {
          onRSSLoadingChange(false);
          fetchInProgressRef.current.rss = false;
        }
      }
    });
  }, [
    isAuthenticated,
    router,
    onRSSDataFetched,
    onRSSLoadingChange,
    onRSSError,
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
    
    // Reset fetch progress flags
    fetchInProgressRef.current = {
      rss: false,
      featured: false
    };
    
    // Use memory management cleanup for comprehensive cleanup
    memoryCleanup();
  }, [memoryCleanup]);

  return {
    fetchRSSData,
    fetchFeaturedData,
    cleanup
  };
}; 