"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Id } from "@/convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, memo, useTransition } from "react";
import { cn } from "@/lib/utils";
import { formatRSSKey } from "@/lib/rss";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { mutate as globalMutate } from 'swr';
import { FOLLOWED_POSTS_KEY } from "@/components/follow-button/FollowButton";
import { Loader2 } from "lucide-react";
import { useFeaturedPostsStore } from "@/lib/stores/featuredPostsStore";
import { 
  FeaturedPostsWidgetPost,
  FeaturedPostsWidgetProps,
  FeaturedPostItemProps
} from "@/lib/types";

// ===================================================================
// SIMPLIFIED CACHE SYSTEM - Consistent with TrendingWidget
// ===================================================================

// ===================================================================
// STABLE ID GENERATION - Consistent with TrendingWidget
// ===================================================================

let idCounter = 0;
const generateStableId = (prefix: string) => `${prefix}-${++idCounter}`;

// ===================================================================
// SKELETON COMPONENT - Matches actual elements exactly
// ===================================================================

const FeaturedPostSkeleton = () => {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex gap-3">
        <Skeleton className="flex-shrink-0 w-10 h-10 rounded-md" />
        <div className="flex flex-grow min-h-[40px] items-center">
          <div className="flex justify-between items-center gap-1.25 w-full">
            <div className="flex-grow">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mt-1" />
            </div>
            <Skeleton className="h-[23px] w-20 flex-shrink-0 rounded-full" />
          </div>
        </div>
      </div>
    </li>
  );
};

// ===================================================================
// FEATURED POST ITEM - Following React best practices
// ===================================================================

