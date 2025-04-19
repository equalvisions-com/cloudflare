'use client';

import React from 'react';
import { RSSFeedClient } from "@/components/postpage/RSSFeedClient";
import type { RSSItem } from "@/lib/rss";

// Define RSSEntryWithData interface (consider moving to a shared types file)
interface RSSEntryWithData {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
}

// Define props for the tabs wrapper
interface PostTabsWrapperProps {
  postTitle: string;
  feedUrl: string;
  rssData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null;
  featuredImg?: string;
  mediaType?: string;
  searchQuery?: string;
  verified?: boolean;
}

// Define props for FeedTabContent (removed isActive)
interface FeedTabContentProps {
  postTitle: string;
  feedUrl: string;
  rssData: PostTabsWrapperProps['rssData'];
  featuredImg?: string;
  mediaType?: string;
  searchQuery?: string;
  verified?: boolean;
}

// Separated out as a standalone component
const FeedTabContent = React.memo(({ 
  postTitle,
  feedUrl,
  rssData,
  featuredImg,
  mediaType,
  searchQuery,
  verified
}: FeedTabContentProps) => {
  if (!rssData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
    
      </div>
    );
  }

  // Show no results message when searching
  if (searchQuery && rssData.entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No results found for &ldquo;{searchQuery}&rdquo;</p>
        <p className="text-sm mt-2">Try a different search term or clear your search.</p>
      </div>
    );
  }

  return (
    <RSSFeedClient
      key={`feed-client-${searchQuery || 'all'}`}
      postTitle={postTitle}
      feedUrl={feedUrl}
      initialData={rssData}
      featuredImg={featuredImg}
      mediaType={mediaType}
      verified={verified}
    />
  );
});
FeedTabContent.displayName = 'FeedTabContent';

export function PostTabsWrapper({ 
  postTitle, 
  feedUrl, 
  rssData, 
  featuredImg, 
  mediaType,
  searchQuery,
  verified
}: PostTabsWrapperProps) {
  const contentKey = `feed-content-${searchQuery || 'all'}`;
  
  return (
    <div className="w-full">
      <FeedTabContent 
        key={contentKey}
        postTitle={postTitle} 
        feedUrl={feedUrl} 
        rssData={rssData}
        featuredImg={featuredImg}
        mediaType={mediaType}
        searchQuery={searchQuery}
        verified={verified}
      />
    </div>
  );
} 