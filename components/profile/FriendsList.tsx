"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/profile/ProfileImage";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { SimpleFriendButton } from "../ui/SimpleFriendButton";

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
  _id: Id<"users">;
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
    initialFriends?.friends.filter((f): f is FriendWithProfile => f !== null) || []
  );
  const [cursor, setCursor] = useState<string | null>(initialFriends?.cursor || null);
  const [hasMore, setHasMore] = useState<boolean>(initialFriends?.hasMore ?? false);
  const [count, setCount] = useState<number>(initialCount);
  
  // Use the count query when the drawer is open to make sure we have the latest count
  const latestCount = useQuery(api.friends.getFriendCountByUsername, open ? { 
    username,
    status: "accepted"
  } : "skip");
  
  // Get next page of friends when the drawer is open and we need to load more
  const loadMoreFriends = async () => {
    if (!hasMore || isLoading || !cursor) return;
    
    setIsLoading(true);
    try {
      const result = await fetch(`/api/friends?username=${username}&cursor=${cursor}`).then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      });

      const newFriends = result.friends.filter((f: FriendWithProfile | null): f is FriendWithProfile => f !== null);

      setFriends(prevFriends => [...prevFriends, ...newFriends]);
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
    if (latestCount !== undefined && latestCount !== null) {
      setCount(latestCount);
    }
  }, [latestCount]);
  
  // Effect to reset friends list when drawer opens if initial data wasn't provided or might be stale
  useEffect(() => {
    if (open && !initialFriends) {
      // Reset state if opening without initial data or to refresh
      setFriends([]);
      setCursor(null);
      setHasMore(false); // Assume we need to load initially
      // Trigger initial load if needed, potentially combine with loadMoreFriends logic
      // Or rely on a separate initial load mechanism if `loadMoreFriends` only handles subsequent pages
      // For simplicity, let's assume the initial load happens correctly or is triggered elsewhere.
      // If the first page needs to be loaded on open, add that logic here.
    }
    // If using initialFriends, ensure they are loaded correctly when opening
    if (open && initialFriends) {
        setFriends(initialFriends.friends.filter((f): f is FriendWithProfile => f !== null));
        setCursor(initialFriends.cursor);
        setHasMore(initialFriends.hasMore);
    }

  }, [open, initialFriends]); // Rerun when open state changes or initial data changes
  
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="link" className="p-0 h-auto text-sm flex items-center gap-1 focus-visible:ring-0 focus:outline-none hover:no-underline">
          <span className="leading-none font-bold mr-[1px]">{count}</span><span className="leading-none font-semibold"> {count === 1 ? "Friend" : "Friends"}</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[75vh] w-full max-w-[550px] mx-auto">
        <DrawerHeader className="px-4 pb-4 border-b border-border">
          <DrawerTitle className="text-base font-extrabold leading-none tracking-tight text-center">Friends</DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 overflow-y-auto" scrollHideDelay={0} type="always">
          {isLoading && friends.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !friends.length ? (
            <div className="text-center py-8 text-muted-foreground">
              No friends found
            </div>
          ) : (
            <div className="space-y-0">
              {friends.map((friend: FriendWithProfile) => (
                <div key={friend.friendship._id.toString()} className="flex items-center justify-between gap-3 p-4 border-b border-border">
                  <Link
                    href={`/@${friend.profile.username}`}
                    className="flex-shrink-0"
                    onClick={() => setOpen(false)}
                  >
                    <ProfileImage
                      profileImage={friend.profile.profileImage}
                      username={friend.profile.username}
                      size="md-lg"
                    />
                  </Link>
                  <div className="flex flex-col flex-1">
                    <Link href={`/@${friend.profile.username}`} onClick={() => setOpen(false)}>
                      <span className="text-sm font-bold">{friend.profile.name || friend.profile.username}</span>
                    </Link>
                     <Link href={`/@${friend.profile.username}`} onClick={() => setOpen(false)} className="mt-[-4px]">
                      <span className="text-xs text-muted-foreground">@{friend.profile.username}</span>
                     </Link>
                  </div>
                  <SimpleFriendButton
                    username={friend.profile.username}
                    userId={friend.profile._id} // Use _id from profile as the user ID
                    profileData={{
                      username: friend.profile.username,
                      name: friend.profile.name,
                      profileImage: friend.profile.profileImage
                    }}
                    initialFriendshipStatus={{
                      exists: true,
                      status: "accepted",
                      direction: null, // Direction isn't strictly needed for 'accepted' state display
                      friendshipId: friend.friendship._id
                    }}
                  />
                </div>
              ))}

              {hasMore && (
                <div className="py-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreFriends}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isLoading ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
} 