"use client";

/**
 * FollowingList Component
 * 
 * Displays a user's following list in a drawer with optimized loading and follow button states.
 * 
 * Key optimizations:
 * - Uses a single optimized query that fetches both following data and current user's follow states
 * - Prevents follow button state flashing by waiting for complete data before rendering
 * - Implements virtualization for performance with large lists
 * - Includes proper error handling and loading states
 * 
 * Performance features:
 * - Cursor-based pagination
 * - Memoized components and callbacks
 * - Atomic state updates to prevent UI flashing
 * - Efficient data fetching with combined queries
 */

import { useReducer, useMemo, useCallback, useRef, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import type {
  FollowingListProps,
  FollowingListState,
  FollowingListAction,
  FollowingListFollowingWithPost,
  FollowingListInitialData,
  ProfileFollowingData,
} from "@/lib/types";
import { convertProfileFollowingDataToFollowingListData } from "@/lib/types";
import { useFollowingListData } from "@/hooks/useFollowingListData";
import { useFollowingListActions } from "@/hooks/useFollowingListActions";
import { useFollowingListVirtualization } from "@/hooks/useFollowingListVirtualization";
import { MemoizedVirtualizedFollowingItem } from "./VirtualizedFollowingItem";
import { FollowingListErrorBoundary } from "./FollowingListErrorBoundary";
import { FollowingListDrawerSkeleton } from "./FollowingListSkeleton";
import { FollowingListEmptyState } from "./FollowingListEmptyState";

// Create initial state from props
const createInitialState = (
  initialCount: number,
  initialFollowing?: ProfileFollowingData
): FollowingListState => {
  // Don't initialize with data immediately - let the drawer opening trigger loading
  // This ensures the skeleton shows even when we have initial data
  
  return {
    isOpen: false,
    isLoading: false,
    followingItems: [], // Always start empty to show skeleton
    count: initialCount,
    cursor: null, // Will be set when data loads
    hasMore: false, // Will be set when data loads
    followStatusMap: {},
    isLoadingFollowStatus: false,
    error: null,
    lastFetchTime: null,
    // Always start as not initialized to show skeleton on first open
    isInitialized: false,
  };
};

// Reducer for following list state management
const followingListReducer = (state: FollowingListState, action: FollowingListAction): FollowingListState => {
  switch (action.type) {
    case 'OPEN_DRAWER':
      return { 
        ...state, 
        isOpen: true,
        // Set loading state if not initialized to show skeleton
        isLoading: !state.isInitialized ? true : state.isLoading
      };
    
    case 'CLOSE_DRAWER':
      return { ...state, isOpen: false };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: action.payload ? null : state.error };
    
    case 'SET_COUNT':
      return { ...state, count: action.payload };
    
    case 'INITIALIZE_FOLLOWING':
      return {
        ...state,
        followingItems: action.payload.followingItems,
        cursor: action.payload.cursor,
        hasMore: action.payload.hasMore,
        // Atomically update follow status map to prevent button state flashing
        followStatusMap: action.payload.followStates || state.followStatusMap,
        isInitialized: true,
        lastFetchTime: Date.now(),
        error: null,
        isLoading: false,
        isLoadingFollowStatus: false,
      };
    
    case 'LOAD_MORE_START':
      return { ...state, isLoading: true, error: null };
    
    case 'LOAD_MORE_SUCCESS':
      return {
        ...state,
        followingItems: [...state.followingItems, ...action.payload.followingItems],
        cursor: action.payload.cursor,
        hasMore: action.payload.hasMore,
        // Merge new follow states with existing ones for pagination
        followStatusMap: action.payload.followStates 
          ? { ...state.followStatusMap, ...action.payload.followStates }
          : state.followStatusMap,
        isLoading: false,
        lastFetchTime: Date.now(),
        error: null,
      };
    
    case 'LOAD_MORE_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_FOLLOW_STATUS_LOADING':
      return { ...state, isLoadingFollowStatus: action.payload };
    
    case 'UPDATE_FOLLOW_STATUS_MAP':
      return { ...state, followStatusMap: action.payload, isLoadingFollowStatus: false };
    
    case 'UPDATE_SINGLE_FOLLOW_STATUS':
      return {
        ...state,
        followStatusMap: {
          ...state.followStatusMap,
          [action.payload.postId]: action.payload.isFollowing,
        },
      };
    
    case 'RESET_STATE':
      return createInitialState(state.count, undefined);
    
    case 'REMOVE_FOLLOWING_ITEM':
      return {
        ...state,
        followingItems: state.followingItems.filter(item => item.post._id !== action.payload),
        count: Math.max(0, state.count - 1),
      };
    
    default:
      return state;
  }
};

