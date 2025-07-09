import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import type {
  FollowersListState,
  FollowersListAction,
  FollowersListUserData,
  UseFollowersListDataProps,
  FollowersListError,
  ViewerFriendshipStatus,
} from '@/lib/types';
import { FollowersListErrorType } from '@/lib/types';



export function useFollowersListData({
  postId,
  state,
  dispatch,
}: UseFollowersListDataProps) {
  // Refs for cleanup and request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<string>("");
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingStartTimeRef = useRef<number | null>(null);

  // Optimized Convex query for initial followers data with friendship states
  const followersQuery = useQuery(
    api.following.getFollowersWithFriendshipStates,
    state.isOpen && !state.isInitialized ? { 
      postId,
      limit: 30 
    } : "skip"
  );

  // Reactive query for real-time friendship status updates (only for visible followers)
  const visibleFollowerIds = useMemo(() => 
    state.followers.slice(0, 30).map(f => f.userId), 
    [state.followers]
  );
  
  const followersFriendshipQuery = useQuery(
    api.following.getFollowersFriendshipStates,
    state.isOpen && state.isInitialized && visibleFollowerIds.length > 0 ? { 
      postId,
      userIds: visibleFollowerIds
    } : "skip"
  );

  // Handle initial data loading from optimized Convex query with minimum loading delay
  useEffect(() => {
    if (state.isOpen && !state.isInitialized && followersQuery !== undefined) {
      // Start tracking loading time when query starts
      if (loadingStartTimeRef.current === null) {
        loadingStartTimeRef.current = Date.now();
      }

      const processResults = () => {
        if (followersQuery === null) {
          dispatch({ 
            type: 'SET_ERROR', 
            payload: 'Failed to load followers. Please try again.' 
          });
        } else {
          // Transform the data to match expected format
          const transformedFollowers: FollowersListUserData[] = followersQuery.followers.map(follower => ({
            userId: follower.userId,
            username: follower.username || 'Guest',
            name: follower.displayName !== follower.username ? follower.displayName : undefined,
            profileImage: follower.profilePicture,
          }));

          dispatch({
            type: 'INITIALIZE_FOLLOWERS',
            payload: {
              followers: transformedFollowers,
              cursor: followersQuery.cursor,
              hasMore: followersQuery.hasMore,
              friendshipStates: followersQuery.friendshipStates || {},
            },
          });
        }
        dispatch({ type: 'SET_LOADING', payload: false });
        loadingStartTimeRef.current = null;
      };

      // Ensure minimum loading time of 300ms for skeleton visibility
      const elapsedTime = Date.now() - loadingStartTimeRef.current;
      const remainingTime = Math.max(0, 300 - elapsedTime);

      if (remainingTime > 0) {
        const timeoutId = setTimeout(processResults, remainingTime);
        return () => clearTimeout(timeoutId);
      } else {
        processResults();
      }
    }
  }, [followersQuery, state.isOpen, state.isInitialized, dispatch]);

  // Handle real-time friendship status updates during render (React best practice)
  // Update state during render when followersFriendshipQuery changes
  if (state.isOpen && state.isInitialized && followersFriendshipQuery !== undefined && followersFriendshipQuery !== null) {
    // Check if any friendship status has changed and update during render
    Object.entries(followersFriendshipQuery).forEach(([userIdStr, newFriendshipStatus]) => {
      const userId = userIdStr as Id<"users">;
      const currentFriendshipStatus = state.friendshipStates[userIdStr];
      
      // Only update if the status has actually changed
      if (JSON.stringify(currentFriendshipStatus) !== JSON.stringify(newFriendshipStatus)) {
        // Update state during render - React will re-render immediately
        dispatch({
          type: 'UPDATE_FRIENDSHIP_STATE',
          payload: { userId, friendshipStatus: newFriendshipStatus },
        });
      }
    });
  }

  // Create error with context
  const createError = useCallback((
    type: FollowersListErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FollowersListError => ({
    type,
    message,
    retryable: [FollowersListErrorType.NETWORK_ERROR, FollowersListErrorType.LOAD_MORE_ERROR, FollowersListErrorType.SERVER_ERROR].includes(type),
    context: {
      postId: postId.toString(),
      timestamp: Date.now(),
      ...context,
    },
  }), [postId]);

  // Enhanced Convex call with retry logic for pagination
  const makeConvexCall = useCallback(async (
    queryArgs: { postId: Id<"posts">; limit?: number; cursor?: string },
    retryCount = 0
  ): Promise<{ followers: FollowersListUserData[]; hasMore: boolean; cursor: string | null; friendshipStates: Record<string, ViewerFriendshipStatus> }> => {
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
      const result = await fetchQuery(api.following.getFollowersWithFriendshipStates, queryArgs);

      // Check if this is still the latest request
      if (lastRequestIdRef.current !== requestId) {
        throw new Error('Request superseded');
      }

      if (!result) {
        throw createError(
          FollowersListErrorType.NETWORK_ERROR,
          'No data returned from Convex',
          new Error('Empty response'),
          { queryArgs }
        );
      }
      
      // Validate response structure
      if (!result || typeof result !== 'object') {
        throw createError(
          FollowersListErrorType.VALIDATION_ERROR,
          'Invalid response format',
          new Error('Invalid response structure'),
          { responseType: typeof result }
        );
      }

      // Transform the data to match expected format
      const transformedFollowers: FollowersListUserData[] = result.followers.map(follower => ({
        userId: follower.userId,
        username: follower.username || 'Guest',
        name: follower.displayName !== follower.username ? follower.displayName : undefined,
        profileImage: follower.profilePicture,
      }));

      return {
        followers: transformedFollowers,
        hasMore: Boolean(result.hasMore),
        cursor: result.cursor || null,
        friendshipStates: result.friendshipStates || {},
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

      // Re-throw FollowersListError as-is
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }

      // Create new error for unknown errors
      throw createError(
        FollowersListErrorType.UNKNOWN_ERROR,
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

  // Initial load of followers
  const loadFollowers = useCallback(async () => {
    if (state.isInitialized) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    loadingStartTimeRef.current = Date.now();
    
    // The initial load is handled by the optimized Convex query above
    // This function is kept for API compatibility
  }, [state.isInitialized, dispatch]);

  // Load more followers (pagination) - uses optimized Convex query
  const loadMoreFollowers = useCallback(async () => {
    if (!state.hasMore || state.isLoading || !state.cursor) {
      return;
    }

    dispatch({ type: 'LOAD_MORE_START' });

    try {
      const result = await makeConvexCall({
        postId,
        limit: 30,
        cursor: state.cursor
      });

      dispatch({
        type: 'LOAD_MORE_SUCCESS',
        payload: {
          followers: result.followers,
          cursor: result.cursor,
          hasMore: result.hasMore,
          friendshipStates: result.friendshipStates,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Silently handle aborted requests
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to load more followers';
      dispatch({
        type: 'LOAD_MORE_ERROR',
        payload: errorMessage,
      });
    }
  }, [state.hasMore, state.isLoading, state.cursor, makeConvexCall, postId, dispatch]);

  // Refresh followers data
  const refreshFollowers = useCallback(async () => {
    dispatch({ type: 'RESET_STATE' });
    dispatch({ type: 'SET_LOADING', payload: true });
    loadingStartTimeRef.current = Date.now();
    
    // Reset initialization to trigger fresh data load
    // The optimized query will handle the refresh
  }, [dispatch]);

  // Update follower friendship status
  const updateFollowerFriendStatus = useCallback((
    userId: Id<"users">, 
    friendshipStatus: ViewerFriendshipStatus
  ): void => {
    dispatch({
      type: 'UPDATE_FRIEND_STATUS',
      payload: { userId, friendshipStatus },
    });
  }, [dispatch]);

  // Update friendship status in the friendshipStates map
  const updateFriendshipStatus = useCallback((
    userId: Id<"users">,
    newFriendshipStatus: ViewerFriendshipStatus
  ): void => {
    dispatch({
      type: 'UPDATE_FRIENDSHIP_STATE',
      payload: { userId, friendshipStatus: newFriendshipStatus },
    });
  }, [dispatch]);

  // Remove follower from list
  const removeFollower = useCallback((userId: Id<"users">): void => {
    dispatch({ type: 'REMOVE_FOLLOWER', payload: userId });
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
    loadingStartTimeRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    followers: state.followers,
    isLoading: state.isLoading || (state.isOpen && !state.isInitialized && followersQuery === undefined),
    error: state.error,
    hasMore: state.hasMore,
    cursor: state.cursor,
    friendshipStates: state.friendshipStates,
    
    // Actions
    loadFollowers,
    loadMoreFollowers,
    refreshFollowers,
    updateFollowerFriendStatus,
    updateFriendshipStatus,
    removeFollower,
    
    // Utilities
    resetError,
  };
} 