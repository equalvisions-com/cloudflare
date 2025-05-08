"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatRSSKey } from "@/lib/rss";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { mutate as globalMutate } from 'swr';
import { FOLLOWED_POSTS_KEY } from "@/components/follow-button/FollowButton";
import { MinusCircle, PlusCircle, Loader2 } from "lucide-react";

// --- Define the type for the post prop more accurately based on the query result ---
interface PublicPostData {
  _id: Id<"posts">;
  title: string;
  postSlug: string;
  categorySlug: string;
  featuredImg: string;
  feedUrl: string;
  mediaType: string;
  verified: boolean;
}

// --- Props for FeaturedPostItem including the externally determined follow state ---
interface FeaturedPostItemProps {
  post: PublicPostData;
  isFollowing: boolean; // Provided by the parent widget
}

interface FeaturedPostsWidgetProps {
  className?: string;
}

// Memoized skeleton loader for featured posts
const FeaturedPostSkeleton = memo(() => {
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
});

FeaturedPostSkeleton.displayName = 'FeaturedPostSkeleton';

// --- Simplified FeaturedPostItem relying on props for follow state ---
const FeaturedPostItem = memo(({ post, isFollowing }: FeaturedPostItemProps) => {
  const router = useRouter();
  // Get auth state for redirect logic
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const followMutation = useMutation(api.following.follow);
  const unfollowMutation = useMutation(api.following.unfollow);

  // State for optimistic UI
  const [visualIsFollowing, setVisualIsFollowing] = useState<boolean | null>(null);
  // State to prevent rapid clicks
  const [isBusy, setIsBusy] = useState(false);
  const lastClickTime = useRef(0);

  // Reset visual state if the underlying prop changes while not busy
  useEffect(() => {
    if (!isBusy) {
      setVisualIsFollowing(null);
    }
  }, [isFollowing, isBusy]);

  const handleFollowClick = useCallback(async () => {
    // Use isAuthLoading here
    if (!isAuthenticated || isAuthLoading || isBusy) {
      if (!isAuthenticated && !isAuthLoading) router.push("/signin");
      return;
    }

    const now = Date.now();
    if (now - lastClickTime.current < 500) return;
    lastClickTime.current = now;

    setIsBusy(true);
    // Use the prop `isFollowing` as the source of truth before the click
    const currentlyFollowing = isFollowing;
    setVisualIsFollowing(!currentlyFollowing); // Optimistic UI update

    try {
      const rssKey = formatRSSKey(post.title);
      if (currentlyFollowing) {
        await unfollowMutation({ postId: post._id, rssKey });
      } else {
        await followMutation({ postId: post._id, feedUrl: post.feedUrl || '', rssKey });
      }

      await globalMutate(FOLLOWED_POSTS_KEY);

    } catch (error) {
      console.error("Error updating follow state:", error);
      setVisualIsFollowing(null); // Rollback optimistic UI on error
    } finally {
      // Allow time for mutation effects / potential prop updates before clearing busy
      setTimeout(() => setIsBusy(false), 300);
    }
    // Dependencies: rely on props and auth state
  }, [isAuthenticated, isAuthLoading, isBusy, isFollowing, post, router, followMutation, unfollowMutation]);

  // Determine the state to display
  const displayFollowing = visualIsFollowing !== null ? visualIsFollowing : isFollowing;

  const buttonVariant = displayFollowing ? "ghost" : "default";
  const buttonClasses = cn(
    "rounded-full h-[23px] text-xs px-2 flex-shrink-0 mt-0 font-semibold",
    displayFollowing && "text-muted-foreground border border-input",
    // Disable if auth is loading or mutation is busy
    (isAuthLoading || isBusy) && "opacity-50 pointer-events-none"
  );

  const buttonContent = useMemo(() => {
    // Show loader ONLY if initial auth is loading (and not busy with a mutation)
    if (isAuthLoading && !isBusy) { 
      return <Loader2 className="h-3 w-3 animate-spin" />;
    }
    // Directly show the target state text based on optimistic/actual state
    return displayFollowing ? "Following" : "Follow";
  }, [isAuthLoading, isBusy, displayFollowing]);

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
                  sizes="40px"
                  priority={false}
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
              variant={buttonVariant}
              onClick={handleFollowClick}
              disabled={isAuthLoading || isBusy}
              className={buttonClasses}
              style={{ opacity: 1 }}
              aria-live="polite"
            >
              {buttonContent}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
});

