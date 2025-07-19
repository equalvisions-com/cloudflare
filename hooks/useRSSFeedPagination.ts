import { useCallback, useMemo, useRef } from 'react';
import type { UseRSSFeedPaginationReturn, RSSFeedEntry, RSSFeedAPIResponse } from '@/lib/types';

// Define types for the hook parameters
interface RSSFeedState {
  entries: RSSFeedEntry[];
  pagination: {
    currentPage: number;
    hasMore: boolean;
    totalEntries: number;
  };
  loading: {
    isLoading: boolean;
    isInitialRender: boolean;
    fetchError: Error | null;
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
  | { type: 'ADD_ENTRIES'; payload: RSSFeedEntry[] }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FETCH_ERROR'; payload: Error | null };

/**
 * Custom hook for RSS Feed pagination logic
 * Handles API calls, data transformation, and pagination state
 * Updated to work with useReducer instead of Zustand
 */
export const useRSSFeedPaginationHook = (
  state: RSSFeedState,
  dispatch: React.Dispatch<RSSFeedAction>,
  customLoadMore?: () => Promise<void>,
  isActive: boolean = true
): UseRSSFeedPaginationReturn => {
  // Extract state values for easier access
  const { pagination, loading, feedMetadata, entries } = state;

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

  // Memoize request parameters creation to prevent recreating on every render
  const createRequestParams = useCallback((nextPage: number) => {
    const { postTitle, feedUrl, pageSize, mediaType } = feedMetadata;
    
    const requestBody: {
      feedUrl: string;
      page: number;
      pageSize: number;
      mediaType?: string;
      totalEntries?: number;
    } = {
      feedUrl: feedUrl,
      page: nextPage,
      pageSize: pageSize,
    };
    
    // Pass the cached total entries to avoid unnecessary COUNT queries
    if (pagination.totalEntries) {
      requestBody.totalEntries = pagination.totalEntries;
    }
    
    if (mediaType) {
      requestBody.mediaType = mediaType;
    }
    
    return {
      url: `/api/rss/${encodeURIComponent(postTitle)}`,
      body: requestBody
    };
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
    
    dispatch({ type: 'SET_LOADING', payload: true });
    const nextPage = currentPageValue + 1;
    
    try {
      const { url, body } = createRequestParams(nextPage);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data: RSSFeedAPIResponse = await response.json();
      
      if (!data.entries?.length) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }
      
      const transformedEntries = transformApiEntries(data.entries);
      
      // Update state using dispatch
      dispatch({ type: 'ADD_ENTRIES', payload: transformedEntries });
      dispatch({ type: 'SET_CURRENT_PAGE', payload: nextPage });
      
      // Update hasMore if provided in response
      if (typeof data.hasMore === 'boolean') {
        dispatch({ type: 'SET_HAS_MORE', payload: data.hasMore });
      }
      
    } catch (error) {
      console.error('📄 RSS Pagination: Error', error);
      dispatch({ type: 'SET_FETCH_ERROR', payload: error instanceof Error ? error : new Error(String(error)) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [
    customLoadMore,
    createRequestParams,
    transformApiEntries,
    dispatch,
    pagination.totalEntries,
    entries.length
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