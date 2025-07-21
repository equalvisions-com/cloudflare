import { useCallback, useRef, useEffect } from 'react';
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
 * - Authentication-aware fetching with bfcache support
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

  // bfcache detection and auth rehydration tracking
  const isBfCacheRestorationRef = useRef(false);
  const authHintsRef = useRef<{ isAuthenticated?: boolean }>({});

  // Read auth hints on mount to detect bfcache scenarios
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuthenticatedHint = document.documentElement.getAttribute('data-user-authenticated') === '1';
      authHintsRef.current = { isAuthenticated: isAuthenticatedHint };
    }
  }, []);

  // Detect bfcache restoration
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page restored from bfcache
        isBfCacheRestorationRef.current = true;
        
        // Reset after a brief period
        setTimeout(() => {
          isBfCacheRestorationRef.current = false;
        }, 2000);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  /**
   * Enhanced auth check that handles bfcache scenarios
   */
  const checkAuthWithBfCacheSupport = useCallback(async (): Promise<boolean> => {
    // If we have clear authentication, proceed
    if (isAuthenticated) {
      return true;
    }

    // Check if this might be a bfcache scenario where auth hasn't rehydrated yet
    const authHints = authHintsRef.current;
    const isBfCacheScenario = isBfCacheRestorationRef.current || 
      (authHints.isAuthenticated && !isAuthenticated);

    if (isBfCacheScenario) {
      // Wait for potential auth rehydration
      let retries = 0;
      const maxRetries = 5; // Max 500ms wait
      
      while (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
        
        // Check if auth rehydrated during wait
        if (isAuthenticated) {
          return true;
        }
      }
      
      // If auth hints said authenticated but Convex auth never rehydrated,
      // trust the hints for bfcache scenarios
      if (authHints.isAuthenticated) {
        return true;
      }
    }

    // No authentication available
    return false;
  }, [isAuthenticated]);

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
   * Fetches RSS data with enhanced authentication checks and bfcache support
   */
  const fetchRSSData = useCallback(async (): Promise<void> => {
    // Skip if fetch is already in progress
    if (fetchInProgressRef.current.rss) {
      return;
    }

    // Enhanced auth check with bfcache support
    const isAuthAllowed = await checkAuthWithBfCacheSupport();
    if (!isAuthAllowed) {
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
    checkAuthWithBfCacheSupport,
    router,
    onRSSDataFetched,
    onRSSLoadingChange,
    onRSSError,
    deduplicateRequest,
    createManagedAbortController,
    optimizeDataForEdge
  ]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset fetch states
    fetchInProgressRef.current = { rss: false, featured: false };
    
    // Call memory cleanup
    memoryCleanup();
  }, [memoryCleanup]);

  return {
    fetchRSSData,
    fetchFeaturedData,
    cleanup
  };
}; 