"use client";

import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect, memo, useMemo } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import dynamic from 'next/dynamic';
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { useBookmarkActions } from "@/lib/hooks/useBookmarkActions";
import { BookmarksData } from "@/lib/types";

// Dynamically import BookmarksFeed with loading state
const DynamicBookmarksFeed = dynamic(
  () => import("@/components/bookmarks/BookmarksFeed").then(mod => ({ default: mod.BookmarksFeed })),
  { 
    ssr: false,
    loading: () => <SkeletonFeed count={5} />
  }
);

interface BookmarksContentProps {
  userId: Id<"users"> | null;
  initialData: BookmarksData | null;
}

const BookmarksContentComponent = ({ userId, initialData }: BookmarksContentProps) => {
  const { isAuthenticated } = useSidebar();
  const { searchQuery, searchResults, isSearching } = useBookmarkActions(userId);
  
  // Memoized components for better performance
  const LoginMessage = useMemo(() => (
      <div className="flex-1 p-6 text-center">
        <div className="p-8 border border-gray-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Login to view your bookmarks</h2>
          <p className="text-gray-500">
            Sign in to see all the posts you&apos;ve bookmarked.
          </p>
        </div>
      </div>
  ), []);

  const NoResultsMessage = useMemo(() => (
    <div className="flex-1 p-6 text-center">
      <div className="p-8 border border-gray-200 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">No results found</h2>
        <p className="text-gray-500">
          No bookmarks match your search for &quot;{searchQuery}&quot;
        </p>
      </div>
    </div>
  ), [searchQuery]);

  if (!isAuthenticated || !userId) {
    return LoginMessage;
  }

  // If there's an active search query
  if (searchQuery && searchQuery.trim().length > 0) {
    if (isSearching) {
      return <SkeletonFeed count={5} />;
    }
    
    if (searchResults) {
      if (searchResults.bookmarks.length === 0) {
        return NoResultsMessage;
      }
      
      return (
        <DynamicBookmarksFeed 
          userId={userId} 
          initialData={searchResults}
          pageSize={30} 
          isSearchResults={true}
        />
      );
    }
  }
    
  // Regular bookmarks view
  if (!initialData) {
    return <SkeletonFeed count={5} />;
  }
  
  return (
    <DynamicBookmarksFeed 
      userId={userId} 
      initialData={initialData}
      pageSize={30} 
      isSearchResults={false}
      />
  );
}; 

export const BookmarksContent = memo(BookmarksContentComponent);
BookmarksContent.displayName = 'BookmarksContent'; 