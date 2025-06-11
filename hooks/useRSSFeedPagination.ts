import { useCallback, useMemo, useRef } from 'react';
import { 
  useRSSFeedStore, 
  useRSSFeedPagination as useRSSFeedPaginationState, 
  useRSSFeedLoading, 
  useRSSFeedMetadata,
  useRSSFeedAddEntries,
  useRSSFeedSetCurrentPage,
  useRSSFeedSetHasMore,
  useRSSFeedSetLoading,
  useRSSFeedSetFetchError
} from '@/lib/stores/rssFeedStore';
import type { UseRSSFeedPaginationReturn, RSSFeedEntry, RSSFeedAPIResponse } from '@/lib/types';

/**
 * Custom hook for RSS Feed pagination logic
 * Handles API calls, data transformation, and pagination state
 * Extracted from RSSFeedClient to separate concerns and eliminate useState
 */
export const useRSSFeedPaginationHook = (
  customLoadMore?: () => Promise<void>,
  isActive: boolean = true
): UseRSSFeedPaginationReturn => {
  // Get state from Zustand store
  const pagination = useRSSFeedPaginationState();
  const loading = useRSSFeedLoading();
  const feedMetadata = useRSSFeedMetadata();
  
  // Get individual actions from store (prevents object recreation)
  const addEntries = useRSSFeedAddEntries();
  const setCurrentPage = useRSSFeedSetCurrentPage();
  const setHasMore = useRSSFeedSetHasMore();
  const setLoading = useRSSFeedSetLoading();
  const setFetchError = useRSSFeedSetFetchError();

  // CRITICAL: Use refs to track current values and avoid stale closures
  // This prevents the loadMoreEntries callback from recreating on every state change
  const currentPageRef = useRef(pagination.currentPage);
  const hasMoreRef = useRef(pagination.hasMore);
  const isLoadingRef = useRef(loading.isLoading);
  const isActiveRef = useRef(isActive);
  
  // PHASE 3 OPTIMIZATION: Direct assignment during render instead of useEffect
  // This eliminates 4 useEffect anti-patterns while maintaining the same functionality
  currentPageRef.current = pagination.currentPage;
  hasMoreRef.current = pagination.hasMore;
  isLoadingRef.current = loading.isLoading;
  isActiveRef.current = isActive;

  // Memoize URL creation to prevent recreating on every render
  const createApiUrl = useCallback((nextPage: number) => {
    const { postTitle, feedUrl, pageSize } = feedMetadata;
    
    const baseUrl = new URL(`/api/rss/${encodeURIComponent(postTitle)}`, window.location.origin);
    baseUrl.searchParams.set('feedUrl', encodeURIComponent(feedUrl));
    baseUrl.searchParams.set('page', nextPage.toString());
    baseUrl.searchParams.set('pageSize', pageSize.toString());
    
    // Pass the cached total entries to avoid unnecessary COUNT queries
    if (pagination.totalEntries) {
      baseUrl.searchParams.set('totalEntries', pagination.totalEntries.toString());
    }
    
    if (feedMetadata.mediaType) {
      baseUrl.searchParams.set('mediaType', encodeURIComponent(feedMetadata.mediaType));
    }
    
    return baseUrl.toString();
  }, [feedMetadata, pagination.totalEntries]); // Stable dependencies

  // Memoize entry transformation to prevent recreating on every render
  const transformApiEntries = useCallback((apiEntries: Array<{ entry: any; initialData?: any }>) => {
    const { postTitle, featuredImg, mediaType } = feedMetadata;
    
    return apiEntries
      .filter(Boolean)
      .map((entry): RSSFeedEntry => ({
        entry: entry.entry,
        initialData: entry.initialData || {
          likes: { isLiked: false, count: 0 },
          comments: { count: 0 },
          retweets: { isRetweeted: false, count: 0 }
        },
        postMetadata: {
          title: postTitle,
          featuredImg: featuredImg || entry.entry.image || '',
          mediaType: mediaType || 'article'
        }
      }));
  }, [feedMetadata]); // Stable dependency

  // CRITICAL: Main load more function with stable callback reference
  // Uses refs to get current values and avoid stale closures
  const loadMoreEntries = useCallback(async () => {
    // If a custom load more function is provided (for search mode), use it instead
    if (customLoadMore) {
      return customLoadMore();
    }
    
    // Use refs to get current values and avoid stale closures
    const currentPageValue = currentPageRef.current;
    const hasMoreValue = hasMoreRef.current;
    const isLoadingValue = isLoadingRef.current;
    const isActiveValue = isActiveRef.current;
    
    // Prevent multiple simultaneous calls and check prerequisites
    if (!isActiveValue || isLoadingValue || !hasMoreValue) {
      return;
    }
    
    setLoading(true);
    const nextPage = currentPageValue + 1;
    
    try {
      const apiUrl = createApiUrl(nextPage);
      
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data: RSSFeedAPIResponse = await response.json();
      
      if (!data.entries?.length) {
        setLoading(false);
        return;
      }
      
      const transformedEntries = transformApiEntries(data.entries);
      
      // Update store state
      addEntries(transformedEntries);
      setCurrentPage(nextPage);
      
      // Update hasMore if provided in response
      if (typeof data.hasMore === 'boolean') {
        setHasMore(data.hasMore);
      }
      
    } catch (error) {
      setFetchError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [
    customLoadMore,
    createApiUrl,
    transformApiEntries,
    setLoading,
    addEntries,
    setCurrentPage,
    setHasMore,
    setFetchError
  ]); // STABLE dependencies - no state values that change frequently

  // Return stable object to prevent unnecessary re-renders
  return useMemo(() => ({
    loadMoreEntries,
    isLoading: loading.isLoading,
    hasMore: pagination.hasMore,
    currentPage: pagination.currentPage,
    error: loading.fetchError
  }), [
    loadMoreEntries,
    loading.isLoading,
    pagination.hasMore,
    pagination.currentPage,
    loading.fetchError
  ]);
}; 