FeaturedPostItem.displayName = 'FeaturedPostItem';

// --- Main Widget Component - Fetches Posts and Follow States ---
const FeaturedPostsWidgetComponent = ({ className = "" }: FeaturedPostsWidgetProps) => {
  const { isAuthenticated } = useConvexAuth();

  // 1. Fetch the list of public posts
  const featuredPosts = useQuery(api.widgets.getPublicWidgetPosts, { limit: 6 });
  const isLoadingPosts = featuredPosts === undefined;

  // 2. Prepare arguments for follow state query (only if posts are loaded and user is authenticated)
  const postIdsToFetch = useMemo(() => {
    if (!isAuthenticated || isLoadingPosts || !featuredPosts) return null;
    return featuredPosts.map(p => p._id);
  }, [isAuthenticated, isLoadingPosts, featuredPosts]);

  // 3. Fetch follow states for the loaded posts
  const followStatesResult = useQuery(
    api.following.getFollowStates,
    postIdsToFetch ? { postIds: postIdsToFetch } : "skip"
  );
  const isLoadingFollowStates = isAuthenticated && !isLoadingPosts && followStatesResult === undefined;

  // 4. Combined Loading State: loading posts OR loading follow states (if auth)
  const isLoading = isLoadingPosts || isLoadingFollowStates;

  // 5. Create a map for easy lookup (only when data is available)
  const followStateMap = useMemo(() => {
    const map = new Map<Id<"posts">, boolean>();
    if (featuredPosts && followStatesResult) {
      featuredPosts.forEach((post, index) => {
        map.set(post._id, followStatesResult[index] ?? false);
      });
    }
    return map;
  }, [featuredPosts, followStatesResult]);

  const [isOpen, setIsOpen] = useState(false);

  // Prepare posts for rendering (only when not loading)
  const initialPosts = useMemo(() => isLoading ? [] : featuredPosts?.slice(0, 3) || [], [isLoading, featuredPosts]);
  const additionalPosts = useMemo(() => isLoading ? [] : featuredPosts?.slice(3, 6) || [], [isLoading, featuredPosts]);
  const hasMorePosts = useMemo(() => additionalPosts.length > 0, [additionalPosts]);

  const handleOpenChange = useCallback((open: boolean) => setIsOpen(open), []);

  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-extrabold flex items-center leading-none tracking-tight">
          <span>Who to follow</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Show skeleton ONLY during the combined loading state */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <FeaturedPostSkeleton key={i} />)}
          </div>
        )}
        
        {/* Show message if loading finished but no posts */}
        {!isLoading && featuredPosts && featuredPosts.length === 0 && (
          <p className="text-sm text-muted-foreground">No featured posts found.</p>
        )}

        {/* Render list only when NOT loading and posts exist */}
        {!isLoading && featuredPosts && featuredPosts.length > 0 && (
          <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="space-y-4">
            <ul className="space-y-4">
              {initialPosts.map((post) => (
                <FeaturedPostItem 
                  key={post._id} 
                  post={post} 
                  // Pass the resolved follow state from the map
                  isFollowing={followStateMap.get(post._id) ?? false} 
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
                        isFollowing={followStateMap.get(post._id) ?? false} 
                      />
                    ))}
                  </ul>
                </CollapsibleContent>
                <CollapsibleTrigger asChild>
                  <Button variant="link" size="sm" className="text-sm font-semibold p-0 h-auto hover:no-underline text-left justify-start mt-0 tracking-tight leading-none">
                    {isOpen ? "Show less" : "Show more"}
                  </Button>
                </CollapsibleTrigger>
              </>
            )}
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};

export const FeaturedPostsWidget = memo(FeaturedPostsWidgetComponent); 