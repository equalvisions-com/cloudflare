import { useMemo, useCallback } from 'react';
import type {
  FollowersListState,
  FollowersListAction,
} from '@/lib/types';

interface UseFollowersListVirtualizationProps {
  state: FollowersListState;
  dispatch: React.Dispatch<FollowersListAction>;
  loadMoreFollowers: () => Promise<void>;
  config?: {
    itemHeight?: number;
    overscan?: number;
    loadMoreThreshold?: number;
    debounceMs?: number;
  };
}

interface FooterComponent {
  type: 'loading';
  message: string;
}

export function useFollowersListVirtualization({
  state,
  dispatch,
  loadMoreFollowers,
  config = {},
}: UseFollowersListVirtualizationProps) {
  const {
    itemHeight = 80,
    overscan = 5,
    loadMoreThreshold = 3,
    debounceMs = 150,
  } = config;

  // Handle end reached for pagination
  const handleEndReached = useCallback(async () => {
    if (state.isLoading || !state.hasMore) return;
    
    try {
      await loadMoreFollowers();
    } catch (error) {
      // Error is handled in the data hook
    }
  }, [state.isLoading, state.hasMore, loadMoreFollowers]);

  // Debounced end reached handler
  const debouncedEndReached = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleEndReached, debounceMs);
    };
  }, [handleEndReached, debounceMs]);

  // Virtuoso props configuration
  const virtuosoProps = useMemo(() => ({
    data: state.followers,
    fixedItemHeight: itemHeight,
    overscan,
    endReached: debouncedEndReached,
    increaseViewportBy: {
      top: itemHeight * overscan,
      bottom: itemHeight * overscan,
    },
    style: { height: '100%' },
    className: 'followers-virtuoso-container',
  }), [state.followers, itemHeight, overscan, debouncedEndReached]);

  // Footer component for loading states
  const footerComponent = useMemo((): FooterComponent | undefined => {
    if (state.isLoading && state.followers.length > 0) {
      return {
        type: 'loading',
        message: '',
      };
    }
    
    return undefined;
  }, [state.isLoading, state.followers.length]);

  // Scroll to top function
  const scrollToTop = useCallback(() => {
    // This would be implemented with a ref to the Virtuoso component
    // For now, we'll return a placeholder function
    return () => {
      // Implementation would go here when integrated with the component
    };
  }, []);

  return {
    virtuosoProps,
    footerComponent,
    scrollToTop,
    
    // Computed values for the component
    shouldShowVirtualizedList: state.followers.length > 0 && !state.error,
    shouldShowLoadingSpinner: state.isLoading && state.followers.length === 0,
    shouldShowErrorState: !!state.error,
    shouldShowEmptyState: !state.isLoading && state.isInitialized && state.followers.length === 0,
  };
} 