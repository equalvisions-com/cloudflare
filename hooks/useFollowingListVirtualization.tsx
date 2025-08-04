"use client";

import { useRef, useCallback, useMemo, useEffect } from "react";
import { VirtuosoHandle } from "react-virtuoso";
import { Id } from "@/convex/_generated/dataModel";
import type { 
  FollowingListFollowingWithPost,
  FollowingListState,
  FollowingListAction,
  FollowingListVirtualizationConfig,
  UseFollowingListVirtualizationReturn,
  UseFollowingListVirtualizationProps,
} from "@/lib/types";

const DEFAULT_CONFIG: FollowingListVirtualizationConfig = {
  itemHeight: 80,
  overscan: 5,
  scrollSeekConfiguration: {
    enter: (velocity) => Math.abs(velocity) > 200,
    exit: (velocity) => Math.abs(velocity) < 30,
  },
  loadMoreThreshold: 3,
  debounceMs: 150,
};

export function useFollowingListVirtualization({
  state,
  dispatch,
  loadMoreFollowing,
  config = {},
}: UseFollowingListVirtualizationProps): UseFollowingListVirtualizationReturn {
  
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

  // Virtuoso ref for programmatic control
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Loading state ref to prevent multiple concurrent requests
  const loadingRef = useRef(false);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized virtualized following items
  const virtualizedFollowing = useMemo(() => {
    return state.followingItems.filter((item): item is FollowingListFollowingWithPost => 
      item !== null && 
      item.following !== null && 
      item.post !== null
    );
  }, [state.followingItems]);

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
        await loadMoreFollowing();
              } catch (error) {
          // Error handled by error boundary
        } finally {
        loadingRef.current = false;
      }
    }, mergedConfig.debounceMs);
  }, [loadMoreFollowing, state.hasMore, state.isLoading, mergedConfig.debounceMs]);

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
    const totalItems = virtualizedFollowing.length;
    
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
  }, [virtualizedFollowing.length, mergedConfig.loadMoreThreshold, state.hasMore, state.isLoading, debouncedLoadMore]);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: 0,
      behavior: 'smooth',
    });
  }, []);

  // Scroll to specific item function
  const scrollToItem = useCallback((postId: string) => {
    const index = virtualizedFollowing.findIndex(
      item => item.post._id.toString() === postId
    );
    
    if (index !== -1) {
      virtuosoRef.current?.scrollToIndex({
        index,
        behavior: 'smooth',
        align: 'center',
      });
    }
  }, [virtualizedFollowing]);

  // Get visible range
  const getVisibleRange = useCallback(() => {
    // Note: This is a simplified implementation - actual Virtuoso API may differ
    return { startIndex: 0, endIndex: Math.min(10, virtualizedFollowing.length - 1) };
  }, [virtualizedFollowing.length]);

  // Item renderer function
  const itemRenderer = useCallback((index: number, item: FollowingListFollowingWithPost) => {
    return {
      item,
      index,
      isFirst: index === 0,
      isLast: index === virtualizedFollowing.length - 1,
    };
  }, [virtualizedFollowing.length]);

  // Footer component configuration for loading state
  const footerComponent = useMemo(() => {
    if (state.isLoading) {
      return {
        type: 'loading',
        message: ''
      };
    }
    
    return null;
  }, [state.isLoading]);

  // Stable style object to prevent re-renders
  const virtuosoStyle = useMemo(() => ({ height: '100%' }), []);
  
  // Stable viewport configuration to prevent re-renders
  const increaseViewportBy = useMemo(() => ({
    top: 160,
    bottom: 240,
  }), []);

  // Virtuoso props - optimized to prevent unnecessary re-renders
  const virtuosoProps = useMemo(() => ({
    ref: virtuosoRef,
    data: virtualizedFollowing,
    endReached: handleEndReached,
    rangeChanged: handleRangeChanged,
    overscan: mergedConfig.overscan,
    fixedItemHeight: mergedConfig.itemHeight,
    scrollSeekConfiguration: mergedConfig.scrollSeekConfiguration,
    style: virtuosoStyle,
    className: 'following-list-virtuoso',
    increaseViewportBy,
  }), [
    virtualizedFollowing,
    handleEndReached,
    handleRangeChanged,
    mergedConfig.overscan,
    mergedConfig.itemHeight,
    mergedConfig.scrollSeekConfiguration,
    virtuosoStyle,
    increaseViewportBy,
  ]);

  return {
    // Virtuoso configuration
    virtuosoRef,
    virtuosoProps,
    
    // Data
    virtualizedFollowing,
    
    // Handlers
    handleEndReached,
    handleRangeChanged,
    itemRenderer,
    
    // Navigation
    scrollToTop,
    scrollToItem,
    getVisibleRange,
    
    // Components
    footerComponent,
    
    // Cleanup
    cleanup,
  };
} 