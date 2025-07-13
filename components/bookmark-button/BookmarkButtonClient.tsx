'use client';

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Bookmark } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useSidebar } from '@/components/ui/sidebar-context';
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useToast } from "@/components/ui/use-toast";

interface BookmarkButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
  initialData?: {
    isBookmarked: boolean;
  };
  skipQuery?: boolean; // When true, don't use individual query
}

export const BookmarkButtonClientWithErrorBoundary = memo(function BookmarkButtonClientWithErrorBoundary(props: BookmarkButtonProps) {
  return (
    <ErrorBoundary>
      <BookmarkButtonClient {...props} />
    </ErrorBoundary>
  );
});

// Create the component implementation that will be memoized
const BookmarkButtonClientComponent = ({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isBookmarked: false },
  skipQuery = false
}: BookmarkButtonProps) => {
  const router = useRouter();
  // Use sidebar context to eliminate duplicate users:viewer query
  const { isAuthenticated } = useSidebar();
  const bookmark = useMutation(api.bookmarks.bookmark);
  const removeBookmark = useMutation(api.bookmarks.removeBookmark);
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
  const [optimisticState, setOptimisticState] = useState<{isBookmarked: boolean, timestamp: number} | null>(null);
  
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
  const isBookmarked = optimisticState?.isBookmarked ?? (skipQuery ? initialData.isBookmarked : (metricsLoaded ? metrics?.bookmarks.isBookmarked : initialData.isBookmarked));
  
  // Only reset optimistic state when real data arrives and matches our expected state
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    // When skipQuery is true, we rely on initialData updates from parent batch metrics
    // When skipQuery is false, we rely on individual metrics query
    if (skipQuery) {
      // For skipQuery mode, clear optimistic state when initialData changes and matches our expected state
      if (optimisticState) {
        const isServerMatchingOptimistic = initialData.isBookmarked === optimisticState.isBookmarked;
        const isOptimisticUpdateStale = Date.now() - optimisticState.timestamp > 3000; // 3 seconds
        
        if (isServerMatchingOptimistic || isOptimisticUpdateStale) {
          setOptimisticState(null);
        }
      }
    } else if (metrics && optimisticState) {
      // Only clear optimistic state if server data matches what we expect
      // or if the optimistic update is older than 5 seconds (fallback)
      const isServerMatchingOptimistic = metrics.bookmarks.isBookmarked === optimisticState.isBookmarked;
      const isOptimisticUpdateStale = Date.now() - optimisticState.timestamp > 5000;
      
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
      isBookmarked: !isBookmarked,
      timestamp: Date.now()
    };

    // Apply optimistic update
    setOptimisticState(newState);

    try {
      if (isBookmarked) {
        await removeBookmark({ entryGuid });
      } else {
        await bookmark({
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

      if (isMountedRef.current) {
        setOptimisticState(null);

        const errorMessage = (err as Error).message || 'Something went wrong';
        let toastTitle = "Error";
        let toastDescription = errorMessage;

        if (errorMessage.includes("Please wait before toggling again")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "You're toggling bookmarks too quickly. Please slow down.";
        } else if (errorMessage.includes("Too many bookmarks too quickly")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "Too many bookmarks too quickly. Please slow down.";
        } else if (errorMessage.includes("Hourly bookmark limit reached")) {
          toastTitle = "Rate Limit Exceeded";
          toastDescription = "Hourly bookmark limit reached. Try again later.";
        }
        // No specific toast for "Not authenticated" as user is redirected.

        toast({
          title: toastTitle,
          description: toastDescription,
        });
      }
    }
  }, [
    isAuthenticated, 
    router, 
    isBookmarked, 
    removeBookmark, 
    entryGuid, 
    bookmark, 
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
      className="px-0 hover:bg-transparent items-center justify-center w-full"
      onClick={handleClick}
      aria-label={isBookmarked ? `Remove bookmark for ${title}` : `Bookmark ${title}`}
    >
      <Bookmark 
        className={`h-4 w-4 text-muted-foreground stroke-[2.5] transition-colors duration-200 ${isBookmarked ? 'fill-current text-red-500' : ''}`}
      />
    </Button>
  );
};

// Export the memoized version of the component
export const BookmarkButtonClient = memo(BookmarkButtonClientComponent); 