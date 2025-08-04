"use client";

import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useFollowActions } from "./actions";
import useSWR, { mutate as globalMutate } from 'swr';
import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Global mutation key for followed posts - update to use the main /api/rss endpoint with refresh flag
export const FOLLOWED_POSTS_KEY = '/api/rss?refresh=true';

interface FollowButtonProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
  initialIsFollowing: boolean;
  isAuthenticated?: boolean; // Make optional to maintain backward compatibility
  className?: string; // Add className prop
  disableAutoFetch?: boolean; // New prop to control when we should skip individual fetching
  showIcon?: boolean; // New prop to control icon visibility
  onUpdatePost?: (postId: string, updates: { isFollowing: boolean }) => void; // Callback to update parent state
}

const fetcher = async (key: string) => {
  // Encode the key for use in URL
  const encodedKey = encodeURIComponent(key);
  
  try {
    const res = await fetch(`/api/follows/${encodedKey}`);
    if (!res.ok) throw new Error('Failed to fetch follow status');
    return res.json();
  } catch (error) {
    // Return null to indicate an error occurred
    return null;
  }
};

export const FollowButtonWithErrorBoundary = memo(function FollowButtonWithErrorBoundary(props: FollowButtonProps) {
  return (
    <ErrorBoundary>
      <FollowButton {...props} />
    </ErrorBoundary>
  );
});

// Create the component implementation that will be memoized
const FollowButtonComponent = ({ 
  postId, 
  feedUrl, 
  postTitle, 
  initialIsFollowing,
  isAuthenticated: serverIsAuthenticated,
  className,
  disableAutoFetch = false,
  showIcon = true,
  onUpdatePost
}: FollowButtonProps) => {
  const router = useRouter();
  const { isAuthenticated: clientIsAuthenticated } = useConvexAuth();
  const { followPost, unfollowPost } = useFollowActions();
  const { toast } = useToast();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Use server-provided auth state initially, then client state once available
  const isAuthenticated = clientIsAuthenticated ?? serverIsAuthenticated;
  
  // Track if we've loaded the initial state
  const [isLoaded, setIsLoaded] = useState(false);

  // Simple busy state to prevent double-clicks
  const [isBusy, setIsBusy] = useState(false);
  
  // Add visual state to show the target state during loading
  const [visualState, setVisualState] = useState<'following' | 'follow' | null>(null);

  // Generate a stable key for SWR to prevent unnecessary revalidation
  const cacheKey = useMemo(() => postId ? postId.toString() : null, [postId]);

  // Skip fetching if we're in a list context that already provided the follow state
  // or if fetching is explicitly disabled
  const shouldFetch = isAuthenticated && !disableAutoFetch && !!cacheKey;

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { data, error, mutate, isValidating } = useSWR(
    shouldFetch ? cacheKey : null,
    fetcher,
    {
      fallbackData: { isFollowing: initialIsFollowing },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      revalidateIfStale: false, // Don't revalidate on stale automatically
      revalidateOnMount: !disableAutoFetch, // Only revalidate if not in batch mode
      keepPreviousData: true,
      suspense: false,
      errorRetryCount: 2,
      errorRetryInterval: 2000,
    }
  );

  // Set loaded state once we have either SWR data or initial data
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Consider component loaded if we have data or if fetch was skipped (disableAutoFetch=true)
    if (!isLoaded && (data !== undefined || disableAutoFetch)) {
      setIsLoaded(true);
    }
  }, [data, isLoaded, disableAutoFetch]);

  // Make sure we use the most accurate state available
  // If data is null (error case) or undefined (loading), fall back to initialIsFollowing
  const isFollowing = data?.isFollowing ?? initialIsFollowing;

  // Determine if button is in loading state
  const isInitialLoading = !disableAutoFetch && !isLoaded && shouldFetch && isValidating;
  
  // Memoize the click handler to prevent unnecessary recreations between renders
  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    // Don't allow clicks during initial loading or while busy
    if (!isMountedRef.current || isInitialLoading || isBusy) return;
    
    // Set busy state to prevent multiple operations
    setIsBusy(true);

    // Set visual state to show target state immediately
    const targetState = isFollowing ? 'follow' : 'following';
    setVisualState(targetState);

    // Store current state for potential rollback
    const previousState = { isFollowing };
    // New state after action
    const newState = { isFollowing: !isFollowing };
    
    // Track if we've already applied the optimistic update
    let optimisticUpdateApplied = false;

    try {
      // Apply optimistic update first
      optimisticUpdateApplied = true;
      await mutate(newState, false);
      
      // Perform the actual server operation
      const success = isFollowing
        ? await unfollowPost(postId, postTitle)
        : await followPost(postId, feedUrl, postTitle);

      if (!isMountedRef.current) return;

      if (success) {
        // After successful mutation, update global state only
        // No need to mutate local state again as it's already updated
        await Promise.all([
          globalMutate('/api/rss'),
          globalMutate(FOLLOWED_POSTS_KEY),
          globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/follows')),
          globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/profile'))
        ]);
        
        // Update parent component state if callback provided
        if (onUpdatePost && isMountedRef.current) {
          onUpdatePost(postId.toString(), { isFollowing: !isFollowing });
        }
        
        // Clear visual state immediately on success to prevent flickering
        if (isMountedRef.current) {
          setVisualState(null);
        }
      } else {
        // Only revalidate if the operation wasn't successful
        await mutate(undefined, true);
        // Reset visual state on failure
        if (isMountedRef.current) {
          setVisualState(null);
        }
      }
    } catch (err) {
      // Roll back to previous state if there was an error
      if (isMountedRef.current && optimisticUpdateApplied) {
        await mutate(previousState, false);
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
    isFollowing, 
    mutate, 
    unfollowPost, 
    postId, 
    postTitle, 
    followPost, 
    feedUrl,
    isBusy,
    isInitialLoading,
    toast,
    onUpdatePost
  ]);

  // Determine the display state based on visual state or actual state
  const displayState = useMemo(() => {
    // During initial loading, show a proper loading indicator
    if (isInitialLoading) {
      return 'loading';
    }
    
    // If we have a visual state set (during loading), use that
    if (visualState !== null) {
      return visualState;
    }
    
    // Otherwise use the actual state
    return isFollowing ? 'following' : 'follow';
  }, [isFollowing, visualState, isInitialLoading]);

  // Memoize the button content to prevent unnecessary re-renders
  const buttonContent = useMemo(() => {
    if (displayState === 'loading') {
      return (
        <span className="flex items-center justify-center gap-1">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="opacity-0">Loading</span>
        </span>
      );
    }
    
    return displayState === 'following' ? "Following" : "Follow";
  }, [displayState]);

  // Use a stable class name based on following state
  const buttonClassName = useMemo(() => cn(
    "rounded-full opacity-100 hover:opacity-100 font-semibold shadow-none transition-all duration-200",
    (displayState === 'following') && "text-muted-foreground border border-input",
    (isInitialLoading) && "opacity-70 pointer-events-none",
    className
  ), [displayState, isInitialLoading, className]);

  return (
    <Button
      variant={displayState === 'following' ? "ghost" : "default"}
      onClick={handleClick}
      disabled={isInitialLoading || isBusy}
      className={buttonClassName}
      style={{ opacity: 1 }}
    >
      {buttonContent}
    </Button>
  );
};

// Export the memoized version of the component
export const FollowButton = memo(FollowButtonComponent);