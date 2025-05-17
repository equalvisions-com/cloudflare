"use client";

import { Id } from "@/convex/_generated/dataModel";
import { BookmarkItem, RSSEntry, InteractionStates } from "@/app/actions/bookmarkActions";
// import { useSearchParams } from "next/navigation"; // No longer using URL search params
import { useState, useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar-context";
import dynamic from 'next/dynamic';
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { useSearch } from "./SearchContext"; // Import useSearch

// Dynamically import BookmarksFeed with loading state
const DynamicBookmarksFeed = dynamic(
  () => import("@/components/bookmarks/BookmarksFeed").then(mod => ({ default: mod.BookmarksFeed })),
  { 
    ssr: false,
    loading: () => <SkeletonFeed count={5} /> // This skeleton handles DynamicBookmarksFeed loading
  }
);

// Simplified SkeletonWrappedBookmarksFeed: It no longer has its own forced skeleton.
// It primarily serves as a structural component if needed, or can be removed if
// DynamicBookmarksFeed is called directly by BookmarksContent when data is ready.
// For now, let's just make it a pass-through to DynamicBookmarksFeed.
const SkeletonWrappedBookmarksFeed = (props: any) => {
  return <DynamicBookmarksFeed {...props} />;
};

interface BookmarksContentProps {
  userId: Id<"users"> | null; // userId is still passed as a prop from BookmarksContentWrapper
  initialData: { // initialData is for the non-search case, also from BookmarksContentWrapper
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null;
}

export const BookmarksContent = ({ userId, initialData }: BookmarksContentProps) => {
  const { isAuthenticated } = useSidebar();
  const { searchQuery } = useSearch(); // Get searchQuery from context
  
  console.log('[BookmarksContent RENDER] Context searchQuery:', searchQuery, 'Prop userId:', userId, 'isAuthenticated:', isAuthenticated);
  
  const [searchResults, setSearchResults] = useState<{
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null>(null);
  
  const [isFetchingSearch, setIsFetchingSearch] = useState(false); // Renamed for clarity

  // Handle search query changes from context
  useEffect(() => {
    console.log('[BookmarksContent useEffect] Context searchQuery changed, or prop userId changed. Current searchQuery:', searchQuery, 'Current userId:', userId);

    const fetchSearchResults = async () => {
      if (!searchQuery || !userId) {
        console.log('[BookmarksContent fetchSearchResults] Bailing: searchQuery is empty or userId missing. Query:', searchQuery, 'User ID:', userId);
        setSearchResults(null); 
        setIsFetchingSearch(false);
        return;
      }
      
      console.log('[BookmarksContent fetchSearchResults] Attempting to fetch. Query:', searchQuery, 'User ID:', userId);
      setIsFetchingSearch(true);
      try {
        const result = await fetch(`/api/bookmarks/search?userId=${userId}&query=${encodeURIComponent(searchQuery)}`);
        
        if (!result.ok) {
          console.error('[BookmarksContent fetchSearchResults] Search API error:', result.status, result.statusText);
          throw new Error(`Search API error: ${result.status}`);
        }
        
        const data = await result.json();
        console.log('[BookmarksContent fetchSearchResults] Data received:', data);
        setSearchResults(data);
      } catch (error) {
        console.error('[BookmarksContent fetchSearchResults] Error searching bookmarks:', error);
        setSearchResults(null);
      } finally {
        setIsFetchingSearch(false);
      }
    };
    
    if (searchQuery && searchQuery.trim().length > 0) {
      fetchSearchResults();
    } else {
      console.log('[BookmarksContent useEffect] No active searchQuery from context. Clearing searchResults.');
      setSearchResults(null);
      setIsFetchingSearch(false);
    }
  }, [searchQuery, userId]); // Dependencies: searchQuery from context, userId from props

  if (!isAuthenticated || !userId) {
    console.log('[BookmarksContent RENDER] Not authenticated or no userId. Showing login message.');
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

  // If there's an active search query (from context)
  if (searchQuery && searchQuery.trim().length > 0) {
    console.log('[BookmarksContent RENDER] Active searchQuery from context. Rendering search results section.');
    if (isFetchingSearch) {
      console.log('[BookmarksContent RENDER] isFetchingSearch is true. Showing SkeletonFeed for search.');
      return <SkeletonFeed count={5} />;
    }
    
    if (searchResults) {
      if (searchResults.bookmarks.length === 0) {
        console.log('[BookmarksContent RENDER] searchResults present but no bookmarks. Showing "No results found".');
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
      
      console.log('[BookmarksContent RENDER] Rendering SkeletonWrappedBookmarksFeed with search results.');
      return (
        <SkeletonWrappedBookmarksFeed 
          userId={userId} 
          initialData={searchResults} // Pass search results to the feed
          pageSize={30} 
          isSearchResults={true} // Indicate to BookmarksFeed these are search results
        />
      );
    }
    
    // searchQuery active, but no results yet and not fetching (could be an error state or initial state before fetch completes for search)
    console.log('[BookmarksContent RENDER] searchQuery active, but no searchResults and not isFetchingSearch. Returning null for now (or specific message).');
    return <div className="p-6 text-center text-gray-500">Searching for &quot;{searchQuery}&quot;...</div>; // Or specific loading/error message
  }

  // Default: no active search query, show all bookmarks from initialData
  console.log('[BookmarksContent RENDER] No active searchQuery. Rendering default BookmarksFeed with initialData.');
  if (!initialData || initialData.bookmarks.length === 0) {
     console.log('[BookmarksContent RENDER] No initialData or no bookmarks in initialData. Showing no bookmarks message.');
      return (
        <div className="flex-1 p-6 text-center">
            <div className="p-8 border border-gray-200 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">No Bookmarks Yet</h2>
              <p className="text-gray-500">
                You haven&apos;t bookmarked anything. Start exploring and save your favorites!
              </p>
            </div>
          </div>
      );
  }
  
  return (
    <SkeletonWrappedBookmarksFeed 
      userId={userId} 
      initialData={initialData} // Pass all bookmarks
      pageSize={30} 
      isSearchResults={false} // Indicate these are NOT search results
      />
  );
}; 