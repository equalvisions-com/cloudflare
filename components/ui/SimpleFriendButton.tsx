"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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

const SimpleFriendButtonComponent = ({ 
  username, 
  userId, 
  profileData, 
  initialFriendshipStatus,
  className = "rounded-full h-[23px] text-xs px-2 flex-shrink-0 mt-0 font-semibold border-0 shadow-none text-muted-foreground",
  loadingClassName = "",
  pendingClassName = "text-muted-foreground",
  friendsClassName = "text-muted-foreground" 
}: SimpleFriendButtonProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const [currentStatus, setCurrentStatus] = useState<FriendshipStatus | null>(initialFriendshipStatus || null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  
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
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    if (!isMountedRef.current) return;
    
    setIsActionLoading(true);
    try {
      const result = await sendRequest({ requesteeId: userId });
      if (result && isMountedRef.current) {
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
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [isAuthenticated, router, userId, sendRequest]);

  // Handle accept friend request
  const handleAcceptFriend = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    if (!currentStatus?.friendshipId || !isMountedRef.current) return;
    
    setIsActionLoading(true);
    try {
      await acceptRequest({ friendshipId: currentStatus.friendshipId });
      // Optimistically update UI
      if (isMountedRef.current) {
        setCurrentStatus({
          ...currentStatus,
          status: "accepted",
        });
      }
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [isAuthenticated, router, currentStatus, acceptRequest]);

  // Handle unfriend or cancel request
  const handleUnfriend = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }
    
    if (!currentStatus?.friendshipId || !isMountedRef.current) return;
    
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
      }
    } catch (error) {
      console.error("Failed to unfriend:", error);
    } finally {
      if (isMountedRef.current) {
        setIsActionLoading(false);
      }
    }
  }, [isAuthenticated, router, currentStatus, deleteFriendship]);

  // Memoize the signin redirect handler
  const handleSignInRedirect = useCallback(() => {
    router.push("/signin");
  }, [router]);

  // Show "Your Profile" button on own profile
  if (currentStatus?.status === "self" && isAuthenticated) {
    return null; // Don't display any button for own profile
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

  // Not authenticated - show sign in button
  if (!isAuthenticated) {
    return (
      <Button 
        variant="default" 
        size="sm" 
        className={cn(className, "border-0 shadow-none")}
        onClick={handleSignInRedirect}
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
};

// Export the memoized version of the component
export const SimpleFriendButton = memo(SimpleFriendButtonComponent); 