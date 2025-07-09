import React, { memo, useCallback, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ProfileImage } from '@/components/profile/ProfileImage';
import { Button } from '@/components/ui/button';
import type { FriendsListFriendWithProfile, ViewerFriendshipStatus } from '@/lib/types';
import { Id } from '@/convex/_generated/dataModel';
import { Check, X, Clock, Loader2 } from 'lucide-react';
import { useMutation, useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";

interface VirtualizedFriendItemProps {
  friend: FriendsListFriendWithProfile;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUnfriend?: (friendshipId: Id<"friends">) => Promise<void>;
  onAcceptRequest?: (friendshipId: Id<"friends">) => Promise<void>;
  onDeclineRequest?: (friendshipId: Id<"friends">) => Promise<void>;
  isOperationPending?: (operationKey: string) => boolean;
  onFriendshipStatusChange?: (friendshipId: Id<"friends">, newStatus: string) => void;
  viewerFriendshipStatus?: ViewerFriendshipStatus; // Viewer's friendship status with this friend
  onViewerFriendshipStatusChange?: (userId: Id<"users">, status: ViewerFriendshipStatus) => void;
}

// Custom friendship button component for friends list
const FriendListButton = memo<{
  friendshipId: Id<"friends"> | undefined;
  userId: Id<"users">;
  username: string;
  displayName: string;
  currentStatus: string | null;
  direction: string | null;
  onStatusChange?: (userId: Id<"users">, status: ViewerFriendshipStatus) => void;
  className?: string;
}>(({ friendshipId, userId, username, displayName, currentStatus, direction, onStatusChange, className }) => {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Get current user info to check if this is the user's own profile
  const currentUser = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  
  // Mutations for friend actions - MUST be called before any conditional returns
  const sendRequest = useMutation(api.friends.sendFriendRequest);
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const deleteFriendship = useMutation(api.friends.deleteFriendship);

  // All useCallback hooks must be called before any conditional returns
  const updateStatus = useCallback((newStatus: string, newFriendshipId?: Id<"friends">) => {
    // Convert null to undefined for friendshipId
    const safeExistingId: Id<"friends"> | undefined = friendshipId === null ? undefined : (friendshipId as Id<"friends">);
    
    // Update with new friendship status
    const statusUpdate = {
      exists: newStatus !== "cancelled" && newStatus !== null,
      status: newStatus === "cancelled" ? null : newStatus,
      direction: newStatus === "pending" ? "sent" : (newStatus === "accepted" ? "accepted" : null),
      friendshipId: newFriendshipId || safeExistingId,
    };
    
    onStatusChange?.(userId, statusUpdate);
  }, [friendshipId, userId, onStatusChange]);

  const handleAddFriend = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    setIsLoading(true);
    try {
      const newFriendshipId = await sendRequest({ requesteeId: userId });
      if (newFriendshipId) {
        updateStatus("pending", newFriendshipId);
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to send friend request. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, router, userId, sendRequest, updateStatus, toast]);

  const handleAcceptFriend = useCallback(async () => {
    if (!friendshipId) return;
    
    setIsLoading(true);
    try {
      await acceptRequest({ friendshipId });
      updateStatus("accepted");
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to accept friend request. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  }, [friendshipId, acceptRequest, updateStatus, toast]);

  const handleUnfriend = useCallback(async () => {
    if (!friendshipId) return;
    
    setIsLoading(true);
    try {
      await deleteFriendship({ friendshipId });
      updateStatus("cancelled");
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update friendship status. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  }, [friendshipId, deleteFriendship, updateStatus, toast]);

  // Check if this is the current user's own profile - AFTER all hooks
  const isCurrentUser = currentUser?._id === userId;

  // Use currentStatus directly instead of syncing to local state
  const displayStatus = currentStatus;

  // Don't show friend button for current user's own profile
  if (isCurrentUser) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Button 
        variant="secondary" 
        size="sm" 
        disabled 
        className={className}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
      </Button>
    );
  }

  // Not authenticated - show sign in button
  if (!isAuthenticated) {
    return (
      <Button 
        variant="default" 
        size="sm" 
        className={className}
        onClick={() => router.push("/signin")}
      >
        Add Friend
      </Button>
    );
  }

  // Determine the button state based on friendship status
  if (displayStatus === "pending") {
    if (direction === "sent") {
      // Pending request sent by current user
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className={`${className} text-muted-foreground border border-input hover:text-accent-foreground`}
          onClick={handleUnfriend}
        >
          Pending
        </Button>
      );
    } else {
      // Pending request received - show accept button
      return (
        <Button 
          variant="ghost" 
          size="sm" 
          className={`${className} text-muted-foreground border border-input hover:text-accent-foreground`}
          onClick={handleAcceptFriend}
        >
          Accept
        </Button>
      );
    }
  } else if (displayStatus === "accepted") {
    // Already friends - show friends status with unfriend option
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className={`${className} text-muted-foreground border border-input hover:text-accent-foreground`}
        onClick={handleUnfriend}
      >
        Friends
      </Button>
    );
  } else {
    // Not friends or cancelled - show add button
    return (
      <Button 
        variant="default" 
        size="sm" 
        className={className}
        onClick={handleAddFriend}
      >
        Add Friend
      </Button>
    );
  }
});

