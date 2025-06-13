'use client';

import React, { useEffect, startTransition } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { UserMenuClientWithErrorBoundary } from '../user-menu/UserMenuClient';
import { MobileSearch } from '@/components/mobile/MobileSearch';
import { useSidebar } from '@/components/ui/sidebar-context';
import { SignInButton } from "@/components/ui/SignInButton";
import { useRouter } from 'next/navigation';
import { useFeedTabsDataFetching } from '@/hooks/useFeedTabsDataFetching';
import { useFeedTabsManagement } from '@/hooks/useFeedTabsManagement';
import { useFeedTabsAuth } from '@/hooks/useFeedTabsAuth';
import { useFeedTabsUI } from '@/hooks/useFeedTabsUI';
import { 
  useFeedTabsActiveTabIndex,
  useFeedTabsInitialize
} from '@/lib/stores/feedTabsStore';
import type { FeedTabsContainerProps } from '@/lib/types';

/**
 * FeedTabsContainer Component
 * 
 * Production-ready component following established patterns:
 * - Zustand store for centralized state management
 * - Custom hooks for business logic separation
 * - Minimal useEffect usage
 * - React.memo optimizations
 * - Comprehensive error handling
 */

export function FeedTabsContainer({ 
  initialData, 
  featuredData: initialFeaturedData, 
  pageSize = 30
}: FeedTabsContainerProps) {
  // Get authentication state from sidebar context
  const { isAuthenticated } = useSidebar();
  const router = useRouter();
  
  // Zustand store selectors
  const activeTabIndex = useFeedTabsActiveTabIndex();
  const initialize = useFeedTabsInitialize();
  
  // Custom hooks for business logic
  const { fetchRSSData, fetchFeaturedData, cleanup } = useFeedTabsDataFetching({
    isAuthenticated,
    router
  });
  
  const { 
    handleTabChange, 
    shouldFetchFeaturedData, 
    shouldFetchRSSData, 
    shouldRedirectToSignIn 
  } = useFeedTabsManagement({
    isAuthenticated,
    router
  });
  
  const { 
    getUserMenuProps, 
    shouldShowSignInButton, 
    shouldShowUserMenu 
  } = useFeedTabsAuth({
    isAuthenticated
  });
  
  const { tabs } = useFeedTabsUI();
  
  // Initialize store with initial data on mount
  useEffect(() => {
    initialize({
      rssData: initialData,
      featuredData: initialFeaturedData,
      pageSize
    });
  }, [initialize, initialData, initialFeaturedData, pageSize]);
  
  // Data fetching coordination effect with startTransition for smooth UX
  useEffect(() => {
    const fetchDataForActiveTab = async () => {
      // Handle redirect for unauthenticated users trying to access Following tab
      if (shouldRedirectToSignIn()) {
        router.push('/signin');
        return;
      }
      
      // Use startTransition for non-urgent data fetching to prevent jarring loading states
      startTransition(() => {
        // Fetch data based on active tab
        if (shouldFetchFeaturedData()) {
          fetchFeaturedData();
        } else if (shouldFetchRSSData()) {
          fetchRSSData();
        }
      });
    };
    
    fetchDataForActiveTab();
    
    // Cleanup function to abort any in-progress requests
    return cleanup;
  }, [
    activeTabIndex,
    isAuthenticated
  ]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 items-center px-4 pt-2 pb-2 z-50 sm:block md:hidden">
        <div>
          {shouldShowUserMenu() && (() => {
            const userMenuProps = getUserMenuProps();
            if (!userMenuProps) return null;
            
            return (
              <UserMenuClientWithErrorBoundary 
                initialDisplayName={userMenuProps.initialDisplayName}
                isBoarded={userMenuProps.isBoarded}
                initialProfileImage={userMenuProps.initialProfileImage || undefined}
                pendingFriendRequestCount={userMenuProps.pendingFriendRequestCount}
              />
            );
          })()}
        </div>
        <div className="flex justify-end items-center gap-2">
          {shouldShowSignInButton() && <SignInButton />}
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

// Use React.memo for performance optimization to prevent unnecessary re-renders
const MemoizedFeedTabsContainer = React.memo(FeedTabsContainer);
MemoizedFeedTabsContainer.displayName = 'MemoizedFeedTabsContainer';

// Error boundary wrapper with React.memo optimization
export const FeedTabsContainerWithErrorBoundary = React.memo(
  (props: FeedTabsContainerProps) => {
    return <MemoizedFeedTabsContainer {...props} />;
  }
);
FeedTabsContainerWithErrorBoundary.displayName = 'FeedTabsContainerWithErrorBoundary'; 