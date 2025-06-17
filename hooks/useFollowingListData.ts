"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type {
  UseFollowingListDataReturn,
  FollowingListFollowingWithPost,
  FollowingListAPIResponse,
  FollowingListState,
  FollowingListAction,
  ProfileFollowingData,
  FollowingListError,
} from "@/lib/types";
import { FollowingListErrorType } from "@/lib/types";

interface UseFollowingListDataProps {
  username: string;
  state: FollowingListState;
  dispatch: React.Dispatch<FollowingListAction>;
  initialFollowing?: ProfileFollowingData;
}

export function useFollowingListData({
  username,
  state,
  dispatch,
  initialFollowing,
}: UseFollowingListDataProps): UseFollowingListDataReturn {
  // Refs for cleanup and request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestIdRef = useRef<string>("");
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Initialize following list when drawer opens
  useEffect(() => {
    if (state.isOpen && !state.isInitialized && initialFollowing) {
      try {
        const validFollowingItems = initialFollowing.following.filter(
          (f): f is FollowingListFollowingWithPost => f !== null
        );
        
        dispatch({
          type: 'INITIALIZE_FOLLOWING',
          payload: {
            followingItems: validFollowingItems,
            cursor: initialFollowing.cursor,
            hasMore: initialFollowing.hasMore,
          },
        });
      } catch (error) {
        console.error('Error initializing following list:', error);
        dispatch({ 
          type: 'SET_ERROR', 
          payload: 'Failed to load following list. Please try again.' 
        });
      }
    }
  }, [state.isOpen, state.isInitialized, initialFollowing, dispatch]);

  // Create error with context
  const createError = useCallback((
    type: FollowingListErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FollowingListError => ({
    type,
    message,
    originalError,
    retryable: [
      FollowingListErrorType.NETWORK_ERROR,
      FollowingListErrorType.LOAD_MORE_ERROR,
      FollowingListErrorType.SERVER_ERROR,
    ].includes(type),
    context: {
      username,
      timestamp: Date.now(),
      ...context,
    },
  }), [username]);

  // Enhanced API call with retry logic
  const makeAPICall = useCallback(async (
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<FollowingListAPIResponse> => {
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

      const response = await fetch(url, {
        ...options,
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Check if this is still the latest request
      if (lastRequestIdRef.current !== requestId) {
        throw new Error('Request superseded');
      }

      if (!response.ok) {
        const errorType = response.status >= 500 
          ? FollowingListErrorType.SERVER_ERROR
          : response.status === 429
          ? FollowingListErrorType.RATE_LIMIT_ERROR
          : response.status === 401
          ? FollowingListErrorType.AUTHENTICATION_ERROR
          : response.status === 404
          ? FollowingListErrorType.NOT_FOUND_ERROR
          : FollowingListErrorType.NETWORK_ERROR;

        throw createError(
          errorType,
          `HTTP ${response.status}: ${response.statusText}`,
          new Error(`HTTP ${response.status}`),
          { status: response.status, url }
        );
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw createError(
          FollowingListErrorType.VALIDATION_ERROR,
          'Invalid response format',
          new Error('Invalid JSON response'),
          { url, responseType: typeof data }
        );
      }

      return {
        following: data.following || [],
        hasMore: Boolean(data.hasMore),
        cursor: data.cursor || null,
        totalCount: data.totalCount,
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
          (error as any).code === 'NETWORK_ERROR';

        if (shouldRetry) {
          await new Promise(resolve => {
            retryTimeoutRef.current = setTimeout(resolve, retryDelay);
          });
          
          return makeAPICall(url, options, retryCount + 1);
        }
      }

      // Re-throw FollowingListError as-is
      if (error && typeof error === 'object' && 'type' in error) {
        throw error;
      }

      // Create new error for unknown errors
      throw createError(
        FollowingListErrorType.UNKNOWN_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
        error instanceof Error ? error : new Error(String(error)),
        { url, retryCount }
      );
    }
  }, [createError]);

  // Load more following with comprehensive error handling
  const loadMoreFollowing = useCallback(async (): Promise<void> => {
    if (!state.hasMore || state.isLoading || !state.cursor) {
      return;
    }

    dispatch({ type: 'LOAD_MORE_START' });

    try {
      const url = `/api/following?username=${encodeURIComponent(username)}&cursor=${encodeURIComponent(state.cursor)}`;
      const result = await makeAPICall(url);

              // Filter out null values and validate data
        const newFollowingItems = result.following.filter(
          (f): f is FollowingListFollowingWithPost => {
            return f !== null && 
                   f.following && 
                   f.following.postId && 
                   f.post && 
                   Boolean(f.post.title);
          }
        );

      dispatch({
        type: 'LOAD_MORE_SUCCESS',
        payload: {
          followingItems: newFollowingItems,
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
  }, [state.hasMore, state.isLoading, state.cursor, username, makeAPICall, dispatch]);

  // Refresh following list
  const refreshFollowing = useCallback(async (): Promise<void> => {
    dispatch({ type: 'RESET_STATE' });
    
    if (initialFollowing) {
      try {
        const validFollowingItems = initialFollowing.following.filter(
          (f): f is FollowingListFollowingWithPost => f !== null
        );
        
        dispatch({
          type: 'INITIALIZE_FOLLOWING',
          payload: {
            followingItems: validFollowingItems,
            cursor: initialFollowing.cursor,
            hasMore: initialFollowing.hasMore,
          },
        });
      } catch (error) {
        dispatch({ 
          type: 'SET_ERROR', 
          payload: 'Failed to refresh following list. Please try again.' 
        });
      }
    }
  }, [initialFollowing, dispatch]);

  // Update follow status for a specific post
  const updateFollowStatus = useCallback((
    postId: Id<"posts">, 
    isFollowing: boolean
  ): void => {
    dispatch({
      type: 'UPDATE_SINGLE_FOLLOW_STATUS',
      payload: { postId: postId.toString(), isFollowing },
    });
  }, [dispatch]);

  // Remove following item from list
  const removeFollowingItem = useCallback((postId: Id<"posts">): void => {
    dispatch({ type: 'REMOVE_FOLLOWING_ITEM', payload: postId });
  }, [dispatch]);

  // Reset error state
  const resetError = useCallback((): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
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
    hasMore: state.hasMore,
    isLoading: state.isLoading,
    error: state.error,
    cursor: state.cursor,
    followStatusMap: state.followStatusMap,
    isLoadingFollowStatus: state.isLoadingFollowStatus,
    
    // Actions
    loadMoreFollowing,
    refreshFollowing,
    updateFollowStatus,
    removeFollowingItem,
    
    // Utilities
    resetError,
  };
} 