import { useCallback, useRef } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import type {
  FriendsListState,
  FriendsListAction,
} from '@/lib/types';

interface UseFriendsListActionsProps {
  state: FriendsListState;
  dispatch: React.Dispatch<FriendsListAction>;
  loadMoreFriends: () => Promise<void>;
  refreshFriends: () => Promise<void>;
}

interface FriendsListError {
  type: string;
  message: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}

export function useFriendsListActions({
  state,
  dispatch,
  loadMoreFriends,
  refreshFriends,
}: UseFriendsListActionsProps) {
  // Track pending operations to prevent duplicate requests
  const pendingOperationsRef = useRef<Set<string>>(new Set());
  
  // Create error with context
  const createError = useCallback((
    type: string,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FriendsListError => ({
    type,
    message,
    retryable: ['NETWORK_ERROR', 'LOAD_MORE_ERROR', 'SERVER_ERROR'].includes(type),
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
      await loadMoreFriends();
    } catch (error) {
      const friendsError = createError(
        'LOAD_MORE_ERROR',
        error instanceof Error ? error.message : 'Failed to load more friends',
        error instanceof Error ? error : new Error(String(error)),
        { operation: operationKey }
      );

      dispatch({ 
        type: 'LOAD_MORE_ERROR', 
        payload: friendsError.message 
      });

      console.error('Load more friends error:', {
        error: friendsError,
        context: friendsError.context,
      });
    } finally {
      pendingOperationsRef.current.delete(operationKey);
    }
  }, [loadMoreFriends, createError, dispatch]);
  
  // Handle refresh with error handling
  const handleRefresh = useCallback(async (): Promise<void> => {
    const operationKey = 'refresh';
    
    if (pendingOperationsRef.current.has(operationKey)) {
      return;
    }

    try {
      pendingOperationsRef.current.add(operationKey);
      await refreshFriends();
    } catch (error) {
      const friendsError = createError(
        'REFRESH_ERROR',
        error instanceof Error ? error.message : 'Failed to refresh friends',
        error instanceof Error ? error : new Error(String(error)),
        { operation: operationKey }
      );

      dispatch({ 
        type: 'SET_ERROR', 
        payload: friendsError.message 
      });

      console.error('Refresh friends error:', {
        error: friendsError,
        context: friendsError.context,
      });
    } finally {
      pendingOperationsRef.current.delete(operationKey);
    }
  }, [refreshFriends, createError, dispatch]);
  
  // Handle general errors
  const handleError = useCallback((
    error: Error, 
    context?: Record<string, unknown>
  ): void => {
    const friendsError = createError(
      'GENERAL_ERROR',
      error.message || 'An unexpected error occurred',
      error,
      context
    );

    dispatch({ 
      type: 'SET_ERROR', 
      payload: friendsError.message 
    });

    console.error('Friends list error:', {
      error: friendsError,
      context: friendsError.context,
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
  
  // Update friend status (for SimpleFriendButton integration)
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
  
  return {
    // Loading actions
    handleLoadMore,
    handleRefresh,
    
    // Friend management actions (for SimpleFriendButton integration)
    updateFriendStatus,
    removeFriend,
    
    // Error handling
    handleError,
    clearError,
    
    // Rate limiting state
    isOperationPending,
  };
} 