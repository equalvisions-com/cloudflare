"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { MenuButton } from "@/components/ui/friend-menu-button";

// Lazy load the EditProfileModal component
const EditProfileModal = lazy(() => import("./EditProfileModal").then(mod => ({ default: mod.EditProfileModal })));

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

interface FriendButtonProps {
  username: string;
  userId: Id<"users">;
  profileData: ProfileData;
}

export function FriendButton({ username, userId, profileData }: FriendButtonProps) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [currentStatus, setCurrentStatus] = useState<FriendshipStatus | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Get current user from Convex
  const user = useQuery(api.users.viewer);

  // Get friendship status - only execute if authenticated
  const friendshipStatus = useQuery(
    api.friends.getFriendshipStatusByUsername, 
    isAuthenticated ? { username } : "skip"
  );
  
  // Track if query is loading
  const isFriendshipLoading = friendshipStatus === undefined && isAuthenticated;

  // Determine if component is in any loading state
  const isLoading = isActionLoading || isFriendshipLoading || isAuthLoading;

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
    
    setIsActionLoading(true);
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

  // Show edit profile button on own profile
  if (currentStatus?.status === "self" && isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
          friendshipStatus="self"
          friendshipDirection={null}
        />
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-full h-9 font-medium text-sm px-4 py-2"
          onClick={() => setIsEditModalOpen(true)}
        >
          Edit Profile
        </Button>
        
        {isEditModalOpen && (
          <Suspense fallback={null}>
            <EditProfileModal 
              isOpen={isEditModalOpen} 
              onClose={() => setIsEditModalOpen(false)} 
              userId={user!._id}
              initialData={profileData}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
        />
        <Button variant="outline" size="sm" disabled className="h-9 font-medium text-sm px-4 py-2 rounded-full">
          Loading
        </Button>
      </div>
    );
  }

  // Not authenticated - show disabled button
  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
        />
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-full h-9 font-medium text-sm px-4 py-2"
          title="Sign in to add as friend"
        >
          Add Friend
        </Button>
      </div>
    );
  }

  // Determine the button state based on friendship status
  if (!currentStatus?.exists) {
    // Not friends - show add button
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
          friendshipStatus={currentStatus?.status}
          friendshipDirection={currentStatus?.direction}
          onUnfriend={handleUnfriend}
        />
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-full h-9 font-medium text-sm px-4 py-2"
          onClick={handleAddFriend}
        >
          Add Friend
        </Button>
      </div>
    );
  } else if (currentStatus.status === "pending") {
    if (currentStatus.direction === "sent") {
      // Pending request sent by current user - simple pending button
      return (
        <div className="flex items-center gap-2">
          <MenuButton 
            userId={userId}
            friendshipStatus={currentStatus.status}
            friendshipDirection={currentStatus.direction}
            onUnfriend={handleUnfriend}
          />
          <Button variant="outline" size="sm" className="h-9 rounded-full bg-muted font-medium text-sm px-4 py-2">
            Pending
          </Button>
        </div>
      );
    } else {
      // Pending request received - show pending button with accept/decline in menu
      return (
        <div className="flex items-center gap-2">
          <MenuButton 
            userId={userId}
            friendshipStatus={currentStatus.status}
            friendshipDirection={currentStatus.direction}
            onAcceptFriend={handleAcceptFriend}
            onUnfriend={handleUnfriend}
          />
          <Button variant="outline" size="sm" className="h-9 rounded-full bg-muted font-medium text-sm px-4 py-2">
            Pending
          </Button>
        </div>
      );
    }
  } else if (currentStatus.status === "accepted") {
    // Already friends - show friends status and unfriend option in menu
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
          friendshipStatus={currentStatus.status}
          friendshipDirection={currentStatus.direction}
          onUnfriend={handleUnfriend}
        />
        <Button variant="outline" className="rounded-full h-9 bg-muted font-medium text-sm px-4 py-2" size="sm">
          Friends
        </Button>
      </div>
    );
  }

  // Fallback
  return null;
} 