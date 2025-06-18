import React, { memo, useCallback, useState, useMemo } from 'react';
import Link from 'next/link';
import { ProfileImage } from '@/components/profile/ProfileImage';
import { SimpleFriendButton } from '@/components/ui/SimpleFriendButton';
import { Button } from '@/components/ui/button';
import type { FriendsListFriendWithProfile } from '@/lib/types';
import { Id } from '@/convex/_generated/dataModel';
import { Check, X, Clock, Loader2 } from 'lucide-react';

interface VirtualizedFriendItemProps {
  friend: FriendsListFriendWithProfile;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUnfriend?: (friendshipId: Id<"friends">) => Promise<void>;
  onAcceptRequest?: (friendshipId: Id<"friends">) => Promise<void>;
  onDeclineRequest?: (friendshipId: Id<"friends">) => Promise<void>;
  isOperationPending?: (operationKey: string) => boolean;
}

export const VirtualizedFriendItem = memo<VirtualizedFriendItemProps>(({
  friend,
  index,
  isFirst,
  isLast,
  onUnfriend,
  onAcceptRequest,
  onDeclineRequest,
  isOperationPending,
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
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-foreground">
            {friendName}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            @{friendUsername}
          </div>
          {friend.profile.bio && (
            <div className="text-xs text-muted-foreground truncate mt-1 leading-relaxed">
              {friend.profile.bio}
            </div>
          )}
        </div>
      </Link>

      {/* Action Button Section */}
      <div className="flex-shrink-0" role="group" aria-label="Friend actions">
        {isAcceptedFriend && (
          <SimpleFriendButton
            username={friendUsername}
            userId={friend.profile.userId}
            profileData={{
              name: friend.profile.name,
              bio: friend.profile.bio,
              profileImage: friend.profile.profileImage,
              username: friendUsername,
            }}
            initialFriendshipStatus={{
              exists: true,
              status: friend.friendship.status,
              direction: friend.friendship.direction,
              friendshipId: friend.friendship._id,
            }}
            className="w-[100px] rounded-full opacity-100 hover:opacity-100 font-semibold shadow-none transition-all duration-200 text-sm"
            friendsClassName="text-muted-foreground border border-input"
            pendingClassName="text-muted-foreground border border-input"
            aria-label={`Manage friendship with ${friendName}`}
          />
        )}
        
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
    prevProfile.bio === nextProfile.bio &&
    prevProfile.profileImage === nextProfile.profileImage &&
    prevFriendship._id === nextFriendship._id &&
    prevFriendship.status === nextFriendship.status &&
    prevFriendship.direction === nextFriendship.direction &&
    prevProps.index === nextProps.index &&
    prevProps.isFirst === nextProps.isFirst &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.onUnfriend === nextProps.onUnfriend &&
    prevProps.onAcceptRequest === nextProps.onAcceptRequest &&
    prevProps.onDeclineRequest === nextProps.onDeclineRequest
  );
};

// Re-export with custom comparison
export const MemoizedVirtualizedFriendItem = memo(VirtualizedFriendItem, arePropsEqual); 