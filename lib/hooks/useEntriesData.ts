import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useEntriesStore } from '@/lib/stores/entriesStore';
import { EntriesRSSEntry, InteractionStates } from '@/lib/types';

interface UseEntriesDataProps {
  mediaType: string;
  searchQuery: string;
  isVisible?: boolean;
  pageSize?: number;
}

// Custom hook for batch metrics
function useEntriesMetrics(entryGuids: string[], isVisible: boolean) {
  const batchMetricsQuery = useQuery(
    api.entries.batchGetEntriesMetrics,
    isVisible && entryGuids.length > 0 ? { entryGuids } : "skip"
  );

  // Create a memoized metrics map
  const metricsMap = useMemo(() => {
    if (!batchMetricsQuery) {
      return new Map<string, InteractionStates>();
    }

    return new Map(
      entryGuids.map((guid, index) => [guid, batchMetricsQuery[index]])
    );
  }, [batchMetricsQuery, entryGuids]);

  // Memoize default values
  const defaultInteractions = useMemo(() => ({
    likes: { isLiked: false, count: 0 },
    comments: { count: 0 },
    retweets: { isRetweeted: false, count: 0 }
  }), []);

  // Return a function to get metrics for a specific entry
  const getEntryMetrics = useCallback((entryGuid: string) => {
    return metricsMap.get(entryGuid) || defaultInteractions;
  }, [metricsMap, defaultInteractions]);

  return {
    getEntryMetrics,
    isLoading: isVisible && entryGuids.length > 0 && !batchMetricsQuery,
    metricsMap
  };
}

export const useEntriesData = ({
  mediaType,
  searchQuery,
  isVisible = false,
  pageSize = 30,
}: UseEntriesDataProps) => {
  const {
    entries,
    page,
    hasMore,
    lastSearchQuery,
    loadingState,
    commentDrawerOpen,
    selectedCommentEntry,
    setEntries,
    addEntries,
    setPage,
    setHasMore,
    setLastSearchQuery,
    setLoading,
    setInitialLoad,
    setMetricsLoading,
    setCommentDrawerOpen,
    setSelectedCommentEntry,
    reset,
  } = useEntriesStore();

  // Extract loading states from loadingState object
  const { isLoading, isInitialLoad, isMetricsLoading } = loadingState;

  // Add ref to prevent multiple endReached calls
  const endReachedCalledRef = useRef(false);
  
  // Track the last search query to detect changes
  const lastSearchQueryRef = useRef('');

  // Derived state - determine if we need to fetch data
  const shouldFetchEntries = useMemo(() => {
    return searchQuery && isVisible && (searchQuery !== lastSearchQuery || entries.length === 0);
  }, [searchQuery, isVisible, lastSearchQuery, entries.length]);

  // Reset the endReachedCalled flag when entries change
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [entries.length]);

  // Get entry guids for metrics
  const entryGuids = useMemo(() => entries.map(entry => entry.guid), [entries]);
  
  // Use our custom hook for metrics
  const { getEntryMetrics, isLoading: metricsLoading } = useEntriesMetrics(entryGuids, isVisible);

  // Update metrics loading state when it changes
  useEffect(() => {
    setMetricsLoading(metricsLoading);
  }, [metricsLoading, setMetricsLoading]);

  // Load more entries function
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !isVisible || endReachedCalledRef.current) {
      return;
    }

    endReachedCalledRef.current = true;
    const nextPage = page + 1;
    
    setLoading(true);
    
    try {
      const response = await fetch(`/api/search/entries?query=${encodeURIComponent(searchQuery)}&mediaType=${encodeURIComponent(mediaType)}&page=${nextPage}&pageSize=${pageSize}`);
      const data = await response.json();
      
      addEntries(data.entries);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (error) {
      
    } finally {
      setLoading(false);
    }
  }, [hasMore, isLoading, isVisible, page, searchQuery, mediaType, pageSize, setLoading, addEntries, setHasMore, setPage]);

  // Reset state when search query changes (controlled reset)
  useEffect(() => {
    if (searchQuery !== lastSearchQueryRef.current) {
      lastSearchQueryRef.current = searchQuery;
      reset();
      setLastSearchQuery(searchQuery);
    }
  }, [searchQuery, reset, setLastSearchQuery]);

  // Single effect for data fetching
  useEffect(() => {
    if (!shouldFetchEntries) return;

    const searchEntries = async () => {
      // Set initial load state if this is a new search query
      if (searchQuery !== lastSearchQuery) {
        setInitialLoad(true);
      }
      
      setLoading(true);
      
      try {
        const response = await fetch(`/api/search/entries?query=${encodeURIComponent(searchQuery)}&mediaType=${encodeURIComponent(mediaType)}&page=1&pageSize=${pageSize}`);
        const data = await response.json();
        
        setEntries(data.entries);
        setHasMore(data.hasMore);
        setPage(1);
        setLastSearchQuery(searchQuery);
      } catch (error) {

      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    searchEntries();
  }, [shouldFetchEntries, searchQuery, lastSearchQuery, mediaType, pageSize, setLoading, setInitialLoad, setEntries, setHasMore, setPage, setLastSearchQuery]);

  // Comment drawer handlers
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, [setSelectedCommentEntry, setCommentDrawerOpen]);

  const handleCommentDrawerClose = useCallback((open: boolean) => {
    setCommentDrawerOpen(open);
  }, [setCommentDrawerOpen]);

  return {
    entries,
    hasMore,
    isLoading,
    isInitialLoad,
    isMetricsLoading,
    commentDrawerOpen,
    selectedCommentEntry,
    getEntryMetrics,
    loadMore,
    handleOpenCommentDrawer,
    handleCommentDrawerClose,
  };
}; 