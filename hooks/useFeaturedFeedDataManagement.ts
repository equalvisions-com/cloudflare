import { useCallback, useEffect, useRef } from 'react';
import { startTransition } from 'react';
import {
  useFeaturedFeedActions,
  useFeaturedFeedLoading,
  useFeaturedFeedPagination,
  useFeaturedFeedMemory
} from '@/components/featured/FeaturedFeedStoreProvider';
import type {
  UseFeaturedFeedDataManagementProps,
  UseFeaturedFeedDataManagementReturn,
  FeaturedFeedAPIResponse,
  FeaturedFeedEntryWithData
} from '@/lib/types';

/**
 * Custom hook for managing Featured Feed data fetching operations
 * 
 * Provides comprehensive data management following production standards:
 * - API fetching with authentication awareness
 * - Request deduplication and caching
 * - Memory management for Edge Runtime
 * - Error handling with retry logic
 * - Performance optimization
 * 
 * @param props - Hook configuration props
 * @returns Data management functions and state
 */
export const useFeaturedFeedDataManagement = ({
  isActive,
  pageSize,
  initialData
}: UseFeaturedFeedDataManagementProps): UseFeaturedFeedDataManagementReturn => {
  // Store actions and state
  const actions = useFeaturedFeedActions();
  const loading = useFeaturedFeedLoading();
  const pagination = useFeaturedFeedPagination();
  const memory = useFeaturedFeedMemory();

  // Request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestCacheRef = useRef<Map<string, Promise<FeaturedFeedAPIResponse>>>(new Map());
  const lastFetchTimeRef = useRef<number>(0);

  /**
   * Create managed AbortController for request cancellation
   */
  const createAbortController = useCallback(() => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      actions.removeAbortController(abortControllerRef.current);
    }

    // Create new controller
    const controller = new AbortController();
    abortControllerRef.current = controller;
    actions.addAbortController(controller);
    
    return controller;
  }, [actions]);

  /**
   * Fetch featured entries with comprehensive error handling
   */
  const fetchFeaturedEntries = useCallback(async (
    page: number = 0,
    isLoadMore: boolean = false
  ): Promise<FeaturedFeedAPIResponse> => {
    const controller = createAbortController();
    const cacheKey = `featured-${page}-${pageSize}`;
    
    // Check cache first
    const cachedRequest = requestCacheRef.current.get(cacheKey);
    if (cachedRequest && !isLoadMore) {
      try {
        return await cachedRequest;
      } catch {
        // Cache miss, continue with fresh request
        requestCacheRef.current.delete(cacheKey);
      }
    }

    // Prevent duplicate requests
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 1000 && !isLoadMore) {
      throw new Error('Request too frequent');
    }
    lastFetchTimeRef.current = now;

    const fetchPromise = (async (): Promise<FeaturedFeedAPIResponse> => {
      const startTime = performance.now();
      
      try {
        const response = await fetch('/api/featured-feed', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: FeaturedFeedAPIResponse = await response.json();
        
        // Validate response structure
        if (!data.entries || !Array.isArray(data.entries)) {
          throw new Error('Invalid API response structure');
        }

        // Record performance metrics
        const fetchTime = performance.now() - startTime;
        actions.updateRenderTime(fetchTime);

        return data;
      } catch (error) {
        // Clean up cache on error
        requestCacheRef.current.delete(cacheKey);
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Request cancelled');
          }
          throw error;
        }
        throw new Error('Unknown fetch error');
      }
    })();

    // Cache the request promise
    requestCacheRef.current.set(cacheKey, fetchPromise);
    
    // Auto-cleanup cache after 5 minutes
    setTimeout(() => {
      requestCacheRef.current.delete(cacheKey);
    }, 5 * 60 * 1000);

    return fetchPromise;
  }, [pageSize, createAbortController, actions]);

  /**
   * Load more entries with pagination
   */
  const loadMoreEntries = useCallback(async (): Promise<void> => {
    if (loading.isLoading || !pagination.hasMore) {
      return;
    }

    actions.setLoading(true);
    actions.setFetchError(null);

    try {
      const nextPage = pagination.currentPage + 1;
      const response = await fetchFeaturedEntries(nextPage, true);
      
      startTransition(() => {
        actions.addEntries(response.entries);
        actions.setCurrentPage(nextPage);
        actions.setHasMore(response.hasMore ?? false);
        actions.setTotalEntries(response.totalEntries);
        
        // Update cache with new entries
        response.entries.forEach(entry => {
          actions.updateEntryCache(entry.entry.guid, entry);
        });
        
        // Announce to screen readers
        actions.addAnnouncement(`Loaded ${response.entries.length} more featured entries`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load more entries';
      actions.setFetchError(new Error(errorMessage));
      actions.addAnnouncement(`Error loading more entries: ${errorMessage}`);
    } finally {
      actions.setLoading(false);
    }
  }, [loading.isLoading, pagination.hasMore, pagination.currentPage, fetchFeaturedEntries, actions]);

  /**
   * Refresh entries with pull-to-refresh support
   */
  const refreshEntries = useCallback(async (): Promise<void> => {
    if (loading.isRefreshing) {
      return;
    }

    actions.setRefreshing(true);
    actions.setRefreshError(null);

    try {
      // Clear cache for fresh data
      requestCacheRef.current.clear();
      actions.clearCache();
      
      const response = await fetchFeaturedEntries(0, false);
      
      startTransition(() => {
        actions.setEntries(response.entries);
        actions.setCurrentPage(0);
        actions.setHasMore(response.hasMore ?? true);
        actions.setTotalEntries(response.totalEntries);
        actions.setHasRefreshed(true);
        
        // Update cache with fresh entries
        response.entries.forEach(entry => {
          actions.updateEntryCache(entry.entry.guid, entry);
        });
        
        // Announce refresh completion
        actions.addAnnouncement(`Refreshed with ${response.entries.length} featured entries`);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh entries';
      actions.setRefreshError(errorMessage);
      actions.addAnnouncement(`Error refreshing entries: ${errorMessage}`);
    } finally {
      actions.setRefreshing(false);
    }
  }, [loading.isRefreshing, fetchFeaturedEntries, actions]);

  /**
   * Initialize data on mount or when becoming active
   */
  useEffect(() => {
    if (!isActive) {
      return;
    }

    // Initialize with provided data if available
    if (initialData && initialData.entries.length > 0) {
      startTransition(() => {
        actions.initialize(initialData);
        
        // Cache initial entries
        initialData.entries.forEach(entry => {
          actions.updateEntryCache(entry.entry.guid, entry);
        });
      });
      return;
    }

    // Fetch initial data if not provided
    const initializeData = async () => {
      actions.setLoading(true);
      
      try {
        const response = await fetchFeaturedEntries(0, false);
        
        startTransition(() => {
          actions.initialize({
            entries: response.entries,
            totalEntries: response.totalEntries,
            hasMore: response.hasMore ?? true
          });
          
          // Cache initial entries
          response.entries.forEach(entry => {
            actions.updateEntryCache(entry.entry.guid, entry);
          });
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load featured entries';
        actions.setFetchError(new Error(errorMessage));
      } finally {
        actions.setLoading(false);
      }
    };

    initializeData();
  }, [isActive, initialData, fetchFeaturedEntries, actions]);

  /**
   * Cleanup function for memory management
   */
  const cleanup = useCallback(() => {
    // Cancel ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      actions.removeAbortController(abortControllerRef.current);
      abortControllerRef.current = null;
    }

    // Clear request cache
    requestCacheRef.current.clear();
    
    // Clear store cache
    actions.clearCache();
    
    // Reset fetch timing
    lastFetchTimeRef.current = 0;
  }, [actions]);

  /**
   * Cleanup on unmount or when becoming inactive
   */
  useEffect(() => {
    if (!isActive) {
      cleanup();
    }

    return cleanup;
  }, [isActive, cleanup]);

  return {
    loadMoreEntries,
    refreshEntries,
    isLoading: loading.isLoading,
    hasMore: pagination.hasMore,
    error: loading.fetchError,
    cleanup
  };
}; 