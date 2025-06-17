"use client";

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import type {
  FollowingListState,
  FollowingListAction,
  FollowingListFollowingWithPost,
  ProfileFollowingData,
} from '@/lib/types';

interface UseFollowingListDataProps {
  username: string;
  state: FollowingListState;
  dispatch: React.Dispatch<FollowingListAction>;
  initialFollowing?: ProfileFollowingData;
}

interface FollowingListError {
  type: string;
  message: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}

export function useFollowingListData({
  username,
  state,
  dispatch,
  initialFollowing,
}: UseFollowingListDataProps) {
  // Refs for cleanup and request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<string>("");
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct Convex query for initial following data
  const followingQuery = useQuery(
    api.following.getFollowingByUsername,
    state.isOpen && !state.isInitialized ? { 
      username,
      limit: 30 
    } : "skip"
  );

  // Handle initial data loading from Convex query
  useEffect(() => {
    if (state.isOpen && !state.isInitialized && followingQuery !== undefined) {
      if (followingQuery === null) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: 'Failed to load following list. Please try again.' 
        });
      } else {
        dispatch({
          type: 'INITIALIZE_FOLLOWING',
          payload: {
            followingItems: followingQuery.following.filter(Boolean) as FollowingListFollowingWithPost[],
            cursor: followingQuery.cursor,
            hasMore: followingQuery.hasMore,
          },
        });
      }
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [followingQuery, state.isOpen, state.isInitialized, dispatch]);

  // Extract post IDs for batched follow status query
  const postIds = useMemo(() => 
    state.followingItems
      .filter(item => item?.following?.postId)
      .map(item => item.following.postId),
    [state.followingItems]
  );

  // Batched follow status query with error handling
  const followStatusArray = useQuery(
    api.following.getFollowStates,
    state.isOpen && postIds.length > 0 ? { postIds } : "skip"
  );

  // Update follow status map when data arrives
  useEffect(() => {
    if (followStatusArray && postIds.length > 0) {
      try {
        const statusMap: Record<string, boolean> = {};
        postIds.forEach((id, index) => {
          if (index < followStatusArray.length) {
            statusMap[id.toString()] = followStatusArray[index];
          }
        });
        dispatch({ type: 'UPDATE_FOLLOW_STATUS_MAP', payload: statusMap });
      } catch (error) {
        console.error('Error updating follow status map:', error);
        dispatch({ 
          type: 'SET_ERROR', 
          payload: 'Failed to update follow status. Please refresh.' 
        });
      }
    }
  }, [followStatusArray, postIds, dispatch]);

  // Create error with context
  const createError = useCallback((
    type: string,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FollowingListError => ({
    type,
    message,
    retryable: ['NETWORK_ERROR', 'LOAD_MORE_ERROR', 'SERVER_ERROR'].includes(type),
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
  ): Promise<{ following: FollowingListFollowingWithPost[]; hasMore: boolean; cursor: string | null }> => {
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
      const result = await fetchQuery(api.following.getFollowingByUsername, queryArgs);

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
        following: result.following.filter(Boolean) as FollowingListFollowingWithPost[] || [],
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

      // Re-throw FollowingListError as-is
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

  // Initial load of following
  const loadFollowing = useCallback(async () => {
    if (state.isInitialized) return;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // The initial load is handled by the Convex query above
    // This function is kept for API compatibility
  }, [state.isInitialized, dispatch]);

  // Load more following (pagination) - uses direct Convex for cursor-based pagination
  const loadMoreFollowing = useCallback(async () => {
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
      const newFollowing = result.following.filter(
        (f): f is FollowingListFollowingWithPost => {
          return f !== null && 
                 Boolean(f.following) && 
                 Boolean(f.following?.postId);
        }
      );

      dispatch({
        type: 'LOAD_MORE_SUCCESS',
        payload: {
          followingItems: newFollowing,
          cursor: result.cursor,
          hasMore: result.hasMore,
        },
      });

    } catch (error) {
      // Handle abort errors silently
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      const followingError = error as FollowingListError;
      const errorMessage = followingError?.retryable
        ? `${followingError.message} (Tap to retry)`
        : followingError?.message || 'An error occurred';

      dispatch({ 
        type: 'LOAD_MORE_ERROR', 
        payload: errorMessage 
      });

      console.error('Load more following error:', {
        error: followingError,
        context: followingError.context,
      });
    }
  }, [state.hasMore, state.isLoading, state.cursor, username, makeConvexCall, dispatch]);

  // Refresh following list
  const refreshFollowing = useCallback(async () => {
    dispatch({ type: 'RESET_STATE' });
    
    // Reset initialization to trigger fresh data load
    dispatch({ type: 'SET_LOADING', payload: true });
    
    // The refresh will be handled by the Convex query re-running
  }, [dispatch]);

  // Update following status
  const updateFollowingStatus = useCallback((
    postId: Id<"posts">, 
    isFollowing: boolean
  ): void => {
    dispatch({
      type: 'UPDATE_SINGLE_FOLLOW_STATUS',
      payload: { postId: postId.toString(), isFollowing },
    });
  }, [dispatch]);

  // Remove following from list
  const removeFollowing = useCallback((postId: Id<"posts">): void => {
    dispatch({ type: 'REMOVE_FOLLOWING_ITEM', payload: postId });
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
    followingItems: state.followingItems,
    isLoading: state.isLoading || (state.isOpen && !state.isInitialized && followingQuery === undefined),
    error: state.error,
    hasMore: state.hasMore,
    cursor: state.cursor,
    followStatusMap: state.followStatusMap,
    
    // Actions
    loadFollowing,
    loadMoreFollowing,
    refreshFollowing,
    updateFollowingStatus,
    removeFollowing,
    
    // Utilities
    resetError,
  };
} 