"use client";

import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useFollowActions } from "./actions";
import useSWR, { mutate as globalMutate } from 'swr';
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
  initialIsFollowing: boolean;
  isAuthenticated?: boolean; // Make optional to maintain backward compatibility
  className?: string; // Add className prop
  disableAutoFetch?: boolean; // New prop to control when we should skip individual fetching
}

const fetcher = async (key: string) => {
  // Encode the key for use in URL
  const encodedKey = encodeURIComponent(key);
  const res = await fetch(`/api/follows/${encodedKey}`);
  if (!res.ok) throw new Error('Failed to fetch follow status');
  return res.json();
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
  disableAutoFetch = false
}: FollowButtonProps) => {
  const router = useRouter();
  const { isAuthenticated: clientIsAuthenticated } = useConvexAuth();
  const { followPost, unfollowPost } = useFollowActions();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Use server-provided auth state initially, then client state once available
  const isAuthenticated = clientIsAuthenticated ?? serverIsAuthenticated;
  
  // Track if we've loaded the initial state
  const [isLoaded, setIsLoaded] = useState(false);

  // Skip fetching if we're in a list context that already provided the follow state
  // or if fetching is explicitly disabled
  const shouldFetch = isAuthenticated && !disableAutoFetch;

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { data, mutate } = useSWR(
    shouldFetch ? postId : null,
    fetcher,
    {
      fallbackData: { isFollowing: initialIsFollowing },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      revalidateIfStale: true,
      revalidateOnMount: !disableAutoFetch, // Only revalidate if not in batch mode
      keepPreviousData: true,
    }
  );

  // Set loaded state once we have either SWR data or initial data
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (!isLoaded && (data || initialIsFollowing !== undefined)) {
      setIsLoaded(true);
    }
    
    // Only force revalidation if we're not in batch mode
    if (shouldFetch && initialIsFollowing !== undefined && data?.isFollowing !== initialIsFollowing) {
      mutate();
    }
  }, [data, initialIsFollowing, isLoaded, shouldFetch, mutate]);

  // Make sure we use the most accurate state available
  const isFollowing = data?.isFollowing ?? initialIsFollowing;

  // Memoize the click handler to prevent unnecessary recreations between renders
  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    if (!isMountedRef.current) return;

    // Optimistic update
    const newState = { isFollowing: !isFollowing };
    await mutate(newState, false);

    try {
      const success = isFollowing
        ? await unfollowPost(postId, postTitle)
        : await followPost(postId, feedUrl, postTitle);

      if (!isMountedRef.current) return;

      if (success) {
        // After successful mutation, update all instances
        await mutate(newState, false);
        
        // Revalidate all relevant caches
        await Promise.all([
          globalMutate('/api/rss'),
          globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/follows')),
          globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/profile')),
          router.refresh()
        ]);
      } else {
        await mutate(undefined, true);
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
      if (isMountedRef.current) {
        await mutate(undefined, true);
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
    feedUrl
  ]);

  return (
    <Button
      variant={isFollowing ? "ghost" : "default"}
      onClick={handleClick}
      className={cn(
        "rounded-full opacity-100 hover:opacity-100 font-semibold shadow-none",
        isFollowing && "text-muted-foreground border border-input",
        className
      )}
      style={{ opacity: 1 }}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
};

// Export the memoized version of the component
export const FollowButton = memo(FollowButtonComponent);