"use client";

import { useReducer, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type {
  FriendsListProps,
  FriendsListState,
  FriendsListAction,
  FriendsListFriendWithProfile,
  FriendsListInitialData,
  FriendsListAPIResponse,
  ProfileSocialData,
} from "@/lib/types";
import { Id } from "@/convex/_generated/dataModel";
import { useFriendsListData } from '@/hooks/useFriendsListData';
import { useFriendsListActions } from '@/hooks/useFriendsListActions';
import { Virtuoso } from 'react-virtuoso';
import { useFriendsListVirtualization } from '@/hooks/useFriendsListVirtualization';
import { MemoizedVirtualizedFriendItem } from '@/components/profile/VirtualizedFriendItem';
import FriendsListErrorBoundary, { MinimalFriendsListErrorFallback } from './FriendsListErrorBoundary';
import { convertProfileSocialDataToFriendsListData } from "@/lib/types";
import { DrawerLoadingSkeleton, LoadingMoreSkeleton } from './FriendsListSkeleton';
import { FriendsListEmptyState } from './FriendsListEmptyState';

// Create initial state from props
const createInitialState = (
  initialCount: number,
  initialFriends?: ProfileSocialData
): FriendsListState => {
  let convertedFriends: FriendsListInitialData | undefined;
  
  if (initialFriends) {
    convertedFriends = convertProfileSocialDataToFriendsListData(initialFriends);
  }
  
  return {
    isOpen: false,
    isLoading: false,
    friends: convertedFriends?.friends.filter((f): f is FriendsListFriendWithProfile => f !== null) || [],
    count: initialCount,
    cursor: convertedFriends?.cursor || null,
    hasMore: convertedFriends?.hasMore ?? false,
    error: null,
    lastFetchTime: null,
    isInitialized: !!convertedFriends,
  };
};

// Reducer for friends list state management
const friendsListReducer = (state: FriendsListState, action: FriendsListAction): FriendsListState => {
  switch (action.type) {
    case 'OPEN_DRAWER':
      return { ...state, isOpen: true };
    
    case 'CLOSE_DRAWER':
      return { ...state, isOpen: false };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: action.payload ? null : state.error };
    
    case 'SET_COUNT':
      return { ...state, count: action.payload };
    
    case 'INITIALIZE_FRIENDS':
      return {
        ...state,
        friends: action.payload.friends,
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
        friends: [...state.friends, ...action.payload.friends],
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
      return createInitialState(state.count, undefined);
    
    case 'UPDATE_FRIEND_STATUS':
      return {
        ...state,
        friends: state.friends.map(friend =>
          friend.friendship._id === action.payload.friendshipId
            ? { ...friend, friendship: { ...friend.friendship, status: action.payload.newStatus } }
            : friend
        ),
      };
    
    case 'REMOVE_FRIEND':
      return {
        ...state,
        friends: state.friends.filter(friend => friend.friendship._id !== action.payload),
        count: Math.max(0, state.count - 1),
      };
    
    default:
      return state;
  }
};

export function FriendsList({ username, initialCount = 0, initialFriends }: FriendsListProps) {
  // State management with useReducer
  const [state, dispatch] = useReducer(friendsListReducer, createInitialState(initialCount, initialFriends));
  
  // Ref for cleanup of accessibility announcement timeout
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Custom hooks for business logic
  const friendsData = useFriendsListData({
    username,
    state,
    dispatch,
    initialFriends,
  });
  
  const friendsActions = useFriendsListActions({
    dispatch,
    updateFriendStatus: friendsData.updateFriendStatus,
    removeFriend: friendsData.removeFriend,
  });
  
  // Virtualization hook for performance
  const virtualization = useFriendsListVirtualization({
    state,
    dispatch,
    loadMoreFriends: friendsData.loadMoreFriends,
    config: {
      itemHeight: 80,
      overscan: 5,
      loadMoreThreshold: 3,
      debounceMs: 300,
    },
  });
  
  // Memoized computed values
  const computedValues = useMemo(() => ({
    displayedFriends: virtualization.virtualizedFriends,
    friendCount: state.count,
    hasError: !!friendsData.error,
    isEmpty: !state.isLoading && state.isInitialized && state.friends.length === 0,
    isInitialLoading: state.isLoading && !state.isInitialized,
    shouldShowLoadingSpinner: state.isLoading && !state.isInitialized,
    shouldShowErrorState: !!friendsData.error,
    shouldShowEmptyState: !state.isLoading && state.isInitialized && state.friends.length === 0,
    shouldShowVirtualizedList: state.isInitialized && state.friends.length > 0 && !friendsData.error,
  }), [
    virtualization.virtualizedFriends,
    state.count,
    friendsData.error,
    state.isLoading,
    state.isInitialized,
    state.friends.length
  ]);

  // Memoized accessibility announcement
  const accessibilityAnnouncement = useMemo(() => {
    return computedValues.friendCount === 0 
      ? "Friends list opened. No friends to display."
      : `Friends list opened. Showing ${computedValues.friendCount} ${computedValues.friendCount === 1 ? 'friend' : 'friends'}.`;
  }, [computedValues.friendCount]);
  
  // Handle drawer state changes with accessibility - optimized
  const handleOpenChange = useCallback((open: boolean) => {
    dispatch({ type: open ? 'OPEN_DRAWER' : 'CLOSE_DRAWER' });
    if (open && friendsData.error) {
      friendsData.resetError();
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
  }, [friendsData, accessibilityAnnouncement]);
  
  // Handle load more with error handling
  const handleLoadMore = useCallback(async () => {
    try {
      await friendsData.loadMoreFriends();
    } catch (error) {
      friendsActions.handleError(
        error instanceof Error ? error : new Error('Load more failed')
      );
    }
  }, [friendsData, friendsActions]);
  
  // Handle refresh with error handling
  const handleRefresh = useCallback(async () => {
    try {
      await friendsData.refreshFriends();
    } catch (error) {
      friendsActions.handleError(
        error instanceof Error ? error : new Error('Refresh failed')
      );
    }
  }, [friendsData, friendsActions]);
  
  // Use the count query when the drawer is open to make sure we have the latest count
  const latestCount = useQuery(api.friends.getFriendCountByUsername, state.isOpen ? { 
    username,
    status: "accepted"
  } : "skip");
  
  // Cleanup function for component unmount
  const cleanup = useCallback(() => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
      announcementTimeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount and handle count updates
  useEffect(() => {
    // Update the count if it changes
    if (latestCount !== undefined && latestCount !== null) {
      dispatch({ type: 'SET_COUNT', payload: latestCount });
    }
    
    // Initialize friends list when drawer opens (moved from separate useEffect)
    if (state.isOpen && !state.isInitialized && initialFriends) {
      dispatch({
        type: 'INITIALIZE_FRIENDS',
        payload: {
          friends: initialFriends.friends.filter((f): f is FriendsListFriendWithProfile => f !== null),
          cursor: initialFriends.cursor,
          hasMore: initialFriends.hasMore,
        },
      });
    }
    
    // Return cleanup function
    return cleanup;
  }, [latestCount, state.isOpen, state.isInitialized, initialFriends, cleanup]);
  
  // Memoized aria label for trigger button
  const triggerAriaLabel = useMemo(() => 
    `View friends list. ${computedValues.friendCount} ${computedValues.friendCount === 1 ? 'friend' : 'friends'}`,
    [computedValues.friendCount]
  );

  // Memoized action handlers to prevent re-renders
  const memoizedHandleUnfriend = useCallback((friendshipId: Id<"friends">) => {
    return friendsActions.handleUnfriend(friendshipId);
  }, [friendsActions]);

  const memoizedHandleAcceptRequest = useCallback((friendshipId: Id<"friends">) => {
    return friendsActions.handleAcceptRequest(friendshipId);
  }, [friendsActions]);

  const memoizedHandleDeclineRequest = useCallback((friendshipId: Id<"friends">) => {
    return friendsActions.handleDeclineRequest(friendshipId);
  }, [friendsActions]);

  // Virtualized item renderer with enhanced error handling - optimized for performance
  const itemContent = useCallback((index: number, friend: FriendsListFriendWithProfile) => {
    // Add defensive check
    if (!friend) {
      // Invalid friend data - render error placeholder
      return (
        <div 
          key={`error-${index}`}
          className="flex items-center justify-center p-4 text-muted-foreground"
          role="alert"
          aria-label="Invalid friend data"
        >
          <span className="text-sm">Invalid friend data</span>
        </div>
      );
    }

    return (
      <MemoizedVirtualizedFriendItem
        key={`${friend.friendship._id}-${index}`}
        friend={friend}
        index={index}
        isFirst={index === 0}
        isLast={index === computedValues.displayedFriends.length - 1}
        onUnfriend={memoizedHandleUnfriend}
        onAcceptRequest={memoizedHandleAcceptRequest}
        onDeclineRequest={memoizedHandleDeclineRequest}
        isOperationPending={friendsActions.isOperationPending}
      />
    );
  }, [computedValues.displayedFriends.length, memoizedHandleUnfriend, memoizedHandleAcceptRequest, memoizedHandleDeclineRequest, friendsActions]);

  // Footer component for virtualized list - memoized to prevent re-renders
  const footerComponent = useMemo(() => {
    if (state.isLoading && state.friends.length > 0) {
      const LoadingFooter = () => <LoadingMoreSkeleton />;
      LoadingFooter.displayName = 'LoadingFooter';
      return LoadingFooter;
    }
    return undefined;
  }, [state.isLoading, state.friends.length]);

  // Empty placeholder component for Virtuoso
  const emptyPlaceholder = useMemo(() => {
    const EmptyPlaceholder = () => (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-muted-foreground">No friends to display</span>
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
    <FriendsListErrorBoundary
      fallback={MinimalFriendsListErrorFallback}
      onError={(error, errorInfo) => {
        // console.error('FriendsList Error Boundary:', { error, errorInfo });
      }}
      maxRetries={3}
      resetTimeoutMs={30000}
    >
      <Drawer open={state.isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button 
            variant="link" 
            className="p-0 h-auto text-sm flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:no-underline text-muted-foreground font-medium transition-colors duration-200 hover:text-foreground"
            aria-label={triggerAriaLabel}
          >
            <span className="leading-none">{computedValues.friendCount}</span>
            <span className="leading-none">{computedValues.friendCount === 1 ? "Friend" : "Friends"}</span>
          </Button>
        </DrawerTrigger>
        
        <DrawerContent 
          className="h-[75vh] flex flex-col focus:outline-none w-full max-w-[550px] mx-auto"
          aria-label="Friends list"
        >
          <DrawerHeader className="flex-shrink-0 border-b">
            <DrawerTitle className="text-base font-extrabold tracking-tight flex items-center justify-center gap-2">
              Friends
            </DrawerTitle>
          </DrawerHeader>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden" role="main">
            {computedValues.shouldShowLoadingSpinner ? (
              <DrawerLoadingSkeleton />
            ) : computedValues.shouldShowErrorState ? (
              <FriendsListEmptyState
                type="error"
                username={username}
                error={friendsData.error}
                onRetry={handleRefresh}
                isLoading={state.isLoading}
              />
            ) : computedValues.shouldShowEmptyState ? (
              <FriendsListEmptyState
                type="no-friends"
                username={username}
              />
            ) : computedValues.shouldShowVirtualizedList ? (
              <Virtuoso
                {...virtualization.virtuosoProps}
                itemContent={itemContent}
                components={virtuosoComponents}
                className="friends-list-virtuoso"
                style={{ height: '100%' }}
                aria-label="Friends list"
                role="feed"
                aria-busy={state.isLoading}
                aria-live="polite"
              />
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </FriendsListErrorBoundary>
  );
} 