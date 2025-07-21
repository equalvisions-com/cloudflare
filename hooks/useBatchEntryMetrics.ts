import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useMemo, useEffect, useCallback, useRef, useState } from 'react';

interface EntryMetrics {
  likes: { count: number; isLiked: boolean };
  comments: { count: number };
  retweets: { count: number; isRetweeted: boolean };
  bookmarks: { isBookmarked: boolean };
  commentLikes?: Record<string, { commentId: string; isLiked: boolean; count: number; }>;
}

interface UseBatchEntryMetricsOptions {
  /** Skip the initial query if we already have metrics from initialData */
  skipInitialQuery?: boolean;
  /** Initial metrics data to use instead of querying */
  initialMetrics?: Record<string, EntryMetrics>;
  /** Whether to include comment likes data in the query (defaults to false) */
  includeCommentLikes?: boolean;
}

export function useBatchEntryMetrics(
  entryGuids: string[], 
  options: UseBatchEntryMetricsOptions = {}
) {
  const { skipInitialQuery = false, initialMetrics = {}, includeCommentLikes = false } = options;
  
  // Track previous values to detect changes
  const prevEntryGuidsRef = useRef<string[]>([]);
  const prevLengthRef = useRef(0);
  const hasInitialMetricsRef = useRef(Object.keys(initialMetrics).length > 0);
  
  // Track previous skipInitialQuery state to detect active/inactive transitions
  const prevSkipInitialQueryRef = useRef(skipInitialQuery);
  
  // CRITICAL FIX: Use ref to track stable GUIDs and only update when they actually change
  const stableGuidsRef = useRef<string[]>([]);
  const stableGuidsStringRef = useRef<string>('');
  
  // Check if GUIDs have actually changed (not just dependency objects)
  const currentGuidsString = entryGuids.filter(Boolean).sort().join(',');
  const guidsHaveChanged = currentGuidsString !== stableGuidsStringRef.current;
  
  // Only update stable refs when GUIDs actually change
  if (guidsHaveChanged) {
    stableGuidsRef.current = entryGuids.filter(Boolean).sort();
    stableGuidsStringRef.current = currentGuidsString;
  }
  
  // Use stable GUIDs for all computations
  const stableGuids = stableGuidsRef.current;
  
  // Track when component becomes active to force fresh queries
  const [forceRefresh, setForceRefresh] = useState(0);
  
  // Persistent metrics cache to prevent flashing during pagination
  const [persistentMetrics, setPersistentMetrics] = useState<Map<string, EntryMetrics>>(new Map());
  
  // Deduplicate and filter valid GUIDs with a stable sort
  const uniqueGuids = useMemo(() => {
    const seen = new Set<string>();
    const validGuids = stableGuids.filter(guid => {
      if (!guid || seen.has(guid)) return false;
      seen.add(guid);
      return true;
    });
    // Sort to ensure consistent order for React's dependency comparison
    return validGuids.sort();
  }, [stableGuids.join(',')]); // Only depend on stable string representation

  // Determine which GUIDs need to be fetched from Convex
  const guidsToFetch = useMemo(() => {
    if (!skipInitialQuery) {
      return uniqueGuids; // Fetch all if not skipping (component is active)
    }
    
    // If skipping initial query (component is inactive), don't fetch anything
    // This maintains the subscription but doesn't make network requests
    return [];
  }, [uniqueGuids.join(','), skipInitialQuery, forceRefresh]); // Include forceRefresh to trigger fresh queries

  // Single batch query for entries that need fresh data
  // CRITICAL: Skip query when no GUIDs to fetch
  const metricsArray = useQuery(
    api.entries.batchGetEntriesMetrics, 
    guidsToFetch.length > 0 ? { entryGuids: guidsToFetch, includeCommentLikes } : 'skip'
  );
  
  // CRITICAL FIX: Force refresh when component becomes active after being inactive
  // This ensures fresh data is fetched instead of showing stale cached data
  useEffect(() => {
    const wasInactive = prevSkipInitialQueryRef.current;
    const isNowActive = !skipInitialQuery;
    
    if (wasInactive && isNowActive) {
      // Component just became active - force a fresh query
      setForceRefresh(prev => prev + 1);
    }
    
    prevSkipInitialQueryRef.current = skipInitialQuery;
  }, [skipInitialQuery]);

  // Update persistent cache when new metrics arrive
  useEffect(() => {
    if (metricsArray && guidsToFetch.length > 0) {
      setPersistentMetrics(prev => {
        const newMap = new Map(prev);
        
        // Add fresh metrics from query
        guidsToFetch.forEach((guid, index) => {
          if (metricsArray[index]) {
            newMap.set(guid, metricsArray[index]);
          }
        });
        
        return newMap;
      });
    }
  }, [metricsArray, guidsToFetch]);
  
  // Initialize persistent cache with initial metrics
  useEffect(() => {
    if (Object.keys(initialMetrics).length > 0) {
      setPersistentMetrics(prev => {
        const newMap = new Map(prev);
        Object.entries(initialMetrics).forEach(([guid, metrics]) => {
          newMap.set(guid, metrics);
        });
        return newMap;
      });
    }
  }, [initialMetrics]);
  
  // Convert to map, using persistent cache to prevent flashing
  const metricsMap = useMemo(() => {
    return persistentMetrics.size > 0 ? persistentMetrics : null;
  }, [persistentMetrics]);
  
  // CRITICAL FIX: Create a new getMetrics function when metricsMap changes
  // This ensures that components using getMetrics as a prop will re-render when data updates
  const getMetrics = useCallback((entryGuid: string): EntryMetrics | null => {
    return metricsMap?.get(entryGuid) || null;
  }, [metricsMap]); // This dependency ensures the function reference changes when data updates
  
  // Determine loading state - we're loading if we're fetching fresh data
  const isLoading = useMemo(() => {
    // If component is inactive (skipInitialQuery = true), we're never "loading"
    if (skipInitialQuery) {
      return false;
    }
    
    // If component is active, we're loading if the query is undefined and we have GUIDs to fetch
    return guidsToFetch.length > 0 && metricsArray === undefined;
  }, [skipInitialQuery, guidsToFetch.length, metricsArray]);
  
  return {
    getMetrics,
    isLoading,
    metricsMap
  };
} 