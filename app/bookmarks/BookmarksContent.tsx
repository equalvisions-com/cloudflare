"use client";

import { Id } from "@/convex/_generated/dataModel";
import { BookmarkItem, RSSEntry, InteractionStates } from "@/app/actions/bookmarkActions";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import dynamic from 'next/dynamic';
import { SkeletonFeed } from "@/components/ui/skeleton-feed";

// Dynamically import BookmarksFeed with loading state
const DynamicBookmarksFeed = dynamic(
  () => import("@/components/bookmarks/BookmarksFeed").then(mod => ({ default: mod.BookmarksFeed })),
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

interface BookmarksContentProps {
  userId: Id<"users"> | null;
  initialData: {
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null;
}

export const BookmarksContent = ({ userId, initialData }: BookmarksContentProps) => {
  const { isAuthenticated } = useSidebar();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q");
  
  const [searchResults, setSearchResults] = useState<{
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);

  // Handle search query changes
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchQuery || !userId) return;
      
      setIsSearching(true);
      try {
        const result = await fetch(`/api/bookmarks/search?userId=${userId}&query=${encodeURIComponent(searchQuery)}`);
        
        if (!result.ok) {
          throw new Error(`Search API error: ${result.status}`);
        }
        
        const data = await result.json();
        setSearchResults(data);
      } catch (error) {
        console.error('Error searching bookmarks:', error);
      } finally {
        setIsSearching(false);
      }
    };
    
    if (searchQuery) {
      fetchSearchResults();
    } else {
      setSearchResults(null);
    }
  }, [searchQuery, userId]);

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

  // Show search results if available
  if (searchQuery) {
    if (isSearching) {
      return <SkeletonFeed count={5} />;
    }
    
    if (searchResults) {
      if (searchResults.bookmarks.length === 0) {
        return (
          <div className="flex-1 p-6 text-center">
            <div className="p-8 border border-gray-200 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">No results found</h2>
              <p className="text-gray-500">
                No bookmarks match your search for &quot;{searchQuery}&quot;
              </p>
            </div>
          </div>
        );
      }
      
      return (
        <SkeletonWrappedBookmarksFeed 
          userId={userId} 
          initialData={searchResults} 
          pageSize={30} 
          isSearchResults={true}
        />
      );
    }
    
    return null;
  }

  // Default: show all bookmarks
  return (
    <SkeletonWrappedBookmarksFeed userId={userId} initialData={initialData} pageSize={30} />
  );
}; 