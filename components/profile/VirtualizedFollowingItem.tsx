"use client";

import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "../VerifiedBadge";
import { AspectRatio } from "../ui/aspect-ratio";
import Image from "next/image";
import { MinusCircle, PlusCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FollowingListFollowingWithPost } from "@/lib/types";

interface VirtualizedFollowingItemProps {
  item: FollowingListFollowingWithPost;
  onCloseDrawer: () => void;
  onFollow?: (postId: Id<"posts">, feedUrl: string, postTitle: string) => Promise<void>;
  onUnfollow?: (postId: Id<"posts">, feedUrl: string, postTitle: string) => Promise<void>;
  isOperationPending?: (postId: Id<"posts">) => boolean;
  currentUserFollowStatus?: boolean; // Whether the current user follows this post
  // Add dispatch to update follow status locally without triggering parent errors
  onUpdateFollowStatus?: (postId: Id<"posts">, isFollowing: boolean) => void;
  isAuthenticated?: boolean; // Add authentication prop like FollowButton.tsx
  showIcon?: boolean; // Add icon control like FollowButton.tsx
}

export const VirtualizedFollowingItem = memo(({ 
  item, 
  onCloseDrawer,
  onFollow,
  onUnfollow,
  isOperationPending,
  currentUserFollowStatus = false,
  onUpdateFollowStatus,
  isAuthenticated: serverIsAuthenticated,
  showIcon = false // Default to false for Following list (cleaner UI)
}: VirtualizedFollowingItemProps) => {
  const router = useRouter();
  // Use sidebar context to eliminate duplicate users:viewer query
  const { isAuthenticated: clientIsAuthenticated } = useSidebar();
  const { toast } = useToast();
  
  // Use server-provided auth state initially, then client state once available (like FollowButton.tsx)
  const isAuthenticated = clientIsAuthenticated ?? serverIsAuthenticated;
  
  // Add a ref to track if component is mounted to prevent state updates after unmount (like FollowButton.tsx)
  const isMountedRef = useRef(true);
  
  // Simple state management - just basic busy state
  const [isBusy, setIsBusy] = useState(false);
  const [visualState, setVisualState] = useState<'following' | 'follow' | null>(null);
  
  // Direct Convex mutations (adapted for Following list context)
  const followMutation = useMutation(api.following.follow);
  const unfollowMutation = useMutation(api.following.unfollow);

  // Set up the mounted ref (exactly like FollowButton.tsx)
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ALL HOOKS MUST BE ABOVE THIS LINE - Move memoized values here before any early returns
  const linkHref = useMemo(() => {
    if (!item?.post) return '';
    return `/${item.post.mediaType === 'newsletter' ? 'newsletters' : item.post.mediaType === 'podcast' ? 'podcasts' : item.post.categorySlug}/${item.post.postSlug}`;
  }, [item?.post]);

  // Memoize click handler to prevent re-renders
  const handleLinkClick = useCallback(() => {
    onCloseDrawer();
  }, [onCloseDrawer]);

  // Check if operation is pending (enhanced to include busy state) - MOVED BEFORE EARLY RETURN
  const isPending = useMemo(() => {
    if (!item?.following?.postId) return false;
    const parentPending = isOperationPending ? isOperationPending(item.following.postId) : false;
    return parentPending || isBusy;
  }, [isOperationPending, item?.following?.postId, isBusy]);

  // Determine the display state based on visual state or actual state (exactly like FollowButton.tsx) - MOVED BEFORE EARLY RETURN
  const displayState = useMemo(() => {
    // If we have a visual state set (during loading), use that
    if (visualState !== null) {
      return visualState;
    }
    
    // Otherwise use the actual state
    return currentUserFollowStatus ? 'following' : 'follow';
  }, [currentUserFollowStatus, visualState]);

  // Memoize the button content to prevent unnecessary re-renders (adapted from FollowButton.tsx) - MOVED BEFORE EARLY RETURN
  const buttonContent = useMemo(() => {
    return (
      <span className="flex items-center gap-1">
        {showIcon && (displayState === 'following' ? 
          <MinusCircle className="h-4 w-4 mr-1" /> : 
          <PlusCircle className="h-4 w-4 mr-1" />
        )}
        {displayState === 'following' ? "Following" : "Follow"}
      </span>
    );
  }, [displayState, showIcon]);

  // Use a stable class name based on following state (adapted from FollowButton.tsx) - MOVED BEFORE EARLY RETURN
  const buttonClassName = useMemo(() => cn(
    "w-[100px] rounded-full opacity-100 hover:opacity-100 font-semibold shadow-none transition-all duration-200",
    (displayState === 'following') && "text-muted-foreground border border-input",
    isPending && "opacity-70 pointer-events-none"
  ), [displayState, isPending]);

  // Memoize image props to prevent re-renders - MOVED BEFORE EARLY RETURN
  const imageProps = useMemo(() => {
    if (!item?.post?.featuredImg) return null;
    return {
      src: item.post.featuredImg,
      alt: item.post.title,
      fill: true,
      sizes: "48px",
      className: "h-full w-full object-cover",
      loading: "lazy" as const,
    };
  }, [item?.post?.featuredImg, item?.post?.title]);

  // Memoize the click handler to prevent unnecessary recreations between renders (exactly like FollowButton.tsx) - MOVED BEFORE EARLY RETURN
  const handleButtonClick = useCallback(async () => {
    // Authentication check (exactly like FollowButton.tsx)
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    // Don't allow clicks while busy
    if (!isMountedRef.current || isBusy) return;
    
    // Set busy state to prevent multiple operations
    setIsBusy(true);

    // Set visual state to show target state immediately
    const targetState = currentUserFollowStatus ? 'follow' : 'following';
    setVisualState(targetState);

    // Store current state for potential rollback
    const previousState = { isFollowing: currentUserFollowStatus };
    // New state after action
    const newState = { isFollowing: !currentUserFollowStatus };
    
    // Track if we've already applied the optimistic update
    let optimisticUpdateApplied = false;

    try {
      // Apply optimistic update (adapted for Following list context)
      if (onUpdateFollowStatus && item?.following?.postId) {
        optimisticUpdateApplied = true;
        onUpdateFollowStatus(item.following.postId, newState.isFollowing);
      }
      
      // Perform the actual server operation
      if (currentUserFollowStatus && item?.following) {
        // Unfollow
        await unfollowMutation({ 
          postId: item.following.postId, 
          rssKey: item.following.feedUrl 
        });
      } else if (item?.following) {
        // Follow
        await followMutation({ 
          postId: item.following.postId, 
          feedUrl: item.following.feedUrl, 
          rssKey: item.following.feedUrl 
        });
      }

      if (!isMountedRef.current) return;

      // Clear visual state immediately on success to prevent flickering
      if (isMountedRef.current) {
        setVisualState(null);
      }
    } catch (err) {
      // Roll back to previous state if there was an error
      if (isMountedRef.current && optimisticUpdateApplied && onUpdateFollowStatus && item?.following?.postId) {
        onUpdateFollowStatus(item.following.postId, previousState.isFollowing);
      }

      // Reset visual state on error
      if (isMountedRef.current) {
        setVisualState(null);
      }

      // Show user-friendly error messages - server handles all rate limiting
      const errorMessage = (err as Error).message || "An unknown error occurred";
      let toastTitle = "Error";
      let toastDescription = "Could not update follow status. Please try again.";

      // Handle rate limiting errors from server
      if (errorMessage.includes("rate limit") || errorMessage.includes("Rate limit") || 
          errorMessage.includes("too quickly") || errorMessage.includes("limit reached")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "You're performing actions too quickly. Please slow down.";
      } else if (errorMessage.includes("User not found")) {
        toastDescription = "Could not update follow status due to a server error.";
      }

      toast({
        title: toastTitle,
        description: toastDescription,
      });

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
  }, [
    isAuthenticated, 
    router, 
    currentUserFollowStatus, 
    item?.following,
    item?.post?.title,
    followMutation,
    unfollowMutation,
    onUpdateFollowStatus,
    isBusy,
    toast
  ]);

  // Safety check AFTER all hooks
  if (!item || !item.following || !item.following.postId || !item.post) {
    return null;
  }

  return (
    <div 
      className="flex items-center justify-between gap-3 p-4 border-b border-border min-h-[80px] hover:bg-muted/30 transition-colors duration-200"
      role="listitem"
      aria-label={`Following: ${item.post.title}`}
    >
      {/* Left side - Post info (entire area clickable like FriendsList) */}
      <Link
        href={linkHref}
        className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none p-1 -m-1"
        onClick={handleLinkClick}
        aria-label={`View ${item.post.title}`}
        prefetch={false}
      >
        <div className="flex-shrink-0 h-12 w-12 rounded-md bg-muted overflow-hidden relative">
          <AspectRatio ratio={1}>
            {item.post.featuredImg && imageProps ? (
              <Image
                {...imageProps}
              />
            ) : (
              <div className="h-full w-full bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  {item.post.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </AspectRatio>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="font-medium text-sm text-foreground line-clamp-2 break-words">
              {item.post.title}
            </h3>
            {item.post.verified && (
              <VerifiedBadge className="h-3 w-3 flex-shrink-0" />
            )}
          </div>
          
          {item.post.categorySlug && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {item.post.categorySlug}
            </p>
          )}
        </div>
      </Link>

      {/* Right side - Follow/Following button */}
      <div className="flex-shrink-0">
        <Button
          variant={displayState === 'following' ? "ghost" : "default"}
          onClick={handleButtonClick}
          disabled={isPending}
          className={buttonClassName}
          style={{ opacity: 1 }}
          aria-live="polite"
          aria-label={`${displayState === 'following' ? 'Unfollow' : 'Follow'} ${item.post.title}`}
        >
          {buttonContent}
        </Button>
      </div>
    </div>
  );
});

VirtualizedFollowingItem.displayName = 'VirtualizedFollowingItem';

// Custom comparison function to prevent unnecessary re-renders
const arePropsEqual = (
  prevProps: VirtualizedFollowingItemProps,
  nextProps: VirtualizedFollowingItemProps
): boolean => {
  // Compare item properties that affect rendering
  if (!prevProps.item || !nextProps.item) {
    return prevProps.item === nextProps.item;
  }

  const prevPost = prevProps.item.post;
  const nextPost = nextProps.item.post;
  const prevFollowing = prevProps.item.following;
  const nextFollowing = nextProps.item.following;

  // Check if essential properties have changed
  return (
    prevPost._id === nextPost._id &&
    prevPost.title === nextPost.title &&
    prevPost.featuredImg === nextPost.featuredImg &&
    prevPost.mediaType === nextPost.mediaType &&
    prevPost.verified === nextPost.verified &&
    prevPost.postSlug === nextPost.postSlug &&
    prevPost.categorySlug === nextPost.categorySlug &&
    prevFollowing.postId === nextFollowing.postId &&
    prevFollowing.feedUrl === nextFollowing.feedUrl &&
    prevProps.onCloseDrawer === nextProps.onCloseDrawer &&
    prevProps.onFollow === nextProps.onFollow &&
    prevProps.onUnfollow === nextProps.onUnfollow &&
    prevProps.isOperationPending === nextProps.isOperationPending &&
    prevProps.currentUserFollowStatus === nextProps.currentUserFollowStatus &&
    prevProps.onUpdateFollowStatus === nextProps.onUpdateFollowStatus &&
    prevProps.isAuthenticated === nextProps.isAuthenticated &&
    prevProps.showIcon === nextProps.showIcon
  );
};

// Re-export with custom comparison
export const MemoizedVirtualizedFollowingItem = memo(VirtualizedFollowingItem, arePropsEqual); 