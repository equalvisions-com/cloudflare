'use client';

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Repeat } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useToast } from "@/components/ui/use-toast";

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
  skipQuery?: boolean; // When true, don't use individual query
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
  initialData = { isRetweeted: false, count: 0 },
  skipQuery = false
}: RetweetButtonProps) => {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const retweet = useMutation(api.retweets.retweet);
  const unretweet = useMutation(api.retweets.unretweet);
  const { toast } = useToast();
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Use Convex's real-time query with proper loading state handling
  // Skip query if parent is handling batch metrics
  const metrics = useQuery(
    api.entries.getEntryMetrics, 
    skipQuery ? 'skip' : { entryGuid }
  );
  
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
  
  // Update metricsLoaded when metrics are received OR when skipQuery is true
  useEffect(() => {
    if ((metrics && !metricsLoaded) || (skipQuery && !metricsLoaded)) {
      if (isMountedRef.current) {
        setMetricsLoaded(true);
      }
    }
  }, [metrics, metricsLoaded, skipQuery]);
  
  // Determine the current state, prioritizing optimistic updates
  // When skipQuery is true, always use initialData as the base (it comes from batch metrics)
  // When skipQuery is false, use server metrics after they load
  const isRetweeted = optimisticState?.isRetweeted ?? (skipQuery ? initialData.isRetweeted : (metricsLoaded ? (metrics?.retweets?.isRetweeted ?? initialData.isRetweeted) : initialData.isRetweeted));
  const retweetCount = optimisticState?.count ?? (skipQuery ? initialData.count : (metricsLoaded ? (metrics?.retweets?.count ?? initialData.count) : initialData.count));
  
  // Only reset optimistic state when real data arrives and matches our expected state
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // When skipQuery is true, we rely on initialData updates from parent batch metrics
    // When skipQuery is false, we rely on individual metrics query
    if (skipQuery) {
      // For skipQuery mode, clear optimistic state when initialData changes and matches our expected state
      if (optimisticState) {
        const isServerMatchingOptimistic = initialData.isRetweeted === optimisticState.isRetweeted && initialData.count === optimisticState.count;
        const isOptimisticUpdateStale = Date.now() - optimisticState.timestamp > 3000; // 3 seconds
        
        if (isServerMatchingOptimistic || isOptimisticUpdateStale) {
          setOptimisticState(null);
        }
      }
    } else if (metrics && optimisticState) {
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
  }, [metrics, optimisticState, skipQuery, initialData]);

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
        // Optional: Show success toast for unretweet
        // if (isMountedRef.current) {
        //   toast({
        //     title: "Removed from your posts",
        //     description: "This post has been removed from your profile.",
        //     duration: 3000,
        //   });
        // }
      } else {
        await retweet({
          entryGuid,
          feedUrl,
          title,
          pubDate,
          link,
        });
        // Optional: Show success toast for retweet
        // if (isMountedRef.current) {
        //   toast({
        //     title: "Added to your posts",
        //     description: "This post will now appear on your profile.",
        //     duration: 3000,
        //   });
        // }
      }
      // Convex will automatically update the UI with the new state
      // No need to manually update as the useQuery hook will receive the update
    } catch (err) {
      // Revert optimistic update on error

      if (isMountedRef.current) {
        setOptimisticState(null);
        
        const errorMessage = (err as Error).message || 'Something went wrong';
        let toastTitle = "Error";
        let toastDescription = errorMessage;

        if (errorMessage.includes("Too many retweets too quickly. Please slow down.")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "Too many shares too quickly. Please slow down.";
        } else if (errorMessage.includes("Please wait before toggling retweet again")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "You're toggling shares too quickly. Please wait a moment.";
        } else if (errorMessage.includes("Hourly retweet limit reached. Try again later.")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "Hourly shares limit reached. Try again later.";
        }
        
        toast({
          title: toastTitle,
          description: toastDescription,
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