"use client";

import { useReducer, useMemo, useCallback, useRef, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { useConvexAuth } from "convex/react";
import { useSidebar } from "@/components/ui/sidebar-context";
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
  FollowersListState,
  FollowersListAction,
  FollowersListUserData,
} from "@/lib/types";
import { useFollowersListData } from "@/hooks/useFollowersListData";
import { useFollowersListActions } from "@/hooks/useFollowersListActions";
import { useFollowersListVirtualization } from "@/hooks/useFollowersListVirtualization";
import { MemoizedVirtualizedFollowerItem } from "@/components/profile/VirtualizedFollowerItem";
import { FollowersListErrorBoundary } from "@/components/profile/FollowersListErrorBoundary";
import { DrawerLoadingSkeleton } from "@/components/profile/FriendsListSkeleton";
import { FollowersListEmptyState } from "@/components/profile/FollowersListEmptyState";

// Create initial state from props
const createInitialState = (initialCount: number = 0): FollowersListState => {
  // Don't initialize with data immediately - let the drawer opening trigger loading
  // This ensures the skeleton shows even when we have initial data
  
  return {
    isOpen: false,
    isLoading: false,
    followers: [], // Always start empty to show skeleton
    count: initialCount,
    cursor: null, // Will be set when data loads
    hasMore: false, // Will be set when data loads
    friendshipStates: {},
    error: null,
    lastFetchTime: null,
    // Always start as not initialized to show skeleton on first open
    isInitialized: false,
  };
};

// Reducer for followers list state management
const followersListReducer = (state: FollowersListState, action: FollowersListAction): FollowersListState => {
  switch (action.type) {
    case 'OPEN_DRAWER':
      return { 
        ...state, 
        isOpen: true,
        // Set loading state if not already initialized to show skeleton
        isLoading: !state.isInitialized ? true : state.isLoading
      };
    
    case 'CLOSE_DRAWER':
      return { ...state, isOpen: false };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: action.payload ? null : state.error };
    
    case 'SET_COUNT':
      return { ...state, count: action.payload };
    
    case 'INITIALIZE_FOLLOWERS':
      return {
        ...state,
        followers: action.payload.followers,
        cursor: action.payload.cursor,
        hasMore: action.payload.hasMore,
        friendshipStates: action.payload.friendshipStates || {},
        isInitialized: true,
        lastFetchTime: Date.now(),
        error: null,
      };
    
    case 'LOAD_MORE_START':
      return { ...state, isLoading: true, error: null };
    
    case 'LOAD_MORE_SUCCESS':
      return {
        ...state,
        followers: [...state.followers, ...action.payload.followers],
        cursor: action.payload.cursor,
        hasMore: action.payload.hasMore,
        friendshipStates: { ...state.friendshipStates, ...(action.payload.friendshipStates || {}) },
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
    
    case 'UPDATE_FRIEND_STATUS':
      return {
        ...state,
        // Update friendship state in the map
        friendshipStates: {
          ...state.friendshipStates,
          [action.payload.userId.toString()]: action.payload.friendshipStatus
        }
      };
    
    case 'UPDATE_FRIENDSHIP_STATE':
      return {
        ...state,
        friendshipStates: {
          ...state.friendshipStates,
          [action.payload.userId.toString()]: action.payload.friendshipStatus
        }
      };
    
    case 'RESET_STATE':
      return createInitialState(state.count);
    
    default:
      return state;
  }
};

interface FollowerCountProps {
  followerCount: number;
  postId: Id<"posts">;
  totalEntries?: number | null;
  mediaType?: string;
}

