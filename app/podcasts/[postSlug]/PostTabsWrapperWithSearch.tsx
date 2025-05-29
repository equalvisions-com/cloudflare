"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PostTabsWrapper } from "@/components/postpage/PostTabsWrapper";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { usePostSearch } from "./PostSearchContext";
import { RSSFeedClientWithErrorBoundary } from "@/components/postpage/RSSFeedClient";
import type { RSSItem } from "@/lib/rss";

// Define RSSEntryWithData interface
interface RSSEntryWithData {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
}

interface PostTabsWrapperWithSearchProps {
  postTitle: string;
  feedUrl: string;
  rssData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null;
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}

// Search-aware RSS Feed Client wrapper
const SearchRSSFeedClient = React.memo(function SearchRSSFeedClient({
  postTitle,
  feedUrl,
  searchQuery,
  featuredImg,
  mediaType,
  verified
}: {
  postTitle: string;
  feedUrl: string;
  searchQuery: string;
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}) {
  const [searchData, setSearchData] = useState<{
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const isLoadingRef = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);
  
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);
  
  // Reset and fetch initial search results when search query changes
  useEffect(() => {
    const fetchInitialSearchResults = async () => {
      if (!searchQuery || !postTitle || !feedUrl) {
        setSearchData(null);
        return;
      }
      
      setIsLoading(true);
      setCurrentPage(1);
      
      try {
        const apiUrl = `/api/rss/${encodeURIComponent(postTitle)}?feedUrl=${encodeURIComponent(feedUrl)}&q=${encodeURIComponent(searchQuery)}&page=1&pageSize=30${mediaType ? `&mediaType=${encodeURIComponent(mediaType)}` : ''}`;
        
        const result = await fetch(apiUrl);
        
        if (!result.ok) {
          throw new Error(`Search API error: ${result.status}`);
        }
        
        const data = await result.json();
        
        // Transform the API response to match our expected format
        const transformedData = {
          entries: data.entries || [],
          totalEntries: data.totalEntries || 0,
          hasMore: data.hasMore || false
        };
        
        setSearchData(transformedData);
      } catch (error) {
        console.error('Error searching entries:', error);
        setSearchData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialSearchResults();
  }, [searchQuery, postTitle, feedUrl, mediaType]);
  
  // Create a custom load more function for search pagination
  const loadMoreSearchResults = useCallback(async () => {
    const currentPageValue = currentPageRef.current;
    const isLoadingValue = isLoadingRef.current;
    
    if (isLoadingValue || !searchData?.hasMore) {
      return;
    }
    
    setIsLoading(true);
    const nextPage = currentPageValue + 1;
    
    try {
      const apiUrl = `/api/rss/${encodeURIComponent(postTitle)}?feedUrl=${encodeURIComponent(feedUrl)}&q=${encodeURIComponent(searchQuery)}&page=${nextPage}&pageSize=30${mediaType ? `&mediaType=${encodeURIComponent(mediaType)}` : ''}&totalEntries=${searchData.totalEntries}`;
      
      const result = await fetch(apiUrl);
      
      if (!result.ok) {
        throw new Error(`Search pagination API error: ${result.status}`);
      }
      
      const data = await result.json();
      
      if (data.entries?.length) {
        setSearchData(prev => prev ? {
          entries: [...prev.entries, ...data.entries],
          totalEntries: data.totalEntries || prev.totalEntries,
          hasMore: data.hasMore || false
        } : null);
        
        setCurrentPage(nextPage);
      }
    } catch (error) {
      console.error('Error loading more search results:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, postTitle, feedUrl, mediaType, searchData]);
  
  if (!searchData) {
    return <SkeletonFeed count={5} />;
  }
  
  if (searchData.entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
        <p className="text-sm mt-2">Try a different search term or clear your search.</p>
      </div>
    );
  }
  
  // Create a modified RSSFeedClient that uses our custom load more function
  return (
    <div className="w-full">
      <RSSFeedClientWithErrorBoundary
        postTitle={postTitle}
        feedUrl={feedUrl}
        initialData={searchData}
        featuredImg={featuredImg}
        mediaType={mediaType}
        verified={verified}
        // We'll need to modify RSSFeedClient to accept a custom loadMore function
        customLoadMore={loadMoreSearchResults}
        isSearchMode={true}
      />
    </div>
  );
});

export const PostTabsWrapperWithSearch = React.memo(function PostTabsWrapperWithSearch({
  postTitle,
  feedUrl,
  rssData,
  featuredImg,
  mediaType,
  verified
}: PostTabsWrapperWithSearchProps) {
  const { searchQuery } = usePostSearch();

  // If there's an active search query, use the search-aware client
  if (searchQuery && searchQuery.trim().length > 0) {
    return (
      <SearchRSSFeedClient
        postTitle={postTitle}
        feedUrl={feedUrl}
        searchQuery={searchQuery}
        featuredImg={featuredImg}
        mediaType={mediaType}
        verified={verified}
      />
    );
  }

  // Default: no active search query, show all entries from rssData
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