"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { UserActivityFeed } from "@/components/profile/UserActivityFeed";
import { UserLikesFeed } from "@/components/profile/UserLikesFeed";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";

// Types for activity items
type ActivityItem = {
  type: "like" | "comment" | "retweet";
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
  pageSize 
}: { 
  userId: Id<"users">, 
  username: string,
  name: string,
  profileImage?: string | null,
  activityData: FeedData | null, 
  pageSize: number 
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
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!likesData || likesData.activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
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
  activityData, 
  likesData: initialLikesData, 
  pageSize = 30 
}: UserProfileTabsProps) {
  // Simplified state management
  const [likesState, setLikesState] = useState<{
    data: FeedData | null;
    status: 'idle' | 'loading' | 'loaded' | 'error';
    error: Error | null;
  }>({
    data: initialLikesData || null,
    status: initialLikesData ? 'loaded' : 'idle',
    error: null
  });
  
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  
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
      content: <ActivityTabContent 
                userId={userId} 
                username={username} 
                name={name}
                profileImage={profileImage}
                activityData={activityData} 
                pageSize={pageSize} 
              />
    },
    // Likes tab
    {
      id: 'likes',
      label: 'Likes',
      content: <LikesTabContent 
                userId={userId}
                likesData={likesState.data} 
                pageSize={pageSize}
                isLoading={likesState.status === 'loading'}
              />
    }
  ], [
    userId, 
    username, 
    name, 
    profileImage, 
    activityData, 
    likesState.data, 
    likesState.status, 
    pageSize
  ]);

  return (
    <div className="w-full border-t z-50">
      <SwipeableTabs 
        tabs={tabs} 
        onTabChange={handleTabChange}
      />
    </div>
  );
}

// Use React.memo for the entire component
export const UserProfileTabsWithErrorBoundary = React.memo(UserProfileTabs);
UserProfileTabsWithErrorBoundary.displayName = 'UserProfileTabsWithErrorBoundary'; 