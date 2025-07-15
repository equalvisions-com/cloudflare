'use client';

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Heart } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar-context';
import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";

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
  skipQuery?: boolean; // When true, don't use individual query
}

export const LikeButtonClientWithErrorBoundary = memo(function LikeButtonClientWithErrorBoundary(props: LikeButtonProps) {
  return (
    <ErrorBoundary>
      <LikeButtonClient {...props} />
    </ErrorBoundary>
  );
});

export const LikeButtonClient = memo(function LikeButtonClient({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isLiked: false, count: 0 },
  skipQuery = false
}: LikeButtonProps) {
  const router = useRouter();
  // Use sidebar context to eliminate duplicate users:viewer query
  const { isAuthenticated } = useSidebar();
  const like = useMutation(api.likes.like);
  const unlike = useMutation(api.likes.unlike);
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
  const [optimisticState, setOptimisticState] = useState<{isLiked: boolean, count: number, timestamp: number} | null>(null);
  
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
  const isLiked = optimisticState?.isLiked ?? (skipQuery ? initialData.isLiked : (metricsLoaded ? metrics?.likes.isLiked : initialData.isLiked));
  const likeCount = optimisticState?.count ?? (skipQuery ? initialData.count : (metricsLoaded ? (metrics?.likes.count ?? initialData.count) : initialData.count));
  
  // Only reset optimistic state when real data arrives and matches our expected state
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // When skipQuery is true, we rely on initialData updates from parent batch metrics
    // When skipQuery is false, we rely on individual metrics query
    if (skipQuery) {
      // For skipQuery mode, clear optimistic state when initialData changes and matches our expected state
      if (optimisticState) {
        const isServerMatchingOptimistic = initialData.isLiked === optimisticState.isLiked && initialData.count === optimisticState.count;
        const isOptimisticUpdateStale = Date.now() - optimisticState.timestamp > 3000; // 3 seconds
        
        if (isServerMatchingOptimistic || isOptimisticUpdateStale) {
          setOptimisticState(null);
        }
      }
    } else if (metrics && optimisticState) {
      // Only clear optimistic state if server data matches what we expect
      // or if the optimistic update is older than 5 seconds (fallback)
      const isServerMatchingOptimistic = metrics.likes.isLiked === optimisticState.isLiked;
      const isOptimisticUpdateStale = Date.now() - optimisticState.timestamp > 5000;
      
      if (isServerMatchingOptimistic || isOptimisticUpdateStale) {
        setOptimisticState(null);
      }
    }
  }, [metrics, optimisticState, skipQuery, initialData]);

  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      router.push('/signin');
      return;
    }

    // Calculate new state for optimistic update
    const newState = {
      isLiked: !isLiked,
      count: likeCount + (isLiked ? -1 : 1),
      timestamp: Date.now()
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

      
      const errorMessage = (err as Error).message || 'Something went wrong';
      let toastTitle = "Error";
      let toastDescription = errorMessage;

      if (errorMessage.includes("Too many likes too quickly. Please slow down.")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "Too many likes too quickly. Please slow down.";
      } else if (errorMessage.includes("Please wait before toggling again")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "You're toggling likes too quickly. Please slow down.";
      } else if (errorMessage.includes("Hourly like limit reached. Try again later.")) {
        toastTitle = "Rate Limit Exceeded";
        toastDescription = "Hourly like limit reached. Try again later.";
      }

      // Show user-friendly error message
      toast({
        title: toastTitle,
        description: toastDescription,
      });
      if (isMountedRef.current) {
        setOptimisticState(null);
      }
    }
  }, [
    isAuthenticated, 
    router, 
    isLiked, 
    likeCount, 
    unlike, 
    like, 
    entryGuid, 
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
      <Heart 
        className={`h-4 w-4 stroke-[2.5] transition-colors duration-200 ${
          isLiked 
            ? 'fill-[#f91880] text-[#f91880]' 
            : 'text-muted-foreground fill-none'
        }`}
      />
      <span className="text-[14px] text-muted-foreground font-semibold transition-all duration-200">{likeCount}</span>
    </Button>
  );
}); 