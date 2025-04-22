"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import dynamic from 'next/dynamic';
import { Id } from "@/convex/_generated/dataModel";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";

// Add global cache object to persist data across navigations
const GLOBAL_CACHE: {
  activityData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
  } | null;
  likesData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
  } | null;
  selectedTabIndex: number;
  userIdCache: Id<"users"> | null;
} = {
  activityData: null,
  likesData: null,
  selectedTabIndex: 0,
  userIdCache: null
};

// Dynamically import UserActivityFeed with loading state
const UserActivityFeed = dynamic(
  () => import('@/components/profile/UserActivityFeed').then(mod => ({ default: mod.UserActivityFeed })),
  {
    loading: () => <SkeletonFeed count={5} />,
    ssr: false
  }
);

// Dynamically import UserLikesFeed with loading state
const UserLikesFeed = dynamic(
  () => import('@/components/profile/UserLikesFeed').then(mod => ({ default: mod.UserLikesFeed })),
  {
    loading: () => <SkeletonFeed count={5} />,
    ssr: false
  }
);

// Types for activity items
type ActivityItem = {
  type: "comment" | "retweet";
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  _id: string;
};

// Type for RSS entry from PlanetScale
type RSSEntry = {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_title?: string;
  feed_url?: string;
  mediaType?: string;
  // Additional fields from Convex posts
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean;
};

// Define types for our props
interface UserProfileTabsProps {
  userId: Id<"users">;
  username: string;
  name: string;
  profileImage?: string | null;
  activityData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
  } | null;
  likesData?: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
  } | null;
  pageSize?: number;
}

// Data interface for better reuse
interface FeedData {
  activities: ActivityItem[];
  totalCount: number;
  hasMore: boolean;
  entryDetails: Record<string, RSSEntry>;
}

// Memoized component for the "Activity" tab content
const ActivityTabContent = React.memo(({ 
  userId, 
  username,
  name,
  profileImage,
  activityData, 
  pageSize,
}: { 
  userId: Id<"users">, 
  username: string,
  name: string,
  profileImage?: string | null,
  activityData: FeedData | null, 
  pageSize: number,
}) => {
  if (!activityData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No activity found for this user.</p>
      </div>
    );
  }

  return (
    <UserActivityFeed
      userId={userId}
      username={username}
      name={name}
      profileImage={profileImage}
      initialData={activityData}
      pageSize={pageSize}
      apiEndpoint="/api/activity"
    />
  );
});
ActivityTabContent.displayName = 'ActivityTabContent';

// Memoized component for the "Likes" tab content
const LikesTabContent = React.memo(({ 
  userId, 
  likesData, 
  pageSize,
  isLoading
}: { 
  userId: Id<"users">, 
  likesData: FeedData | null, 
  pageSize: number,
  isLoading: boolean
}) => {
  if (isLoading) {
    return (
      <div className="">
        <SkeletonFeed count={5} />
      </div>
    );
  }

  if (!likesData || likesData.activities.length === 0) {
    return (
      <div className="h-screen text-center py-8 text-muted-foreground">
        <p>No likes found for this user.</p>
      </div>
    );
  }

  return (
    <UserLikesFeed
      userId={userId}
      initialData={likesData}
      pageSize={pageSize}
    />
  );
});
LikesTabContent.displayName = 'LikesTabContent';

export function UserProfileTabs({ 
  userId, 
  username,
  name,
  profileImage,
  activityData: initialActivityData, 
  likesData: initialLikesData, 
  pageSize = 30 
}: UserProfileTabsProps) {
  // Check if user ID has changed to invalidate cache
  const userChanged = userId !== GLOBAL_CACHE.userIdCache;
  if (userChanged) {
    // Reset cache when viewing a different user's profile
    GLOBAL_CACHE.activityData = null;
    GLOBAL_CACHE.likesData = null;
    GLOBAL_CACHE.selectedTabIndex = 0;
    GLOBAL_CACHE.userIdCache = userId;
  }

  // Update activity data cache if we have new initial data
  if (initialActivityData && (!GLOBAL_CACHE.activityData || userChanged)) {
    GLOBAL_CACHE.activityData = initialActivityData;
  }

  // Update likes data cache if we have new initial data
  if (initialLikesData && (!GLOBAL_CACHE.likesData || userChanged)) {
    GLOBAL_CACHE.likesData = initialLikesData;
  }

  // Use cached data or fall back to initial props
  const [likesState, setLikesState] = useState<{
    data: FeedData | null;
    status: 'idle' | 'loading' | 'loaded' | 'error';
    error: Error | null;
  }>({
    data: GLOBAL_CACHE.likesData || initialLikesData || null,
    status: (GLOBAL_CACHE.likesData || initialLikesData) ? 'loaded' : 'idle',
    error: null
  });
  
  // Use cached selected tab index
  const [selectedTabIndex, setSelectedTabIndex] = useState(userChanged ? 0 : GLOBAL_CACHE.selectedTabIndex);
  
  // Function to fetch likes data - stabilized with useCallback + fewer dependencies
  const fetchLikesData = useCallback(async () => {
    // Only fetch if in idle state
    if (likesState.status !== 'idle') return;
    
    setLikesState(prev => ({ ...prev, status: 'loading' }));
    
    try {
      // Fetch likes data from API
      const response = await fetch(`/api/likes?userId=${userId}&skip=0&limit=${pageSize}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch likes: ${response.status}`);
      }
      
      const data = await response.json();
      setLikesState({ data, status: 'loaded', error: null });
      
      // Update the global cache
      GLOBAL_CACHE.likesData = data;
    } catch (error) {
      console.error('Error fetching likes data:', error);
      setLikesState({
        data: null,
        status: 'error',
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      });
    }
  }, [userId, pageSize, likesState.status]); // Added likesState.status to the dependencies

  // Handle tab change
  const handleTabChange = useCallback((index: number) => {
    setSelectedTabIndex(index);
    // Update the global cache
    GLOBAL_CACHE.selectedTabIndex = index;
    
    // If switching to likes tab (index 1) and likes haven't been loaded
    if (index === 1 && likesState.status === 'idle') {
      fetchLikesData();
    }
  }, [fetchLikesData, likesState.status]);

  // Memoize the tabs configuration to prevent unnecessary re-creation
  const tabs = useMemo(() => [
    // Activity tab
    {
      id: 'activity',
      label: 'Activity',
      component: () => (
        <ActivityTabContent 
          userId={userId} 
          username={username} 
          name={name}
          profileImage={profileImage}
          activityData={GLOBAL_CACHE.activityData || initialActivityData} 
          pageSize={pageSize}
        />
      )
    },
    // Likes tab
    {
      id: 'likes',
      label: 'Likes',
      component: () => (
        <LikesTabContent 
          userId={userId}
          likesData={likesState.data} 
          pageSize={pageSize}
          isLoading={likesState.status === 'loading'}
        />
      )
    }
  ], [
    userId, 
    username, 
    name, 
    profileImage, 
    initialActivityData, 
    likesState.data, 
    likesState.status, 
    pageSize
  ]);

  return (
    <div className="w-full border-t z-50">
      <SwipeableTabs 
        tabs={tabs} 
        onTabChange={handleTabChange}
        defaultTabIndex={selectedTabIndex}
      />
    </div>
  );
}

// Use React.memo for the entire component
export const UserProfileTabsWithErrorBoundary = React.memo(UserProfileTabs);
UserProfileTabsWithErrorBoundary.displayName = 'UserProfileTabsWithErrorBoundary'; 