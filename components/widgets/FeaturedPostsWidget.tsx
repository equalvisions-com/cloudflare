"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatRSSKey } from "@/lib/rss";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VerifiedBadge } from "@/components/VerifiedBadge";

interface FeaturedPostsWidgetProps {
  className?: string;
}

export function FeaturedPostsWidget({ className = "" }: FeaturedPostsWidgetProps) {
  // Set up random timestamp to bust the cache
  const [timestamp, setTimestamp] = useState(() => Date.now());
  
  // Force refresh when component mounts or tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimestamp(Date.now());
      }
    };
    
    // Update timestamp on mount
    setTimestamp(Date.now());
    
    // Add visibility change listener for tab switches
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Fetch batched widget data from Convex instead of directly querying featured posts
  const widgetData = useQuery(api.featured.getBatchedWidgetData, { 
    featuredLimit: 6,
    trendingLimit: 6,
    timestamp
  });
  
  // Extract featured posts from the batched data
  const featuredPosts = widgetData?.featuredPosts || [];
  
  const [isOpen, setIsOpen] = useState(false);
  
  // Show first 3 posts initially
  const initialPosts = featuredPosts.slice(0, 3);
  const additionalPosts = featuredPosts.slice(3, 6);
  const hasMorePosts = additionalPosts.length > 0;
  
  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-extrabold flex items-center leading-none tracking-tight">
          <span>Who to follow</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="4 pb-4">
        {!featuredPosts.length && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <FeaturedPostSkeleton key={i} />
            ))}
          </div>
        )}
        
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="space-y-4"
        >
          <ul className="space-y-4">
            {initialPosts.map((post) => (
              <FeaturedPostItem 
                key={post._id}
                post={post}
              />
            ))}
          </ul>
          
          {hasMorePosts && (
            <>
              <CollapsibleContent className="space-y-4 mt-4">
                <ul className="space-y-4">
                  {additionalPosts.map((post) => (
                    <FeaturedPostItem 
                      key={post._id}
                      post={post}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
              
              <CollapsibleTrigger asChild>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-sm font-semibold p-0 h-auto hover:no-underline text-left justify-start mt-0 tracking-tight leading-none"
                >
                  {isOpen ? "Show less" : "Show more"}
                </Button>
              </CollapsibleTrigger>
            </>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// Featured post item component with optimized follow button
function FeaturedPostItem({ post }: { post: any & { verified?: boolean } }) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(post.isFollowing || false);
  const [isAuthenticated] = useState(post.isAuthenticated);
  
  const followMutation = useMutation(api.following.follow);
  const unfollowMutation = useMutation(api.following.unfollow);
  
  const handleFollowClick = async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    // Optimistic update
    setIsFollowing(!isFollowing);

    try {
      const rssKey = formatRSSKey(post.title);
      
      if (isFollowing) {
        // Unfollow
        await unfollowMutation({
          postId: post._id,
          rssKey
        });
      } else {
        // Follow
        await followMutation({
          postId: post._id,
          feedUrl: post.feedUrl || '',
          rssKey
        });
      }
      
      // Refresh router after mutation completes
      router.refresh();
    } catch (error) {
      console.error("Error updating follow state:", error);
      // Revert optimistic update on error
      setIsFollowing(isFollowing);
    }
  };
  
  return (
    <li className="flex flex-col gap-2">
      <div className="flex gap-3">
        {post.featuredImg && (
          <div className="flex-shrink-0 w-10 h-10 overflow-hidden rounded-md">
            <Link href={`/${post.mediaType === 'newsletter' ? 'newsletters' : post.mediaType === 'podcast' ? 'podcasts' : post.categorySlug}/${post.postSlug}`}>
              <AspectRatio ratio={1/1} className="bg-muted">
                <Image 
                  src={post.featuredImg} 
                  alt={post.title}
                  fill
                  className="object-cover hover:opacity-90 transition-opacity"
                  sizes="(max-width: 768px) 100vw, 64px"
                />
              </AspectRatio>
            </Link>
          </div>
        )}
        <div className="flex flex-grow min-h-[40px] items-center">
          <div className="flex justify-between items-center gap-1.25 w-full">
            <div className="flex-grow">
              <Link 
                href={`/${post.mediaType === 'newsletter' ? 'newsletters' : post.mediaType === 'podcast' ? 'podcasts' : post.categorySlug}/${post.postSlug}`} 
                className="text-sm hover:text-primary hover:no-underline font-semibold line-clamp-2 overflow-hidden"
              >
                {post.title}
                {post.verified && <VerifiedBadge className="inline-block align-middle ml-1 h-3 w-3" />}
              </Link>
            </div>
            <Button
              variant={isFollowing ? "ghost" : "default"}
              onClick={handleFollowClick}
              className={cn(
                "rounded-full h-[23px] text-xs px-2 flex-shrink-0 mt-0 font-semibold",
                isFollowing && "text-muted-foreground border border-input"
              )}
              style={{ opacity: 1 }}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

// Skeleton loader for featured posts
function FeaturedPostSkeleton() {
  return (
    <div className="flex gap-3">
      <Skeleton className="h-10 w-10 rounded-md" />
      <div className="flex items-center flex-grow min-h-[40px]">
        <div className="flex justify-between w-full">
          <div className="flex-grow">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mt-1" />
          </div>
          <Skeleton className="h-7 w-20 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
} 