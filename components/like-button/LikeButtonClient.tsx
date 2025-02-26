'use client';

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Heart } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useState, useEffect } from 'react';

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
  
  // Use Convex's real-time query with proper loading state handling
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  
  // Track if the metrics have been loaded at least once
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  
  // Use state for optimistic updates
  const [optimisticState, setOptimisticState] = useState<{isLiked: boolean, count: number} | null>(null);
  
  // Update metricsLoaded when metrics are received
  useEffect(() => {
    if (metrics && !metricsLoaded) {
      setMetricsLoaded(true);
    }
  }, [metrics, metricsLoaded]);
  
  // Determine the current state, prioritizing optimistic updates
  // If metrics haven't loaded yet, use initialData to prevent flickering
  const isLiked = optimisticState?.isLiked ?? (metricsLoaded ? metrics?.likes.isLiked : initialData.isLiked);
  const likeCount = optimisticState?.count ?? (metricsLoaded ? (metrics?.likes.count ?? initialData.count) : initialData.count);
  
  // Reset optimistic state when real data arrives
  useEffect(() => {
    if (metrics && optimisticState) {
      setOptimisticState(null);
    }
  }, [metrics, optimisticState]);

  const handleClick = async () => {
    if (!isAuthenticated) {
      router.push('/signin');
      return;
    }

    // Calculate new state for optimistic update
    const newState = {
      isLiked: !isLiked,
      count: likeCount + (isLiked ? -1 : 1)
    };

    // Apply optimistic update
    setOptimisticState(newState);

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
      // Convex will automatically update the UI with the new state
      // No need to manually update as the useQuery hook will receive the update
    } catch (err) {
      // Revert optimistic update on error
      console.error('Error updating like status:', err);
      setOptimisticState(null);
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