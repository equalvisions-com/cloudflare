"use client";

import { useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/ui/use-toast";
import type {
  UseFollowingListActionsReturn,
  FollowingListState,
  FollowingListAction,
  FollowingListError,
  FollowingListErrorType,
} from "@/lib/types";
import { FollowingListErrorType as ErrorType } from "@/lib/types";

interface UseFollowingListActionsProps {
  username: string;
  state: FollowingListState;
  dispatch: React.Dispatch<FollowingListAction>;
  loadMoreFollowing: () => Promise<void>;
  refreshFollowing: () => Promise<void>;
}

export function useFollowingListActions({
  username,
  state,
  dispatch,
  loadMoreFollowing,
  refreshFollowing,
}: UseFollowingListActionsProps): UseFollowingListActionsReturn {
  const { toast } = useToast();
  
  // Convex mutations
  const followMutation = useMutation(api.following.follow);
  const unfollowMutation = useMutation(api.following.unfollow);

  // Refs for managing ongoing operations and global rate limiting
  const ongoingOperationsRef = useRef<Set<string>>(new Set());
  const retryTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastGlobalActionTimeRef = useRef<number>(0);
  const GLOBAL_COOLDOWN_MS = 2000; // 2 seconds between ANY follow/unfollow operations

  // Create enhanced error with context
  const createEnhancedError = useCallback((
    type: FollowingListErrorType,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ): FollowingListError => ({
    type,
    message,
    originalError,
    retryable: [
      ErrorType.NETWORK_ERROR,
      ErrorType.SERVER_ERROR,
      ErrorType.RATE_LIMIT_ERROR,
    ].includes(type),
    context: {
      username,
      timestamp: Date.now(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      ...context,
    },
  }), [username]);

  // Enhanced error handler with classification and recovery
  const handleError = useCallback((
    error: Error,
    context?: Record<string, unknown>
  ): void => {
    let errorType: FollowingListErrorType = ErrorType.UNKNOWN_ERROR;
    let userMessage = 'An unexpected error occurred';
    let toastTitle = "Error";
    let toastDescription = "Could not update follow status. Please try again.";

    const errorMessage = error.message || "";

    // Classify error type and set appropriate toast messages
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      errorType = ErrorType.NETWORK_ERROR;
      userMessage = 'Network error. Please check your connection and try again.';
      toastTitle = "Network Error";
      toastDescription = "Please check your connection and try again.";
    } else if (errorMessage.includes("Please wait 2 seconds between follow/unfollow operations")) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      userMessage = "You're following and unfollowing too quickly. Please slow down.";
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "You're following and unfollowing too quickly. Please slow down.";
    } else if (errorMessage.includes("Please wait before toggling follow again")) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      userMessage = "You're following and unfollowing too quickly. Please slow down.";
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "You're following and unfollowing too quickly. Please slow down.";
    } else if (errorMessage.includes("Too many follows too quickly")) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      userMessage = "Too many follows too quickly. Please slow down.";
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "Too many follows too quickly. Please slow down.";
    } else if (errorMessage.includes("Hourly follow limit reached")) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      userMessage = "Hourly follow limit reached. Try again later.";
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "Hourly follow limit reached. Try again later.";
    } else if (errorMessage.includes("Daily follow limit reached")) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      userMessage = "Daily follow limit reached. Try again tomorrow.";
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "Daily follow limit reached. Try again tomorrow.";
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      userMessage = "You're following and unfollowing too quickly. Please slow down.";
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "You're following and unfollowing too quickly. Please slow down.";
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      errorType = ErrorType.AUTHENTICATION_ERROR;
      userMessage = 'Authentication error. Please sign in again.';
      toastTitle = "Authentication Error";
      toastDescription = "Please sign in again.";
    } else if (errorMessage.includes('server') || errorMessage.includes('500')) {
      errorType = ErrorType.SERVER_ERROR;
      userMessage = 'Server error. Please try again in a moment.';
      toastTitle = "Server Error";
      toastDescription = "Please try again in a moment.";
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      errorType = ErrorType.NOT_FOUND_ERROR;
      userMessage = 'Content not found. It may have been removed.';
      toastTitle = "Not Found";
      toastDescription = "Content not found. It may have been removed.";
    } else if (errorMessage.includes('validation')) {
      errorType = ErrorType.VALIDATION_ERROR;
      userMessage = 'Invalid data. Please refresh and try again.';
      toastTitle = "Validation Error";
      toastDescription = "Invalid data. Please refresh and try again.";
    }

    const enhancedError = createEnhancedError(errorType, userMessage, error, context);

    // Show toast notification
    toast({
      title: toastTitle,
      description: toastDescription,
    });

    // Log error for debugging
    console.error('FollowingList Action Error:', {
      type: errorType,
      message: userMessage,
      originalError: error,
      context: enhancedError.context,
    });

    // Update state (but don't show error in UI since we're using toast)
    // dispatch({ type: 'SET_ERROR', payload: userMessage });
  }, [createEnhancedError, toast]);

  // Clear error state
  const clearError = useCallback((): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);

  // Handle load more with error handling
  const handleLoadMore = useCallback(async (): Promise<void> => {
    if (state.isLoading || !state.hasMore) return;

    try {
      await loadMoreFollowing();
    } catch (error) {
      handleError(
        error instanceof Error ? error : new Error('Load more failed'),
        { operation: 'loadMore', hasMore: state.hasMore, cursor: state.cursor }
      );
    }
  }, [state.isLoading, state.hasMore, state.cursor, loadMoreFollowing, handleError]);

  // Handle refresh with error handling
  const handleRefresh = useCallback(async (): Promise<void> => {
    try {
      clearError();
      await refreshFollowing();
      // console.log('Following list refreshed');
    } catch (error) {
      handleError(
        error instanceof Error ? error : new Error('Refresh failed'),
        { operation: 'refresh' }
      );
    }
  }, [refreshFollowing, clearError, handleError]);

  // Check global rate limiting
  const checkGlobalRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastAction = now - lastGlobalActionTimeRef.current;
    
    if (timeSinceLastAction < GLOBAL_COOLDOWN_MS) {
      const remainingTime = Math.ceil((GLOBAL_COOLDOWN_MS - timeSinceLastAction) / 1000);
      throw new Error(`Please wait ${remainingTime} second${remainingTime > 1 ? 's' : ''} between follow/unfollow operations`);
    }
    
    lastGlobalActionTimeRef.current = now;
    return true;
  }, [GLOBAL_COOLDOWN_MS]);

  // Optimistic follow operation
  const handleFollow = useCallback(async (
    postId: Id<"posts">,
    feedUrl: string,
    postTitle: string
  ): Promise<void> => {
    const operationId = `follow-${postId}`;
    
    // Check global rate limiting first
    try {
      checkGlobalRateLimit();
    } catch (error) {
      handleError(
        error instanceof Error ? error : new Error('Rate limit exceeded'),
        { operation: 'follow', postId: postId.toString(), rateLimited: true }
      );
      return;
    }
    
    // Prevent duplicate operations
    if (ongoingOperationsRef.current.has(operationId)) {
      return;
    }

    ongoingOperationsRef.current.add(operationId);

    try {
      // Optimistic update
      dispatch({
        type: 'UPDATE_SINGLE_FOLLOW_STATUS',
        payload: { postId: postId.toString(), isFollowing: true },
      });

      // Log optimistic action
      console.log(`Following ${postTitle}`, 'You will receive updates from this content');

      // Perform actual follow operation - need to add rssKey parameter
      await followMutation({ postId, feedUrl, rssKey: feedUrl });

      // Success - the optimistic update is already in place
      console.log('Follow operation successful:', { postId, postTitle });

    } catch (error) {
      // Revert optimistic update on error
      dispatch({
        type: 'UPDATE_SINGLE_FOLLOW_STATUS',
        payload: { postId: postId.toString(), isFollowing: false },
      });

      // Handle error with context
      handleError(
        error instanceof Error ? error : new Error('Follow operation failed'),
        {
          operation: 'follow',
          postId: postId.toString(),
          feedUrl,
          postTitle,
        }
      );

      // Log error
      console.error(`Failed to follow ${postTitle}`, 'Please try again');
    } finally {
      ongoingOperationsRef.current.delete(operationId);
    }
  }, [dispatch, followMutation, handleError, checkGlobalRateLimit]);

  // Optimistic unfollow operation
  const handleUnfollow = useCallback(async (
    postId: Id<"posts">,
    feedUrl: string,
    postTitle: string
  ): Promise<void> => {
    const operationId = `unfollow-${postId}`;
    
    // Check global rate limiting first
    try {
      checkGlobalRateLimit();
    } catch (error) {
      handleError(
        error instanceof Error ? error : new Error('Rate limit exceeded'),
        { operation: 'unfollow', postId: postId.toString(), rateLimited: true }
      );
      return;
    }
    
    // Prevent duplicate operations
    if (ongoingOperationsRef.current.has(operationId)) {
      return;
    }

    ongoingOperationsRef.current.add(operationId);

    try {
      // Optimistic update - only update button state, don't remove from list
      dispatch({
        type: 'UPDATE_SINGLE_FOLLOW_STATUS',
        payload: { postId: postId.toString(), isFollowing: false },
      });

      // Log optimistic action
      console.log(`Unfollowed ${postTitle}`, 'You will no longer receive updates from this content');

      // Perform actual unfollow operation - need to add rssKey parameter
      await unfollowMutation({ postId, rssKey: feedUrl });

      // Success - the optimistic update is already in place
      console.log('Unfollow operation successful:', { postId, postTitle });

    } catch (error) {
      // Revert optimistic update on error
      dispatch({
        type: 'UPDATE_SINGLE_FOLLOW_STATUS',
        payload: { postId: postId.toString(), isFollowing: true },
      });

      // Handle error with context
      handleError(
        error instanceof Error ? error : new Error('Unfollow operation failed'),
        {
          operation: 'unfollow',
          postId: postId.toString(),
          feedUrl,
          postTitle,
        }
      );

      // Log error
      console.error(`Failed to unfollow ${postTitle}`, 'Please try again');
    } finally {
      ongoingOperationsRef.current.delete(operationId);
    }
  }, [dispatch, unfollowMutation, handleError, checkGlobalRateLimit]);

  // Cleanup function for ongoing operations
  const cleanup = useCallback((): void => {
    // Clear all ongoing operations
    ongoingOperationsRef.current.clear();
    
    // Clear all retry timeouts
    retryTimeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    retryTimeoutsRef.current.clear();
  }, []);

  // Batch operations for better performance
  const handleBatchFollow = useCallback(async (
    items: Array<{ postId: Id<"posts">; feedUrl: string; postTitle: string }>
  ): Promise<void> => {
    const batchSize = 5; // Process in batches to avoid overwhelming the server
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch in parallel
      await Promise.allSettled(
        batch.map(item => handleFollow(item.postId, item.feedUrl, item.postTitle))
      );
      
      // Small delay between batches to be respectful to the server
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, [handleFollow]);

  const handleBatchUnfollow = useCallback(async (
    items: Array<{ postId: Id<"posts">; feedUrl: string; postTitle: string }>
  ): Promise<void> => {
    const batchSize = 5;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(item => handleUnfollow(item.postId, item.feedUrl, item.postTitle))
      );
      
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }, [handleUnfollow]);

  return {
    // Loading actions
    handleLoadMore,
    handleRefresh,
    
    // Follow management actions
    handleFollow,
    handleUnfollow,
    
    // Batch operations
    handleBatchFollow,
    handleBatchUnfollow,
    
    // Error handling
    handleError,
    clearError,
    
    // Utilities
    cleanup,
    
    // State queries
    isOperationPending: (postId: Id<"posts">) => 
      ongoingOperationsRef.current.has(`follow-${postId}`) || 
      ongoingOperationsRef.current.has(`unfollow-${postId}`),
    
    // Global rate limiting check
    isGlobalOperationPending: () => {
      const now = Date.now();
      const timeSinceLastAction = now - lastGlobalActionTimeRef.current;
      return timeSinceLastAction < GLOBAL_COOLDOWN_MS;
    },
  };
} 