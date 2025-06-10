import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useUserActivityFeedStore } from '@/lib/stores/userActivityFeedStore';
import { useDelayedIntersectionObserver } from '@/utils/FeedInteraction';

interface UseActivityLoadingProps {
  userId: string;
  apiEndpoint: string;
  pageSize: number;
  isActive: boolean;
  initialActivities: any[];
  initialEntryDetails: Record<string, any>;
  initialHasMore: boolean;
}

export function useActivityLoading({
  userId,
  apiEndpoint,
  pageSize,
  isActive,
  initialActivities,
  initialEntryDetails,
  initialHasMore
}: UseActivityLoadingProps) {
  // Get store state and actions
  const {
    activities,
    entryDetails,
    hasMore,
    isLoading,
    currentSkip,
    isInitialLoad,
    setInitialData,
    startLoadingMore,
    loadMoreSuccess,
    loadMoreFailure,
    setInitialLoadComplete,
    reset
  } = useUserActivityFeedStore();

  // Initialize store with initial data directly - no useEffect needed
  if (initialActivities.length > 0 && activities.length === 0) {
    setInitialData({
      activities: initialActivities,
      entryDetails: initialEntryDetails,
      hasMore: initialHasMore
    });
  }

  // Use direct values instead of stable refs - no useEffect needed
  const currentValues = useMemo(() => ({
    userId,
    apiEndpoint,
    pageSize,
    hasMore,
    isLoading,
    currentSkip,
    activitiesLength: activities.length
  }), [userId, apiEndpoint, pageSize, hasMore, isLoading, currentSkip, activities.length]);

  // Create a ref for the load more container
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Track endReached state with useMemo instead of useEffect
  const endReachedCalled = useMemo(() => false, [activities.length]);

  // Function to load more activities with current values
  const loadMoreActivities = useCallback(async () => {
    const {
      userId,
      apiEndpoint,
      pageSize,
      hasMore,
      isLoading,
      currentSkip
    } = currentValues;
    
    // Avoid redundant requests and early exit when needed
    if (!isActive || isLoading || !hasMore) {
      // Removed logger call for production readiness
      return;
    }

    // Start loading
    startLoadingMore();

    try {
      // Removed logger call for production readiness

      // Use the API route to fetch the next page
      const result = await fetch(`${apiEndpoint}?userId=${userId}&skip=${currentSkip}&limit=${pageSize}`);

      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }

      const data = await result.json();
      // Removed logger call for production readiness

      if (!data.activities?.length) {
        // Removed logger call for production readiness
        loadMoreSuccess({ 
          activities: [], 
          entryDetails: {}, 
          hasMore: false 
        });
        return;
      }

      // Use the store to update state in one go
      loadMoreSuccess({
        activities: data.activities,
        entryDetails: data.entryDetails || {},
        hasMore: data.hasMore
      });

      // Removed logger call for production readiness
    } catch (error) {
      // Removed logger call for production readiness
      loadMoreFailure();
    }
  }, [isActive, currentValues, startLoadingMore, loadMoreSuccess, loadMoreFailure]);

  // Use the shared delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMoreActivities, {
    enabled: hasMore && !isLoading,
    isLoading,
    hasMore,
    rootMargin: '800px',
    threshold: 0.1,
    delay: 3000
  });

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    if (!hasMore || isLoading || !loadMoreRef.current) return;
    
    const checkContentHeight = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && activities.length > 0) {
        // Removed logger call for production readiness
        loadMoreActivities();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [activities.length, hasMore, isLoading, loadMoreActivities]);

  // Efficiently group activities by entryGuid and type
  const groupedActivities = useMemo(() => {
    // Create a map to store activities by entry GUID and type
    const groupedMap = new Map<string, Map<string, any[]>>();

    // First pass: filter out any activities that are not comments or retweets
    activities.forEach(activity => {
      const key = activity.entryGuid;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, new Map());
      }

      // Group only comments together, keep retweets separate
      const typeKey = activity.type === 'comment' ? 'comment' : `${activity.type}-${activity._id}`;

      if (!groupedMap.get(key)!.has(typeKey)) {
        groupedMap.get(key)!.set(typeKey, []);
      }
      groupedMap.get(key)!.get(typeKey)!.push(activity);
    });

    // Second pass: create final structure
    const result: any[] = [];

    groupedMap.forEach((typeMap, entryGuid) => {
      typeMap.forEach((activitiesForType, typeKey) => {
        // Sort activities by timestamp (oldest first)
        const sortedActivities = [...activitiesForType].sort((a, b) => a.timestamp - b.timestamp);

        if (typeKey === 'comment') {
          // For comments, group them together
          result.push({
            entryGuid,
            firstActivity: sortedActivities[0],
            comments: sortedActivities,
            hasMultipleComments: sortedActivities.length > 1,
            type: 'comment'
          });
        } else {
          // For retweets, each is a separate entry
          sortedActivities.forEach(activity => {
            result.push({
              entryGuid,
              firstActivity: activity,
              comments: [],
              hasMultipleComments: false,
              type: activity.type
            });
          });
        }
      });
    });

    // Sort the result by the timestamp of the first activity (newest first for the feed)
    return result.sort((a, b) => b.firstActivity.timestamp - a.firstActivity.timestamp);
  }, [activities]);

  // Memoize loading state calculations
  const uiIsInitialLoading = useMemo(() => 
    (isLoading && isInitialLoad) || (isInitialLoad && activities.length > 0),
    [isLoading, isInitialLoad, activities.length]
  );
  
  const uiHasNoActivities = useMemo(() => 
    activities.length === 0 && !isLoading && !isInitialLoad,
    [activities.length, isLoading, isInitialLoad]
  );

  return {
    // State
    activities,
    entryDetails,
    hasMore,
    isLoading,
    isInitialLoad,
    groupedActivities,
    uiIsInitialLoading,
    uiHasNoActivities,
    
    // Refs
    loadMoreRef,
    
    // Actions
    loadMoreActivities,
    reset,
    setInitialLoadComplete,
  };
} 