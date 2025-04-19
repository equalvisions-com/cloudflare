'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import dynamic from 'next/dynamic';
import { FeaturedFeedWrapper } from "@/components/featured/FeaturedFeedWrapper";
import type { FeaturedEntry } from "@/lib/featured_redis";
import { UserMenuClientWithErrorBoundary } from '../user-menu/UserMenuClient';
import Link from 'next/link';
import { MobileSearch } from '@/components/mobile/MobileSearch';
import { useSidebar } from '@/components/ui/sidebar-context';
import { SignInButton } from "@/components/ui/SignInButton";
import { Loader2 } from 'lucide-react';
import { SkeletonFeed } from '@/components/ui/skeleton-feed';

// Lazy load RSSEntriesClient component
const RSSEntriesClientWithErrorBoundary = dynamic(
  () => import("@/components/rss-feed/RSSEntriesDisplay.client").then(mod => mod.RSSEntriesClientWithErrorBoundary),
  { 
    ssr: false,
    // Remove the loading component as we'll use our custom skeleton
    loading: () => null
  }
);

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
  
  // State to track the loaded RSS data
  const [rssData, setRssData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  
  // Function to fetch RSS data
  const fetchRSSData = useCallback(async () => {
    // Skip if data is already loaded or loading is in progress
    if (rssData !== null || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/rss-feed');
      if (!response.ok) {
        throw new Error('Failed to fetch RSS feed data');
      }
      
      const data = await response.json();
      setRssData(data);
    } catch (err) {
      console.error('Error fetching RSS data:', err);
      setError('Failed to load RSS feed data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [rssData, isLoading]);
  
  // Handle tab change
  const handleTabChange = useCallback((index: number) => {
    setActiveTabIndex(index);
    
    // If switching to the "Following" tab (index 1), fetch RSS data
    if (index === 1) {
      fetchRSSData();
    }
  }, [fetchRSSData]);
  
  // If we're on the Following tab and don't have data yet, trigger fetch
  useEffect(() => {
    if (activeTabIndex === 1 && rssData === null && !isLoading && !error) {
      fetchRSSData();
    }
  }, [activeTabIndex, rssData, isLoading, error, fetchRSSData]);
  
  // Memoize the tabs configuration
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
    // Following tab - shows RSS feed content
    {
      id: 'following',
      label: 'Following',
      component: () => {
        if (error) {
          return (
            <div className="p-8 text-center text-destructive">
              <p>{error}</p>
              <button 
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
                onClick={() => fetchRSSData()}
              >
                Try Again
              </button>
            </div>
          );
        }
        
        if (isLoading) {
          return <SkeletonFeed count={5} />;
        }
        
        return (
          <RSSEntriesClientWithErrorBoundary 
            initialData={rssData as any /* Adjust typing */} 
            pageSize={pageSize} 
          />
        );
      }
    }
  ], [rssData, featuredData, pageSize, error, isLoading, fetchRSSData]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 items-center px-4 pt-2 pb-2 z-50 sm:block md:hidden">
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
        <div className="flex justify-end">
          <MobileSearch />
        </div>
      </div>
     
      <SwipeableTabs 
        tabs={tabs} 
        onTabChange={handleTabChange}
        defaultTabIndex={activeTabIndex} 
      />
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