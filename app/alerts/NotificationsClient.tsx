"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon, UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMutation } from "convex/react";
import { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar-context";

// Define types for our notifications
interface FriendshipData {
  _id: Id<"friends">;
  requesterId: Id<"users">;
  requesteeId: Id<"users">;
  status: string;
  createdAt: number;
  updatedAt?: number;
  direction: string;
  type: string;
  friendId?: Id<"users">;
}

interface ProfileData {
  _id: Id<"users">;
  userId: Id<"users">;
  username: string;
  name?: string | null;
  bio?: string | null;
  profileImage?: string | null;
}

interface NotificationItem {
  friendship: FriendshipData;
  profile: ProfileData;
}

interface NotificationsData {
  user: any;
  notifications: NotificationItem[];
}

export default function NotificationsClient() {
  const { toast } = useToast();
  const { pendingFriendRequestCount, updatePendingFriendRequestCount } = useSidebar();
  
  // Get notifications data in a single query
  const data = useQuery(api.friends.getNotifications) as NotificationsData | undefined;
  
  // Mutations
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const deleteFriendship = useMutation(api.friends.deleteFriendship);
  
  // Loading states
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [decliningIds, setDecliningIds] = useState<Set<string>>(new Set());
  
  // If data is not available yet, simply return null to let the wrapper handle loading state
  if (!data) {
    return null;
  }
  
  const { user, notifications } = data;
  
  if (!user) {
    return (
      <div className="p-8 rounded-lg bg-muted/50 text-center">
        <UserIcon className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view notifications</h2>
        <p className="text-muted-foreground">You need to be signed in to view your notifications.</p>
      </div>
    );
  }
  
  const handleAcceptRequest = async (friendshipId: Id<"friends">) => {
    setAcceptingIds(prev => new Set(prev).add(friendshipId));
    try {
      await acceptRequest({ friendshipId });
      toast({
        description: "Friend request accepted",
      });
      updatePendingFriendRequestCount(pendingFriendRequestCount - 1);
    } catch (error) {
      console.error("Failed to accept friend request:", error);
      toast({
        variant: "destructive",
        description: "Failed to accept friend request",
      });
    } finally {
      setAcceptingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(friendshipId);
        return newSet;
      });
    }
  };
  
  const handleDeclineRequest = async (friendshipId: Id<"friends">) => {
    setDecliningIds(prev => new Set(prev).add(friendshipId));
    try {
      await deleteFriendship({ friendshipId });
      toast({
        description: "Friend request declined",
      });
      updatePendingFriendRequestCount(pendingFriendRequestCount - 1);
    } catch (error) {
      console.error("Failed to decline friend request:", error);
      toast({
        variant: "destructive",
        description: "Failed to decline friend request",
      });
    } finally {
      setDecliningIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(friendshipId);
        return newSet;
      });
    }
  };
  
  const handleRemoveFriend = async (friendshipId: Id<"friends">) => {
    setDecliningIds(prev => new Set(prev).add(friendshipId));
    try {
      await deleteFriendship({ friendshipId });
      toast({
        description: "Friend removed",
      });
    } catch (error) {
      console.error("Failed to remove friend:", error);
      toast({
        variant: "destructive",
        description: "Failed to remove friend",
      });
    } finally {
      setDecliningIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(friendshipId);
        return newSet;
      });
    }
  };
  
  return (
    <>
      {notifications.length === 0 ? (
        <div className="p-8 rounded-lg bg-muted/50 text-center">
          <div className="mx-auto h-10 w-10 text-muted-foreground mb-4 flex items-center justify-center">
            <CheckIcon className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
          <p className="text-muted-foreground">You have no new notifications.</p>
        </div>
      ) : (
        <div className="">
          {notifications.map((notification) => {
            // We know notifications is not null here, and we're mapping through valid elements
            const isAccepting = acceptingIds.has(notification.friendship._id);
            const isDeclining = decliningIds.has(notification.friendship._id);
            const isLoading = isAccepting || isDeclining;
            const profileUrl = `/@${notification.profile.username}`;
            
            return (
              <div key={notification.friendship._id} className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  <Link href={profileUrl} className="block">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {notification.profile.profileImage ? (
                        <img 
                          src={notification.profile.profileImage} 
                          alt={notification.profile.username || "User"} 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </Link>
                  <div>
                    <Link href={profileUrl} className="hover:none">
                      <p className="font-bold text-sm">
                        {notification.profile.name || notification.profile.username}
                      </p>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {notification.friendship.type === "friend_request" && 
                        "Sent you a friend request"}
                      {notification.friendship.type === "friend_accepted" && 
                        "Accepted your friend request"}
                      {notification.friendship.type === "friend_you_accepted" && 
                        "You accepted their friend request"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {notification.friendship.type === "friend_request" ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleAcceptRequest(notification.friendship._id)}
                        disabled={isLoading}
                        className="rounded-full bg-muted/90 hover:bg-muted shadow-none"
                      >
                        <CheckIcon className="h-4 w-4" strokeWidth={2.25} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeclineRequest(notification.friendship._id)}
                        disabled={isLoading}
                        className="rounded-full bg-muted/90 hover:bg-muted shadow-none"
                      >
                        <XIcon className="h-4 w-4" strokeWidth={2.25} />
                      </Button>
                    </>
                  ) : notification.friendship.status === "accepted" ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-full shadow-none font-semibold text-sm"
                          disabled={isLoading}
                        >
                          Friends
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleRemoveFriend(notification.friendship._id)}
                          className="text-red-500 focus:text-red-500 focus:bg-red-50"
                        >
                          <XIcon className="mr-2 h-4 w-4" />
                          Remove friend
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
} 