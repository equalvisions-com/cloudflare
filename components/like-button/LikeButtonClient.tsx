'use client';

import useSWR, { mutate as globalMutate } from 'swr';
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Heart } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';

interface LikeButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
  initialData?: {
    isLiked: boolean;
    count: number;
  };
}

const fetcher = async (key: string) => {
  // Encode the key for use in URL
  const encodedKey = encodeURIComponent(key);
  const res = await fetch(`/api/likes/${encodedKey}`);
  if (!res.ok) throw new Error('Failed to fetch like status');
  return res.json();
};

export function LikeButtonClientWithErrorBoundary(props: LikeButtonProps) {
  return (
    <ErrorBoundary>
      <LikeButtonClient {...props} />
    </ErrorBoundary>
  );
}

export function LikeButtonClient({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isLiked: false, count: 0 }
}: LikeButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const like = useMutation(api.likes.like);
  const unlike = useMutation(api.likes.unlike);
  
  const { data, mutate } = useSWR(
    entryGuid,
    fetcher,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000, // 5 seconds
      revalidateIfStale: false, // Don't revalidate if we have initial data
      revalidateOnMount: !initialData, // Only fetch if we don't have initial data
    }
  );

  const isLiked = data?.isLiked ?? initialData.isLiked;
  const likeCount = data?.count ?? initialData.count;

  const handleClick = async () => {
    if (!isAuthenticated) {
      router.push('/signin');
      return;
    }

    const newState = {
      isLiked: !isLiked,
      count: likeCount + (isLiked ? -1 : 1)
    };

    // Optimistic update
    await mutate(newState, false);

    try {
      if (isLiked) {
        await unlike({ entryGuid });
      } else {
        await like({
          entryGuid,
          feedUrl,
          title,
          pubDate,
          link,
        });
      }
      
      // After successful mutation, update all instances of this entry
      await Promise.all([
        mutate(newState),
        // Update the batch cache
        globalMutate(
          `/api/batch`,
          (data) => {
            if (!data?.entries) return data;
            return {
              ...data,
              entries: {
                ...data.entries,
                [entryGuid]: {
                  ...data.entries[entryGuid],
                  likes: newState
                }
              }
            };
          },
          false
        )
      ]);
    } catch (err) {
      // Revert on error
      console.error('Error updating like status:', err);
      await mutate();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full"
      onClick={handleClick}
    >
      <Heart 
        className={`h-4 w-4 transition-colors ${isLiked ? 'fill-current text-[#f91880]' : ''}`}
      />
      <span>{likeCount}</span>
    </Button>
  );
} 