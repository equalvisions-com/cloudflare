"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FriendshipStatus = {
  exists: boolean;
  status: string | null;
  direction: string | null;
  friendshipId: Id<"friends"> | null;
};

interface ProfileData {
  name?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  username: string;
}

interface SimpleFriendButtonProps {
  username: string;
  userId: Id<"users">;
  profileData: ProfileData;
  initialFriendshipStatus?: FriendshipStatus | null;
  className?: string;
  loadingClassName?: string;
  pendingClassName?: string;
  friendsClassName?: string;
}

export function SimpleFriendButton({ 
  username, 
  userId, 
  profileData, 
  initialFriendshipStatus,
  className = "rounded-full h-[23px] text-xs px-2 flex-shrink-0 mt-0 font-semibold border-0 shadow-none text-muted-foreground",
  loadingClassName = "",
  pendingClassName = "text-muted-foreground",
  friendsClassName = "text-muted-foreground" 
}: SimpleFriendButtonProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [currentStatus, setCurrentStatus] = useState<FriendshipStatus | null>(initialFriendshipStatus || null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Only fetch friendship status if not provided from server and user is authenticated
  const shouldFetchStatus = isAuthenticated && !initialFriendshipStatus;
  const friendshipStatus = useQuery(
    api.friends.getFriendshipStatusByUsername, 
    shouldFetchStatus ? { username } : "skip"
  );
  
  // Track if query is loading
  const isFriendshipLoading = friendshipStatus === undefined && shouldFetchStatus;

  // Determine if component is in any loading state
  const isLoading = isActionLoading || isFriendshipLoading || isAuthLoading;

  // Mutations for friend actions
  const sendRequest = useMutation(api.friends.sendFriendRequest);
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const deleteFriendship = useMutation(api.friends.deleteFriendship);

  // Update local state when friendship status changes from query
  useEffect(() => {
    if (friendshipStatus) {
      setCurrentStatus(friendshipStatus);
    }
  }, [friendshipStatus]);

  // Handle add friend action
  const handleAddFriend = async () => {
    if (!isAuthenticated) return;
    
    setIsActionLoading(true);
    try {
      const result = await sendRequest({ requesteeId: userId });
      if (result) {
        // Optimistically update UI with the returned friendship ID
        setCurrentStatus({
          exists: true,
          status: "pending",
          direction: "sent",
          friendshipId: result,
        });
      }
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle accept friend request
  const handleAcceptFriend = async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated) return;
    
    setIsActionLoading(true);
    try {
      await acceptRequest({ friendshipId: currentStatus.friendshipId });
      // Optimistically update UI
      setCurrentStatus({
        ...currentStatus,
        status: "accepted",
      });
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle unfriend or cancel request
  const handleUnfriend = async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated) return;
    
    setIsActionLoading(true);
    try {
      await deleteFriendship({ friendshipId: currentStatus.friendshipId });
      // Optimistically update UI
      setCurrentStatus({
        exists: false,
        status: null,
        direction: null,
        friendshipId: null,
      });
    } catch (error) {
      console.error("Failed to unfriend:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Show "Your Profile" button on own profile
  if (currentStatus?.status === "self" && isAuthenticated) {
    return (
      <Button 
        variant="secondary" 
        size="sm" 
        className={cn(className, "border-0 shadow-none")}
      >
        Your Profile
      </Button>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <Button 
        variant="secondary" 
        size="sm" 
        disabled 
        className={cn(className, loadingClassName, "border-0 shadow-none")}
      >
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Loading
      </Button>
    );
  }

  // Not authenticated - show sign in message
  if (!isAuthenticated) {
    return (
      <Button 
        variant="default" 
        size="sm" 
        className={cn(className, "border-0 shadow-none")}
        title="Sign in to add as friend"
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
        className={cn(className, "border-0 shadow-none")}
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
          className={cn(className, pendingClassName, "border border-input hover:text-accent-foreground")}
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
          className={cn(className, friendsClassName, "border border-input hover:text-accent-foreground")}
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
        className={cn(className, friendsClassName, "border border-input hover:text-accent-foreground")}
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
      className={cn(className, "border-0 shadow-none")}
      onClick={handleAddFriend}
    >
      Add Friend
    </Button>
  );
} 