'use client';

import React, { useMemo } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { RSSEntriesClient } from "@/components/rss-feed/RSSEntriesDisplay.client";
import { FeaturedFeedWrapper } from "@/components/featured/FeaturedFeedWrapper";
import type { FeaturedEntry } from "@/lib/featured_redis";
import { UserMenuClientWithErrorBoundary } from '../user-menu/UserMenuClient';
import { Twitter } from "lucide-react";
import Link from 'next/link';
import { MobileSearch } from '@/components/mobile/MobileSearch';
import { useSidebar } from '@/components/ui/sidebar-context';
import { SignInButton } from "@/components/ui/SignInButton";


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
  verified?: boolean;
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
    verified?: boolean;
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

// Memoized component for the "Following" tab content - REMOVED as we pass component directly
/*
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
*/

// Memoized component for the "Discover" tab content - REMOVED as we pass component directly
/*
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
*/

export function FeedTabsContainer({ 
  initialData, 
  featuredData, 
  pageSize = 30
}: FeedTabsContainerProps) {
  // Get user data from context
  const { displayName, isBoarded, profileImage, isAuthenticated, pendingFriendRequestCount } = useSidebar();
  
  // Memoize the tabs configuration to prevent unnecessary re-creation
  const tabs = useMemo(() => [
    // Discover tab - first in order
    {
      id: 'discover',
      label: 'Discover',
      component: () => (
        <FeaturedFeedWrapper 
          initialData={featuredData as any /* Adjust typing */} 
        />
      )
    },
    // Following tab (renamed from Discover) - shows RSS feed content
    {
      id: 'following',
      label: 'Following',
      component: () => (
        <RSSEntriesClient 
          initialData={initialData as any /* Adjust typing */} 
          pageSize={pageSize} 
        />
      )
    }
  ], [initialData, featuredData, pageSize]);

  return (
    <div className="w-full flex flex-col">

<div className="grid grid-cols-3 items-center px-4 pt-2 pb-2 z-50 sm:block md:hidden">
<div>
        {isAuthenticated ? (
          <UserMenuClientWithErrorBoundary 
            initialDisplayName={displayName}
            isBoarded={isBoarded} 
            initialProfileImage={profileImage}
            pendingFriendRequestCount={pendingFriendRequestCount}
          />
        ) : (
          <SignInButton />
        )}
      </div>
                      <div className="flex justify-center font-medium">
                        <Twitter className="h-8 w-8 fill-[#1DA1F2] stroke-[#1DA1F2]" />
                      </div>
                      <div className="flex justify-end">
                        <MobileSearch />
                      </div>
</div>
     
      <SwipeableTabs tabs={tabs} /> {/* SwipeableTabs now uses the 'component' prop */}
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