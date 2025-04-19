"use client";

import { useState, useEffect, useMemo } from "react";
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
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { FollowButtonWithErrorBoundary } from "../follow-button/FollowButton";
import { VerifiedBadge } from "../VerifiedBadge";

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
  categorySlug: string;
  featuredImg?: string;
  mediaType: string;
  verified?: boolean;
}

interface FollowingWithPost {
  following: FollowingData;
  post: PostData;
}

// New Component Definition
interface ViewerFollowStatusButtonProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
}

function ViewerFollowStatusButton({ postId, feedUrl, postTitle }: ViewerFollowStatusButtonProps) {
  const isViewerFollowing = useQuery(
    api.following.isFollowing,
    { postId }
  );

  if (isViewerFollowing === undefined) {
    return (
      <Button variant="outline" size="sm" disabled className="flex-shrink-0 w-[100px]">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <FollowButtonWithErrorBoundary
      postId={postId}
      feedUrl={feedUrl}
      postTitle={postTitle}
      initialIsFollowing={isViewerFollowing}
      className="flex-shrink-0"
      disableAutoFetch={true}
    />
  );
}
// End of New Component Definition

export function FollowingList({ username, initialCount = 0, initialFollowing }: FollowingListProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followingItems, setFollowingItems] = useState<FollowingWithPost[]>(
    initialFollowing?.following.filter((f): f is FollowingWithPost => f !== null) || []
  );
  const [cursor, setCursor] = useState<string | null>(initialFollowing?.cursor || null);
  const [hasMore, setHasMore] = useState<boolean>(initialFollowing?.hasMore ?? false);
  const [count, setCount] = useState<number>(initialCount);
  
  // Extract all post IDs for batched follow status query
  const postIds = useMemo(() => 
    followingItems.map(item => item.following.postId),
    [followingItems]
  );
  
  // Make a single batched query for all post IDs' follow status
  // This returns an array of booleans where each index corresponds to the postIds array
  const followStatusArray = useQuery(
    api.following.getFollowStates,
    open && postIds.length > 0 ? { postIds } : "skip"
  );
  
  // Create a mapping of postId to follow status for easier lookup
  const followStatusMap = useMemo(() => {
    if (!followStatusArray || !postIds) return {};
    
    // Build a map of postId string -> follow status boolean
    const map: Record<string, boolean> = {};
    
    postIds.forEach((id, index) => {
      // Make sure we don't access beyond the array bounds
      if (index < followStatusArray.length) {
        map[id.toString()] = followStatusArray[index];
      }
    });
    
    return map;
  }, [followStatusArray, postIds]);
  
  // Get next page of following when the drawer is open
  const loadMoreFollowing = async () => {
    if (!hasMore || isLoading || !cursor) return;
    
    setIsLoading(true);
    try {
      const result = await fetch(`/api/following?username=${username}&cursor=${cursor}`).then(res => {
         if (!res.ok) {
           throw new Error(`HTTP error! status: ${res.status}`);
         }
         return res.json();
      });
      
      const newFollowingItems = result.following.filter((f: FollowingWithPost | null): f is FollowingWithPost => f !== null);
      
      setFollowingItems(prevItems => [...prevItems, ...newFollowingItems]);
      setCursor(result.cursor);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error("Failed to load more following:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
   // Effect to reset following list when drawer opens if initial data wasn't provided or might be stale
   useEffect(() => {
     if (open && !initialFollowing) {
       setFollowingItems([]);
       setCursor(null);
       setHasMore(false);
     }
     
     if (open && initialFollowing) {
       setFollowingItems(initialFollowing.following.filter((f): f is FollowingWithPost => f !== null));
       setCursor(initialFollowing.cursor);
       setHasMore(initialFollowing.hasMore);
     }
   }, [open, initialFollowing]);
  
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button 
          variant="link" 
          className="p-0 h-auto text-sm flex items-center gap-1 focus-visible:ring-0 focus:outline-none hover:no-underline"
        >
          <span className="leading-none font-bold mr-[1px]">{count}</span><span className="leading-none font-semibold"> Following</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[75vh] w-full max-w-[550px] mx-auto">
        <DrawerHeader className="px-4 pb-4 border-b border-border">
          <DrawerTitle className="text-base font-extrabold leading-none tracking-tight text-center">Following</DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 overflow-y-auto" scrollHideDelay={0} type="always">
          {isLoading && followingItems.length === 0 ? (
             <div className="flex items-center justify-center py-10">
               <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
             </div>
           ) : !followingItems.length ? (
            <div className="text-center py-8 text-muted-foreground">
              Not following any content yet
            </div>
          ) : (
            <div className="space-y-0">
              {followingItems.map((item: FollowingWithPost) => {
                // Get the follow status for this post from the mapping
                const postIdStr = item.following.postId.toString();
                const isFollowing = followStatusMap[postIdStr];
                
                // undefined means still loading
                const isLoadingStatus = followStatusArray === undefined;
                
                return (
                  <div key={item.following._id.toString()} className="flex items-center justify-between gap-3 p-4 border-b border-border">
                    <Link
                      href={`/${item.post.mediaType === 'newsletter' ? 'newsletters' : item.post.mediaType === 'podcast' ? 'podcasts' : item.post.categorySlug}/${item.post.postSlug}`}
                      className="flex-shrink-0 h-10 w-10 rounded-md bg-muted overflow-hidden"
                      onClick={() => setOpen(false)}
                    >
                      {item.post.featuredImg ? (
                        <img
                          src={item.post.featuredImg}
                          alt={item.post.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                         <div className="h-full w-full bg-muted"></div>
                      )}
                    </Link>
                    <div className="flex flex-col flex-1 min-w-0">
                      <Link
                        href={`/${item.post.mediaType === 'newsletter' ? 'newsletters' : item.post.mediaType === 'podcast' ? 'podcasts' : item.post.categorySlug}/${item.post.postSlug}`}
                        onClick={() => setOpen(false)}
                      >
                        <div className="text-sm font-bold">
                          {item.post.title} {item.post.verified && <VerifiedBadge className="inline-block align-text-middle ml-0.5 h-3.5 w-3.5" />}
                        </div>
                      </Link>
                    </div>
                    {isLoadingStatus ? (
                      <Button variant="outline" size="sm" disabled className="flex-shrink-0 w-[100px]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </Button>
                    ) : (
                      <FollowButtonWithErrorBoundary
                        postId={item.following.postId}
                        feedUrl={item.following.feedUrl}
                        postTitle={item.post.title}
                        initialIsFollowing={isFollowing}
                        className="flex-shrink-0"
                        disableAutoFetch={true}
                      />
                    )}
                  </div>
                );
              })}

              {hasMore && (
                <div className="py-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreFollowing}
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