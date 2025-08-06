"use client";

import { useState, useEffect, lazy, Suspense, useRef, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, UserCheck, UserX, UserMinus, UserPlus, Clock, UserCog, UserPen } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import type { ProfileData } from "@/lib/types";

// Lazy load the EditProfileModal component
const EditProfileModal = lazy(() => import("./EditProfileModal").then(mod => ({ default: mod.EditProfileModal })));

type FriendshipStatus = {
  exists: boolean;
  status: string | null;
  direction: string | null;
  friendshipId: Id<"friends"> | null;
};

interface FriendButtonProps {
  username: string;
  userId: Id<"users">;
  profileData: ProfileData;
  initialFriendshipStatus?: FriendshipStatus | null; // Add prop for server-provided status
  className?: string; // Add optional className prop
}

const FriendButtonComponent = ({ username, userId, profileData, initialFriendshipStatus, className }: FriendButtonProps) => {
  // Use sidebar context to get current viewer info and auth state
  const { 
    isAuthenticated, 
    isLoading: isAuthLoading,
    username: viewerUsername,
    userId: viewerId,
    displayName: viewerName
  } = useSidebar();
  
  const [currentStatus, setCurrentStatus] = useState<FriendshipStatus | null>(initialFriendshipStatus || null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
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

  // Smart profile detection: Compare usernames to detect own profile
  const isOwnProfile = isAuthenticated && viewerUsername === username;
  const user = viewerId ? { _id: viewerId, name: viewerName, username: viewerUsername } : null;

  // Only fetch friendship status if:
  // 1. Not viewing own profile
  // 2. User is authenticated
  // 3. Server didn't provide initial status
  const shouldFetchStatus = isAuthenticated && !isOwnProfile && !initialFriendshipStatus;
  const friendshipStatus = useQuery(
    api.friends.getFriendshipStatusByUsername, 
    shouldFetchStatus ? { username } : "skip"
  );
  
  // Track if query is loading - only when we're actually fetching
  const isFriendshipLoading = friendshipStatus === undefined && shouldFetchStatus;

  // Smart loading logic: Only show loading when actually fetching data
  // Don't depend on auth loading when we have server data or can detect own profile
  const isLoading = isActionLoading || isFriendshipLoading;

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
      if (isMountedRef.current) {
        setCurrentStatus({
          exists: true,
          status: "pending",
          direction: "sent",
          friendshipId: null, 
        });
      }
    } catch (error) {
      
      const errorMessage = (error as Error).message || "An unknown error occurred";
      let toastTitle = "Error Sending Request";
      let toastDescription = "Could not send friend request. Please try again.";

      if (errorMessage.includes("Cannot send friend request to yourself")) {
        toastDescription = "You cannot send a friend request to yourself.";
      } else if (errorMessage.includes("Friend request already sent")) {
        toastDescription = "You have already sent a friend request to this user.";
      } else if (errorMessage.includes("Friendship already exists")) {
        toastDescription = "You are already friends with this user or a request is pending.";
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("Rate limit") || 
                 errorMessage.includes("too quickly") || errorMessage.includes("limit reached")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "You're performing actions too quickly. Please slow down.";
      }
      toast({ title: toastTitle, description: toastDescription });
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [isAuthenticated, sendRequest, userId, toast]);

  // Handle accept friend request
  const handleAcceptFriend = useCallback(async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated || !isMountedRef.current) return;
    
    setIsActionLoading(true);
    try {
      await acceptRequest({ friendshipId: currentStatus.friendshipId });
      if (isMountedRef.current) {
        setCurrentStatus({
          ...currentStatus,
          status: "accepted",
        });
      }
    } catch (error) {
      
      const errorMessage = (error as Error).message || "An unknown error occurred";
      let toastTitle = "Error Accepting Request";
      let toastDescription = "Could not accept friend request. Please try again.";

      if (errorMessage.includes("Friend request not found")) {
        toastDescription = "The friend request could not be found. It might have been withdrawn.";
      } else if (errorMessage.includes("Not authorized to accept this friend request")) {
        toastDescription = "You are not authorized to accept this friend request.";
      } else if (errorMessage.includes("Friend request is not pending")) {
        toastDescription = "This friend request is no longer pending.";
      }
      toast({ title: toastTitle, description: toastDescription });
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [currentStatus, isAuthenticated, acceptRequest, toast]);

  // Handle unfriend or cancel request
  const handleUnfriend = useCallback(async () => {
    if (!currentStatus?.friendshipId || !isAuthenticated || !isMountedRef.current) return;
    
    setIsActionLoading(true);
    try {
      await deleteFriendship({ friendshipId: currentStatus.friendshipId });
      if (isMountedRef.current) {
        setCurrentStatus({
          exists: false,
          status: null,
          direction: null,
          friendshipId: null,
        });
      }
    } catch (error) {
      
      const errorMessage = (error as Error).message || "An unknown error occurred";
      let toastTitle = "Error Modifying Friendship";
      let toastDescription = "Could not update friendship status. Please try again.";

      if (errorMessage.includes("Friendship not found")) {
        toastDescription = "The friendship record could not be found.";
      } else if (errorMessage.includes("Not authorized to delete this friendship")) {
        toastDescription = "You are not authorized to modify this friendship.";
      }
      toast({ title: toastTitle, description: toastDescription });
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [currentStatus, isAuthenticated, deleteFriendship, toast]);

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

  // Show edit profile button on own profile - use smart detection instead of status
  if (isOwnProfile) {
    return (
      <>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("rounded-lg h-9 font-semibold text-sm px-4 py-2 shadow-none bg-transparent text-muted-foreground border border-input hover:bg-accent hover:text-accent-foreground", className)}
          onClick={handleEditProfileClick}
        >
          <UserPen className="h-4 w-4" />
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
      </>
    );
  }

  // Loading state - only show when we're actually fetching data and don't have initial state
  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className={cn("h-9 font-semibold text-sm px-4 py-2 rounded-lg shadow-none border !opacity-100 text-muted-foreground", className)}>
        Loading
      </Button>
    );
  }

  // Not authenticated - show button that redirects to signin
  if (!isAuthenticated) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className={cn("rounded-lg h-9 font-semibold text-sm px-4 py-2 shadow-none bg-primary/90 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-none", className)}
        onClick={handleSignInRedirect}
      >
        <UserPlus className="h-4 w-4" />
        Add Friend
      </Button>
    );
  }

  // Determine the button state based on friendship status
  if (!currentStatus?.exists) {
    // Not friends - show add button
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        className={cn("rounded-lg h-9 font-semibold text-sm px-4 py-2 shadow-none bg-primary/90 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-none", className)}
        onClick={handleAddFriend}
      >
        <UserPlus className="h-4 w-4" />
        Add Friend
      </Button>
    );
  } else if (currentStatus.status === "pending") {
    if (currentStatus.direction === "sent") {
      // Pending request sent by current user - show cancel option in dropdown
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={cn("h-9 rounded-lg bg-transparent text-muted-foreground font-semibold text-sm px-4 py-2 shadow-none border border-input hover:bg-accent hover:text-accent-foreground", className)}>
              <>
                <Clock className="h-4 w-4" />
                Pending
              </>
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
      );
    } else {
      // Pending request received - show accept/decline options in menu
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={cn("h-9 rounded-lg bg-transparent text-muted-foreground font-semibold text-sm px-4 py-2 shadow-none border border-input hover:bg-accent hover:text-accent-foreground", className)}>
              <>
                <Clock className="h-4 w-4" />
                Pending
              </>
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
      );
    }
  } else if (currentStatus.status === "accepted") {
    // Already friends - show unfriend option in dropdown
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn("h-9 rounded-lg bg-transparent text-muted-foreground font-semibold text-sm px-4 py-2 shadow-none border border-input hover:bg-accent hover:text-accent-foreground", className)}>
            <>
              <UserCheck className="h-4 w-4" />
              Friends
            </>
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
    );
  }
  
  // Fallback for any other unhandled state
  return (
    <Button variant="ghost" size="sm" className={cn("h-9 font-semibold text-sm px-4 py-2 rounded-lg shadow-none border-none", className)}>
      <UserPlus className="h-4 w-4" />
      Add Friend
    </Button>
  );
};

// Export the memoized version of the component
export const FriendButton = memo(FriendButtonComponent); 