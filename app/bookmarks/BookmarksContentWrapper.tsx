"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { getBookmarksData } from "@/app/actions/bookmarkActions";
import { Id } from "@/convex/_generated/dataModel";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import dynamic from 'next/dynamic'; // Import dynamic

// Type import needed for proper typing
import type { BookmarkItem, RSSEntry, InteractionStates } from "@/app/actions/bookmarkActions";

// Dynamically import BookmarksContent
const DynamicBookmarksContent = dynamic(
  () => import("./BookmarksContent").then(mod => mod.BookmarksContent),
  {
    ssr: false, // Keep it client-side as it deals with client state for search
    loading: () => <SkeletonFeed count={5} />
  }
);

export function BookmarksContentWrapper() {
  const { userId, isAuthenticated } = useSidebar();
  console.log('[BookmarksContentWrapper RENDER] userId:', userId, 'isAuthenticated:', isAuthenticated);
  
  const [initialData, setInitialData] = useState<{
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[BookmarksContentWrapper useEffect] userId changed. Current userId:', userId);
    const fetchData = async () => {
      if (!userId) {
        console.log('[BookmarksContentWrapper fetchData] No userId, setting isLoading to false and returning.');
        setIsLoading(false);
        setInitialData(null);
        return;
      }

      console.log('[BookmarksContentWrapper fetchData] Fetching initial bookmarks data for userId:', userId);
      setIsLoading(true);
      try {
        const data = await getBookmarksData(userId, 0, 30); 
        console.log('[BookmarksContentWrapper fetchData] Initial data received:', data);
        setInitialData(data as any);
      } catch (error) {
        console.error("[BookmarksContentWrapper fetchData] Error fetching initial bookmarks:", error);
        setInitialData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (!isAuthenticated || !userId) {
    if (isLoading && !initialData) { 
      console.log('[BookmarksContentWrapper RENDER] Initial load, no userId yet but isLoading. Showing SkeletonFeed.');
      return <SkeletonFeed count={5} />;
    }
    console.log('[BookmarksContentWrapper RENDER] Not authenticated or no userId. Showing login message.');
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

  if (isLoading) {
    console.log('[BookmarksContentWrapper RENDER] userId present, but initialData is loading. Showing SkeletonFeed.');
    return <SkeletonFeed count={5} />;
  }

  console.log('[BookmarksContentWrapper RENDER] Rendering DynamicBookmarksContent with userId and initialData.');
  return (
      <DynamicBookmarksContent // Use the dynamically imported component
        userId={userId}
        initialData={initialData}
      />
  );
} 