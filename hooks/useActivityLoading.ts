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
  initialCommentLikes?: Record<string, { commentId: string; isLiked: boolean; count: number; }>;
}

export function useActivityLoading({
  userId,
  apiEndpoint,
  pageSize,
  isActive,
  initialActivities,
  initialEntryDetails,
  initialHasMore,
  initialCommentLikes
}: UseActivityLoadingProps) {
  // Get store state and actions
  const {
    activities,
    entryDetails,
    hasMore,
    isLoading,
    currentSkip,
    isInitialLoad,
    commentLikes,
    setInitialData,
    startLoadingMore,
    loadMoreSuccess,
    loadMoreFailure,
    setInitialLoadComplete,
    reset
  } = useUserActivityFeedStore();

  // Initialize store with initial data using useEffect to prevent re-initialization
  useEffect(() => {
    if (initialActivities.length > 0 && activities.length === 0 && isInitialLoad) {
      setInitialData({
        activities: initialActivities,
        entryDetails: initialEntryDetails,
        hasMore: initialHasMore,
        commentLikes: initialCommentLikes
      });
    }
  }, [initialActivities, initialEntryDetails, initialHasMore, initialCommentLikes, activities.length, isInitialLoad, setInitialData]);

  // Reset state when initial data changes (similar to RSSFeedClient pattern)
  useEffect(() => {
    // Only reset if we have new initial data and it's different from current
    if (initialActivities.length > 0 && activities.length > 0) {
      // Check if this is actually new initial data by comparing first item
      const currentFirstActivity = activities[0];
      const newFirstActivity = initialActivities[0];
      
      if (currentFirstActivity && newFirstActivity && 
          currentFirstActivity._id !== newFirstActivity._id) {
        // This is new initial data, reset completely
        setInitialData({
          activities: initialActivities,
          entryDetails: initialEntryDetails,
          hasMore: initialHasMore,
          commentLikes: initialCommentLikes
        });
      }
    }
  }, [initialActivities, initialEntryDetails, initialHasMore, activities, setInitialData]);

  // Use refs to track current values to avoid stale closures (similar to RSSFeedClient pattern)
  const currentSkipRef = useRef(currentSkip);
  const hasMoreRef = useRef(hasMore);
  const isLoadingRef = useRef(isLoading);
  
  // Update refs synchronously during render (React best practice)
  currentSkipRef.current = currentSkip;
  hasMoreRef.current = hasMore;
  isLoadingRef.current = isLoading;

  // Create a ref for the load more container
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Function to load more activities with current values
  const loadMoreActivities = useCallback(async () => {
    // Use refs to get current values and avoid stale closures
    const currentSkipValue = currentSkipRef.current;
    const hasMoreValue = hasMoreRef.current;
    const isLoadingValue = isLoadingRef.current;
    
    // Avoid redundant requests and early exit when needed
    if (!isActive || isLoadingValue || !hasMoreValue) {
      return;
    }

    // Start loading
    startLoadingMore();

    try {
      // Use the API route to fetch the next page
      const url = new URL(apiEndpoint, window.location.origin);
      url.searchParams.set('skip', currentSkipValue.toString());
      url.searchParams.set('limit', pageSize.toString());
      const result = await fetch(url.toString());

      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }

      const data = await result.json();

      if (!data.activities?.length) {
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
        hasMore: data.hasMore,
        commentLikes: data.commentLikes || {}
      });
    } catch (error) {
      loadMoreFailure();
    }
  }, [isActive, apiEndpoint, pageSize, currentSkipRef, hasMoreRef, isLoadingRef, startLoadingMore, loadMoreSuccess, loadMoreFailure]);

  // Use the shared delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMoreActivities, {
    enabled: hasMore && !isLoading,
    isLoading,
    hasMore,
    rootMargin: '800px',
    threshold: 0.1,
    delay: 1000
  });

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    if (!hasMore || isLoading || !loadMoreRef.current) return;
    
    const checkContentHeight = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && activities.length > 0) {
        loadMoreActivities();
      }
    };
    
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
    commentLikes,
    
    // Refs
    loadMoreRef,
    
    // Actions
    loadMoreActivities,
    reset,
    setInitialLoadComplete,
  };
} 