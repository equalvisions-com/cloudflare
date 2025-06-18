import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import type {
  FriendsListState,
  FriendsListAction,
  FriendsListFriendWithProfile,
  ProfileSocialData,
  UseFriendsListDataProps,
  FriendsListError,
} from '@/lib/types';
import { FriendsListErrorType } from '@/lib/types';

export function useFriendsListData({
  username,
  state,
  dispatch,
  initialFriends,
}: UseFriendsListDataProps) {
  // Refs for cleanup and request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<string>("");
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reactive Convex query for friends data - only for initial load
  const friendsQuery = useQuery(
    api.friends.getFriendsByUsername,
    state.isOpen && !state.isInitialized ? { 
      username,
      limit: 30 
    } : "skip"
  );

  // Reactive query for real-time friendship status updates
  const friendsStatusQuery = useQuery(
    api.friends.getFriendsStatusByUsername,
    state.isOpen && state.isInitialized ? { 
      username,
      friendIds: state.friends.map(f => f.friendship._id)
    } : "skip"
  );

  // Handle initial data loading from Convex query
  useEffect(() => {
    if (state.isOpen && !state.isInitialized && friendsQuery !== undefined) {
      const processData = async () => {
        // Add minimum delay to ensure loading skeleton is visible
        const minDelay = new Promise(resolve => setTimeout(resolve, 300));
        
        if (friendsQuery === null) {
          await minDelay;
          dispatch({ 
            type: 'SET_ERROR', 
            payload: 'Failed to load friends list. Please try again.' 
          });
        } else {
          await minDelay;
          dispatch({
            type: 'INITIALIZE_FRIENDS',
            payload: {
              friends: friendsQuery.friends.filter(Boolean) as FriendsListFriendWithProfile[],
              cursor: friendsQuery.cursor || null,
              hasMore: friendsQuery.hasMore,
            },
          });
        }
        dispatch({ type: 'SET_LOADING', payload: false });
      };
      
      processData();
    }
  }, [friendsQuery, state.isOpen, state.isInitialized, dispatch]);

  // Handle real-time friendship status updates during render (React best practice)
  // Update state during render when friendsStatusQuery changes
  if (state.isOpen && state.isInitialized && friendsStatusQuery !== undefined && friendsStatusQuery !== null) {
    // Check if any friendship status has changed and update during render
    Object.entries(friendsStatusQuery).forEach(([friendshipIdStr, newStatus]) => {
      const friendshipId = friendshipIdStr as Id<"friends">;
      const currentFriend = state.friends.find(f => f.friendship._id === friendshipId);
      if (currentFriend && currentFriend.friendship.status !== newStatus) {
        // Update state during render - React will re-render immediately
        dispatch({
          type: 'UPDATE_FRIEND_STATUS',
          payload: { friendshipId, newStatus },
        });
      }
    });
  }

  // Create error with context
  const createError = useCallback((
    type: FriendsListErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FriendsListError => ({
    type,
    message,
    retryable: [FriendsListErrorType.NETWORK_ERROR, FriendsListErrorType.LOAD_MORE_ERROR, FriendsListErrorType.SERVER_ERROR].includes(type),
    context: {
      username,
      timestamp: Date.now(),
      ...context,
    },
  }), [username]);

  // Enhanced Convex call with retry logic for pagination
  const makeConvexCall = useCallback(async (
    queryArgs: any,
    retryCount = 0
  ): Promise<{ friends: FriendsListFriendWithProfile[]; hasMore: boolean; cursor: string | null }> => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);

    try {
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const requestId = `${Date.now()}-${Math.random()}`;
      lastRequestIdRef.current = requestId;

      // Use direct Convex query for pagination
      const { fetchQuery } = await import('convex/nextjs');
      const result = await fetchQuery(api.friends.getFriendsByUsername, queryArgs);

      // Check if this is still the latest request
      if (lastRequestIdRef.current !== requestId) {
        throw new Error('Request superseded');
      }

      if (!result) {
        throw createError(
          FriendsListErrorType.NETWORK_ERROR,
          'No data returned from Convex',
          new Error('Empty response'),
          { queryArgs }
        );
      }
      
      // Validate response structure
      if (!result || typeof result !== 'object') {
        throw createError(
          FriendsListErrorType.VALIDATION_ERROR,
          'Invalid response format',
          new Error('Invalid response structure'),
          { responseType: typeof result }
        );
      }

      return {
        friends: result.friends.filter(Boolean) as FriendsListFriendWithProfile[] || [],
        hasMore: Boolean(result.hasMore),
        cursor: result.cursor || null,
      };

    } catch (error) {
      // Handle abort errors (not actual errors)
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Handle network errors with retry
      if (retryCount < maxRetries && error instanceof Error) {
        const shouldRetry = 
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('superseded');

        if (shouldRetry) {
          await new Promise(resolve => {
            retryTimeoutRef.current = setTimeout(resolve, retryDelay);
          });
          
          return makeConvexCall(queryArgs, retryCount + 1);
        }
      }

      // Re-throw FriendsListError as-is
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }

      // Create new error for unknown errors
      throw createError(
        FriendsListErrorType.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
        error instanceof Error ? error : new Error(String(error)),
        { retryCount }
      );
    }
  }, [createError]);

  // Reset error state
  const resetError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);

  // Initial load of friends
  const loadFriends = useCallback(async () => {
    if (state.isInitialized) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // The initial load is handled by the Convex query above
    // This function is kept for API compatibility
  }, [state.isInitialized, dispatch]);

  // Load more friends (pagination) - uses direct Convex for cursor-based pagination
  const loadMoreFriends = useCallback(async () => {
    if (!state.hasMore || state.isLoading || !state.cursor) {
      return;
    }

    dispatch({ type: 'LOAD_MORE_START' });

    try {
      const result = await makeConvexCall({
        username,
        limit: 30,
        cursor: state.cursor
      });

      // Filter out null values and validate data
             const newFriends = result.friends.filter(
         (f): f is FriendsListFriendWithProfile => {
           return f !== null && 
                  f.friendship && 
                  Boolean(f.profile);
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
      // Handle abort errors silently
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const friendsError = error as FriendsListError;
      const errorMessage = friendsError?.retryable
        ? `${friendsError.message} (Tap to retry)`
        : friendsError?.message || 'An error occurred';

      dispatch({ 
        type: 'LOAD_MORE_ERROR', 
        payload: errorMessage 
      });
    }
  }, [state.hasMore, state.isLoading, state.cursor, username, makeConvexCall, dispatch]);

  // Refresh friends list
  const refreshFriends = useCallback(async () => {
    dispatch({ type: 'RESET_STATE' });
    
    // Reset initialization to trigger fresh data load
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // The refresh will be handled by the Convex query re-running
  }, [dispatch]);

  // Update friend status
  const updateFriendStatus = useCallback((
    friendshipId: Id<"friends">, 
    newStatus: string
  ): void => {
    dispatch({
      type: 'UPDATE_FRIEND_STATUS',
      payload: { friendshipId, newStatus },
    });
  }, [dispatch]);

  // Remove friend from list
  const removeFriend = useCallback((friendshipId: Id<"friends">): void => {
    dispatch({ type: 'REMOVE_FRIEND', payload: friendshipId });
  }, [dispatch]);

  // Cleanup function
  const cleanup = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    lastRequestIdRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    friends: state.friends,
    isLoading: state.isLoading || (state.isOpen && !state.isInitialized && friendsQuery === undefined),
    error: state.error,
    hasMore: state.hasMore,
    cursor: state.cursor,
    
    // Actions
    loadFriends,
    loadMoreFriends,
    refreshFriends,
    updateFriendStatus,
    removeFriend,
    
    // Utilities
    resetError,
  };
} 