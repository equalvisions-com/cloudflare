import { useCallback, useRef } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import type {
  FollowersListState,
  FollowersListAction,
  UseFollowersListActionsProps,
  FollowersListError,
} from '@/lib/types';
import { FollowersListErrorType } from '@/lib/types';

export function useFollowersListActions({
  state,
  dispatch,
  loadMoreFollowers,
  refreshFollowers,
}: UseFollowersListActionsProps) {
  // Track pending operations to prevent duplicate requests
  const pendingOperationsRef = useRef<Set<string>>(new Set());

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
      await loadMoreFollowers();
    } catch (error) {
      const followersError = createError(
        FollowersListErrorType.LOAD_MORE_ERROR,
        error instanceof Error ? error.message : 'Failed to load more followers',
        error instanceof Error ? error : new Error(String(error)),
        { operation: operationKey }
      );

      dispatch({ 
        type: 'LOAD_MORE_ERROR', 
        payload: followersError.message 
      });
    } finally {
      pendingOperationsRef.current.delete(operationKey);
    }
  }, [loadMoreFollowers, createError, dispatch]);

  // Handle refresh with error handling
  const handleRefresh = useCallback(async (): Promise<void> => {
    const operationKey = 'refresh';
    
    if (pendingOperationsRef.current.has(operationKey)) {
      return;
    }

    try {
      pendingOperationsRef.current.add(operationKey);
      await refreshFollowers();
    } catch (error) {
      const followersError = createError(
        FollowersListErrorType.REFRESH_ERROR,
        error instanceof Error ? error.message : 'Failed to refresh followers',
        error instanceof Error ? error : new Error(String(error)),
        { operation: operationKey }
      );

      dispatch({ 
        type: 'SET_ERROR', 
        payload: followersError.message 
      });
    } finally {
      pendingOperationsRef.current.delete(operationKey);
    }
  }, [refreshFollowers, createError, dispatch]);

  // Handle general errors
  const handleError = useCallback((
    error: Error, 
    context?: Record<string, unknown>
  ): void => {
    const followersError = createError(
      FollowersListErrorType.GENERAL_ERROR,
      error.message || 'An unexpected error occurred',
      error,
      context
    );

    dispatch({ 
      type: 'SET_ERROR', 
      payload: followersError.message 
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

  // Update follower friend status (for SimpleFriendButton integration)
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

  return {
    // Loading actions
    handleLoadMore,
    handleRefresh,
    
    // Friend management actions (for SimpleFriendButton integration)
    updateFollowerFriendStatus,
    removeFollower,
    
    // Error handling
    handleError,
    clearError,
    
    // Rate limiting state
    isOperationPending,
  };
} 