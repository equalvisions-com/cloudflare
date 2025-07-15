import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useUserLikesFeedStore } from '@/lib/stores/userLikesFeedStore';
import { useDelayedIntersectionObserver } from '@/utils/FeedInteraction';
import { UserLikesFeedProps } from '@/lib/types';

interface UseLikesLoadingProps {
  userId: string;
  username: string;
  initialData: UserLikesFeedProps['initialData'];
  pageSize: number;
}

export function useLikesLoading({ userId, username, initialData, pageSize }: UseLikesLoadingProps) {
  // Use refs for tracking state without causing re-renders
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef(true);
  
  // Use Zustand store for state management
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
  } = useUserLikesFeedStore();
  
  // Track skip with a ref to avoid closure problems - update when currentSkip changes
  const currentSkipRef = useRef<number>(currentSkip);
  useMemo(() => {
    currentSkipRef.current = currentSkip;
  }, [currentSkip]);

  // Process initial data when received - use useMemo for efficiency
  useMemo(() => {
    if (!initialData?.activities) return;
    
    setInitialData({
      activities: initialData.activities,
      entryDetails: initialData.entryDetails || {},
      hasMore: initialData.hasMore
    });
    currentSkipRef.current = initialData.activities.length;
  }, [initialData, setInitialData]);

  // Function to load more activities
  const loadMoreActivities = useCallback(async () => {
    if (!isMountedRef.current || isLoading || !hasMore) {
      return;
    }

    startLoadingMore();
    
    try {
      // Get current skip value from ref to ensure it's up-to-date
      const skipValue = currentSkipRef.current;
      
      // Use the public API route to fetch the next page for this specific user  
      const result = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          skip: skipValue,
          limit: pageSize
        })
      });
      
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      
      const data = await result.json();
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (!data.activities?.length) {
        loadMoreFailure();
        return;
      }
      
      // Update both the ref and the state for the new skip value
      const newSkip = skipValue + data.activities.length;
      currentSkipRef.current = newSkip;
      
      loadMoreSuccess({
        activities: data.activities,
        entryDetails: data.entryDetails || {},
        hasMore: data.hasMore
      });
    } catch (error) {
      loadMoreFailure();
    }
  }, [username, isLoading, hasMore, pageSize, startLoadingMore, loadMoreSuccess, loadMoreFailure]);
  
  // Use the shared hook for delayed intersection observer
  useDelayedIntersectionObserver(loadMoreRef, loadMoreActivities, {
    enabled: hasMore && !isLoading,
    isLoading,
    hasMore,
    rootMargin: '800px',
    threshold: 0.1,
    delay: 1000 // Optimized delay for production - prevents accidental triggers
  });

  // Single legitimate cleanup useEffect for component mount/unmount
  useEffect(() => {
    // Set mounted to true when component mounts
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check if we need to load more when content is short - legitimate useEffect for timer cleanup
  useEffect(() => {
    if (!hasMore || isLoading || activities.length === 0) return;
    
    const checkContentHeight = () => {
      if (!isMountedRef.current || !loadMoreRef.current) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight) {
        loadMoreActivities();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [activities.length, hasMore, isLoading, loadMoreActivities]);

  return {
    // State
    activities,
    entryDetails,
    hasMore,
    isLoading,
    isInitialLoad,
    
    // Refs
    loadMoreRef,
    
    // Actions
    loadMoreActivities,
  };
} 