FriendListButton.displayName = 'FriendListButton';

export const VirtualizedFriendItem = memo<VirtualizedFriendItemProps>(({
  friend,
  index,
  isFirst,
  isLast,
  onUnfriend,
  onAcceptRequest,
  onDeclineRequest,
  isOperationPending,
  onFriendshipStatusChange,
  viewerFriendshipStatus,
  onViewerFriendshipStatusChange,
}) => {
  // Loading states for actions (fallback to local state if no isOperationPending provided)
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Safe access to friendship ID with optional chaining
  const friendshipId = friend?.friendship?._id;
  
  // Check if operations are pending using the rate limiting hook
  const acceptOperationKey = `accept-${friendshipId}`;
  const declineOperationKey = `decline-${friendshipId}`;
  const isAcceptPending = isOperationPending ? isOperationPending(acceptOperationKey) : isAccepting;
  const isDeclinePending = isOperationPending ? isOperationPending(declineOperationKey) : isDeclining;

  // Memoized handlers with rate limiting support
  const handleAcceptRequest = useCallback(async () => {
    if (onAcceptRequest && friendshipId && !isAcceptPending) {
      // Use local state as fallback if no rate limiting hook provided
      if (!isOperationPending) {
        setIsAccepting(true);
      }
      try {
        await onAcceptRequest(friendshipId);
      } finally {
        if (!isOperationPending) {
          setIsAccepting(false);
        }
      }
    }
  }, [onAcceptRequest, friendshipId, isAcceptPending, isOperationPending]);

  const handleDeclineRequest = useCallback(async () => {
    if (onDeclineRequest && friendshipId && !isDeclinePending) {
      // Use local state as fallback if no rate limiting hook provided
      if (!isOperationPending) {
        setIsDeclining(true);
      }
      try {
        await onDeclineRequest(friendshipId);
      } finally {
        if (!isOperationPending) {
          setIsDeclining(false);
        }
      }
    }
  }, [onDeclineRequest, friendshipId, isDeclinePending, isOperationPending]);

  // Memoized computed values to prevent re-calculations
  const computedValues = useMemo(() => {
    const isAcceptedFriend = friend?.friendship?.status === 'accepted';
    const isPendingRequest = friend?.friendship?.status === 'pending';
    const isOutgoingRequest = friend?.friendship?.direction === 'outgoing';
    const isIncomingRequest = friend?.friendship?.direction === 'incoming';
    const friendName = friend?.profile?.name || friend?.profile?.username;
    const friendUsername = friend?.profile?.username;

    return {
      isAcceptedFriend,
      isPendingRequest,
      isOutgoingRequest,
      isIncomingRequest,
      friendName,
      friendUsername,
    };
  }, [
    friend?.friendship?.status,
    friend?.friendship?.direction,
    friend?.profile?.name,
    friend?.profile?.username,
  ]);

  // Defensive check for data integrity - AFTER all hooks
  if (!friend || !friend.friendship || !friend.profile) {
    // Invalid friend data - render error placeholder
    return (
      <div 
        className="flex items-center justify-center p-4 text-muted-foreground"
        role="alert"
        aria-label="Invalid friend data"
      >
        <span className="text-sm">Invalid friend data</span>
      </div>
    );
  }

  // Ensure friendship._id exists - AFTER all hooks
  if (!friendshipId) {
    // Missing friendship ID - render error placeholder
    return (
      <div 
        className="flex items-center justify-center p-4 text-muted-foreground"
        role="alert"
        aria-label="Missing friendship data"
      >
        <span className="text-sm">Missing friendship ID</span>
      </div>
    );
  }

  const {
    isAcceptedFriend,
    isPendingRequest,
    isOutgoingRequest,
    isIncomingRequest,
    friendName,
    friendUsername,
  } = computedValues;



  return (
    <div 
      className="flex items-center justify-between gap-3 p-4 border-b border-border min-h-[80px] hover:bg-muted/30 transition-colors duration-200"
      data-index={index}
      data-friend-id={friendshipId.toString()}
      role="listitem"
      aria-label={`Friend: ${friendName}`}
    >
      {/* Friend Profile Section */}
      <Link
        href={`/profile/${friendUsername}`}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none p-1 -m-1"
        aria-label={`View ${friendName}'s profile`}
      >
        <div className="flex-shrink-0">
          <ProfileImage
            profileImage={friend.profile.profileImage}
            username={friendUsername}
            size="sm"
            className="h-12 w-12"
          />
        </div>
        
        <div className="flex flex-col flex-1 min-w-0">
          <div className="text-sm font-bold overflow-anywhere line-clamp-2 text-foreground">
            {friendName}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-1">
            @{friendUsername}
          </div>
        </div>
      </Link>

      {/* Action Button Section */}
      <div className="flex-shrink-0" role="group" aria-label="Friend actions">
        <FriendListButton
          friendshipId={viewerFriendshipStatus?.friendshipId ? viewerFriendshipStatus.friendshipId : undefined}
          userId={friend.profile.userId}
          username={friendUsername}
          displayName={friendName}
          currentStatus={viewerFriendshipStatus?.status || null}
          direction={viewerFriendshipStatus?.direction || null}
          onStatusChange={onViewerFriendshipStatusChange}
          className="w-[100px] rounded-full opacity-100 hover:opacity-100 font-semibold shadow-none transition-all duration-200 text-sm"
          aria-label={`Manage friendship with ${friendName}`}
        />
        
        {isPendingRequest && isIncomingRequest && (
          <div className="flex gap-2">
            <Button
              onClick={handleAcceptRequest}
              disabled={isAcceptPending || isDeclinePending}
              size="sm"
              className="h-8 px-3 text-xs font-medium bg-green-600 hover:bg-green-700 text-white transition-colors duration-200"
              aria-label={`Accept friend request from ${friendName}`}
            >
              {isAcceptPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Accept
                </>
              )}
            </Button>
            <Button
              onClick={handleDeclineRequest}
              disabled={isAcceptPending || isDeclinePending}
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium border-border/50 hover:bg-destructive hover:text-destructive-foreground transition-colors duration-200"
              aria-label={`Decline friend request from ${friendName}`}
            >
              {isDeclinePending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Decline
                </>
              )}
            </Button>
          </div>
        )}
        
        {isPendingRequest && isOutgoingRequest && (
          <div 
            className="flex items-center gap-1 text-xs text-muted-foreground px-3 py-2 bg-muted/50 rounded-md"
            role="status"
            aria-label={`Friend request sent to ${friendName} is pending`}
          >
            <Clock className="h-3 w-3" />
            Pending
          </div>
        )}
      </div>
    </div>
  );
});

