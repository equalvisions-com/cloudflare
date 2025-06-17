import { useCallback, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { friendsListErrorHandler } from '@/lib/utils/friendsListErrorHandler';
import { convertProfileSocialDataToFriendsListData } from '@/lib/types';
import type {
  FriendsListState,
  FriendsListAction,
  FriendsListFriendWithProfile,
  FriendsListAPIResponse,
  FriendsListInitialData,
  UseFriendsListDataReturn,
  FriendsListErrorContext,
  ProfileSocialData,
} from '@/lib/types';

interface UseFriendsListDataProps {
  username: string;
  state: FriendsListState;
  dispatch: React.Dispatch<FriendsListAction>;
  initialFriends?: ProfileSocialData;
}

export const useFriendsListData = ({
  username,
  state,
  dispatch,
  initialFriends,
}: UseFriendsListDataProps): UseFriendsListDataReturn => {
  const { isOpen, isLoading, friends, cursor, hasMore, isInitialized } = state;
  
  // Ref to prevent multiple concurrent requests
  const loadingRef = useRef(false);
  
  // Get latest count when drawer is open
  const latestCount = useQuery(
    api.friends.getFriendCountByUsername,
    isOpen ? { username, status: 'accepted' } : 'skip'
  );
  
  // Update count when it changes
  useEffect(() => {
    if (latestCount !== undefined && latestCount !== null) {
      dispatch({ type: 'SET_COUNT', payload: latestCount });
    }
  }, [latestCount, dispatch]);
  
  // Initialize friends list when drawer opens
  useEffect(() => {
    if (isOpen && !isInitialized && initialFriends) {
      // Convert ProfileSocialData to FriendsListInitialData
      const convertedData = convertProfileSocialDataToFriendsListData(initialFriends);
      
      const filteredFriends = convertedData.friends.filter(
        (f): f is FriendsListFriendWithProfile => {
          if (!f) return false;
          if (!f.friendship || !f.friendship._id) return false;
          if (!f.profile) return false;
          return true;
        }
      );
      
      dispatch({
        type: 'INITIALIZE_FRIENDS',
        payload: {
          friends: filteredFriends,
          cursor: convertedData.cursor,
          hasMore: convertedData.hasMore,
        },
      });
    }
  }, [isOpen, isInitialized, initialFriends, dispatch]);
  
  // Load more friends function
  const loadMoreFriends = useCallback(async (): Promise<void> => {
    if (!hasMore || isLoading || !cursor || loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;
    dispatch({ type: 'LOAD_MORE_START' });
    
        try {
      const response = await fetch(
        `/api/friends?username=${encodeURIComponent(username)}&cursor=${encodeURIComponent(cursor)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: FriendsListAPIResponse = await response.json();
      
      const newFriends = result.friends.filter(
        (f): f is FriendsListFriendWithProfile => {
          if (!f) return false;
          if (!f.friendship || !f.friendship._id) return false;
          if (!f.profile) return false;
          return true;
        }
      );

      dispatch({
        type: 'LOAD_MORE_SUCCESS',
        payload: {
          friends: newFriends,
          cursor: result.cursor,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      const context: FriendsListErrorContext = {
        operation: 'loadMore',
        username,
        timestamp: Date.now(),
      };
      
      const enhancedError = await friendsListErrorHandler.handleError(
        error,
        context,
        loadMoreFriends
      );
      
      dispatch({
        type: 'LOAD_MORE_ERROR',
        payload: enhancedError.message,
      });
    } finally {
      loadingRef.current = false;
    }
  }, [hasMore, isLoading, cursor, username, dispatch]);
  
  // Refresh friends list
  const refreshFriends = useCallback(async (): Promise<void> => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    dispatch({ type: 'SET_LOADING', payload: true });
    
        try {
      // Reset to first page
      const response = await fetch(
        `/api/friends?username=${encodeURIComponent(username)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: FriendsListAPIResponse = await response.json();
      
      const newFriends = result.friends.filter(
        (f): f is FriendsListFriendWithProfile => {
          if (!f) return false;
          if (!f.friendship || !f.friendship._id) return false;
          if (!f.profile) return false;
          return true;
        }
      );

      dispatch({
        type: 'INITIALIZE_FRIENDS',
        payload: {
          friends: newFriends,
          cursor: result.cursor,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      const context: FriendsListErrorContext = {
        operation: 'refresh',
        username,
        timestamp: Date.now(),
      };
      
      const enhancedError = await friendsListErrorHandler.handleError(
        error,
        context,
        refreshFriends
      );
      
      dispatch({
        type: 'SET_ERROR',
        payload: enhancedError.message,
      });
    } finally {
      loadingRef.current = false;
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [username, dispatch]);
  
  // Update friend status (for optimistic updates)
  const updateFriendStatus = useCallback(
    (friendshipId: Id<"friends">, newStatus: string): void => {
      dispatch({
        type: 'UPDATE_FRIEND_STATUS',
        payload: { friendshipId, newStatus },
      });
    },
    [dispatch]
  );
  
  // Remove friend (for optimistic updates)
  const removeFriend = useCallback(
    (friendshipId: Id<"friends">): void => {
      dispatch({
        type: 'REMOVE_FRIEND',
        payload: friendshipId,
      });
    },
    [dispatch]
  );
  
  // Reset error
  const resetError = useCallback((): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);
  
  return {
    // State
    friends,
    hasMore,
    isLoading,
    error: state.error,
    cursor,
    
    // Actions
    loadMoreFriends,
    refreshFriends,
    updateFriendStatus,
    removeFriend,
    
    // Utilities
    resetError,
  };
}; 