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
import { Loader2, Users } from "lucide-react";
import type {
  FriendsListProps,
  FriendsListState,
  FriendsListAction,
  FriendsListFriendWithProfile,
  FriendsListInitialData,
  ProfileSocialData,
  ViewerFriendshipStatus,
  BatchFriendshipStatusResponse,
} from "@/lib/types";
import { transformBatchFriendshipStatusToRecord } from "@/lib/types";
import { Id } from "@/convex/_generated/dataModel";
import { useFriendsListData } from '@/hooks/useFriendsListData';
import { useFriendsListActions } from '@/hooks/useFriendsListActions';
import { Virtuoso } from 'react-virtuoso';
import { useFriendsListVirtualization } from '@/hooks/useFriendsListVirtualization';
import { MemoizedVirtualizedFriendItem } from '@/components/profile/VirtualizedFriendItem';
import FriendsListErrorBoundary, { MinimalFriendsListErrorFallback } from './FriendsListErrorBoundary';
import { convertProfileSocialDataToFriendsListData } from "@/lib/types";
import { DrawerLoadingSkeleton } from './FriendsListSkeleton';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// FriendsEmptyState component
function FriendsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 relative">
      {/* Background subtle pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute top-8 left-8 w-2 h-2 bg-foreground rounded-full"></div>
        <div className="absolute top-16 right-12 w-1 h-1 bg-foreground rounded-full"></div>
        <div className="absolute bottom-12 left-16 w-1.5 h-1.5 bg-foreground rounded-full"></div>
        <div className="absolute bottom-8 right-8 w-1 h-1 bg-foreground rounded-full"></div>
      </div>

      {/* Icon cluster */}
      <div className="relative mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-muted to-muted/60 rounded-2xl flex items-center justify-center border border-border shadow-lg">
          <Users className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
        </div>
      </div>

      {/* Text content */}
      <div className="text-center space-y-2">
        <h3 className="text-foreground font-medium text-base">No friends yet</h3>
        <p className="text-muted-foreground text-sm max-w-[200px] leading-relaxed">
          Connect with people and start building your network
        </p>
      </div>
    </div>
  )
}

// Create initial state from props
const createInitialState = (
  initialCount: number,
  initialFriends?: ProfileSocialData
): FriendsListState => {
  // Don't initialize with data immediately - let the drawer opening trigger loading
  // This ensures the skeleton shows even when we have initial data
  
  return {
    isOpen: false,
    isLoading: false,
    friends: [], // Always start empty to show skeleton
    count: initialCount,
    viewerFriendshipStatuses: {}, // Initialize empty viewer statuses
    cursor: null, // Will be set when data loads
    hasMore: false, // Will be set when data loads
    error: null,
    lastFetchTime: null,
    // Always start as not initialized to show skeleton on first open
    isInitialized: false,
  };
};

