'use client';

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Bookmark } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { useState, useEffect } from 'react';

interface BookmarkButtonProps {
  entryGuid: string;
  feedUrl: string;
  title: string;
  pubDate: string;
  link: string;
  initialData?: {
    isBookmarked: boolean;
  };
}

export function BookmarkButtonClientWithErrorBoundary(props: BookmarkButtonProps) {
  return (
    <ErrorBoundary>
      <BookmarkButtonClient {...props} />
    </ErrorBoundary>
  );
}

export function BookmarkButtonClient({ 
  entryGuid, 
  feedUrl, 
  title, 
  pubDate, 
  link,
  initialData = { isBookmarked: false }
}: BookmarkButtonProps) {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const bookmark = useMutation(api.bookmarks.bookmark);
  const removeBookmark = useMutation(api.bookmarks.removeBookmark);
  
  // Use Convex's real-time query with proper loading state handling
  const metrics = useQuery(api.entries.getEntryMetrics, { entryGuid });
  
  // Track if the metrics have been loaded at least once
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  
  // Use state for optimistic updates
  const [optimisticState, setOptimisticState] = useState<{isBookmarked: boolean, timestamp: number} | null>(null);
  
  // Update metricsLoaded when metrics are received
  useEffect(() => {
    if (metrics && !metricsLoaded) {
      setMetricsLoaded(true);
    }
  }, [metrics, metricsLoaded]);
  
  // Determine the current state, prioritizing optimistic updates
  // If metrics haven't loaded yet, use initialData to prevent flickering
  const isBookmarked = optimisticState?.isBookmarked ?? (metricsLoaded ? metrics?.bookmarks.isBookmarked : initialData.isBookmarked);
  
  // Only reset optimistic state when real data arrives and matches our expected state
  useEffect(() => {
    if (metrics && optimisticState) {
      // Only clear optimistic state if server data matches what we expect
      // or if the optimistic update is older than 5 seconds (fallback)
      const isServerMatchingOptimistic = metrics.bookmarks.isBookmarked === optimisticState.isBookmarked;
      const isOptimisticUpdateStale = Date.now() - optimisticState.timestamp > 5000;
      
      if (isServerMatchingOptimistic || isOptimisticUpdateStale) {
        setOptimisticState(null);
      }
    }
  }, [metrics, optimisticState]);

  const handleClick = async () => {
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
      console.error('Error updating bookmark status:', err);
      setOptimisticState(null);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="px-0 hover:bg-transparent items-center justify-center w-full"
      onClick={handleClick}
    >
      <Bookmark 
        className={`h-4 w-4 text-muted-foreground stroke-[2.5] transition-colors duration-200 ${isBookmarked ? 'fill-current text-red-500' : ''}`}
      />
    </Button>
  );
} 