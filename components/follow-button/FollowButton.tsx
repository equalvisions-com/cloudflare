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
import { MinusCircle, PlusCircle, Loader2 } from "lucide-react";
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
}

const fetcher = async (key: string) => {
  // Encode the key for use in URL
  const encodedKey = encodeURIComponent(key);
  
  try {
    const res = await fetch(`/api/follows/${encodedKey}`);
    if (!res.ok) throw new Error('Failed to fetch follow status');
    return res.json();
  } catch (error) {
    console.error('Error fetching follow status:', error);
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
  showIcon = true
}: FollowButtonProps) => {
  const router = useRouter();
  const { isAuthenticated: clientIsAuthenticated } = useConvexAuth();
  const { followPost, unfollowPost } = useFollowActions();
  const { toast } = useToast();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Use server-provided auth state initially, then client state once available
  const isAuthenticated = clientIsAuthenticated ?? serverIsAuthenticated;
  
  // Initialize as loaded when we have initial data to prevent hydration flicker
  const [isLoaded, setIsLoaded] = useState(initialIsFollowing !== undefined);

  // Add busy state to prevent rapid clicking
  const [isBusy, setIsBusy] = useState(false);
  
  // Add visual state to show the target state during loading
  const [visualState, setVisualState] = useState<'following' | 'follow' | null>(null);
  
  // Track last operation time to prevent rapid successive clicks
  const lastClickTime = useRef(0);

  // Generate a stable key for SWR to prevent unnecessary revalidation
  const cacheKey = useMemo(() => postId ? postId.toString() : null, [postId]);

  // Skip fetching if:
  // 1. We're not authenticated
  // 2. Explicit disableAutoFetch is set
  // 3. No postId cache key available
  // 4. We're in server-side rendering context (trust server data)
  const shouldFetch = isAuthenticated && !disableAutoFetch && !!cacheKey && typeof window !== 'undefined';

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
      revalidateOnMount: false, // Trust server data, don't revalidate on mount
      keepPreviousData: true,
      suspense: false,
      errorRetryCount: 2,
      errorRetryInterval: 2000,
    }
  );

  // Set loaded state once we have either SWR data, initial data, or we're in client mode
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // Mark as loaded on first client render or when data arrives
    if (!isLoaded && (data !== undefined || disableAutoFetch || typeof window !== 'undefined')) {
      setIsLoaded(true);
    }
  }, [data, isLoaded, disableAutoFetch]);

  // Make sure we use the most accurate state available
  // If disableAutoFetch is true, always use initialIsFollowing (from Convex query)
  // Otherwise, use SWR data with fallback to initialIsFollowing
  const isFollowing = disableAutoFetch ? initialIsFollowing : (data?.isFollowing ?? initialIsFollowing);

  // Determine if button is in loading state - only show loading during client-side fetch
  const isInitialLoading = !isLoaded && shouldFetch && isValidating && typeof window !== 'undefined';
  
  // Memoize the click handler to prevent unnecessary recreations between renders
  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    // Don't allow clicks during initial loading or while busy
    if (!isMountedRef.current || isInitialLoading || isBusy) return;
    
    // Prevent rapid clicks (debounce)
    const now = Date.now();
    if (now - lastClickTime.current < 500) {
      return; // Ignore clicks that happen too quickly
    }
    lastClickTime.current = now;
    
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
      // Only apply optimistic update to SWR if we're using SWR (not disableAutoFetch)
      if (!disableAutoFetch && mutate) {
        optimisticUpdateApplied = true;
        await mutate(newState, false);
      }
      
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
        
        // Clear visual state immediately on success to prevent flickering
        if (isMountedRef.current) {
          setVisualState(null);
        }
      } else {
        // Only revalidate if the operation wasn't successful and we're using SWR
        if (!disableAutoFetch && mutate) {
          await mutate(undefined, true);
        }
        // Reset visual state on failure
        if (isMountedRef.current) {
          setVisualState(null);
        }
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
      // Roll back to previous state if there was an error and we're using SWR
      if (isMountedRef.current && optimisticUpdateApplied && mutate) {
        await mutate(previousState, false);
      }

      // Reset visual state on error
      if (isMountedRef.current) {
        setVisualState(null);
      }

      // Show toast notification for the error
      const errorMessage = (err as Error).message || "An unknown error occurred";
      let toastTitle = "Error";
      let toastDescription = "Could not update follow status. Please try again.";

      if (errorMessage.includes("Please wait before toggling follow again")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "You're toggling follows too quickly. Please slow down.";
      } else if (errorMessage.includes("Too many follows too quickly")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "Too many follows too quickly. Please slow down.";
      } else if (errorMessage.includes("Hourly follow limit reached")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "Hourly follow limit reached. Try again later.";
      } else if (errorMessage.includes("Daily follow limit reached")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "Daily follow limit reached. Try again tomorrow.";
      } else if (errorMessage.includes("User not found")) {
        // Keep generic message for this, as it's a server-side issue
        toastDescription = "Could not update follow status due to a server error.";
      }
      // No specific toast for "Not authenticated" as user is redirected.

      toast({
        title: toastTitle,
        description: toastDescription,
      });

    } finally {
      // Clear busy state after operation completes with minimal delay
      if (isMountedRef.current) {
        // Reduced delay to minimize flickering
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
    disableAutoFetch
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
        <span className="flex items-center gap-1">
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          <span className="opacity-0">Loading</span>
        </span>
      );
    }
    
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