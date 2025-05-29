"use client";

import React, { useState, useEffect } from 'react';
import { PostTabsWrapper } from "@/components/postpage/PostTabsWrapper";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { usePostSearch } from "./PostSearchContext";
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

export function PostTabsWrapperWithSearch({
  postTitle,
  feedUrl,
  rssData,
  featuredImg,
  mediaType,
  verified
}: PostTabsWrapperWithSearchProps) {
  const { searchQuery } = usePostSearch();
  
  const [searchResults, setSearchResults] = useState<{
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null>(null);
  
  const [isFetchingSearch, setIsFetchingSearch] = useState(false);

  // Handle search query changes from context
  useEffect(() => {
    const fetchSearchResults = async () => {
      if (!searchQuery || !postTitle || !feedUrl) {
        setSearchResults(null); 
        setIsFetchingSearch(false);
        return;
      }
      
      setIsFetchingSearch(true);
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
        
        setSearchResults(transformedData);
      } catch (error) {
        console.error('Error searching entries:', error);
        setSearchResults(null);
      } finally {
        setIsFetchingSearch(false);
      }
    };
    
    if (searchQuery && searchQuery.trim().length > 0) {
      fetchSearchResults();
    } else {
      setSearchResults(null);
      setIsFetchingSearch(false);
    }
  }, [searchQuery, postTitle, feedUrl, mediaType]);

  // If there's an active search query
  if (searchQuery && searchQuery.trim().length > 0) {
    if (isFetchingSearch) {
      return <SkeletonFeed count={5} />;
    }
    
    if (searchResults) {
      if (searchResults.entries.length === 0) {
        return (
          <div className="text-center py-8 text-muted-foreground">
            <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-sm mt-2">Try a different search term or clear your search.</p>
          </div>
        );
      }
      
      return (
        <PostTabsWrapper
          key={`search-${searchQuery}`}
          postTitle={postTitle}
          feedUrl={feedUrl}
          rssData={searchResults}
          featuredImg={featuredImg}
          mediaType={mediaType}
          verified={verified}
        />
      );
    }
    
    // searchQuery active, but no results yet and not fetching
    return <div className="p-6 text-center text-gray-500">Searching for &quot;{searchQuery}&quot;...</div>;
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
} 