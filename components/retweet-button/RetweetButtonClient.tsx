'use client';

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Repeat } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect } from 'react';

interface RetweetButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
  initialData?: {
    isRetweeted: boolean;
    count: number;
  };
}

export function RetweetButtonClientWithErrorBoundary(props: RetweetButtonProps) {
  return (
    <ErrorBoundary>
      <RetweetButtonClient {...props} />
    </ErrorBoundary>
  );
}

export function RetweetButtonClient({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isRetweeted: false, count: 0 }
}: RetweetButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const retweet = useMutation(api.retweets.retweet);
  const unretweet = useMutation(api.retweets.unretweet);
  
  // Use Convex's real-time query with proper loading state handling
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  
  // Track if the metrics have been loaded at least once
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  
  // Use state for optimistic updates
  const [optimisticState, setOptimisticState] = useState<{isRetweeted: boolean, count: number} | null>(null);
  
  // Update metricsLoaded when metrics are received
  useEffect(() => {
    if (metrics && !metricsLoaded) {
      setMetricsLoaded(true);
    }
  }, [metrics, metricsLoaded]);
  
  // Determine the current state, prioritizing optimistic updates
  // If metrics haven't loaded yet, use initialData to prevent flickering
  const isRetweeted = optimisticState?.isRetweeted ?? (metricsLoaded ? (metrics?.retweets?.isRetweeted ?? initialData.isRetweeted) : initialData.isRetweeted);
  const retweetCount = optimisticState?.count ?? (metricsLoaded ? (metrics?.retweets?.count ?? initialData.count) : initialData.count);
  
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
      isRetweeted: !isRetweeted,
      count: retweetCount + (isRetweeted ? -1 : 1)
    };

    // Apply optimistic update
    setOptimisticState(newState);

    try {
      if (isRetweeted) {
        await unretweet({ entryGuid });
        toast({
          title: "Removed from your posts",
          description: "This post has been removed from your profile.",
          duration: 3000,
        });
      } else {
        await retweet({
          entryGuid,
          feedUrl,
          title,
          pubDate,
          link,
        });
        toast({
          title: "Added to your posts",
          description: "This post will now appear on your profile.",
          duration: 3000,
        });
      }
      // Convex will automatically update the UI with the new state
      // No need to manually update as the useQuery hook will receive the update
    } catch (err) {
      // Revert optimistic update on error
      console.error('Error updating retweet status:', err);
      setOptimisticState(null);
      toast({
        title: "Error",
        description: "There was an error processing your request.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full"
      onClick={handleClick}
    >
      <Repeat 
        className={`h-4 w-4 transition-colors ${isRetweeted ? 'text-green-500' : ''}`}
      />
      <span>{retweetCount}</span>
    </Button>
  );
} 