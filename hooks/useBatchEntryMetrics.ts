import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useMemo, useEffect, useCallback, useRef } from 'react';

interface EntryMetrics {
  likes: { count: number; isLiked: boolean };
  comments: { count: number };
  retweets: { count: number; isRetweeted: boolean };
  bookmarks: { isBookmarked: boolean };
}

interface UseBatchEntryMetricsOptions {
  /** Skip the initial query if we already have metrics from initialData */
  skipInitialQuery?: boolean;
  /** Initial metrics data to use instead of querying */
  initialMetrics?: Record<string, EntryMetrics>;
}

export function useBatchEntryMetrics(
  entryGuids: string[], 
  options: UseBatchEntryMetricsOptions = {}
) {
  const { skipInitialQuery = false, initialMetrics = {} } = options;
  
  // Track previous values to detect changes
  const prevEntryGuidsRef = useRef<string[]>([]);
  const prevLengthRef = useRef(0);
  const hasInitialMetricsRef = useRef(Object.keys(initialMetrics).length > 0);
  
  // Deduplicate and filter valid GUIDs with a stable sort
  const uniqueGuids = useMemo(() => {
    const seen = new Set<string>();
    const validGuids = entryGuids.filter(guid => {
      if (!guid || seen.has(guid)) return false;
      seen.add(guid);
      return true;
    });
    // Sort to ensure consistent order for React's dependency comparison
    return validGuids.sort();
  }, [entryGuids]);

  // Determine which GUIDs need to be fetched from Convex
  const guidsToFetch = useMemo(() => {
    if (!skipInitialQuery) {
      return uniqueGuids; // Fetch all if not skipping
    }
    
    // If skipping initial query, only fetch GUIDs we don't have metrics for
    return uniqueGuids.filter(guid => !initialMetrics[guid]);
  }, [uniqueGuids, skipInitialQuery, initialMetrics]);

  // Update refs to track changes
  useEffect(() => {
    prevEntryGuidsRef.current = entryGuids;
    prevLengthRef.current = entryGuids.length;
    hasInitialMetricsRef.current = Object.keys(initialMetrics).length > 0;
  }, [entryGuids, initialMetrics]);

  // Single batch query for entries that need fresh data
  // CRITICAL: Skip query when no GUIDs to fetch or when we have all metrics from initialData
  const metricsArray = useQuery(
    api.entries.batchGetEntriesMetrics, 
    guidsToFetch.length > 0 ? { entryGuids: guidsToFetch } : 'skip'
  );
  
  // Convert to map, combining initial metrics with fresh query results
  const metricsMap = useMemo(() => {
    const map = new Map<string, EntryMetrics>();
    
    // First, add initial metrics
    Object.entries(initialMetrics).forEach(([guid, metrics]) => {
      map.set(guid, metrics);
    });
    
    // Then, add fresh metrics from query (these take precedence for pagination)
    if (metricsArray && guidsToFetch.length > 0) {
      guidsToFetch.forEach((guid, index) => {
        if (metricsArray[index]) {
          map.set(guid, metricsArray[index]);
        }
      });
    }
    
    return map.size > 0 ? map : null;
  }, [metricsArray, guidsToFetch, initialMetrics]);
  
  // CRITICAL FIX: Create a new getMetrics function when metricsMap changes
  // This ensures that components using getMetrics as a prop will re-render when data updates
  const getMetrics = useCallback((entryGuid: string): EntryMetrics | null => {
    return metricsMap?.get(entryGuid) || null;
  }, [metricsMap]); // This dependency ensures the function reference changes when data updates
  
  // Determine loading state - we're loading if we're fetching fresh data
  const isLoading = useMemo(() => {
    // If we have initial metrics for all requested GUIDs, we're not loading
    if (skipInitialQuery && uniqueGuids.every(guid => initialMetrics[guid])) {
      return false;
    }
    
    // Otherwise, we're loading if the query is undefined and we have GUIDs to fetch
    return guidsToFetch.length > 0 && metricsArray === undefined;
  }, [skipInitialQuery, uniqueGuids, initialMetrics, guidsToFetch.length, metricsArray]);
  
  return {
    getMetrics,
    isLoading,
    metricsMap
  };
} 