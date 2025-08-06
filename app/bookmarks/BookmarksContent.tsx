"use client";

import { Id } from "@/convex/_generated/dataModel";
import { memo, useMemo } from "react";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { useBookmarksContext } from "./BookmarksContext";
import { BookmarksData } from "@/lib/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BookmarksFeed } from "@/components/bookmarks/BookmarksFeed";
import { Search } from "lucide-react";

// Memoized empty state component for better performance
const EmptySearchState = memo(({ searchQuery }: { searchQuery: string }) => (
  <div className="flex flex-col items-center justify-center py-6 px-4">
    {/* Icon cluster */}
    <div className="relative mb-4">
      <div className="w-12 h-12 bg-gradient-to-br from-muted to-muted/60 rounded-2xl flex items-center justify-center border border-border shadow-lg">
        <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
    </div>

    {/* Text content */}
    <div className="text-center space-y-1">
      <h3 className="text-foreground font-medium text-sm">No results found</h3>
      <p className="text-muted-foreground text-xs leading-relaxed">
        No bookmarks match your search
      </p>
    </div>
  </div>
));
EmptySearchState.displayName = 'EmptySearchState';

// Enhanced error fallback with retry capability
const BookmarksFeedError = memo(({ onRetry }: { onRetry?: () => void }) => (
  <div className="flex-1 p-6 text-center">
    <div className="p-8 border border-red-200 rounded-lg bg-red-50">
      <h2 className="text-xl font-semibold mb-2 text-red-800">Failed to load bookmarks</h2>
      <p className="text-red-600 mb-4">
        Please refresh the page to try again.
      </p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  </div>
));
BookmarksFeedError.displayName = 'BookmarksFeedError';

interface BookmarksContentProps {
  userId: Id<"users"> | null;
  initialData: BookmarksData | null;
}

const BookmarksContentComponent = ({ userId, initialData }: BookmarksContentProps) => {
  const { searchQuery, searchResults, isSearching } = useBookmarksContext();
  
  // Optimized search state computation with better performance
  const searchState = useMemo(() => {
    const trimmedQuery = searchQuery?.trim();
    const hasSearchQuery = Boolean(trimmedQuery?.length);
    const hasResults = Boolean(searchResults?.bookmarks.length);
    
    return {
      hasSearchQuery,
      hasSearchResults: hasResults,
      hasEmptySearchResults: hasSearchQuery && !hasResults,
      shouldShowLoading: hasSearchQuery && (isSearching || !searchResults),
      shouldShowEmptyState: hasSearchQuery && !hasResults && !isSearching,
      shouldShowSearchResults: hasSearchQuery && hasResults,
      shouldShowInitialBookmarks: !hasSearchQuery // Show initial bookmarks when no search query
    };
  }, [searchQuery, searchResults?.bookmarks.length, isSearching]);
  
  // Note: Authentication is guaranteed by middleware protection
  if (!userId) {
    // Edge-compatible error handling
    if (typeof window !== 'undefined') {
      console.warn('Unexpected: userId is null on protected route');
    }
    return <SkeletonFeed count={5} />;
  }

  // Handle search states with memoized components
  if (searchState.shouldShowLoading) {
    return <SkeletonFeed count={5} />;
  }
  
  if (searchState.shouldShowEmptyState) {
    return <EmptySearchState searchQuery={searchQuery} />;
  }
  
  if (searchState.shouldShowSearchResults) {
    return (
      <ErrorBoundary fallback={({ retry }) => <BookmarksFeedError onRetry={retry} />}>
        <BookmarksFeed 
          key="search-results"
          userId={userId} 
          initialData={searchResults!}
          pageSize={30} 
          isSearchResults={true}
        />
      </ErrorBoundary>
    );
  }
    
  // Regular bookmarks view
  if (!initialData) {
    return <SkeletonFeed count={5} />;
  }
  
  return (
    <ErrorBoundary fallback={({ retry }) => <BookmarksFeedError onRetry={retry} />}>
      <BookmarksFeed 
        key="initial-bookmarks"
        userId={userId} 
        initialData={initialData}
        pageSize={30} 
        isSearchResults={false}
      />
    </ErrorBoundary>
  );
}; 

export const BookmarksContent = memo(BookmarksContentComponent);
BookmarksContent.displayName = 'BookmarksContent'; 