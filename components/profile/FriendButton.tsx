"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, UserCheck, UserPlus, UserX } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FriendshipStatus = {
  exists: boolean;
  status: string | null;
  direction: string | null;
  friendshipId: Id<"friends"> | null;
};

interface FriendButtonProps {
  username: string;
  userId: Id<"users">;
}

export function FriendButton({ username, userId }: FriendButtonProps) {
  const { isAuthenticated } = useConvexAuth();
  const [currentStatus, setCurrentStatus] = useState<FriendshipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get current user from Convex
  const user = useQuery(api.users.viewer);

  // Get friendship status - only execute if authenticated
  const friendshipStatus = useQuery(
    api.friends.getFriendshipStatusByUsername, 
    isAuthenticated ? { username } : "skip"
  );

  // Mutations for friend actions
  const sendRequest = useMutation(api.friends.sendFriendRequest);
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const deleteFriendship = useMutation(api.friends.deleteFriendship);

  // Update local state when friendship status changes
  useEffect(() => {
    if (friendshipStatus) {
      setCurrentStatus(friendshipStatus);
    }
  }, [friendshipStatus]);

  // Handle add friend action
  const handleAddFriend = async () => {
    if (!user?._id || !isAuthenticated) return;
    
    setIsLoading(true);
    try {
      await sendRequest({ requesteeId: userId });
      // Optimistically update UI
      setCurrentStatus({
        exists: true,
        status: "pending",
        direction: "sent",
        friendshipId: null, // We don't know the ID yet, will be updated on next query
      });
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle accept friend request
  const handleAcceptFriend = async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated) return;
    
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // Handle unfriend or cancel request
  const handleUnfriend = async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated) return;
    
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // Don't show button on own profile
  if (currentStatus?.status === "self") {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading
      </Button>
    );
  }

  // Not authenticated - show disabled button
  if (!isAuthenticated) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        disabled
        title="Sign in to add as friend"
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add Friend
      </Button>
    );
  }

  // Determine the button state based on friendship status
  if (!currentStatus?.exists) {
    // Not friends - show add button
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleAddFriend}
      >
        <UserPlus className="mr-2 h-4 w-4" />
        Add Friend
      </Button>
    );
  } else if (currentStatus.status === "pending") {
    if (currentStatus.direction === "sent") {
      // Pending request sent by current user - show cancel option
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Loader2 className="mr-2 h-4 w-4" />
              Pending
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleUnfriend}>
              <UserX className="mr-2 h-4 w-4" />
              Cancel Request
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else {
      // Pending request received - show accept option
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Respond
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAcceptFriend}>
              <UserCheck className="mr-2 h-4 w-4" />
              Accept
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleUnfriend}>
              <UserX className="mr-2 h-4 w-4" />
              Decline
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
  } else if (currentStatus.status === "accepted") {
    // Already friends - show unfriend option
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <UserCheck className="mr-2 h-4 w-4" />
            Friends
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleUnfriend}>
            <UserX className="mr-2 h-4 w-4" />
            Unfriend
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Fallback
  return null;
} 