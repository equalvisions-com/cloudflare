"use client";

import { useReducer, useMemo, useCallback, useRef, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { useConvexAuth } from "convex/react";
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
import { FollowersListDrawerSkeleton } from "@/components/profile/FollowersListSkeleton";
import { FollowersListEmptyState } from "@/components/profile/FollowersListEmptyState";

// Create initial state
const createInitialState = (initialCount: number = 0): FollowersListState => ({
  isOpen: false,
  isLoading: false,
  followers: [],
  count: initialCount,
  cursor: null,
  hasMore: false,
  error: null,
  lastFetchTime: null,
  isInitialized: false,
});

// Reducer for followers list state management
const followersListReducer = (state: FollowersListState, action: FollowersListAction): FollowersListState => {
  switch (action.type) {
    case 'OPEN_DRAWER':
      return { ...state, isOpen: true };
    
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
  // Authentication state
  const { isAuthenticated } = useConvexAuth();
  
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

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

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

  // Memoized computed values
  const computedValues = useMemo(() => ({
    followerCount: state.count || followerCount,
    hasError: !!dataHook.error,
    isEmpty: !dataHook.isLoading && state.isInitialized && dataHook.followers.length === 0,
    isInitialLoading: dataHook.isLoading && !state.isInitialized,
    shouldShowLoadingSpinner: dataHook.isLoading && !state.isInitialized,
    shouldShowErrorState: !!dataHook.error,
    shouldShowEmptyState: !dataHook.isLoading && state.isInitialized && dataHook.followers.length === 0,
    shouldShowVirtualizedList: state.isInitialized && dataHook.followers.length > 0 && !dataHook.error,
  }), [
    dataHook.followers.length, 
    dataHook.isLoading,
    dataHook.error,
    state.count,
    followerCount,
    state.isInitialized
  ]);

  // Memoized accessibility announcement
  const accessibilityAnnouncement = useMemo(() => {
    return computedValues.followerCount === 0 
      ? "Followers list opened. No followers yet."
      : `Followers list opened. Showing ${computedValues.followerCount} ${computedValues.followerCount === 1 ? 'follower' : 'followers'}.`;
  }, [computedValues.followerCount]);

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
        const announcer = document.createElement('div');
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        announcer.textContent = accessibilityAnnouncement;
        document.body.appendChild(announcer);
        
        announcementTimeoutRef.current = setTimeout(() => {
          if (document.body.contains(announcer)) {
            document.body.removeChild(announcer);
          }
          announcementTimeoutRef.current = null;
        }, 1000);
      }
    }
  }, [dataHook, accessibilityAnnouncement, state.isInitialized]);

  // Memoized aria label for trigger button
  const triggerAriaLabel = useMemo(() => 
    `View followers. ${computedValues.followerCount} ${computedValues.followerCount === 1 ? 'follower' : 'followers'}`,
    [computedValues.followerCount]
  );

  // Virtualized item renderer
  const itemContent = useCallback((index: number, follower: FollowersListUserData) => {
    if (!follower) {
      return (
        <div 
          key={`error-${index}`}
          className="flex items-center justify-center p-4 text-muted-foreground"
          role="alert"
          aria-label="Invalid follower data"
        >
          <span className="text-sm">Invalid follower data</span>
        </div>
      );
    }

    return (
      <MemoizedVirtualizedFollowerItem
        key={`${follower.userId}-${index}`}
        follower={follower}
        index={index}
        isFirst={index === 0}
        isAuthenticated={isAuthenticated}
      />
    );
  }, [isAuthenticated]);

  // Footer component for virtualized list
  const footerComponent = useMemo(() => {
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
  }, [virtualizationHook.footerComponent]);

  // Empty placeholder component for Virtuoso
  const emptyPlaceholder = useMemo(() => {
    const EmptyPlaceholder = () => (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-muted-foreground">No followers to display</span>
      </div>
    );
    EmptyPlaceholder.displayName = 'EmptyPlaceholder';
    return EmptyPlaceholder;
  }, []);

  // Virtuoso components configuration
  const virtuosoComponents = useMemo(() => {
    const components: any = {
      EmptyPlaceholder: emptyPlaceholder,
    };
    
    if (footerComponent) {
      components.Footer = footerComponent;
    }
    
    return components;
  }, [footerComponent, emptyPlaceholder]);

  return (
    <FollowersListErrorBoundary
      enableRecovery={true}
      maxRetries={3}
      onError={(error, errorInfo) => {
        // Log error in development
        if (process.env.NODE_ENV === 'development') {
          console.error('FollowerCount Error:', error, errorInfo);
        }
      }}
    >
      <div className="max-w-4xl text-sm flex items-center gap-4">
      <Drawer open={state.isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button 
            variant="ghost" 
            className="flex items-center h-auto p-0 hover:bg-transparent group focus-visible:ring-0 focus:outline-none"
            aria-label={triggerAriaLabel}
          >
            <span className="leading-none font-medium mr-[-3px]">{computedValues.followerCount}</span>{' '}
            <span className="leading-none font-medium">{computedValues.followerCount === 1 ? 'Follower' : 'Followers'}</span>
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
            {computedValues.shouldShowLoadingSpinner ? (
              <FollowersListDrawerSkeleton count={6} />
            ) : computedValues.shouldShowErrorState ? (
              <FollowersListEmptyState
                variant="error"
                onRetry={() => dataHook.refreshFollowers()}
                className="h-full"
              />
            ) : computedValues.shouldShowEmptyState ? (
              <FollowersListEmptyState
                variant="default"
                className="h-full"
              />
            ) : computedValues.shouldShowVirtualizedList ? (
              <Virtuoso
                {...virtualizationHook.virtuosoProps}
                itemContent={itemContent}
                components={virtuosoComponents}
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