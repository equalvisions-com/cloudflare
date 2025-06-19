"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { getBookmarksData } from "@/app/actions/bookmarkActions";
import { Id } from "@/convex/_generated/dataModel";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import dynamic from 'next/dynamic';
import { useBookmarkStore } from "@/lib/stores/bookmarkStore";
import { BookmarksData } from "@/lib/types";

// Dynamically import BookmarksContent
const DynamicBookmarksContent = dynamic(
  () => import("./BookmarksContent").then(mod => mod.BookmarksContent),
  {
    ssr: false,
    loading: () => <SkeletonFeed count={5} />
  }
);

const BookmarksContentWrapperComponent = () => {
  const { userId, isAuthenticated } = useSidebar();
  const { loading, setLoading } = useBookmarkStore();
  
  const [initialData, setInitialData] = useState<BookmarksData | null>(null);
  
  const fetchInitialData = useCallback(async () => {
      if (!userId) {
      setLoading({ isLoading: false });
        setInitialData(null);
        return;
      }

    setLoading({ isLoading: true });
      try {
        const data = await getBookmarksData(userId, 0, 30); 
      setInitialData(data as BookmarksData);
      } catch (error) {
        setInitialData(null);
      } finally {
      setLoading({ isLoading: false });
      }
  }, [userId, setLoading]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (!isAuthenticated || !userId) {
    if (loading.isLoading && !initialData) {
      return <SkeletonFeed count={5} />;
    }
    
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

  if (loading.isLoading && !initialData) {
    return <SkeletonFeed count={5} />;
  }

  return (
    <DynamicBookmarksContent 
        userId={userId}
        initialData={initialData}
      />
  );
};

export const BookmarksContentWrapper = memo(BookmarksContentWrapperComponent);
BookmarksContentWrapper.displayName = 'BookmarksContentWrapper'; 