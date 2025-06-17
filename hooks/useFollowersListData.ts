import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import type {
  FollowersListState,
  FollowersListAction,
  FollowersListUserData,
} from '@/lib/types';

interface UseFollowersListDataProps {
  postId: Id<"posts">;
  state: FollowersListState;
  dispatch: React.Dispatch<FollowersListAction>;
}

interface FollowersListError {
  type: string;
  message: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}

export function useFollowersListData({
  postId,
  state,
  dispatch,
}: UseFollowersListDataProps) {
  // Refs for cleanup and request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<string>("");
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct Convex query for initial followers data
  const followersQuery = useQuery(
    api.following.getFollowers,
    state.isOpen && !state.isInitialized ? { 
      postId,
      limit: 30 
    } : "skip"
  );

  // Handle initial data loading from Convex query
  useEffect(() => {
    if (state.isOpen && !state.isInitialized && followersQuery !== undefined) {
      if (followersQuery === null) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: 'Failed to load followers. Please try again.' 
        });
      } else {
        dispatch({
          type: 'INITIALIZE_FOLLOWERS',
          payload: {
            followers: followersQuery.followers,
            cursor: followersQuery.cursor,
            hasMore: followersQuery.hasMore,
          },
        });
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [followersQuery, state.isOpen, state.isInitialized, dispatch]);

  // Create error with context
  const createError = useCallback((
    type: string,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FollowersListError => ({
    type,
    message,
    retryable: ['NETWORK_ERROR', 'LOAD_MORE_ERROR', 'SERVER_ERROR'].includes(type),
    context: {
      postId: postId.toString(),
      timestamp: Date.now(),
      ...context,
    },
  }), [postId]);

  // Enhanced Convex call with retry logic for pagination
  const makeConvexCall = useCallback(async (
    queryArgs: any,
    retryCount = 0
  ): Promise<{ followers: FollowersListUserData[]; hasMore: boolean; cursor: string | null }> => {
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
      const result = await fetchQuery(api.following.getFollowers, queryArgs);

      // Check if this is still the latest request
      if (lastRequestIdRef.current !== requestId) {
        throw new Error('Request superseded');
      }

      if (!result) {
        throw createError(
          'NETWORK_ERROR',
          'No data returned from Convex',
          new Error('Empty response'),
          { queryArgs }
        );
      }
      
      // Validate response structure
      if (!result || typeof result !== 'object') {
        throw createError(
          'VALIDATION_ERROR',
          'Invalid response format',
          new Error('Invalid response structure'),
          { responseType: typeof result }
        );
      }

      return {
        followers: result.followers || [],
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

      // Re-throw FollowersListError as-is
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }

      // Create new error for unknown errors
      throw createError(
        'UNKNOWN_ERROR',
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
    
    // The initial load is handled by the Convex query above
    // This function is kept for API compatibility
  }, [state.isInitialized, dispatch]);

  // Load more followers (pagination) - uses direct Convex for cursor-based pagination
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

      // Filter out null values and validate data
      const newFollowers = result.followers.filter(
        (f): f is FollowersListUserData => {
          return f !== null && 
                 Boolean(f.userId) && 
                 Boolean(f.username);
        }
      );

      dispatch({
        type: 'LOAD_MORE_SUCCESS',
        payload: {
          followers: newFollowers,
          cursor: result.cursor,
          hasMore: result.hasMore,
        },
      });

    } catch (error) {
      // Handle abort errors silently
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const followersError = error as FollowersListError;
      const errorMessage = followersError?.retryable
        ? `${followersError.message} (Tap to retry)`
        : followersError?.message || 'An error occurred';

      dispatch({ 
        type: 'LOAD_MORE_ERROR', 
        payload: errorMessage 
      });

      console.error('Load more followers error:', {
        error: followersError,
        context: followersError.context,
      });
    }
  }, [state.hasMore, state.isLoading, state.cursor, postId, makeConvexCall, dispatch]);

  // Refresh followers list
  const refreshFollowers = useCallback(async () => {
    dispatch({ type: 'RESET_STATE' });
    
    // Reset initialization to trigger fresh data load
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // The refresh will be handled by the Convex query re-running
  }, [dispatch]);

  // Update follower friend status
  const updateFollowerFriendStatus = useCallback((
    userId: Id<"users">, 
    friendshipStatus: any
  ): void => {
    dispatch({
      type: 'UPDATE_FRIEND_STATUS',
      payload: { userId, friendshipStatus },
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
    
    // Actions
    loadFollowers,
    loadMoreFollowers,
    refreshFollowers,
    updateFollowerFriendStatus,
    removeFollower,
    
    // Utilities
    resetError,
  };
} 