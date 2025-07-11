"use client";

import React, { Suspense } from 'react';
import { PostTabsWrapper } from "@/components/postpage/PostTabsWrapper";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { RSSFeedClientWithErrorBoundary } from "@/components/postpage/RSSFeedClient";
import { useSearchResults } from "@/hooks/useSearchResults";
import { useNewsletterPostTabsUI } from "@/hooks/useNewsletterPostTabsUI";
import { useSearchFeedUI } from "@/hooks/useSearchFeedUI";
import type { 
  NewsletterPostTabsWrapperWithSearchProps,
  NewsletterSearchRSSFeedClientProps,
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
    <div className="text-center py-8 text-muted-foreground">
      <p>{message}</p>
      <p className="text-sm mt-2">{suggestion}</p>
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
}: NewsletterSearchRSSFeedClientProps) {
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
  props: NewsletterPostTabsWrapperWithSearchProps
) {
  const { shouldShowSearchResults, searchProps, defaultProps } = useNewsletterPostTabsUI(props);

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