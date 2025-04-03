"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import { BookmarksContent } from "./BookmarksContent";
import { getBookmarksData } from "@/app/actions/bookmarkActions";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

// Type import needed for proper typing
import type { BookmarkItem, RSSEntry, InteractionStates } from "@/app/actions/bookmarkActions";

export function BookmarksContentWrapper() {
  const { userId } = useSidebar();
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
        // Explicit type assertion
        setInitialData(data as any);
      } catch (error) {
        console.error("Error fetching bookmarks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Provide safe fallbacks for props
  return (
    <BookmarksContent 
      userId={userId || null} 
      initialData={initialData} 
    />
  );
} 