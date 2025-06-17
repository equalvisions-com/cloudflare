import { useCallback, useRef, useState } from 'react';
import { useMutation, useConvexAuth } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { friendsListErrorHandler } from '@/lib/utils/friendsListErrorHandler';
import type {
  FriendsListAction,
  UseFriendsListActionsReturn,
  FriendsListErrorContext,
} from '@/lib/types';
import { Id } from '@/convex/_generated/dataModel';

interface UseFriendsListActionsProps {
  dispatch: React.Dispatch<FriendsListAction>;
  updateFriendStatus: (friendshipId: Id<"friends">, newStatus: string) => void;
  removeFriend: (friendshipId: Id<"friends">) => void;
}

export const useFriendsListActions = ({
  dispatch,
  updateFriendStatus,
  removeFriend,
}: UseFriendsListActionsProps): UseFriendsListActionsReturn => {
  const { toast } = useToast();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  
  // Rate limiting state
  const [busyOperations, setBusyOperations] = useState<Set<string>>(new Set());
  const lastActionTimeRef = useRef<number>(0);
  const DEBOUNCE_MS = 500; // Same as SimpleFriendButton
  
  // Convex mutations
  const deleteFriendship = useMutation(api.friends.deleteFriendship);
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const declineRequest = useMutation(api.friends.deleteFriendship); // Same as delete for decline
  
  // Helper to check if operation is busy
  const isOperationBusy = useCallback((operationKey: string): boolean => {
    return busyOperations.has(operationKey);
  }, [busyOperations]);
  
  // Helper to set operation busy state
  const setOperationBusy = useCallback((operationKey: string, isBusy: boolean) => {
    setBusyOperations(prev => {
      const newSet = new Set(prev);
      if (isBusy) {
        newSet.add(operationKey);
      } else {
        newSet.delete(operationKey);
      }
      return newSet;
    });
  }, []);
  
  // Rate limiting check (same as SimpleFriendButton)
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const timeSinceLastAction = now - lastActionTimeRef.current;
    
    if (timeSinceLastAction < DEBOUNCE_MS) {
      return false; // Rate limited
    }
    
    lastActionTimeRef.current = now;
    return true; // Allowed
  }, []);
  
  // Enhanced error handler with rate limit specific messages
  const handleError = useCallback(async (error: Error, context?: FriendsListErrorContext): Promise<void> => {
    const errorMessage = error.message || "An unknown error occurred";
    let toastTitle = "Error";
    let toastDescription = "An error occurred. Please try again.";

    // Handle rate limit errors specifically (same as SimpleFriendButton)
    if (errorMessage.includes("Cannot send friend request to yourself")) {
      toastDescription = "You cannot send a friend request to yourself.";
    } else if (errorMessage.includes("Please wait before sending another request")) {
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "You're sending friend requests too quickly. Please slow down.";
    } else if (errorMessage.includes("Friend request already sent")) {
      toastDescription = "You have already sent a friend request to this user.";
    } else if (errorMessage.includes("Friendship already exists")) {
      toastDescription = "You are already friends with this user or a request is pending.";
    } else if (errorMessage.includes("Too many friend requests too quickly")) {
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "You're sending friend requests too quickly. Please slow down.";
    } else if (errorMessage.includes("Hourly friend request limit reached")) {
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "Hourly friend request limit reached. Try again later.";
    } else if (errorMessage.includes("Daily friend request limit reached")) {
      toastTitle = "Rate Limit Exceeded";
      toastDescription = "Daily friend request limit reached. Try again tomorrow.";
    } else if (errorMessage.includes("Friend request not found")) {
      toastDescription = "The friend request could not be found. It might have been withdrawn.";
    } else if (errorMessage.includes("Not authorized to accept this friend request")) {
      toastDescription = "You are not authorized to accept this friend request.";
    } else if (errorMessage.includes("Friend request is not pending")) {
      toastDescription = "This friend request is no longer pending.";
    } else if (errorMessage.includes("Friendship not found")) {
      toastDescription = "The friendship record could not be found.";
    } else if (errorMessage.includes("Not authorized to delete this friendship")) {
      toastDescription = "You are not authorized to modify this friendship.";
    }

    toast({ title: toastTitle, description: toastDescription, variant: "destructive" });
    
    // Also update state with enhanced error message
    const enhancedError = await friendsListErrorHandler.handleError(error, context);
    dispatch({
      type: 'SET_ERROR',
      payload: enhancedError.message,
    });
  }, [dispatch, toast]);
  
  // Clear error
  const clearError = useCallback((): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);
  
  // Handle load more with error handling
  const handleLoadMore = useCallback(async (): Promise<void> => {
    try {
      // This will be called by the data hook
      // Just a placeholder for consistency
    } catch (error) {
      await handleError(
        error instanceof Error ? error : new Error('Load more failed'),
        { operation: 'loadMore', timestamp: Date.now() }
      );
    }
  }, [handleError]);
  
  // Handle refresh with error handling
  const handleRefresh = useCallback(async (): Promise<void> => {
    try {
      // This will be called by the data hook
      // Just a placeholder for consistency
    } catch (error) {
      await handleError(
        error instanceof Error ? error : new Error('Refresh failed'),
        { operation: 'refresh', timestamp: Date.now() }
      );
    }
  }, [handleError]);
  
  // Handle unfriend action with rate limiting
  const handleUnfriend = useCallback(async (friendshipId: Id<"friends">): Promise<void> => {
    // Authentication check (same as SimpleFriendButton)
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    const operationKey = `unfriend-${friendshipId}`;
    
    // Check if operation is already in progress
    if (isOperationBusy(operationKey)) {
      return;
    }
    
    // Rate limiting check
    if (!checkRateLimit()) {
      toast({
        title: "Rate Limit",
        description: "Please wait before performing another action.",
      });
      return;
    }
    
    setOperationBusy(operationKey, true);
    
    try {
      await deleteFriendship({ friendshipId });
      
      toast({
        title: 'Success',
        description: 'Friend removed successfully.',
      });
    } catch (error) {
      await handleError(
        error instanceof Error ? error : new Error('Unfriend failed'),
        { 
          operation: 'unfriend', 
          friendshipId,
          timestamp: Date.now() 
        }
      );
    } finally {
      setOperationBusy(operationKey, false);
    }
  }, [isAuthenticated, router, deleteFriendship, toast, handleError, isOperationBusy, setOperationBusy, checkRateLimit]);
  
  // Handle accept friend request with rate limiting
  const handleAcceptRequest = useCallback(async (friendshipId: Id<"friends">): Promise<void> => {
    // Authentication check (same as SimpleFriendButton)
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    const operationKey = `accept-${friendshipId}`;
    
    // Check if operation is already in progress
    if (isOperationBusy(operationKey)) {
      return;
    }
    
    // Rate limiting check
    if (!checkRateLimit()) {
      toast({
        title: "Rate Limit",
        description: "Please wait before performing another action.",
      });
      return;
    }
    
    setOperationBusy(operationKey, true);
    
    try {
      await acceptRequest({ friendshipId });
      
      toast({
        title: 'Success',
        description: 'Friend request accepted.',
      });
    } catch (error) {
      await handleError(
        error instanceof Error ? error : new Error('Accept request failed'),
        { 
          operation: 'acceptRequest', 
          friendshipId,
          timestamp: Date.now() 
        }
      );
    } finally {
      setOperationBusy(operationKey, false);
    }
  }, [isAuthenticated, router, acceptRequest, toast, handleError, isOperationBusy, setOperationBusy, checkRateLimit]);
  
  // Handle decline friend request with rate limiting
  const handleDeclineRequest = useCallback(async (friendshipId: Id<"friends">): Promise<void> => {
    // Authentication check (same as SimpleFriendButton)
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    const operationKey = `decline-${friendshipId}`;
    
    // Check if operation is already in progress
    if (isOperationBusy(operationKey)) {
      return;
    }
    
    // Rate limiting check
    if (!checkRateLimit()) {
      toast({
        title: "Rate Limit",
        description: "Please wait before performing another action.",
      });
      return;
    }
    
    setOperationBusy(operationKey, true);
    
    try {
      await declineRequest({ friendshipId });
      
      toast({
        title: 'Success',
        description: 'Friend request declined.',
      });
    } catch (error) {
      await handleError(
        error instanceof Error ? error : new Error('Decline request failed'),
        { 
          operation: 'declineRequest', 
          friendshipId,
          timestamp: Date.now() 
        }
      );
    } finally {
      setOperationBusy(operationKey, false);
    }
  }, [isAuthenticated, router, declineRequest, toast, handleError, isOperationBusy, setOperationBusy, checkRateLimit]);
  
  return {
    // Loading actions
    handleLoadMore,
    handleRefresh,
    
    // Friend management actions
    handleUnfriend,
    handleAcceptRequest,
    handleDeclineRequest,
    
    // Error handling
    handleError,
    clearError,
    
    // Rate limiting state
    isOperationPending: isOperationBusy,
  };
}; 