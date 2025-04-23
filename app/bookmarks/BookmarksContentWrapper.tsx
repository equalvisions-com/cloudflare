"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { getBookmarksData } from "@/app/actions/bookmarkActions";
import { Id } from "@/convex/_generated/dataModel";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import dynamic from 'next/dynamic';

// Type import needed for proper typing
import type { BookmarkItem, RSSEntry, InteractionStates } from "@/app/actions/bookmarkActions";

// Dynamically import BookmarksFeed with correct typing
const DynamicBookmarksFeed = dynamic(
  () => import("@/components/bookmarks/BookmarksFeed").then(mod => mod.BookmarksFeed),
  { 
    ssr: false,
    loading: () => <SkeletonFeed count={5} />
  }
);

// Wrapper component to guarantee skeletons show
const SkeletonWrappedBookmarksFeed = (props: any) => {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsLoading(false);
    });
    
    return () => cancelAnimationFrame(frame);
  }, []);
  
  if (isLoading) {
    return <SkeletonFeed count={5} />;
  }
  
  return <DynamicBookmarksFeed {...props} />;
};

export function BookmarksContentWrapper() {
  const { userId, isAuthenticated } = useSidebar();
  
  // Initialize with the correct type structure
  const [initialData, setInitialData] = useState<{
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getBookmarksData(userId, 0, 30);
        setInitialData(data as any);
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  // Show skeleton while loading
  if (isLoading) {
    return <SkeletonFeed count={5} />;
  }

  // If not authenticated or no userId, show message
  if (!isAuthenticated || !userId) {
    return (
      <div className="flex-1 p-6 text-center">
        <div className="p-8 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Login to view your bookmarks</h2>
          <p className="text-gray-500">
            Sign in to see all the posts you&apos;ve bookmarked.
          </p>
        </div>
      </div>
    );
  }

  // Only render BookmarksFeed when we have a userId
  return (
    <div className="sm:pb-[128px] md:pb-0">
      <SkeletonWrappedBookmarksFeed 
        userId={userId}
        initialData={initialData} 
      />
    </div>
  );
} 