VirtualizedFriendItem.displayName = 'VirtualizedFriendItem';

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (
  prevProps: VirtualizedFriendItemProps,
  nextProps: VirtualizedFriendItemProps
): boolean => {
  // Compare friend properties that affect rendering
  if (!prevProps.friend || !nextProps.friend) {
    return prevProps.friend === nextProps.friend;
  }

  const prevProfile = prevProps.friend.profile;
  const nextProfile = nextProps.friend.profile;
  const prevFriendship = prevProps.friend.friendship;
  const nextFriendship = nextProps.friend.friendship;

  // Check if essential properties have changed
  return (
    prevProfile.userId === nextProfile.userId &&
    prevProfile.username === nextProfile.username &&
    prevProfile.name === nextProfile.name &&
    prevProfile.profileImage === nextProfile.profileImage &&
    prevFriendship._id === nextFriendship._id &&
    prevFriendship.status === nextFriendship.status &&
    prevFriendship.direction === nextFriendship.direction &&
    prevProps.index === nextProps.index &&
    prevProps.isFirst === nextProps.isFirst &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.onUnfriend === nextProps.onUnfriend &&
    prevProps.onAcceptRequest === nextProps.onAcceptRequest &&
    prevProps.onDeclineRequest === nextProps.onDeclineRequest &&
    prevProps.onFriendshipStatusChange === nextProps.onFriendshipStatusChange
  );
};

// Re-export with custom comparison
export const MemoizedVirtualizedFriendItem = memo(VirtualizedFriendItem, arePropsEqual); 