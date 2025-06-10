"use client";

import React, { useMemo } from 'react';
import { SwipeableTabs } from "@/components/profile/ProfileSwipeableTabs";
import dynamic from 'next/dynamic';
import { Id } from "@/convex/_generated/dataModel";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import { useProfileTabs } from "@/hooks/useProfileTabs";
import { 
  ProfileFeedData, 
  UserProfileTabsProps,
  UserActivityFeedProps,
  UserLikesFeedProps,
  ActivityTabContentProps,
  LikesTabContentProps
} from "@/lib/types";

// Dynamically import components with proper loading states
const DynamicUserActivityFeed = dynamic<UserActivityFeedProps>(
  () => import('@/components/profile/UserActivityFeed').then(mod => ({ default: mod.UserActivityFeed })),
  {
    loading: () => <SkeletonFeed count={5} />,
    ssr: false
  }
);

const DynamicUserLikesFeed = dynamic<UserLikesFeedProps>(
  () => import('@/components/profile/UserLikesFeed').then(mod => ({ default: mod.UserLikesFeed })),
  {
    loading: () => <SkeletonFeed count={5} />,
    ssr: false
  }
);

// Memoized component for the "Activity" tab content
const ActivityTabContent = React.memo(({ 
  userId, 
  username,
  name,
  profileImage,
  activityData, 
  pageSize,
}: ActivityTabContentProps) => {
  if (!activityData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No activity found for this user.</p>
      </div>
    );
  }

  return (
    <DynamicUserActivityFeed
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
  isLoading,
  error
}: LikesTabContentProps) => {
  if (isLoading) {
    return <SkeletonFeed count={5} />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Error loading likes: {error.message}</p>
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
    <DynamicUserLikesFeed
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
  // Use custom hook for business logic and state management
  const {
    selectedTabIndex,
    likesData,
    likesStatus,
    likesError,
    isPending,
    handleTabChange,
  } = useProfileTabs({
    userId,
    pageSize,
    initialLikesData,
  });

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
          activityData={activityData} 
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
          likesData={likesData} 
          pageSize={pageSize}
          isLoading={likesStatus === 'loading'}
          error={likesError}
        />
      )
    }
  ], [
    userId, 
    username, 
    name, 
    profileImage, 
    activityData, 
    likesData, 
    likesStatus,
    likesError,
    pageSize
  ]);

  return (
    <div className="w-full z-50">
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