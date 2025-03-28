"use client";

import { Id } from "@/convex/_generated/dataModel";
import { BookmarksFeed } from "@/app/components/bookmarks/BookmarksFeed";
import { BookmarkItem, RSSEntry, InteractionStates } from "@/app/actions/bookmarkActions";

interface BookmarksContentProps {
  isAuthenticated: boolean;
  userId: Id<"users"> | null;
  initialData: {
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null;
}

export const BookmarksContent = ({ isAuthenticated, userId, initialData }: BookmarksContentProps) => {
  if (!isAuthenticated || !userId) {
    return (
      <div className="flex-1 p-6 text-center">
        <div className="p-8 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Login to view your bookmarks</h2>
          <p className="text-gray-500">
            Sign in to see all the posts you've bookmarked.
          </p>
        </div>
      </div>
    );
  }

  return (
      <BookmarksFeed userId={userId} initialData={initialData} pageSize={30} />
  );
}; 