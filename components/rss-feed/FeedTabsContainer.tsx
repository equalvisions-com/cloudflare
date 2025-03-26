'use client';

import React, { useMemo } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { RSSEntriesClient } from "@/components/rss-feed/RSSEntriesDisplay.client";
import { FeaturedFeedWrapper } from "@/components/featured/FeaturedFeedWrapper";
import { FriendsFeedClientWithErrorBoundary } from "@/components/friends-feed/FriendsFeedClient";
import type { FriendActivityGroup } from "@/components/friends-feed/FriendsFeedClient";
import type { FeaturedEntry } from "@/lib/featured_redis";

// Define the RSSItem interface based on the database schema
export interface RSSItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  description?: string;
  image?: string;
  mediaType?: string;
  feedUrl: string;
  feedTitle?: string;
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
  friendsData?: {
    activityGroups: FriendActivityGroup[];
    hasMore: boolean;
  } | null;
  pageSize?: number;
}

// Memoized component for the "Following" tab content
const FollowingTabContent = React.memo(({ 
  initialData, 
  pageSize 
}: { 
  initialData: FeedTabsContainerProps['initialData'], 
  pageSize: number 
}) => {
  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No entries found. Please sign in and add some RSS feeds to get started.</p>
        <p className="text-sm mt-2">If you&apos;ve already added feeds, try refreshing the page.</p>
      </div>
    );
  }

  return (
    <RSSEntriesClient
      initialData={initialData as { 
        entries: RSSEntryWithData[]; 
        totalEntries: number; 
        hasMore: boolean; 
        postTitles?: string[]; 
      }}
      pageSize={pageSize}
    />
  );
});
FollowingTabContent.displayName = 'FollowingTabContent';

// Memoized component for the "Discover" tab content
const DiscoverTabContent = React.memo(({ 
  featuredData 
}: { 
  featuredData: FeedTabsContainerProps['featuredData'] 
}) => {
  return (
    <FeaturedFeedWrapper 
      initialData={featuredData as { 
        entries: FeaturedEntryWithData[]; 
        totalEntries: number; 
      } | null} 
    />
  );
});
DiscoverTabContent.displayName = 'DiscoverTabContent';

// Memoized component for the "Friends" tab content
const FriendsTabContent = React.memo(({ 
  friendsData,
  pageSize
}: { 
  friendsData: FeedTabsContainerProps['friendsData'],
  pageSize: number 
}) => {
  console.log("Rendering FriendsTabContent with data:", friendsData);
  
  return (
    <FriendsFeedClientWithErrorBoundary 
      initialData={friendsData || null}
      pageSize={pageSize}
    />
  );
});
FriendsTabContent.displayName = 'FriendsTabContent';

export function FeedTabsContainer({ initialData, featuredData, friendsData, pageSize = 30 }: FeedTabsContainerProps) {
  // Memoize the tabs configuration to prevent unnecessary re-creation
  const tabs = useMemo(() => [
    // Discover tab - first in order
    {
      id: 'discover',
      label: 'Discover',
      content: <DiscoverTabContent featuredData={featuredData} />
    },
    // Following tab - shows RSS feed content
    {
      id: 'following',
      label: 'Following',
      content: <FollowingTabContent initialData={initialData} pageSize={pageSize} />
    },
    // Friends tab - shows friend activity
    {
      id: 'friends',
      label: 'Friends',
      content: <FriendsTabContent friendsData={friendsData} pageSize={pageSize} />
    }
  ], [initialData, featuredData, friendsData, pageSize]);

  return (
    <div className="w-full">
      <SwipeableTabs tabs={tabs} />
    </div>
  );
}

// Use React.memo for the error boundary wrapper to prevent unnecessary re-renders
export const FeedTabsContainerWithErrorBoundary = React.memo(
  (props: FeedTabsContainerProps) => {
    return (
      <React.Fragment>
        <FeedTabsContainer {...props} />
      </React.Fragment>
    );
  }
);
FeedTabsContainerWithErrorBoundary.displayName = 'FeedTabsContainerWithErrorBoundary'; 