"use client";

import React, { useMemo, useState, useCallback, useReducer, useRef } from 'react';
import { SwipeableTabs } from "@/components/profile/ProfileSwipeableTabs";
import dynamic from 'next/dynamic';
import { Id } from "@/convex/_generated/dataModel";
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
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

// Local state management types
type LikesStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface LikesState {
  data: ProfileFeedData | null;
  status: LikesStatus;
  error: Error | null;
}

type LikesAction = 
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: ProfileFeedData }
  | { type: 'FETCH_ERROR'; payload: Error }
  | { type: 'INITIALIZE'; payload: ProfileFeedData };

// Reducer for likes state management
function likesReducer(state: LikesState, action: LikesAction): LikesState {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        data: action.payload,
        status: 'loaded',
        error: null
      };
    case 'FETCH_START':
      return {
        ...state,
        status: 'loading',
        error: null
      };
    case 'FETCH_SUCCESS':
      return {
        data: action.payload,
        status: 'loaded',
        error: null
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.payload,
        data: null
      };
    default:
      return state;
  }
}

// Memoized component for the "Activity" tab content
const ActivityTabContent = React.memo(({ 
  userId, 
  username,
  name,
  profileImage,
  activityData, 
  pageSize,
  isActive = false
}: ActivityTabContentProps & { isActive?: boolean }) => {
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
      isActive={isActive}
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
  error,
  isActive = false
}: LikesTabContentProps & { isActive?: boolean }) => {
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

  // Only load the UserLikesFeed component when we actually have data to display
  // Pass isActive to prevent useBatchEntryMetrics calls when tab is not active
  return (
    <DynamicUserLikesFeed
      userId={userId}
      initialData={likesData}
      pageSize={pageSize}
      isActive={isActive}
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
  // Local state management with useState and useReducer
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);
  
  // Initialize likes state
  const initialLikesState: LikesState = {
    data: initialLikesData || null,
    status: initialLikesData ? 'loaded' : 'idle',
    error: null
  };
  
  const [likesState, dispatchLikes] = useReducer(likesReducer, initialLikesState);

  // Enterprise-grade fetch function with error recovery
  const retryAttemptsRef = useRef(0);
  const MAX_RETRY_ATTEMPTS = 3;
  
  const fetchLikesData = useCallback(async () => {
    if (likesState.status !== 'idle') return;
    
    dispatchLikes({ type: 'FETCH_START' });
    
    try {
      // Use the public API endpoint for consistency - no authentication required
      const response = await fetch(`/api/users/${userId}/likes?skip=0&limit=${pageSize}`, {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch likes: ${response.status}`);
      }
      
      const data = await response.json();
      dispatchLikes({ type: 'FETCH_SUCCESS', payload: data });
      retryAttemptsRef.current = 0; // Reset on success
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
      
      // Enterprise error recovery with exponential backoff
      if (retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
        retryAttemptsRef.current++;
        const retryDelay = Math.min(1000 * Math.pow(2, retryAttemptsRef.current - 1), 10000);
        
        setTimeout(() => {
          if (likesState.status === 'loading') {
            // Reset to idle to allow retry
            dispatchLikes({ type: 'FETCH_ERROR', payload: new Error('Retrying...') });
            setTimeout(() => fetchLikesData(), 100);
          }
        }, retryDelay);
      } else {
        dispatchLikes({ type: 'FETCH_ERROR', payload: errorObj });
      }
    }
  }, [userId, pageSize, likesState.status]);

  // Optimized tab change handler
  const handleTabChange = useCallback((index: number) => {
    // Start fetch BEFORE transition if needed
    if (index === 1 && likesState.status === 'idle') {
      fetchLikesData();
    }
    
    // CRITICAL FIX: Remove startTransition to make tab changes synchronous
    // This prevents components from staying mounted during tab switch
    setSelectedTabIndex(index);
  }, [likesState.status, fetchLikesData]);

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
          isActive={selectedTabIndex === 0} // Pass isActive based on current tab
        />
      )
    },
    // Likes tab - only create the component when this tab is selected
    {
      id: 'likes',
      label: 'Likes',
      component: () => (
        <LikesTabContent 
          userId={userId}
          likesData={likesState.data} 
          pageSize={pageSize}
          isLoading={likesState.status === 'loading'}
          error={likesState.error}
          isActive={selectedTabIndex === 1} // Pass isActive based on current tab
        />
      )
    }
  ], [
    userId, 
    username, 
    name, 
    profileImage, 
    activityData, 
    likesState.data, 
    likesState.status,
    likesState.error,
    pageSize,
    selectedTabIndex // Add selectedTabIndex to dependencies
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

// Use React.memo for the entire component with proper comparison
export const UserProfileTabsWithErrorBoundary = React.memo(UserProfileTabs, (prevProps, nextProps) => {
  // Custom comparison function for better memoization
  return (
    prevProps.userId === nextProps.userId &&
    prevProps.username === nextProps.username &&
    prevProps.name === nextProps.name &&
    prevProps.profileImage === nextProps.profileImage &&
    prevProps.pageSize === nextProps.pageSize &&
    prevProps.activityData === nextProps.activityData &&
    prevProps.likesData === nextProps.likesData
  );
});
UserProfileTabsWithErrorBoundary.displayName = 'UserProfileTabsWithErrorBoundary'; 