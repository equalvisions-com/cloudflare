'use client';

import React from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { RSSEntriesClient } from "@/components/rss-feed/RSSEntriesDisplay.client";
import { FeaturedFeedWrapper } from "@/components/featured/FeaturedFeedWrapper";
import type { FeaturedEntry } from "@/lib/featured_redis";

// Define the RSSItem interface based on the database schema
interface RSSItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  feedUrl: string;
  feedTitle?: string;
  [key: string]: unknown;
}

// Interface for post metadata
interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
}

// Define the interfaces that match the expected types in the child components
interface FeaturedEntryWithData {
  entry: FeaturedEntry;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
  postMetadata: PostMetadata;
}

interface RSSEntryWithData {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    categorySlug?: string;
    postSlug?: string;
  };
}

// Define types for our props
interface FeedTabsContainerProps {
  initialData: {
    entries: unknown[]; // Using unknown for type safety
    totalEntries: number;
    hasMore: boolean;
    postTitles?: string[];
  } | null;
  featuredData?: {
    entries: unknown[]; // Using unknown for type safety
    totalEntries: number;
  } | null;
  pageSize?: number;
}

export function FeedTabsContainer({ initialData, featuredData, pageSize = 30 }: FeedTabsContainerProps) {
  // Define the tabs configuration
  const tabs = [
    // Featured tab - first in order
    {
      id: 'featured',
      label: 'Featured',
      content: (
        <FeaturedFeedWrapper 
          initialData={featuredData as { 
            entries: FeaturedEntryWithData[]; 
            totalEntries: number; 
          } | null} 
        />
      ),
    },
    // Following tab (renamed from Discover) - shows RSS feed content
    {
      id: 'following',
      label: 'Following',
      content: (
        !initialData ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No entries found. Please sign in and add some RSS feeds to get started.</p>
            <p className="text-sm mt-2">If you&apos;ve already added feeds, try refreshing the page.</p>
          </div>
        ) : (
          <RSSEntriesClient
            initialData={initialData as { 
              entries: RSSEntryWithData[]; 
              totalEntries: number; 
              hasMore: boolean; 
              postTitles?: string[]; 
            }}
            pageSize={pageSize}
          />
        )
      ),
    }
  ];

  return (
    <div className="w-full">
      <SwipeableTabs tabs={tabs} />
    </div>
  );
}

export function FeedTabsContainerWithErrorBoundary(props: FeedTabsContainerProps) {
  return (
    <React.Fragment>
      <FeedTabsContainer {...props} />
    </React.Fragment>
  );
} 