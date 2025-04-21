"use client";

import { useState, useEffect, lazy, Suspense, useRef, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, UserCheck, UserX, UserMinus } from "lucide-react";
import { MenuButton } from "@/components/ui/friend-menu-button";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useRouter } from "next/navigation";

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
  initialFriendshipStatus?: FriendshipStatus | null; // Add prop for server-provided status
}

const FriendButtonComponent = ({ username, userId, profileData, initialFriendshipStatus }: FriendButtonProps) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [currentStatus, setCurrentStatus] = useState<FriendshipStatus | null>(initialFriendshipStatus || null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { pendingFriendRequestCount, updatePendingFriendRequestCount } = useSidebar();
  const router = useRouter();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Only fetch viewer if authenticated and we need it
  const needsViewerQuery = isAuthenticated && 
    (!currentStatus || (currentStatus.status === "self" && isEditModalOpen));
  const user = useQuery(api.users.viewer, needsViewerQuery ? {} : "skip");

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
    if (!isMountedRef.current) return;
    
    if (friendshipStatus) {
      setCurrentStatus(friendshipStatus);
    }
  }, [friendshipStatus]);

  // Handle add friend action
  const handleAddFriend = useCallback(async () => {
    if (!isAuthenticated || !isMountedRef.current) return;
    
    setIsActionLoading(true);
    try {
      await sendRequest({ requesteeId: userId });
      // Optimistically update UI
      if (isMountedRef.current) {
        setCurrentStatus({
          exists: true,
          status: "pending",
          direction: "sent",
          friendshipId: null, // We don't know the ID yet, will be updated on next query
        });
      }
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [isAuthenticated, sendRequest, userId]);

  // Handle accept friend request
  const handleAcceptFriend = useCallback(async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated || !isMountedRef.current) return;
    
    setIsActionLoading(true);
    try {
      await acceptRequest({ friendshipId: currentStatus.friendshipId });
      // Optimistically update UI
      if (isMountedRef.current) {
        setCurrentStatus({
          ...currentStatus,
          status: "accepted",
        });
        updatePendingFriendRequestCount(pendingFriendRequestCount - 1);
      }
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [currentStatus, isAuthenticated, acceptRequest, updatePendingFriendRequestCount, pendingFriendRequestCount]);

  // Handle unfriend or cancel request
  const handleUnfriend = useCallback(async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated || !isMountedRef.current) return;
    
    setIsActionLoading(true);
    try {
      await deleteFriendship({ friendshipId: currentStatus.friendshipId });
      // Optimistically update UI
      if (isMountedRef.current) {
        setCurrentStatus({
          exists: false,
          status: null,
          direction: null,
          friendshipId: null,
        });
        
        // If we're declining a pending request, decrement the count
        if (currentStatus.status === "pending" && currentStatus.direction === "received") {
          updatePendingFriendRequestCount(pendingFriendRequestCount - 1);
        }
      }
    } catch (error) {
      console.error("Failed to unfriend:", error);
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [currentStatus, isAuthenticated, deleteFriendship, updatePendingFriendRequestCount, pendingFriendRequestCount]);

  // Memoize the edit profile handler
  const handleEditProfileClick = useCallback(() => {
    if (isMountedRef.current) {
      setIsEditModalOpen(true);
    }
  }, []);

  // Memoize the modal close handler
  const handleModalClose = useCallback(() => {
    if (isMountedRef.current) {
      setIsEditModalOpen(false);
    }
  }, []);

  // Memoize the signin redirect handler
  const handleSignInRedirect = useCallback(() => {
    router.push("/signin");
  }, [router]);

  // Show edit profile button on own profile
  if (currentStatus?.status === "self" && isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
        />
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full h-9 font-semibold text-sm px-4 py-2 shadow-none bg-transparent text-muted-foreground border border-input hover:bg-accent hover:text-accent-foreground"
          onClick={handleEditProfileClick}
        >
          Edit Profile
        </Button>
        
        {isEditModalOpen && user && (
          <Suspense fallback={null}>
            <EditProfileModal 
              isOpen={isEditModalOpen} 
              onClose={handleModalClose} 
              userId={user._id}
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
        <Button variant="ghost" size="sm" disabled className="h-9 font-semibold text-sm px-4 py-2 rounded-full shadow-none border !opacity-100 text-muted-foreground">
          Loading
        </Button>
      </div>
    );
  }

  // Not authenticated - show button that redirects to signin
  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
        />
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full h-9 font-semibold text-sm px-4 py-2 shadow-none bg-primary/90 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-none"
          onClick={handleSignInRedirect}
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
        />
        <Button 
          variant="ghost" 
          size="sm" 
          className="rounded-full h-9 font-semibold text-sm px-4 py-2 shadow-none bg-primary/90 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-none"
          onClick={handleAddFriend}
        >
          Add Friend
        </Button>
      </div>
    );
  } else if (currentStatus.status === "pending") {
    if (currentStatus.direction === "sent") {
      // Pending request sent by current user - show cancel option in dropdown
      return (
        <div className="flex items-center gap-2">
          <MenuButton 
            userId={userId}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 rounded-full bg-transparent text-muted-foreground font-semibold text-sm px-4 py-2 shadow-none border border-input hover:bg-accent hover:text-accent-foreground">
                Pending
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-500"
                onClick={handleUnfriend}
              >
                <UserX className="mr-2 h-4 w-4" />
                Cancel Request
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    } else {
      // Pending request received - show accept/decline options in menu
      return (
        <div className="flex items-center gap-2">
          <MenuButton 
            userId={userId}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 rounded-full bg-transparent text-muted-foreground font-semibold text-sm px-4 py-2 shadow-none border border-input hover:bg-accent hover:text-accent-foreground">
                Pending
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleAcceptFriend}>
                <UserCheck className="mr-2 h-4 w-4" />
                Accept Request
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-500"
                onClick={handleUnfriend}
              >
                <UserX className="mr-2 h-4 w-4" />
                Decline Request
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }
  } else if (currentStatus.status === "accepted") {
    // Already friends - show unfriend option in dropdown
    return (
      <div className="flex items-center gap-2">
        <MenuButton 
          userId={userId}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 rounded-full bg-transparent text-muted-foreground font-semibold text-sm px-4 py-2 shadow-none border border-input hover:bg-accent hover:text-accent-foreground">
              Friends
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-500"
              onClick={handleUnfriend}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              Remove Friend
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
  
  // Fallback for any other unhandled state
  return (
    <div className="flex items-center gap-2">
      <MenuButton 
        userId={userId}
      />
      <Button variant="ghost" size="sm" className="h-9 font-semibold text-sm px-4 py-2 rounded-full shadow-none border-none">
        Add Friend
      </Button>
    </div>
  );
};

// Export the memoized version of the component
export const FriendButton = memo(FriendButtonComponent); 