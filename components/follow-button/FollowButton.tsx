"use client";

import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useFollowActions } from "./actions";
import useSWR, { mutate as globalMutate } from 'swr';
import { useState, useEffect } from 'react';

interface FollowButtonProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
  initialIsFollowing: boolean;
  isAuthenticated?: boolean; // Make optional to maintain backward compatibility
}

const fetcher = async (key: string) => {
  // Encode the key for use in URL
  const encodedKey = encodeURIComponent(key);
  const res = await fetch(`/api/follows/${encodedKey}`);
  if (!res.ok) throw new Error('Failed to fetch follow status');
  return res.json();
};

export function FollowButtonWithErrorBoundary(props: FollowButtonProps) {
  return (
    <ErrorBoundary>
      <FollowButton {...props} />
    </ErrorBoundary>
  );
}

export function FollowButton({ 
  postId, 
  feedUrl, 
  postTitle, 
  initialIsFollowing,
  isAuthenticated: serverIsAuthenticated 
}: FollowButtonProps) {
  const router = useRouter();
  const { isAuthenticated: clientIsAuthenticated } = useConvexAuth();
  const { followPost, unfollowPost } = useFollowActions();
  
  // Use server-provided auth state initially, then client state once available
  const isAuthenticated = clientIsAuthenticated ?? serverIsAuthenticated;
  
  // Track if we've loaded the initial state
  const [isLoaded, setIsLoaded] = useState(false);

  const { data, mutate } = useSWR(
    isAuthenticated ? postId : null,
    fetcher,
    {
      fallbackData: { isFollowing: initialIsFollowing },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      revalidateIfStale: false,
      revalidateOnMount: false,
      keepPreviousData: true,
    }
  );

  // Set loaded state once we have either SWR data or initial data
  useEffect(() => {
    if (!isLoaded && (data || initialIsFollowing !== undefined)) {
      setIsLoaded(true);
    }
  }, [data, initialIsFollowing, isLoaded]);

  const isFollowing = data?.isFollowing ?? initialIsFollowing;

  const handleClick = async () => {
    if (!isAuthenticated) {
      router.push("/signin");
      return;
    }

    // Optimistic update
    const newState = { isFollowing: !isFollowing };
    await mutate(newState, false);

    try {
      const success = isFollowing
        ? await unfollowPost(postId, postTitle)
        : await followPost(postId, feedUrl, postTitle);

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
      await mutate(undefined, true);
    }
  };

  return (
    <Button
      variant={isFollowing ? "secondary" : "default"}
      onClick={handleClick}
      className="rounded-full"
      disabled={!isAuthenticated}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}