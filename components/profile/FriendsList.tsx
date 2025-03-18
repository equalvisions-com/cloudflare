"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/profile/ProfileImage";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

interface FriendsListProps {
  username: string;
  initialCount?: number;
  initialFriends?: {
    friends: (FriendWithProfile | null)[]; // Allow null values in the array
    hasMore: boolean;
    cursor: string | null;
  };
}

// Types for friendship data from the API
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
  name?: string;
  profileImage?: string;
  bio?: string;
}

interface FriendWithProfile {
  friendship: FriendshipData;
  profile: ProfileData;
}

export function FriendsList({ username, initialCount = 0, initialFriends }: FriendsListProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [friends, setFriends] = useState<FriendWithProfile[]>(
    initialFriends?.friends.filter(Boolean) as FriendWithProfile[] || []
  );
  const [cursor, setCursor] = useState<string | null>(initialFriends?.cursor || null);
  const [hasMore, setHasMore] = useState<boolean>(initialFriends?.hasMore || false);
  const [count, setCount] = useState<number>(initialCount);
  
  // Use the count query when the modal is open to make sure we have the latest count
  const latestCount = useQuery(api.friends.getFriendCountByUsername, open ? { 
    username,
    status: "accepted"
  } : "skip");
  
  // Get next page of friends when the modal is open and we need to load more
  const loadMoreFriends = async () => {
    if (!hasMore || isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await fetch(`/api/friends?username=${username}&cursor=${cursor}`).then(res => res.json());
      setFriends([...friends, ...result.friends]);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Failed to load more friends:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update the count if it changes
  useEffect(() => {
    if (latestCount !== undefined) {
      setCount(latestCount);
    }
  }, [latestCount]);
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="link" className="p-0 h-auto text-sm text-muted-foreground flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          <span>{count} {count === 1 ? "Friend" : "Friends"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Friends</DialogTitle>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          {!friends.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No friends found
            </div>
          ) : (
            <div className="space-y-1">
              {friends.map((friend: FriendWithProfile) => (
                <div key={friend.friendship._id.toString()} className="p-2 hover:bg-accent rounded-md">
                  <Link 
                    href={`/@${friend.profile.username}`} 
                    className="flex items-center gap-2"
                    onClick={() => setOpen(false)}
                  >
                    <ProfileImage 
                      profileImage={friend.profile.profileImage} 
                      username={friend.profile.username}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-medium">{friend.profile.name || friend.profile.username}</p>
                      <p className="text-xs text-muted-foreground">@{friend.profile.username}</p>
                    </div>
                  </Link>
                </div>
              ))}
              
              {hasMore && (
                <div className="py-2 text-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={loadMoreFriends}
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 