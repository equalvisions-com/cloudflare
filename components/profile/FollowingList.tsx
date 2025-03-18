"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";

interface FollowingListProps {
  username: string;
  initialCount?: number;
  initialFollowing?: {
    following: (FollowingWithPost | null)[]; // Allow null values in the array
    hasMore: boolean;
    cursor: Id<"following"> | null;
  };
}

// Types for following data from the API
interface FollowingData {
  userId: Id<"users">;
  postId: Id<"posts">;
  feedUrl: string;
  _id: Id<"following">;
}

interface PostData {
  _id: Id<"posts">;
  title: string;
  postSlug: string;
  category: string;
  categorySlug: string;
  featuredImg?: string;
  mediaType: string;
}

interface FollowingWithPost {
  following: FollowingData;
  post: PostData;
}

export function FollowingList({ username, initialCount = 0, initialFollowing }: FollowingListProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followingItems, setFollowingItems] = useState<FollowingWithPost[]>(
    initialFollowing?.following.filter(Boolean) as FollowingWithPost[] || []
  );
  const [cursor, setCursor] = useState<Id<"following"> | null>(initialFollowing?.cursor || null);
  const [hasMore, setHasMore] = useState<boolean>(initialFollowing?.hasMore || false);
  const [count, setCount] = useState<number>(initialCount);
  
  // Use the count query when the modal is open to make sure we have the latest count
  const latestCount = useQuery(api.following.getFollowingCountByUsername, open ? { 
    username
  } : "skip");
  
  // Get next page of following when the modal is open and we need to load more
  const loadMoreFollowing = async () => {
    if (!hasMore || isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await fetch(`/api/following?username=${username}&cursor=${cursor}`).then(res => res.json());
      setFollowingItems([...followingItems, ...result.following]);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Failed to load more following:", error);
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
          <BookOpen className="h-3.5 w-3.5" />
          <span>{count} Following</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Following</DialogTitle>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          {!followingItems.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Not following any content yet
            </div>
          ) : (
            <div className="space-y-1">
              {followingItems.map((item: FollowingWithPost) => (
                <div key={item.following._id.toString()} className="p-2 hover:bg-accent rounded-md">
                  <Link 
                    href={`/${item.post.categorySlug}/${item.post.postSlug}`} 
                    className="flex items-center gap-2"
                    onClick={() => setOpen(false)}
                  >
                    <div className="h-10 w-10 flex-shrink-0 rounded-md bg-muted overflow-hidden">
                      {item.post.featuredImg ? (
                        <img 
                          src={item.post.featuredImg} 
                          alt={item.post.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-muted">
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{item.post.title}</p>
                      <p className="text-xs text-muted-foreground">{item.post.category}</p>
                    </div>
                  </Link>
                </div>
              ))}
              
              {hasMore && (
                <div className="py-2 text-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={loadMoreFollowing}
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