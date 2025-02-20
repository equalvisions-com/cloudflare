'use client';

import { useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

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

export function LikeButtonClient({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isLiked: false, count: 0 }
}: LikeButtonProps) {
  const like = useMutation(api.likes.like);
  const unlike = useMutation(api.likes.unlike);
  
  const { data, error, mutate } = useSWR(
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
          (data: any) => {
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
    } catch (error) {
      // Revert on error
      await mutate();
    }
  };

  if (error) {
    console.error('Error fetching like status:', error);
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-3"
      onClick={handleClick}
    >
      <Heart 
        className={`h-4 w-4 transition-colors ${isLiked ? 'fill-current text-primary' : ''}`}
      />
      <span>{likeCount}</span>
    </Button>
  );
} 