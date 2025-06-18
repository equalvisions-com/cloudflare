"use client";

import { memo, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { ProfileImage } from "@/components/profile/ProfileImage";
import { SimpleFriendButton } from "@/components/ui/SimpleFriendButton";
import { Button } from "@/components/ui/button";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import type { FollowersListUserData } from "@/lib/types";

interface VirtualizedFollowerItemProps {
  follower: FollowersListUserData;
  index: number;
  isFirst?: boolean;
  isLast?: boolean;
  isAuthenticated?: boolean;
  initialFriendshipStatus?: any; // Friendship status from optimized query
  onFriendshipStatusChange?: (userId: Id<"users">, newStatus: any) => void; // Callback for status changes
}

// Custom friendship button component for followers
const FollowerFriendButton = memo<{
  userId: Id<"users">;
  username: string;
  displayName: string;
  profileImage?: string;
  initialStatus: any;
  onStatusChange?: (userId: Id<"users">, newStatus: any) => void;
  className?: string;
}>(({ userId, username, displayName, profileImage, initialStatus, onStatusChange, className }) => {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  // Mutations for friend actions
  const sendRequest = useMutation(api.friends.sendFriendRequest);
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const deleteFriendship = useMutation(api.friends.deleteFriendship);

  const updateStatus = useCallback((newStatus: any) => {
    setCurrentStatus(newStatus);
    onStatusChange?.(userId, newStatus);
  }, [userId, onStatusChange]);

  const handleAddFriend = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await sendRequest({ requesteeId: userId });
      const newStatus = {
        exists: true,
        status: "pending" as const,
        direction: "sent" as const,
        friendshipId: result,
      };
      updateStatus(newStatus);
    } catch (error) {
      console.error("Failed to send friend request:", error);
      toast({ 
        title: "Error", 
        description: "Failed to send friend request. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, router, userId, sendRequest, updateStatus, toast]);

  const handleAcceptFriend = useCallback(async () => {
    if (!currentStatus?.friendshipId) return;
    
    setIsLoading(true);
    try {
      await acceptRequest({ friendshipId: currentStatus.friendshipId });
      const newStatus = {
        ...currentStatus,
        status: "accepted",
      };
      updateStatus(newStatus);
    } catch (error) {
      console.error("Failed to accept friend request:", error);
      toast({ 
        title: "Error", 
        description: "Failed to accept friend request. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentStatus, acceptRequest, updateStatus, toast]);

  const handleUnfriend = useCallback(async () => {
    if (!currentStatus?.friendshipId) return;
    
    setIsLoading(true);
    try {
      await deleteFriendship({ friendshipId: currentStatus.friendshipId });
      const newStatus = {
        exists: false,
        status: null,
        direction: null,
        friendshipId: null,
      };
      updateStatus(newStatus);
    } catch (error) {
      console.error("Failed to unfriend:", error);
      toast({ 
        title: "Error", 
        description: "Failed to update friendship status. Please try again." 
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentStatus, deleteFriendship, updateStatus, toast]);

  // Show "Your Profile" button on own profile
  if (currentStatus?.status === "self") {
    return null; // Don't display any button for own profile
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
  if (!currentStatus?.exists) {
    // Not friends - show add button
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
  } else if (currentStatus.status === "pending") {
    if (currentStatus.direction === "sent") {
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
  } else if (currentStatus.status === "accepted") {
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
  }
  
  // Fallback for any other unhandled state
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
});

FollowerFriendButton.displayName = 'FollowerFriendButton';

export const VirtualizedFollowerItem = memo<VirtualizedFollowerItemProps>((props) => {
  // Memoized computed values
  const computedValues = useMemo(() => {
    const follower = props.follower;
    if (!follower) return null;

    return {
      displayName: follower.name || follower.username || "Unknown User",
      username: follower.username || "unknown",
      profileImage: follower.profileImage,
      userId: follower.userId,
    };
  }, [props.follower]);

  // Defensive check for data integrity - AFTER all hooks
  if (!props.follower || !computedValues) {
    return (
      <div 
        className="flex items-center justify-center p-4 text-muted-foreground"
        role="alert"
        aria-label="Invalid follower data"
      >
        <span className="text-sm">Invalid follower data</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center justify-between gap-3 p-4 border-b border-border min-h-[80px] hover:bg-muted/30 transition-colors duration-200"
      data-index={props.index}
      data-follower-id={computedValues.userId.toString()}
      role="listitem"
      aria-label={`Follower: ${computedValues.displayName}`}
    >
      {/* Left side - Profile info */}
      <Link
        href={`/profile/${computedValues.username}`}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none p-1 -m-1"
        aria-label={`View ${computedValues.displayName}'s profile`}
      >
        <div className="flex-shrink-0">
          <ProfileImage
            profileImage={computedValues.profileImage}
            username={computedValues.username}
            size="sm"
            className="h-12 w-12"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-foreground">
            {computedValues.displayName}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            @{computedValues.username}
          </div>
        </div>
      </Link>

      {/* Right side - Action button */}
      {props.isAuthenticated && (
        <div className="flex-shrink-0" role="group" aria-label="Friend actions">
          <FollowerFriendButton
            userId={computedValues.userId}
            username={computedValues.username}
            displayName={computedValues.displayName}
            profileImage={computedValues.profileImage || undefined}
            initialStatus={props.initialFriendshipStatus}
            onStatusChange={props.onFriendshipStatusChange}
            className="w-[100px] rounded-full opacity-100 hover:opacity-100 font-semibold shadow-none transition-all duration-200 text-sm"
          />
        </div>
      )}
    </div>
  );
});

VirtualizedFollowerItem.displayName = 'VirtualizedFollowerItem';

// Memoized export to prevent unnecessary re-renders
export const MemoizedVirtualizedFollowerItem = memo(VirtualizedFollowerItem); 