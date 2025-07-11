import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useMemo, useEffect, useCallback, useRef } from 'react';

interface EntryMetrics {
  likes: { count: number; isLiked: boolean };
  comments: { count: number };
  retweets: { count: number; isRetweeted: boolean };
}

export function useBatchEntryMetrics(entryGuids: string[]) {
  // Track previous values to detect changes
  const prevEntryGuidsRef = useRef<string[]>([]);
  const prevLengthRef = useRef(0);
  
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

  // Update refs to track changes
  useEffect(() => {
    prevEntryGuidsRef.current = entryGuids;
    prevLengthRef.current = entryGuids.length;
  }, [entryGuids]);

  // Single batch query for all entries - this is reactive by default
  // CRITICAL: Skip query when no GUIDs to prevent unnecessary API calls
  const metricsArray = useQuery(
    api.entries.batchGetEntriesMetrics, 
    uniqueGuids.length > 0 ? { entryGuids: uniqueGuids } : 'skip'
  );
  
  // Convert array to map for O(1) lookup - but don't over-cache
  // Let this recompute when metricsArray changes (which happens reactively)
  const metricsMap = useMemo(() => {
    if (!metricsArray || !uniqueGuids.length) return null;
    
    const map = new Map<string, EntryMetrics>();
    uniqueGuids.forEach((guid, index) => {
      if (metricsArray[index]) {
        map.set(guid, metricsArray[index]);
      }
    });
    

    
    return map;
  }, [metricsArray, uniqueGuids]);
  
  // CRITICAL FIX: Create a new getMetrics function when metricsMap changes
  // This ensures that components using getMetrics as a prop will re-render when data updates
  const getMetrics = useCallback((entryGuid: string): EntryMetrics | null => {
    return metricsMap?.get(entryGuid) || null;
  }, [metricsMap]); // This dependency ensures the function reference changes when data updates
  

  
  return {
    getMetrics,
    isLoading: metricsArray === undefined,
    metricsMap
  };
} 