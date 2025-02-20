"use client";

import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Id } from "@/convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useFollowActions } from "./actions";
import useSWR, { mutate as globalMutate } from 'swr';

interface FollowButtonProps {
  postId: Id<"posts">;
  feedUrl: string;
  postTitle: string;
  initialIsFollowing: boolean;
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

export function FollowButton({ postId, feedUrl, postTitle, initialIsFollowing }: FollowButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { followPost, unfollowPost } = useFollowActions();

  const { data, mutate } = useSWR(
    isAuthenticated ? postId : null, // Only fetch if authenticated
    fetcher,
    {
      fallbackData: { isFollowing: initialIsFollowing },
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Increase to 60 seconds
      revalidateIfStale: false,
      revalidateOnMount: false, // Never revalidate on mount, trust the server data
      keepPreviousData: true, // Keep showing previous data while loading
    }
  );

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
        await mutate(newState, false); // Don't revalidate after success
        
        // Revalidate all relevant caches
        await Promise.all([
          globalMutate('/api/rss'),
          globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/follows')),
          globalMutate((key: string) => typeof key === 'string' && key.startsWith('/api/profile')),
          router.refresh() // Force Next.js to revalidate server components
        ]);
      } else {
        // Revert on error
        await mutate(undefined, true); // Force revalidate on error
      }
    } catch (err) {
      console.error('Error updating follow status:', err);
      await mutate(undefined, true); // Force revalidate on error
    }
  };

  return (
    <Button
      variant={isFollowing ? "secondary" : "default"}
      onClick={handleClick}
      className="w-28 disabled:opacity-100"
      disabled={!isAuthenticated}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}