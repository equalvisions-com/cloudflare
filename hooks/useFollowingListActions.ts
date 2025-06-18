import { useCallback, useRef } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import type {
  FollowingListState,
  FollowingListAction,
  UseFollowingListActionsProps,
  FollowingListError,
} from '@/lib/types';
import { FollowingListErrorType } from '@/lib/types';

export function useFollowingListActions({
  state,
  dispatch,
  loadMoreFollowing,
  refreshFollowing,
}: UseFollowingListActionsProps) {

  // Track pending operations to prevent duplicate requests
  const pendingOperationsRef = useRef<Set<string>>(new Set());

  // Create error with context
  const createError = useCallback((
    type: FollowingListErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FollowingListError => ({
    type,
    message,
    retryable: [FollowingListErrorType.NETWORK_ERROR, FollowingListErrorType.LOAD_MORE_ERROR, FollowingListErrorType.SERVER_ERROR].includes(type),
    context: {
      timestamp: Date.now(),
      ...context,
    },
  }), []);

  // Handle load more with error handling
  const handleLoadMore = useCallback(async (): Promise<void> => {
    const operationKey = 'loadMore';
    
    if (pendingOperationsRef.current.has(operationKey)) {
      return;
    }

    try {
      pendingOperationsRef.current.add(operationKey);
      await loadMoreFollowing();
    } catch (error) {
      const followingError = createError(
        FollowingListErrorType.LOAD_MORE_ERROR,
        error instanceof Error ? error.message : 'Failed to load more following',
        error instanceof Error ? error : new Error(String(error)),
        { operation: operationKey }
      );

      dispatch({ 
        type: 'LOAD_MORE_ERROR', 
        payload: followingError.message 
      });
    } finally {
      pendingOperationsRef.current.delete(operationKey);
    }
  }, [loadMoreFollowing, createError, dispatch]);

  // Handle refresh with error handling
  const handleRefresh = useCallback(async (): Promise<void> => {
    const operationKey = 'refresh';
    
    if (pendingOperationsRef.current.has(operationKey)) {
      return;
    }

    try {
      pendingOperationsRef.current.add(operationKey);
      await refreshFollowing();
    } catch (error) {
      const followingError = createError(
        FollowingListErrorType.REFRESH_ERROR,
        error instanceof Error ? error.message : 'Failed to refresh following',
        error instanceof Error ? error : new Error(String(error)),
        { operation: operationKey }
      );

      dispatch({ 
        type: 'SET_ERROR', 
        payload: followingError.message 
      });
    } finally {
      pendingOperationsRef.current.delete(operationKey);
    }
  }, [refreshFollowing, createError, dispatch]);

  // Handle general errors
  const handleError = useCallback((
    error: Error, 
    context?: Record<string, unknown>
  ): void => {
    const followingError = createError(
      FollowingListErrorType.GENERAL_ERROR,
      error.message || 'An unexpected error occurred',
      error,
      context
    );

    dispatch({ 
      type: 'SET_ERROR', 
      payload: followingError.message 
    });
  }, [createError, dispatch]);

  // Clear error state
  const clearError = useCallback((): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);

  // Check if operation is pending
  const isOperationPending = useCallback((operationKey: string): boolean => {
    return pendingOperationsRef.current.has(operationKey);
  }, []);

  // Update following status (for FollowButton integration)
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

  return {
    // Loading actions
    handleLoadMore,
    handleRefresh,
    
    // Follow management actions (for FollowButton integration)
    updateFollowingStatus,
    removeFollowing,
    
    // Error handling
    handleError,
    clearError,
    
    // Rate limiting state
    isOperationPending,
  };
} 