const FeaturedPostItem = memo(({ post, isFollowing, priority = false }: FeaturedPostItemProps) => {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const followMutation = useMutation(api.following.follow);
  const unfollowMutation = useMutation(api.following.unfollow);

  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // State management like FollowButton
  const [isBusy, setIsBusy] = useState(false);
  const [visualState, setVisualState] = useState<'following' | 'follow' | null>(null);
  
  // Track last operation time to prevent rapid successive clicks
  const lastClickTime = useRef(0);
  
  // Global rate limiting - 1 second between ANY follow/unfollow operations
  const lastGlobalActionTimeRef = useRef(0);
  const GLOBAL_COOLDOWN_MS = 1000;

  // Set up the mounted ref
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Click handler matching FollowButton pattern
  const handleFollowClick = async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    // Don't allow clicks while busy
    if (!isMountedRef.current || isBusy) return;
    
    // Check global rate limiting first
    const now = Date.now();
    const timeSinceLastGlobalAction = now - lastGlobalActionTimeRef.current;
    if (timeSinceLastGlobalAction < GLOBAL_COOLDOWN_MS) {
      return;
    }
    
    // Prevent rapid clicks on same button (debounce)
    if (now - lastClickTime.current < 500) {
      return;
    }
    
    // Update both timers
    lastClickTime.current = now;
    lastGlobalActionTimeRef.current = now;
    
    // Set busy state to prevent multiple operations
    setIsBusy(true);

    // Set visual state to show target state immediately
    const targetState = isFollowing ? 'follow' : 'following';
    setVisualState(targetState);

    try {
      const rssKey = formatRSSKey(post.title);
      if (isFollowing) {
        await unfollowMutation({ postId: post._id, rssKey });
      } else {
        await followMutation({ postId: post._id, feedUrl: post.feedUrl || '', rssKey });
      }

      if (!isMountedRef.current) return;

      // Clear visual state immediately on success
      setVisualState(null);
      
      await globalMutate(FOLLOWED_POSTS_KEY);
    } catch (error) {
      // Reset visual state on error
      if (isMountedRef.current) {
        setVisualState(null);
      }
    } finally {
      // Clear busy state after operation completes
      if (isMountedRef.current) {
        setTimeout(() => {
          if (isMountedRef.current) {
            setIsBusy(false);
          }
        }, 100);
      }
    }
  };

  // Determine the display state based on visual state or actual state
  const displayState = visualState !== null ? visualState : (isFollowing ? 'following' : 'follow');
  const isDisplayFollowing = displayState === 'following';
  const buttonVariant = isDisplayFollowing ? "ghost" : "default";
  const buttonClasses = cn(
    "rounded-full h-[23px] text-xs px-2 flex-shrink-0 mt-0 font-semibold",
    isDisplayFollowing && "text-muted-foreground border border-input",
    (isAuthLoading || isBusy) && "opacity-50 pointer-events-none"
  );

  // Only show button when we have a valid follow state (prevents flashing)
  // This is the key pattern from FollowButton that prevents flashing
  if (isAuthenticated && isFollowing === undefined) {
    return (
      <li className="flex flex-col gap-2">
        <div className="flex gap-3">
          {post.featuredImg && (
            <div className="flex-shrink-0 w-10 h-10 overflow-hidden rounded-md">
              <Link href={`/${post.mediaType === 'newsletter' ? 'newsletters' : post.mediaType === 'podcast' ? 'podcasts' : post.categorySlug}/${post.postSlug}`} prefetch={false}>
                <AspectRatio ratio={1/1} className="bg-muted">
                  <Image 
                    src={post.featuredImg} 
                    alt={post.title}
                    fill
                    className="object-cover hover:opacity-90 transition-opacity"
                    sizes="40px"
                    priority={priority}
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
              <div className="rounded-full h-[23px] w-16 bg-muted animate-pulse flex-shrink-0 mt-0" />
            </div>
          </div>
        </div>
      </li>
    );
  }

  // Simple content determination - no memoization needed
  const buttonContent = (isAuthLoading && !isBusy) 
    ? <Loader2 className="h-3 w-3 animate-spin" />
    : (isDisplayFollowing ? "Following" : "Follow");

  return (
    <li className="flex flex-col gap-2">
      <div className="flex gap-3">
        {post.featuredImg && (
          <div className="flex-shrink-0 w-10 h-10 overflow-hidden rounded-md">
            <Link href={`/${post.mediaType === 'newsletter' ? 'newsletters' : post.mediaType === 'podcast' ? 'podcasts' : post.categorySlug}/${post.postSlug}`} prefetch={false}>
              <AspectRatio ratio={1/1} className="bg-muted">
                <Image 
                  src={post.featuredImg} 
                  alt={post.title}
                  fill
                  className="object-cover hover:opacity-90 transition-opacity"
                  sizes="40px"
                  priority={priority}
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

// ===================================================================
// MAIN WIDGET COMPONENT - Following React best practices exactly
// ===================================================================

const FeaturedPostsWidgetComponent = ({ className = "" }: FeaturedPostsWidgetProps) => {
  const { isAuthenticated } = useConvexAuth();
  
  // Get data from persistent store
  const { posts: storedPosts, followStates: storedFollowStates, setPosts, setFollowStates } = useFeaturedPostsStore();
  const hasStoredData = storedPosts.length > 0;
  
  // Stable IDs using refs (no regeneration on render)
  const widgetId = useRef(generateStableId('featured-posts-widget')).current;
  const loadingId = useRef(generateStableId('loading-status')).current;

  // State with transition for smooth UX
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 1. Fetch posts
  const featuredPosts = useQuery(api.widgets.getPublicWidgetPosts, { limit: 6 });
  const isLoadingPosts = featuredPosts === undefined;

  // 2. Fetch follow states
  const postIdsToFetch = (!isAuthenticated || isLoadingPosts || !featuredPosts) 
    ? null 
    : featuredPosts.map(p => p._id);

  const followStatesResult = useQuery(
    api.following.getFollowStates,
    postIdsToFetch ? { postIds: postIdsToFetch } : "skip"
  );
  const isLoadingFollowStates = isAuthenticated && !isLoadingPosts && followStatesResult === undefined;

  // 3. Combined loading state
  const isLoading = isLoadingPosts || isLoadingFollowStates;
  const shouldShowSkeleton = isLoading && !hasStoredData;

  // 4. Cache posts when they arrive
  useEffect(() => {
    if (featuredPosts && !isLoadingPosts) {
      setPosts(featuredPosts);
    }
  }, [featuredPosts, isLoadingPosts, setPosts]);

  // 5. Update follow states
  useEffect(() => {
    if (featuredPosts && followStatesResult && !isLoadingFollowStates) {
      const followStateMap = new Map<Id<"posts">, boolean>();
      featuredPosts.forEach((post, index) => {
        followStateMap.set(post._id, followStatesResult[index] ?? false);
      });
      setFollowStates(followStateMap);
    }
  }, [featuredPosts, followStatesResult, isLoadingFollowStates, setFollowStates]);

  // Simple calculations - no memoization needed per React docs
  const postsToShow = featuredPosts || storedPosts;
  const followStatesToUse = storedFollowStates;

  const initialPosts = postsToShow.slice(0, 3);
  const additionalPosts = postsToShow.slice(3, 6);
  const hasMorePosts = additionalPosts.length > 0;

  // Transition handler for smooth expand/collapse UX
  const handleOpenChange = (open: boolean) => {
    startTransition(() => {
      setIsOpen(open);
    });
  };

  // Simple object creation - no memoization needed
  const ariaLabels = {
    widget: 'Featured posts widget',
    loading: 'Loading featured posts'
  };

  // Loading state with skeleton
  if (shouldShowSkeleton) {
    return (
      <Card 
        className={`shadow-none rounded-xl ${className}`}
        role="region"
        aria-labelledby={`${widgetId}-title`}
        aria-describedby={loadingId}
      >
        <CardHeader className="pb-4">
          <CardTitle 
            id={`${widgetId}-title`}
            className="text-base font-extrabold flex items-center leading-none tracking-tight"
          >
            <span>Who to follow</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-4">
            <ul 
              className="space-y-4"
              role="status"
              aria-live="polite"
              aria-label={ariaLabels.loading}
            >
              {[...Array(3)].map((_, i) => <FeaturedPostSkeleton key={i} />)}
            </ul>
            {/* Show more button skeleton */}
            <Skeleton className="h-4 w-20 mt-4" />
          </div>
          <span id={loadingId} className="sr-only">
            Loading featured posts, please wait
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-extrabold flex items-center leading-none tracking-tight">
          <span>Who to follow</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Show skeleton if no posts (instead of text message) */}
        {!isLoading && postsToShow.length === 0 && (
          <div className="space-y-4">
            <ul className="space-y-4" role="status" aria-label="No featured posts available">
              {[...Array(3)].map((_, i) => <FeaturedPostSkeleton key={i} />)}
            </ul>
            {/* Show more button skeleton */}
            <Skeleton className="h-4 w-20 mt-4" />
            <span className="sr-only">No featured posts found</span>
          </div>
        )}

        {/* Render list when posts exist */}
        {postsToShow.length > 0 && (
          <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="space-y-4">
            <ul className="space-y-4">
              {initialPosts.map((post) => (
                <FeaturedPostItem 
                  key={post._id} 
                  post={post} 
                  isFollowing={followStatesToUse.get(post._id)} 
                  priority={true}
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
                        isFollowing={followStatesToUse.get(post._id)} 
                        priority={false}
                      />
                    ))}
                  </ul>
                </CollapsibleContent>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className={cn(
                      "text-sm font-semibold p-0 h-auto hover:no-underline text-left justify-start mt-0 tracking-tight leading-none",
                      isPending && "opacity-70"
                    )}
                    disabled={isPending}
                  >
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

// Export cache stats for monitoring - consistent with TrendingWidget
export const getFeaturedPostsCacheStats = () => {
  return {
    message: 'Cache stats available in development mode',
    cacheSize: 'Simplified cache implementation'
  };
}; 