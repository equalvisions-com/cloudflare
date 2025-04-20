'use client';

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Repeat } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useToast } from "@/components/ui/use-toast";
import { useState, useEffect, useRef, useCallback, memo } from 'react';

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

// Create the component implementation that will be memoized
const RetweetButtonClientComponent = ({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isRetweeted: false, count: 0 }
}: RetweetButtonProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const retweet = useMutation(api.retweets.retweet);
  const unretweet = useMutation(api.retweets.unretweet);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Use Convex's real-time query with proper loading state handling
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  
  // Track if the metrics have been loaded at least once
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  
  // Use state for optimistic updates
  const [optimisticState, setOptimisticState] = useState<{isRetweeted: boolean, count: number, timestamp: number} | null>(null);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Update metricsLoaded when metrics are received
  useEffect(() => {
    if (metrics && !metricsLoaded && isMountedRef.current) {
      setMetricsLoaded(true);
    }
  }, [metrics, metricsLoaded]);
  
  // Determine the current state, prioritizing optimistic updates
  // If metrics haven't loaded yet, use initialData to prevent flickering
  const isRetweeted = optimisticState?.isRetweeted ?? (metricsLoaded ? (metrics?.retweets?.isRetweeted ?? initialData.isRetweeted) : initialData.isRetweeted);
  const retweetCount = optimisticState?.count ?? (metricsLoaded ? (metrics?.retweets?.count ?? initialData.count) : initialData.count);
  
  // Only reset optimistic state when real data arrives and matches our expected state
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (metrics && optimisticState) {
      // Only clear optimistic state if server data matches what we expect
      // or if the optimistic update is older than 5 seconds (fallback)
      const isServerMatchingOptimistic = metrics.retweets?.isRetweeted === optimisticState.isRetweeted;
      const isOptimisticUpdateStale = Date.now() - optimisticState.timestamp > 5000;
      
      // Only clear if the server state matches our optimistic state
      // This prevents flickering when the server confirms our update
      if (isServerMatchingOptimistic || isOptimisticUpdateStale) {
        setOptimisticState(null);
      }
    }
  }, [metrics, optimisticState]);

  // Memoize the click handler to prevent unnecessary recreations between renders
  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      router.push('/signin');
      return;
    }

    // Calculate new state for optimistic update
    const newState = {
      isRetweeted: !isRetweeted,
      count: retweetCount + (isRetweeted ? -1 : 1),
      timestamp: Date.now()
    };

    // Apply optimistic update
    setOptimisticState(newState);

    try {
      if (isRetweeted) {
        await unretweet({ entryGuid });
        if (isMountedRef.current) {
          toast({
            title: "Removed from your posts",
            description: "This post has been removed from your profile.",
            duration: 3000,
          });
        }
      } else {
        await retweet({
          entryGuid,
          feedUrl,
          title,
          pubDate,
          link,
        });
        if (isMountedRef.current) {
          toast({
            title: "Added to your posts",
            description: "This post will now appear on your profile.",
            duration: 3000,
          });
        }
      }
      // Convex will automatically update the UI with the new state
      // No need to manually update as the useQuery hook will receive the update
    } catch (err) {
      // Revert optimistic update on error
      console.error('Error updating retweet status:', err);
      if (isMountedRef.current) {
        setOptimisticState(null);
        toast({
          title: "Error",
          description: "There was an error processing your request.",
          variant: "destructive",
          duration: 3000,
        });
      }
    }
  }, [
    isAuthenticated, 
    router, 
    isRetweeted, 
    retweetCount, 
    unretweet, 
    entryGuid, 
    retweet, 
    feedUrl, 
    title, 
    pubDate, 
    link, 
    toast
  ]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 px-0 hover:bg-transparent items-center justify-center w-full"
      onClick={handleClick}
    >
      <Repeat 
        className={`h-4 w-4 stroke-[2.5] transition-colors duration-200 ${
          isRetweeted 
            ? 'text-green-500 fill-none' 
            : 'text-muted-foreground fill-none'
        }`}
      />
      <span className="text-[14px] text-muted-foreground font-semibold transition-all duration-200">{retweetCount}</span>
    </Button>
  );
};

// Export the memoized version of the component
export const RetweetButtonClient = memo(RetweetButtonClientComponent); 