export function FollowingList({ username, initialCount = 0, initialFollowing }: FollowingListProps) {
  // Authentication state (like FollowButton.tsx)
  const { isAuthenticated } = useConvexAuth();
  
  // Router for navigation
  const router = useRouter();
  
  // State management with useReducer
  const [state, dispatch] = useReducer(followingListReducer, createInitialState(initialCount, initialFollowing));
  
  // Ref for cleanup of accessibility announcement timeout
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Data hook - handles all data fetching and management
  const dataHook = useFollowingListData({
    username,
    state,
    dispatch,
    initialFollowing,
  });

  // Actions hook - handles all user interactions
  const actionsHook = useFollowingListActions({
    state,
    dispatch,
    loadMoreFollowing: dataHook.loadMoreFollowing,
    refreshFollowing: dataHook.refreshFollowing,
  });

  // Memoized callbacks to prevent unnecessary re-renders
  const handleCloseDrawer = useCallback(() => {
    dispatch({ type: 'CLOSE_DRAWER' });
  }, []);

  // Cleanup function for component unmount
  const cleanup = useCallback(() => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
      announcementTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Note: Initial data handling is disabled to prevent follow button state flashing
  // The optimized query provides both following data and follow states atomically
  // This ensures buttons display correct states immediately when content appears

  // Virtualization hook - handles large list performance
  const virtualizationHook = useFollowingListVirtualization({
    state,
    dispatch,
    loadMoreFollowing: actionsHook.handleLoadMore,
    config: {
      itemHeight: 80,
      overscan: 5,
      loadMoreThreshold: 3,
      debounceMs: 150,
    },
  });

  // Memoized computed values with optimized dependencies
  const computedValues = useMemo(() => ({
    followingCount: state.count,
    hasError: !!dataHook.error,
    isEmpty: !dataHook.isLoading && state.isInitialized && dataHook.followingItems.length === 0,
    isInitialLoading: (state.isLoading || dataHook.isLoading) && !state.isInitialized,
    // Show skeleton during initial load only (follow status now comes with main query)
    shouldShowLoadingSpinner: (state.isLoading || dataHook.isLoading) && !state.isInitialized,
    shouldShowErrorState: !!dataHook.error,
    shouldShowEmptyState: !dataHook.isLoading && !state.isLoading && state.isInitialized && dataHook.followingItems.length === 0,
    // Show content when we have following data (follow status is included in the optimized query)
    shouldShowVirtualizedList: state.isInitialized && 
                               dataHook.followingItems.length > 0 && 
                               !dataHook.error,
  }), [
    dataHook.followingItems.length, 
    dataHook.isLoading,
    dataHook.error,
    state.count, 
    state.isInitialized,
    state.isLoading,
    state.isOpen
  ]);

  // Memoized accessibility announcement
  const accessibilityAnnouncement = useMemo(() => {
    return computedValues.followingCount === 0 
      ? "Following list opened. Not following any content yet."
      : `Following list opened. Showing ${computedValues.followingCount} followed ${computedValues.followingCount === 1 ? 'item' : 'items'}.`;
  }, [computedValues.followingCount]);

  // Handle drawer state changes with accessibility - optimized
  const handleOpenChange = useCallback((open: boolean) => {
    dispatch({ type: open ? 'OPEN_DRAWER' : 'CLOSE_DRAWER' });
    if (open && dataHook.error) {
      dataHook.resetError();
    }
    
    // Announce to screen readers
    if (open) {
      // Clear any existing timeout
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
      
      // Only run in browser environment
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        // Create temporary announcement element
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        announcer.textContent = accessibilityAnnouncement;
        document.body.appendChild(announcer);
        
        // Clean up after announcement with proper timeout management
        announcementTimeoutRef.current = setTimeout(() => {
          if (document.body.contains(announcer)) {
            document.body.removeChild(announcer);
          }
          announcementTimeoutRef.current = null;
        }, 1000);
      }
    }
  }, [dataHook, accessibilityAnnouncement]);

  // Memoized aria label for trigger button
  const triggerAriaLabel = useMemo(() => 
    `View following list. Following ${computedValues.followingCount} ${computedValues.followingCount === 1 ? 'item' : 'items'}`,
    [computedValues.followingCount]
  );

  // Handle load more with error handling
  const handleLoadMore = useCallback(async () => {
    try {
      await dataHook.loadMoreFollowing();
    } catch (error) {
      actionsHook.handleError(
        error instanceof Error ? error : new Error('Load more failed')
      );
    }
  }, [dataHook, actionsHook]);

  // Handle refresh with error handling
  const handleRefresh = useCallback(async () => {
    try {
      await dataHook.refreshFollowing();
    } catch (error) {
      actionsHook.handleError(
        error instanceof Error ? error : new Error('Refresh failed')
      );
    }
  }, [dataHook, actionsHook]);

  // Memoized close drawer handler to prevent re-renders
  const memoizedCloseDrawer = useCallback(() => {
    dispatch({ type: 'CLOSE_DRAWER' });
  }, []);

  // Stable item renderer for Virtuoso - fixed dependencies  
  const itemContent = useCallback((index: number, item: FollowingListFollowingWithPost) => {
    // Add defensive check
    if (!item || !item.post) {
      // Invalid item data - render error placeholder
      return (
        <div 
          key={`error-${index}`}
          className="flex items-center justify-center p-4 text-muted-foreground"
          role="alert"
          aria-label="Invalid item data"
        >
          <span className="text-sm">Invalid item data</span>
        </div>
      );
    }

    // Get current user's follow status for this post
    const currentUserFollowStatus = state.followStatusMap[item.following.postId.toString()] ?? false;

    // Local update function that doesn't trigger parent error state
    const handleUpdateFollowStatus = (postId: Id<"posts">, isFollowing: boolean) => {
      dispatch({
        type: 'UPDATE_SINGLE_FOLLOW_STATUS',
        payload: { postId: postId.toString(), isFollowing },
      });
    };

    return (
      <MemoizedVirtualizedFollowingItem
        key={`${item.post._id}-${index}`}
        item={item}
        onCloseDrawer={memoizedCloseDrawer}
        currentUserFollowStatus={currentUserFollowStatus}
        onUpdateFollowStatus={handleUpdateFollowStatus}
        isAuthenticated={isAuthenticated}
        showIcon={false} // Keep icons disabled for cleaner Following list UI
      />
    );
  }, [memoizedCloseDrawer, state.followStatusMap, dispatch, isAuthenticated]);

  // Stable Footer component - extracted to prevent re-creation
  const FooterComponent = useMemo(() => {
    const footer = virtualizationHook.footerComponent;
    if (footer?.type === 'loading') {
      const LoadingFooter = () => (
        <div className="py-4 text-center flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      );
      LoadingFooter.displayName = 'FollowingListLoadingFooter';
      return LoadingFooter;
    }
    
    return undefined;
  }, [virtualizationHook.footerComponent]);

  // Stable EmptyPlaceholder component
  const EmptyPlaceholderComponent = useMemo(() => {
    const EmptyPlaceholder = () => (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-muted-foreground">No items to display</span>
      </div>
    );
    EmptyPlaceholder.displayName = 'FollowingListEmptyPlaceholder';
    return EmptyPlaceholder;
  }, []);

  // Stable components object for Virtuoso
  const virtuosoComponents = useMemo(() => {
    const components: any = {
      EmptyPlaceholder: EmptyPlaceholderComponent,
    };
    
    if (FooterComponent) {
      components.Footer = FooterComponent;
    }
    
    return components;
  }, [FooterComponent, EmptyPlaceholderComponent]);

  return (
    <FollowingListErrorBoundary
      enableRecovery={true}
      maxRetries={3}
      onError={(error, errorInfo) => {
        // console.error('FollowingList Error:', error, errorInfo);
      }}
    >
      <Drawer open={state.isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button
            variant="link" 
            className="p-0 h-auto text-sm flex items-center gap-1 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none hover:no-underline text-muted-foreground font-medium transition-colors duration-200 hover:text-foreground"
            aria-label={triggerAriaLabel}
          >
            <span className="leading-none">{computedValues.followingCount}</span>
            <span className="leading-none">Following</span>
          </Button>
        </DrawerTrigger>
        
        <DrawerContent 
          className="h-[75vh] flex flex-col focus:outline-none w-full max-w-[550px] mx-auto"
          aria-label="Following list"
        >
          <DrawerHeader className="flex-shrink-0 border-b">
            <DrawerTitle className="text-base font-extrabold tracking-tight text-center flex items-center justify-center gap-2">
              Following
            </DrawerTitle>
          </DrawerHeader>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden" role="main">
            {computedValues.shouldShowLoadingSpinner ? (
              <FollowingListDrawerSkeleton count={6} />
            ) : computedValues.shouldShowErrorState ? (
              <FollowingListEmptyState
                variant="error"
                onRetry={handleRefresh}
                className="h-full"
              />
            ) : computedValues.shouldShowEmptyState ? (
              <FollowingListEmptyState
                variant="default"
                username={username}
                isOwnProfile={true} // You might want to determine this based on current user
                onExplore={() => {
                  // Navigate to newsletters page
                  router.push('/newsletters');
                }}
                className="h-full"
              />
            ) : computedValues.shouldShowVirtualizedList ? (
              <Virtuoso
                data={state.followingItems}
                itemContent={itemContent}
                components={virtuosoComponents}
                endReached={virtualizationHook.handleEndReached}
                overscan={5}
                fixedItemHeight={80}
                increaseViewportBy={{ top: 200, bottom: 200 }}
                style={{ height: '100%' }}
                aria-label="Following list"
                role="feed"
                aria-busy={state.isLoading}
                aria-live="polite"
              />
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </FollowingListErrorBoundary>
  );
}