"use client";

import { useReducer, useMemo, useCallback, useRef, useEffect } from "react";
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
  
  // Three-hook architecture pattern (matching FollowerCount and FollowingList)
  const friendsData = useFriendsListData({
    username,
    state,
    dispatch,
    initialFriends,
  });
  
  const friendsActions = useFriendsListActions({
    state,
    dispatch,
    loadMoreFriends: friendsData.loadMoreFriends,
    refreshFriends: friendsData.refreshFriends,
  });
  
  // Virtualization hook for performance
  const virtualization = useFriendsListVirtualization({
    state,
    dispatch,
    loadMoreFriends: friendsActions.handleLoadMore,
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
  
  // Memoized aria label for trigger button
  const triggerAriaLabel = useMemo(() => 
    `View friends list. ${computedValues.friendCount} ${computedValues.friendCount === 1 ? 'friend' : 'friends'}`,
    [computedValues.friendCount]
  );
  
  // Handle drawer state changes with accessibility - optimized
  const handleOpenChange = useCallback((open: boolean) => {
    dispatch({ type: open ? 'OPEN_DRAWER' : 'CLOSE_DRAWER' });
    
    if (open) {
      // Reset error state when opening
      if (friendsData.error) {
        friendsActions.clearError();
      }
      
      // Announce for screen readers with debouncing
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
      
      announcementTimeoutRef.current = setTimeout(() => {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = accessibilityAnnouncement;
        document.body.appendChild(announcement);
        
        setTimeout(() => document.body.removeChild(announcement), 1000);
      }, 150);
    }
  }, [friendsData.error, friendsActions.clearError, accessibilityAnnouncement]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  // Stable item renderer for Virtuoso - fixed dependencies
  const itemRenderer = useCallback((index: number) => {
    const friend = state.friends[index];
    if (!friend) return null;

    return (
      <MemoizedVirtualizedFriendItem
        key={friend.friendship._id}
        friend={friend}
        index={index}
        isFirst={index === 0}
        isLast={index === state.friends.length - 1}
      />
    );
  }, [state.friends]);

  // Stable Footer component - extracted to prevent re-creation
  const FooterComponent = useMemo(() => {
    const Footer = () => {
      if (!state.hasMore && !state.isLoading) return null;
      
      return (
        <div className="p-4 text-center">
          {state.isLoading ? (
            <LoadingMoreSkeleton />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={friendsActions.handleLoadMore}
              disabled={state.isLoading}
              className="text-muted-foreground hover:text-foreground"
            >
              Load more friends
            </Button>
          )}
        </div>
      );
    };
    Footer.displayName = 'FriendsListFooter';
    return Footer;
  }, [state.hasMore, state.isLoading, friendsActions.handleLoadMore]);

  // Stable EmptyPlaceholder component
  const EmptyPlaceholderComponent = useMemo(() => {
    const EmptyPlaceholder = () => (
      <FriendsListEmptyState 
        type="no-friends"
        username={username}
        onRefresh={friendsActions.handleRefresh}
        isLoading={state.isLoading}
      />
    );
    EmptyPlaceholder.displayName = 'FriendsListEmptyPlaceholder';
    return EmptyPlaceholder;
  }, [username, friendsActions.handleRefresh, state.isLoading]);

  // Stable components object for Virtuoso
  const virtuosoComponents = useMemo(() => ({
    Footer: FooterComponent,
    EmptyPlaceholder: EmptyPlaceholderComponent,
  }), [FooterComponent, EmptyPlaceholderComponent]);

  // Memoized error display component
  const ErrorDisplay = useMemo(() => {
    if (!computedValues.shouldShowErrorState) return null;

    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-sm text-muted-foreground">
          {friendsData.error}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={friendsActions.clearError}
          >
            Dismiss
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={friendsActions.handleRefresh}
            disabled={state.isLoading}
          >
            {state.isLoading ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      </div>
    );
  }, [
    computedValues.shouldShowErrorState,
    friendsData.error,
    friendsActions.clearError,
    friendsActions.handleRefresh,
    state.isLoading,
  ]);

  // Main drawer content - simplified dependencies
  const drawerContent = useMemo(() => {
    if (computedValues.shouldShowLoadingSpinner) {
      return <DrawerLoadingSkeleton />;
    }

    if (computedValues.shouldShowErrorState) {
      return ErrorDisplay;
    }

    if (computedValues.shouldShowEmptyState) {
      return <EmptyPlaceholderComponent />;
    }

    if (computedValues.shouldShowVirtualizedList) {
      return (
        <Virtuoso
          data={state.friends}
          itemContent={itemRenderer}
          components={virtuosoComponents}
          endReached={virtualization.handleEndReached}
          overscan={5}
          fixedItemHeight={80}
          increaseViewportBy={{ top: 200, bottom: 200 }}
          style={{ height: '100%' }}
          aria-label="Friends list"
          role="feed"
          aria-busy={state.isLoading}
          aria-live="polite"
        />
      );
    }

    return <EmptyPlaceholderComponent />;
  }, [
    computedValues.shouldShowLoadingSpinner,
    computedValues.shouldShowErrorState,
    computedValues.shouldShowEmptyState,
    computedValues.shouldShowVirtualizedList,
    state.friends,
    state.isLoading,
    ErrorDisplay,
    EmptyPlaceholderComponent,
    itemRenderer,
    virtuosoComponents,
    virtualization.handleEndReached,
  ]);

  return (
    <FriendsListErrorBoundary fallback={MinimalFriendsListErrorFallback}>
      <Drawer open={state.isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button
            variant="link" 
            className="p-0 h-auto text-sm flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:no-underline text-muted-foreground font-medium transition-colors duration-200 hover:text-foreground"
            aria-label={triggerAriaLabel}
          >
            <span className="leading-none">{computedValues.friendCount}</span>
            <span className="leading-none">{computedValues.friendCount === 1 ? 'Friend' : 'Friends'}</span>
          </Button>
        </DrawerTrigger>
        
        <DrawerContent 
          className="h-[75vh] flex flex-col focus:outline-none w-full max-w-[550px] mx-auto"
          aria-label="Friends list"
        >
          <DrawerHeader className="flex-shrink-0 border-b">
            <DrawerTitle className="text-base font-extrabold tracking-tight text-center flex items-center justify-center gap-2">
              Friends
            </DrawerTitle>
          </DrawerHeader>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden" role="main">
            {drawerContent}
          </div>
        </DrawerContent>
      </Drawer>
    </FriendsListErrorBoundary>
  );
} 