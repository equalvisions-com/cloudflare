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

// Memoized component for the "Activity" tab content
const ActivityTabContent = React.memo(({ 
  userId, 
  username, 
  activityData, 
  pageSize 
}: { 
  userId: Id<"users">, 
  username: string, 
  activityData: UserProfileTabsProps['activityData'], 
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
  username, 
  likesData, 
  pageSize,
  isLoading
}: { 
  userId: Id<"users">, 
  username: string, 
  likesData: UserProfileTabsProps['likesData'], 
  pageSize: number,
  isLoading: boolean
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading likes...</span>
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
      username={username}
      initialData={likesData}
      pageSize={pageSize}
    />
  );
});
LikesTabContent.displayName = 'LikesTabContent';

export function UserProfileTabs({ 
  userId, 
  username, 
  activityData, 
  likesData: initialLikesData, 
  pageSize = 30 
}: UserProfileTabsProps) {
  // State for lazy loading likes data
  const [likesData, setLikesData] = useState<UserProfileTabsProps['likesData']>(initialLikesData);
  const [isLoadingLikes, setIsLoadingLikes] = useState<boolean>(false);
  const [hasAttemptedLoadingLikes, setHasAttemptedLoadingLikes] = useState<boolean>(!!initialLikesData);
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  
  // Ref to track if a fetch is in progress to prevent duplicate requests
  const isFetchingRef = useRef<boolean>(false);

  // Function to fetch likes data
  const fetchLikesData = useCallback(async () => {
    // Check if we should fetch data and ensure we're not already fetching
    if (likesData || isLoadingLikes || hasAttemptedLoadingLikes || isFetchingRef.current) return;
    
    // Set both state and ref to indicate fetching is in progress
    setIsLoadingLikes(true);
    isFetchingRef.current = true;
    
    console.log(`[Client] Fetching likes data for user: ${userId}`);
    const startTime = Date.now();
    
    try {
      // Fetch likes data from API
      const response = await fetch(`/api/likes?userId=${userId}&skip=0&limit=${pageSize}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch likes: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[Client] Fetched ${data.activities?.length || 0} likes in ${Date.now() - startTime}ms`);
      setLikesData(data);
    } catch (error) {
      console.error('Error fetching likes data:', error);
    } finally {
      setIsLoadingLikes(false);
      setHasAttemptedLoadingLikes(true);
      isFetchingRef.current = false;
    }
  }, [userId, pageSize, likesData, isLoadingLikes, hasAttemptedLoadingLikes]);

  // Handle tab change
  const handleTabChange = useCallback((index: number) => {
    // Only update if the tab is actually changing
    if (index === selectedTabIndex) return;
    
    setSelectedTabIndex(index);
    
    // If switching to likes tab (index 1) and likes data hasn't been loaded yet
    if (index === 1 && !likesData && !isLoadingLikes && !hasAttemptedLoadingLikes && !isFetchingRef.current) {
      fetchLikesData();
    }
  }, [fetchLikesData, likesData, isLoadingLikes, hasAttemptedLoadingLikes, selectedTabIndex]);

  // If initial likes data was provided, use it
  useEffect(() => {
    if (initialLikesData) {
      setLikesData(initialLikesData);
      setHasAttemptedLoadingLikes(true);
    }
  }, [initialLikesData]);

  // Memoize the tabs configuration to prevent unnecessary re-creation
  const tabs = useMemo(() => [
    // Activity tab
    {
      id: 'activity',
      label: 'Activity',
      content: <ActivityTabContent 
                userId={userId} 
                username={username} 
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
                username={username} 
                likesData={likesData} 
                pageSize={pageSize}
                isLoading={isLoadingLikes}
              />
    }
  ], [userId, username, activityData, likesData, pageSize, isLoadingLikes]);

  return (
    <div className="w-full">
      <SwipeableTabs 
        tabs={tabs} 
        onTabChange={handleTabChange}
      />
    </div>
  );
}

// Use React.memo for the error boundary wrapper to prevent unnecessary re-renders
export const UserProfileTabsWithErrorBoundary = React.memo(
  (props: UserProfileTabsProps) => {
    return (
      <React.Fragment>
        <UserProfileTabs {...props} />
      </React.Fragment>
    );
  }
);
UserProfileTabsWithErrorBoundary.displayName = 'UserProfileTabsWithErrorBoundary'; 