// Reducer for friends list state management
const friendsListReducer = (state: FriendsListState, action: FriendsListAction): FriendsListState => {
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
      // If status is null (friendship deleted), remove the friend from the list
      if (action.payload.newStatus === null) {
        return {
          ...state,
          friends: state.friends.filter(friend => friend.friendship._id !== action.payload.friendshipId),
          count: Math.max(0, state.count - 1),
        };
      }
      // Otherwise, update the status
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
    
    case 'SET_VIEWER_FRIENDSHIP_STATUSES':

      return {
        ...state,
        viewerFriendshipStatuses: action.payload,
      };
    
    case 'UPDATE_VIEWER_FRIENDSHIP_STATUS':
      return {
        ...state,
        viewerFriendshipStatuses: {
          ...state.viewerFriendshipStatuses,
          [action.payload.userId]: action.payload.status,
        },
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
  const virtualizationHook = useFriendsListVirtualization({
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
  
  // Batch query for viewer's friendship status with all friends
  const friendUserIds = useMemo(() => 
    state.friends.map(friend => friend.profile.userId), 
    [state.friends]
  );
  
  const queryArgs = state.isInitialized && friendUserIds.length > 0 ? { 
    userIds: friendUserIds 
  } : "skip";
  

  
  const viewerFriendshipStatuses = useQuery(
    api.friends.getBatchFriendshipStatuses,
    queryArgs
  );
  
  // Update viewer friendship statuses when query returns
  useEffect(() => {
    if (viewerFriendshipStatuses && state.isInitialized) {
      // Transform BatchFriendshipStatusResponse to Record<string, ViewerFriendshipStatus>
      const statusesRecord = transformBatchFriendshipStatusToRecord(
        viewerFriendshipStatuses as BatchFriendshipStatusResponse
      );

      dispatch({
        type: 'SET_VIEWER_FRIENDSHIP_STATUSES',
        payload: statusesRecord,
      });
    }
  }, [viewerFriendshipStatuses, state.isInitialized, dispatch]);
  
  // Simple calculations - no memoization needed
  const friendCount = state.count;
  const hasError = !!friendsData.error;
  const isEmpty = !friendsData.isLoading && state.isInitialized && state.friends.length === 0;
  
  // Check if we have viewer friendship statuses for all friends
  const hasViewerStatuses = state.isInitialized && friendUserIds.length > 0 
    ? friendUserIds.every(userId => state.viewerFriendshipStatuses[userId] !== undefined)
    : true; // If no friends, we don't need statuses
  
  const shouldShowLoadingSpinner = (state.isLoading || friendsData.isLoading) && (!state.isInitialized || !hasViewerStatuses);
  const shouldShowErrorState = !!friendsData.error;
  const shouldShowEmptyState = !friendsData.isLoading && !state.isLoading && state.isInitialized && state.friends.length === 0 && hasViewerStatuses;
  const shouldShowVirtualizedList = state.isInitialized && state.friends.length > 0 && !friendsData.error && hasViewerStatuses;

  // Simple calculations - no memoization needed (React best practice)
  const accessibilityAnnouncement = friendCount === 0 
    ? "Friends list opened. No friends to display."
    : `Friends list opened. Showing ${friendCount} ${friendCount === 1 ? 'friend' : 'friends'}.`;
  
  const triggerAriaLabel = `View friends list. ${friendCount} ${friendCount === 1 ? 'friend' : 'friends'}`;
  
  // Handle drawer state changes with accessibility - memory safe
  const handleOpenChange = useCallback((open: boolean) => {
    dispatch({ type: open ? 'OPEN_DRAWER' : 'CLOSE_DRAWER' });
    
    if (open) {
      // Reset error state when opening
      if (friendsData.error) {
        friendsActions.clearError();
      }
      
      // Announce for screen readers with proper cleanup
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
      
      // Only announce in browser environment with proper error handling
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        announcementTimeoutRef.current = setTimeout(() => {
          try {
            const announcement = document.createElement('div');
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.className = 'sr-only';
            announcement.textContent = accessibilityAnnouncement;
            document.body.appendChild(announcement);
            
            // Safe cleanup with error handling
            setTimeout(() => {
              try {
                if (document.body.contains(announcement)) {
                  document.body.removeChild(announcement);
                }
              } catch (e) {
                // Silently handle cleanup errors
              }
            }, 1000);
          } catch (e) {
            // Silently handle DOM creation errors
          }
        }, 150);
      }
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

  // Handle friendship status changes - dispatch is stable, no memoization needed
  const handleFriendshipStatusChange = (friendshipId: Id<"friends">, newStatus: string) => {
    dispatch({
      type: 'UPDATE_FRIEND_STATUS',
      payload: { friendshipId, newStatus },
    });
  };
  
  // Handle viewer friendship status changes
  const handleViewerFriendshipStatusChange = (userId: Id<"users">, status: ViewerFriendshipStatus) => {
    dispatch({
      type: 'UPDATE_VIEWER_FRIENDSHIP_STATUS',
      payload: { userId, status },
    });
  };

  // Simple item renderer - dependencies are stable, no memoization needed
  const itemContent = (index: number, friend: FriendsListFriendWithProfile) => {
    // Add defensive check
    if (!friend) {
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

    // Get viewer's friendship status with this friend
    const viewerStatus = state.viewerFriendshipStatuses[friend.profile.userId];

    return (
      <MemoizedVirtualizedFriendItem
        key={friend.friendship._id}
        friend={friend}
        index={index}
        isFirst={index === 0}
        isLast={index === state.friends.length - 1}
        onFriendshipStatusChange={handleFriendshipStatusChange}
        viewerFriendshipStatus={viewerStatus}
        onViewerFriendshipStatusChange={handleViewerFriendshipStatusChange}
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
    <div className="h-full min-h-[400px] flex items-center justify-center">
      <FriendsEmptyState />
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

  // Simple conditional rendering - no memoization needed
  const ErrorDisplay = !shouldShowErrorState ? null : (
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

  // Simple conditional rendering - no memoization needed
  let drawerContent;
  if (shouldShowLoadingSpinner) {
    drawerContent = <DrawerLoadingSkeleton />;
  } else if (shouldShowErrorState) {
    drawerContent = ErrorDisplay;
  } else if (shouldShowEmptyState) {
    drawerContent = (
      <div className="h-full min-h-[400px] flex items-center justify-center">
        <FriendsEmptyState />
      </div>
    );
  } else if (shouldShowVirtualizedList) {
    drawerContent = (
      <Virtuoso
        data={state.friends}
        itemContent={itemContent}
        components={virtuosoComponents}
        endReached={virtualizationHook.handleEndReached}
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
  } else {
    // Fallback to skeleton if none of the conditions are met (prevents flash of empty state)
    drawerContent = <DrawerLoadingSkeleton />;
  }

  return (
    <FriendsListErrorBoundary fallback={MinimalFriendsListErrorFallback}>
      <Drawer open={state.isOpen} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button
            variant="link" 
            className="p-0 h-auto text-sm flex items-center gap-1 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none hover:no-underline text-muted-foreground font-medium transition-colors duration-200 hover:text-foreground"
            aria-label={triggerAriaLabel}
          >
            <span className="leading-none">{friendCount}</span>
            <span className="leading-none">{friendCount === 1 ? 'Friend' : 'Friends'}</span>
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