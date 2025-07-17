import { useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useToast } from '@/components/ui/use-toast';
import { useSidebar } from '@/components/ui/sidebar-context';
import { useNotificationsContext } from '@/lib/contexts/NotificationsContext';

/**
 * Custom hook for notification actions following React best practices
 * - Encapsulates all notification-related mutations and state management
 * - Uses Zustand for loading states
 * - Minimal useEffect usage (none needed here)
 * - Proper error handling and user feedback
 */
export function useNotificationActions() {
  const { toast } = useToast();
  const { pendingFriendRequestCount } = useSidebar();
  const { setAccepting, setDeclining } = useNotificationsContext();
  
  // Mutations
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const deleteFriendship = useMutation(api.friends.deleteFriendship);
  
  // Accept friend request action
  const handleAcceptRequest = useCallback(async (friendshipId: Id<"friends">) => {
    setAccepting(friendshipId, true);
    
    try {
      await acceptRequest({ friendshipId });
      toast({
        description: "Friend request accepted",
      });
    } catch (error) {

      toast({
        variant: "destructive",
        description: "Failed to accept friend request",
      });
    } finally {
      setAccepting(friendshipId, false);
    }
  }, [acceptRequest, toast, setAccepting]);
  
  // Decline friend request action
  const handleDeclineRequest = useCallback(async (friendshipId: Id<"friends">) => {
    setDeclining(friendshipId, true);
    
    try {
      await deleteFriendship({ friendshipId });
      toast({
        description: "Friend request declined",
      });
    } catch (error) {

      toast({
        variant: "destructive",
        description: "Failed to decline friend request",
      });
    } finally {
      setDeclining(friendshipId, false);
    }
  }, [deleteFriendship, toast, setDeclining]);
  
  // Remove friend action
  const handleRemoveFriend = useCallback(async (friendshipId: Id<"friends">) => {
    setDeclining(friendshipId, true);
    
    try {
      await deleteFriendship({ friendshipId });
      toast({
        description: "Friend removed",
      });
    } catch (error) {

      toast({
        variant: "destructive",
        description: "Failed to remove friend",
      });
    } finally {
      setDeclining(friendshipId, false);
    }
  }, [deleteFriendship, toast, setDeclining]);
  
  return {
    handleAcceptRequest,
    handleDeclineRequest,
    handleRemoveFriend,
  };
} 