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

// Format timestamp to human-readable format (e.g., "2 hrs ago")
const formatTimestamp = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  // Convert milliseconds to different time units
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  
  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else if (weeks < 4) {
    return `${weeks}w ago`;
  } else if (months < 12) {
    return `${months}m ago`;
  } else {
    // For anything older than a year, just show the date
    return new Date(timestamp).toLocaleDateString();
  }
};

export default function NotificationsClient() {
  const { toast } = useToast();
  
  // Get notifications data in a single query
  const data = useQuery(api.friends.getNotifications) as NotificationsData | undefined;
  
  // Mutations
  const acceptRequest = useMutation(api.friends.acceptFriendRequest);
  const deleteFriendship = useMutation(api.friends.deleteFriendship);
  
  // Loading states
  const [acceptingIds, setAcceptingIds] = useState<Set<string>>(new Set());
  const [decliningIds, setDecliningIds] = useState<Set<string>>(new Set());
  
  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        <div className="p-4">Loading notifications...</div>
      </div>
    );
  }
  
  const { user, notifications } = data;
  
  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="p-8 rounded-lg bg-muted/50 text-center">
          <UserIcon className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to view notifications</h2>
          <p className="text-muted-foreground">You need to be signed in to view your notifications.</p>
        </div>
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
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Notifications</h1>
      
      {notifications.length === 0 ? (
        <div className="p-8 rounded-lg bg-muted/50 text-center">
          <div className="mx-auto h-10 w-10 text-muted-foreground mb-4 flex items-center justify-center">
            <CheckIcon className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
          <p className="text-muted-foreground">You have no new notifications.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            // We know notifications is not null here, and we're mapping through valid elements
            const isAccepting = acceptingIds.has(notification.friendship._id);
            const isDeclining = decliningIds.has(notification.friendship._id);
            const isLoading = isAccepting || isDeclining;
            const profileUrl = `/@${notification.profile.username}`;
            
            return (
              <div key={notification.friendship._id} className="flex items-center justify-between p-4 rounded-lg border">
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
                    <Link href={profileUrl} className="hover:underline">
                      <p className="font-medium">
                        {notification.profile.name || notification.profile.username}
                      </p>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {notification.friendship.type === "friend_request" && 
                        "Sent you a friend request"}
                      {notification.friendship.type === "friend_accepted" && 
                        "Accepted your friend request"}
                      {notification.friendship.type === "friend_you_accepted" && 
                        "You accepted their friend request"}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xs text-muted-foreground">
                    {formatTimestamp(notification.friendship.updatedAt || notification.friendship.createdAt)}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {notification.friendship.type === "friend_request" ? (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeclineRequest(notification.friendship._id)}
                          disabled={isLoading}
                          className="rounded-full bg-muted/50 hover:bg-muted"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleAcceptRequest(notification.friendship._id)}
                          disabled={isLoading}
                          className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </Button>
                      </>
                    ) : notification.friendship.status === "accepted" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-full"
                            disabled={isLoading}
                          >
                            Friends
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleRemoveFriend(notification.friendship._id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <XIcon className="mr-2 h-4 w-4" />
                            Remove friend
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 