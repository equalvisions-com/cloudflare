"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { BookmarkEntry } from "./BookmarkEntry";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

type BookmarksListProps = {
  userId: Id<"users">;
};

export const BookmarksList = ({ userId }: BookmarksListProps) => {
  const [skip, setSkip] = useState(0);
  const limit = 10;

  const { bookmarks, totalCount, hasMore } = useQuery(api.userActivity.getUserBookmarks, {
    userId,
    skip,
    limit,
  }) || { bookmarks: [], totalCount: 0, hasMore: false };

  const handleLoadMore = () => {
    setSkip(skip + limit);
  };

  if (!bookmarks || bookmarks.length === 0) {
    return (
      <div className="p-10 text-center">
        <h3 className="text-lg font-medium text-gray-600">No bookmarks found</h3>
        <p className="text-gray-500 mt-2">
          Bookmarks you save will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-gray-200 pb-2 mb-4">
        <h2 className="text-xl font-bold">Your Bookmarks</h2>
        <p className="text-sm text-gray-500">{totalCount} bookmarks saved</p>
      </div>

      <div className="divide-y divide-gray-100">
        {bookmarks.map((bookmark) => (
          <BookmarkEntry
            key={bookmark._id}
            title={bookmark.title}
            link={bookmark.link}
            pubDate={bookmark.pubDate}
            bookmarkedAt={bookmark.bookmarkedAt}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button
            onClick={handleLoadMore}
            variant="outline"
            className="px-4 py-2"
          >
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}; 