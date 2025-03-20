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

// Define types for our notifications
interface FriendshipData {
  _id: Id<"friends">;
  requesterId: Id<"users">;
  requesteeId: Id<"users">;
  status: string;
  createdAt: number;
  updatedAt?: number;
  direction: string;
  friendId: Id<"users">;
}

interface ProfileData {
  _id: Id<"profiles">;
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
            
            return (
              <div key={notification.friendship._id} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
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
                  <div>
                    <p className="font-medium">
                      {notification.profile.name || notification.profile.username}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {notification.friendship.direction === "received" && notification.friendship.status === "pending" && 
                        "Sent you a friend request"}
                      {notification.friendship.direction === "sent" && notification.friendship.status === "accepted" && 
                        "Accepted your friend request"}
                      {notification.friendship.status === "accepted" && notification.friendship.direction === "received" && 
                        "You are now friends"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {notification.friendship.direction === "received" && notification.friendship.status === "pending" ? (
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
            );
          })}
        </div>
      )}
    </div>
  );
} 