"use client";

import React, { Suspense } from 'react';
import { PostTabsWrapper } from "@/components/postpage/PostTabsWrapper";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { RSSFeedClientWithErrorBoundary } from "@/components/postpage/RSSFeedClient";
import { useSearchResults } from "@/hooks/useSearchResults";
import { usePostTabsUI } from "@/hooks/usePostTabsUI";
import { useSearchFeedUI } from "@/hooks/useSearchFeedUI";
import { Search } from 'lucide-react';
import type { 
  PostTabsWrapperWithSearchProps, 
  SearchRSSFeedClientProps,
  DefaultPostTabsWrapperProps,
  SearchEmptyStateComponentProps,
  RSSFeedEntry
} from "@/lib/types";

// Enhanced Suspense fallback for search operations
const SearchSuspenseFallback = React.memo(function SearchSuspenseFallback() {
  return (
    <div className="w-full space-y-4">
      <SkeletonFeed count={5} />
      <div className="text-center text-sm text-muted-foreground">
        Searching content...
      </div>
    </div>
  );
});

// Memoized empty state component for better performance
const SearchEmptyState = React.memo(function SearchEmptyState({
  message,
  suggestion
}: SearchEmptyStateComponentProps) {
  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      {/* Icon cluster */}
      <div className="relative mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-muted to-muted/60 rounded-2xl flex items-center justify-center border border-border shadow-lg">
          <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
      </div>

      {/* Text content */}
      <div className="text-center space-y-1">
        <h3 className="text-foreground font-medium text-sm">No matches found</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Try different keywords or browse categories
        </p>
      </div>
    </div>
  );
});

// Memoized skeleton loading component
const SearchLoadingState = React.memo(function SearchLoadingState() {
  return <SkeletonFeed count={5} />;
});

// Search-aware RSS Feed Client wrapper with optimized memoization
const SearchRSSFeedClient = React.memo(function SearchRSSFeedClient({
  postTitle,
  feedUrl,
  searchQuery,
  featuredImg,
  mediaType,
  verified
}: SearchRSSFeedClientProps) {
  const { searchData, isLoading, loadMoreSearchResults } = useSearchResults({
    postTitle,
    feedUrl,
    searchQuery,
    mediaType
  });
  
  const { renderState, emptyStateProps } = useSearchFeedUI(searchData, searchQuery);
  
  // Handle different render states with memoized components
  if (renderState === 'loading') {
    return <SearchLoadingState />;
  }
  
  if (renderState === 'empty') {
    return (
      <SearchEmptyState
        message={emptyStateProps.message}
        suggestion={emptyStateProps.suggestion}
      />
    );
  }
  
  // Render search results (searchData is guaranteed to be non-null here)
  if (!searchData) return null; // Type guard
  
  // Transform PostSearchRSSData to match RSSFeedEntry format
  const transformedData: {
    entries: RSSFeedEntry[];
    totalEntries: number;
    hasMore: boolean;
  } = {
    entries: searchData.entries.map(entry => ({
      entry: entry.entry,
      initialData: entry.initialData,
      postMetadata: entry.postMetadata ? {
        title: entry.postMetadata.postTitle,
        featuredImg: entry.postMetadata.featuredImg,
        mediaType: entry.postMetadata.mediaType
      } : {
        title: postTitle,
        featuredImg: featuredImg,
        mediaType: mediaType
      }
    })),
    totalEntries: searchData.totalEntries,
    hasMore: searchData.hasMore
  };
  
  return (
    <div className="w-full">
      <Suspense fallback={<SearchSuspenseFallback />}>
        <RSSFeedClientWithErrorBoundary
          postTitle={postTitle}
          feedUrl={feedUrl}
          initialData={transformedData}
          featuredImg={featuredImg}
          mediaType={mediaType}
          verified={verified}
          customLoadMore={loadMoreSearchResults}
          isSearchMode={true}
          externalIsLoading={isLoading}
        />
      </Suspense>
    </div>
  );
});

// Memoized default PostTabsWrapper for better performance
const DefaultPostTabsWrapper = React.memo(function DefaultPostTabsWrapper({
  postTitle,
  feedUrl,
  rssData,
  featuredImg,
  mediaType,
  verified
}: DefaultPostTabsWrapperProps) {
  return (
    <PostTabsWrapper
      key="default"
      postTitle={postTitle}
      feedUrl={feedUrl}
      rssData={rssData}
      featuredImg={featuredImg}
      mediaType={mediaType}
      verified={verified}
    />
  );
});

// Main component with optimized memoization and prop handling
export const PostTabsWrapperWithSearch = React.memo(function PostTabsWrapperWithSearch(
  props: PostTabsWrapperWithSearchProps
) {
  const { shouldShowSearchResults, searchProps, defaultProps } = usePostTabsUI(props);

  // If there's an active search query, use the search-aware client
  if (shouldShowSearchResults) {
    return (
      <SearchRSSFeedClient
        postTitle={searchProps.postTitle}
        feedUrl={searchProps.feedUrl}
        searchQuery={searchProps.searchQuery}
        featuredImg={searchProps.featuredImg}
        mediaType={searchProps.mediaType}
        verified={searchProps.verified}
      />
    );
  }

  // Default: no active search query, show all entries from rssData
  return (
    <DefaultPostTabsWrapper
      postTitle={defaultProps.postTitle}
      feedUrl={defaultProps.feedUrl}
      rssData={defaultProps.rssData}
      featuredImg={defaultProps.featuredImg}
      mediaType={defaultProps.mediaType}
      verified={defaultProps.verified}
    />
  );
}); 