export function FollowerCount({ 
  followerCount, 
  postId, 
  totalEntries, 
  mediaType 
}: FollowerCountProps) {
  // Authentication state - use sidebar context to eliminate duplicate users:viewer query
  const { isAuthenticated } = useSidebar();
  
  // State management with useReducer
  const [state, dispatch] = useReducer(followersListReducer, createInitialState(followerCount));
  
  // Ref for cleanup of accessibility announcement timeout
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Data hook - handles all data fetching and management
  const dataHook = useFollowersListData({
    postId,
    state,
    dispatch,
  });

  // Actions hook - handles user interactions with error handling
  const actionsHook = useFollowersListActions({
    state,
    dispatch,
    loadMoreFollowers: dataHook.loadMoreFollowers,
    refreshFollowers: dataHook.refreshFollowers,
  });

  // Cleanup function for component unmount
  const cleanup = useCallback(() => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
      announcementTimeoutRef.current = null;
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  // Virtualization hook - handles large list performance
  const virtualizationHook = useFollowersListVirtualization({
    state,
    dispatch,
    loadMoreFollowers: actionsHook.handleLoadMore,
    config: {
      itemHeight: 80,
      overscan: 5,
      loadMoreThreshold: 3,
      debounceMs: 150,
    },
  });

  // Get content label based on media type
  const getContentLabel = useCallback(() => {
    switch (mediaType?.toLowerCase()) {
      case 'podcast':
        return totalEntries === 1 ? 'Episode' : 'Episodes';
      case 'newsletter':
        return totalEntries === 1 ? 'Newsletter' : 'Newsletters';
      default:
        return totalEntries === 1 ? 'Post' : 'Posts';
    }
  }, [mediaType, totalEntries]);

  // Simple calculations - no memoization needed
  const currentFollowerCount = state.count || followerCount;
  const hasError = !!dataHook.error;
  const isEmpty = !dataHook.isLoading && state.isInitialized && dataHook.followers.length === 0;
  const shouldShowLoadingSpinner = (state.isLoading || dataHook.isLoading) && !state.isInitialized;
  const shouldShowErrorState = !!dataHook.error;
  const shouldShowEmptyState = !dataHook.isLoading && !state.isLoading && state.isInitialized && dataHook.followers.length === 0;
  const shouldShowVirtualizedList = state.isInitialized && dataHook.followers.length > 0 && !dataHook.error;

  // Simple calculations - no memoization needed (React best practice)
  const accessibilityAnnouncement = currentFollowerCount === 0 
    ? "Followers list opened. No followers yet."
    : `Followers list opened. Showing ${currentFollowerCount} ${currentFollowerCount === 1 ? 'follower' : 'followers'}.`;

  const triggerAriaLabel = `View followers. ${currentFollowerCount} ${currentFollowerCount === 1 ? 'follower' : 'followers'}`;

  // Handle drawer state changes with accessibility
  const handleOpenChange = useCallback((open: boolean) => {
    dispatch({ type: open ? 'OPEN_DRAWER' : 'CLOSE_DRAWER' });
    
    if (open) {
      if (dataHook.error) {
        dataHook.resetError();
      }
      
      // Load followers if not already loaded
      if (!state.isInitialized) {
        dataHook.loadFollowers();
      }
      
      // Announce to screen readers
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
      
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        announcementTimeoutRef.current = setTimeout(() => {
          try {
            const announcer = document.createElement('div');
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.className = 'sr-only';
            announcer.textContent = accessibilityAnnouncement;
            document.body.appendChild(announcer);
            
            // Safe cleanup with error handling
            setTimeout(() => {
              try {
                if (document.body.contains(announcer)) {
                  document.body.removeChild(announcer);
                }
              } catch (e) {
                // Silently handle cleanup errors
              }
              announcementTimeoutRef.current = null;
            }, 1000);
          } catch (e) {
            // Silently handle DOM creation errors
            announcementTimeoutRef.current = null;
          }
        }, 150);
      }
    }
  }, [dataHook, accessibilityAnnouncement, state.isInitialized]);

  // Simple item renderer - dependencies are stable, no memoization needed
  const itemContent = (index: number, follower: FollowersListUserData) => {
    // Get friendship status from the optimized query data
    const friendshipStatus = state.friendshipStates[follower.userId.toString()] || null;
    
    return (
      <MemoizedVirtualizedFollowerItem
        key={follower.userId || `follower-${index}`}
        follower={follower}
        index={index}
        isFirst={index === 0}
        isLast={index === state.followers.length - 1}
        isAuthenticated={isAuthenticated}
        initialFriendshipStatus={friendshipStatus}
        onFriendshipStatusChange={dataHook.updateFriendshipStatus}
      />
    );
  };

  // Simple components - no memoization needed for basic JSX
  const FooterComponent = (() => {
    const footer = virtualizationHook.footerComponent;
    if (footer?.type === 'loading') {
      const LoadingFooter = () => (
        <div className="py-4 text-center flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      );
      LoadingFooter.displayName = 'LoadingFooter';
      return LoadingFooter;
    }
    return undefined;
  })();

  const EmptyPlaceholderComponent = () => (
    <div className="flex items-center justify-center py-8">
      <span className="text-sm text-muted-foreground">No followers to display</span>
    </div>
  );

  // Only memoize the components object since it's passed to Virtuoso
  const virtuosoComponents = useMemo(() => {
    const components: Record<string, React.ComponentType> = {
      EmptyPlaceholder: EmptyPlaceholderComponent,
    };
    
    if (FooterComponent) {
      components.Footer = FooterComponent;
    }
    
    return components;
  }, [FooterComponent]);

  return (
    <FollowersListErrorBoundary
      enableRecovery={true}
      maxRetries={3}
      onError={(error, errorInfo) => {
        // Error handled by error boundary
      }}
    >
      <div className="max-w-4xl text-sm flex items-center gap-4">
      <Drawer open={state.isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center h-auto p-0 hover:bg-transparent group focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
            aria-label={triggerAriaLabel}
          >
            <span className="leading-none font-medium mr-[-3px]">{currentFollowerCount}</span>{' '}
            <span className="leading-none font-medium">{currentFollowerCount === 1 ? 'Follower' : 'Followers'}</span>
          </Button>
        </DrawerTrigger>
        
        <DrawerContent 
          className="h-[75vh] flex flex-col focus:outline-none w-full max-w-[550px] mx-auto"
          aria-label="Followers list"
        >
          <DrawerHeader className="flex-shrink-0 border-b">
            <DrawerTitle className="text-base font-extrabold tracking-tight text-center flex items-center justify-center gap-2">
              Followers
            </DrawerTitle>
          </DrawerHeader>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden" role="main">
            {shouldShowLoadingSpinner ? (
              <DrawerLoadingSkeleton />
            ) : shouldShowErrorState ? (
              <FollowersListEmptyState
                variant="error"
                onRetry={() => dataHook.refreshFollowers()}
                className="h-full"
              />
            ) : shouldShowEmptyState ? (
              <FollowersListEmptyState
                variant="default"
                className="h-full"
              />
            ) : shouldShowVirtualizedList ? (
              <Virtuoso
                data={state.followers}
                itemContent={itemContent}
                components={virtuosoComponents}
                endReached={virtualizationHook.virtuosoProps.endReached}
                overscan={5}
                fixedItemHeight={80}
                increaseViewportBy={{ top: 200, bottom: 200 }}
                style={{ height: '100%' }}
                aria-label="Followers list"
                role="feed"
                aria-busy={state.isLoading}
                aria-live="polite"
              />
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* Total entries display (unchanged functionality) */}
      {totalEntries ? (
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="flex items-center h-auto p-0 hover:bg-transparent group focus-visible:ring-0 focus:outline-none">
            <span className="leading-none font-medium mr-[-3px]">{totalEntries}</span>{' '}
            <span className="leading-none font-medium">{getContentLabel()}</span>
          </Button>
        </div>
      ) : null}
      </div>
    </FollowersListErrorBoundary>
  );
} 