import { useCallback, useRef, useMemo, useEffect } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import type {
  FriendsListState,
  FriendsListAction,
  FriendsListFriendWithProfile,
  UseFriendsListVirtualizationReturn,
  FriendsListVirtualizationConfig,
} from '@/lib/types';

interface UseFriendsListVirtualizationProps {
  state: FriendsListState;
  dispatch: React.Dispatch<FriendsListAction>;
  loadMoreFriends: () => Promise<void>;
  config?: Partial<FriendsListVirtualizationConfig>;
}

const DEFAULT_CONFIG: FriendsListVirtualizationConfig = {
  itemHeight: 80, // Height of each friend item
  overscan: 5, // Number of items to render outside viewport
  scrollSeekConfiguration: {
    enter: (velocity) => Math.abs(velocity) > 200,
    exit: (velocity) => Math.abs(velocity) < 30,
  },
  loadMoreThreshold: 3, // Load more when 3 items from bottom
  debounceMs: 300,
};

export const useFriendsListVirtualization = ({
  state,
  dispatch,
  loadMoreFriends,
  config = {},
}: UseFriendsListVirtualizationProps): UseFriendsListVirtualizationReturn => {
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  
  // Virtuoso ref for programmatic control
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  
  // Loading state ref to prevent multiple concurrent requests
  const loadingRef = useRef(false);
  
  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Memoized friends list for performance
  const virtualizedFriends = useMemo(() => {
    return state.friends || [];
  }, [state.friends]);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    loadingRef.current = false;
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // Debounced load more function
  const debouncedLoadMore = useCallback(async () => {
    if (loadingRef.current || !state.hasMore || state.isLoading) {
      return;
    }
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      if (loadingRef.current) return;
      
      loadingRef.current = true;
      try {
        await loadMoreFriends();
      } catch (error) {
        console.error('Virtualized load more failed:', error);
      } finally {
        loadingRef.current = false;
      }
    }, mergedConfig.debounceMs);
  }, [loadMoreFriends, state.hasMore, state.isLoading, mergedConfig.debounceMs]);
  
  // End reached handler for Virtuoso
  const handleEndReached = useCallback(() => {
    if (!state.hasMore || state.isLoading || loadingRef.current) {
      return;
    }
    
    debouncedLoadMore();
  }, [state.hasMore, state.isLoading, debouncedLoadMore]);
  
  // Range changed handler for preloading
  const handleRangeChanged = useCallback((range: { startIndex: number; endIndex: number }) => {
    const { endIndex } = range;
    const totalItems = virtualizedFriends.length;
    
    // Preload when approaching the end
    if (
      totalItems > 0 && 
      endIndex >= totalItems - mergedConfig.loadMoreThreshold &&
      state.hasMore &&
      !state.isLoading &&
      !loadingRef.current
    ) {
      debouncedLoadMore();
    }
  }, [virtualizedFriends.length, mergedConfig.loadMoreThreshold, state.hasMore, state.isLoading, debouncedLoadMore]);
  
  // Scroll to top function
  const scrollToTop = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: 0,
      behavior: 'smooth',
    });
  }, []);
  
  // Scroll to friend function
  const scrollToFriend = useCallback((friendshipId: string) => {
    const index = virtualizedFriends.findIndex(
      friend => friend.friendship._id.toString() === friendshipId
    );
    
    if (index !== -1) {
      virtuosoRef.current?.scrollToIndex({
        index,
        behavior: 'smooth',
        align: 'center',
      });
    }
  }, [virtualizedFriends]);
  
  // Get visible range
  const getVisibleRange = useCallback(() => {
    // Note: This is a simplified implementation - actual Virtuoso API may differ
    return { startIndex: 0, endIndex: Math.min(10, virtualizedFriends.length - 1) };
  }, [virtualizedFriends.length]);
  
  // Item renderer function
  const itemRenderer = useCallback((index: number, friend: FriendsListFriendWithProfile) => {
    return {
      friend,
      index,
      isFirst: index === 0,
      isLast: index === virtualizedFriends.length - 1,
    };
  }, [virtualizedFriends.length]);
  
  // Footer component configuration for loading state
  const footerComponent = useMemo(() => {
    if (!state.hasMore) {
      return {
        type: 'no-more',
        message: virtualizedFriends.length === 0 ? 'No friends found' : 'No more friends to load'
      };
    }
    
    if (state.isLoading) {
      return {
        type: 'loading',
        message: 'Loading more friends...'
      };
    }
    
    return null;
  }, [state.hasMore, state.isLoading, virtualizedFriends.length]);
  
  // Stable style object to prevent re-renders
  const virtuosoStyle = useMemo(() => ({ height: '100%' }), []);

  // Virtuoso props - optimized to prevent unnecessary re-renders
  const virtuosoProps = useMemo(() => ({
    ref: virtuosoRef,
    data: virtualizedFriends,
    endReached: handleEndReached,
    rangeChanged: handleRangeChanged,
    overscan: mergedConfig.overscan,
    fixedItemHeight: mergedConfig.itemHeight,
    scrollSeekConfiguration: mergedConfig.scrollSeekConfiguration,
    style: virtuosoStyle,
    className: 'friends-list-virtuoso',
  }), [
    virtualizedFriends,
    handleEndReached,
    handleRangeChanged,
    mergedConfig.overscan,
    mergedConfig.itemHeight,
    mergedConfig.scrollSeekConfiguration,
    virtuosoStyle,
  ]);
  
  return {
    // Virtuoso configuration
    virtuosoRef,
    virtuosoProps,
    
    // Data
    virtualizedFriends,
    
    // Handlers
    handleEndReached,
    handleRangeChanged,
    itemRenderer,
    
    // Navigation
    scrollToTop,
    scrollToFriend,
    getVisibleRange,
    
    // Components
    footerComponent,
    
    // Cleanup
    cleanup,
  };
}; 