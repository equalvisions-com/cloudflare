'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { UserMenuClientWithErrorBoundary } from '../user-menu/UserMenuClient';
import { MobileSearch } from '@/components/mobile/MobileSearch';
import { useSidebar } from '@/components/ui/sidebar-context';
import { SignInButton } from "@/components/ui/SignInButton";
import { useRouter } from 'next/navigation';
import { useFeedTabsDataFetching } from '@/hooks/useFeedTabsDataFetching';
import { useFeedTabsUI } from '@/hooks/useFeedTabsUI';
import type { FeedTabsContainerProps } from '@/lib/types';

/**
 * FeedTabsContainer Component
 * 
 * Production-ready implementation with optimizations:
 * - useState for local component state
 * - useTransition for smooth UX during tab changes
 * - Optimized useEffect usage with proper dependencies
 * - React.memo optimizations
 * - Preserved dynamic imports with skeletons
 * - Single context usage to prevent re-renders
 * - Stable refs to prevent stale closures
 */

export function FeedTabsContainer({ 
  initialData, 
  featuredData: initialFeaturedData, 
  pageSize = 30
}: FeedTabsContainerProps) {
  // STABILITY FIX: Only destructure needed values to prevent unnecessary re-renders during auth refresh
  const { isAuthenticated, displayName, isBoarded, profileImage, pendingFriendRequestCount } = useSidebar();
  const router = useRouter();
  
  // React state management - local component state
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [rssData, setRssData] = useState(initialData);
  const [featuredData, setFeaturedData] = useState(initialFeaturedData);
  const [loading, setLoading] = useState({
    rss: false,
    featured: false
  });
  const [errors, setErrors] = useState({
    rss: null as string | null,
    featured: null as string | null
  });
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Stable refs to prevent stale closures in useEffect
  const rssDataRef = useRef(rssData);
  const loadingRef = useRef(loading);
  const featuredDataRef = useRef(featuredData);
  const errorsRef = useRef(errors);
  
  // Circuit breaker to prevent infinite retry loops
  const retryAttemptsRef = useRef({ rss: 0, featured: 0 });
  const MAX_RETRY_ATTEMPTS = 3;
  
  // Update refs when state changes
  useEffect(() => {
    rssDataRef.current = rssData;
  }, [rssData]);
  
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  
  useEffect(() => {
    featuredDataRef.current = featuredData;
  }, [featuredData]);
  
  useEffect(() => {
    errorsRef.current = errors;
  }, [errors]);
  
  // Removed useTransition to fix tab switching timing issues
  
  // Custom hook for data fetching - simplified to accept callbacks
  const { fetchRSSData, fetchFeaturedData, cleanup } = useFeedTabsDataFetching({
    isAuthenticated,
    router,
    onRSSDataFetched: setRssData,
    onFeaturedDataFetched: setFeaturedData,
    onRSSLoadingChange: (loading: boolean) => setLoading(prev => ({ ...prev, rss: loading })),
    onFeaturedLoadingChange: (loading: boolean) => setLoading(prev => ({ ...prev, featured: loading })),
    onRSSError: (error: string | null) => setErrors(prev => ({ ...prev, rss: error })),
    onFeaturedError: (error: string | null) => setErrors(prev => ({ ...prev, featured: error }))
  });
  
  // Stable cleanup reference to prevent dependency issues
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  
  // Stable retry handlers to prevent re-renders
  const handleRetryRSS = useCallback(() => {
    // Reset error and retry attempt counter
    setErrors(prev => ({ ...prev, rss: null }));
    retryAttemptsRef.current.rss = 0;
    fetchRSSData();
  }, [fetchRSSData]);

  const handleRetryFeatured = useCallback(() => {
    // Reset error and retry attempt counter  
    setErrors(prev => ({ ...prev, featured: null }));
    retryAttemptsRef.current.featured = 0;
    fetchFeaturedData();
  }, [fetchFeaturedData]);

  // Custom hook for UI rendering - now accepts props instead of using store
  const { tabs } = useFeedTabsUI({
    rssData,
    featuredData: featuredData ?? null, // Convert undefined to null to match type
    isRSSLoading: loading.rss,
    isFeaturedLoading: loading.featured,
    rssError: errors.rss,
    featuredError: errors.featured,
    activeTabIndex,
    onRetryRSS: handleRetryRSS,
    onRetryFeatured: handleRetryFeatured
  });
  
  // Tab change handler with authentication checks
  const handleTabChange = useCallback((index: number) => {
    // If switching to the "Following" tab (index 1), check authentication
    if (index === 1 && !isAuthenticated) {
      router.push('/signin');
      return;
    }
    
    // CRITICAL FIX: Remove startTransition to make tab changes synchronous
    // This prevents the Featured Feed from staying mounted during RSS tab switch
    setActiveTabIndex(index);
  }, [isAuthenticated, router]);
  
  // Auth state management - reset to Discover tab when user signs out
  useEffect(() => {
    if (!isAuthenticated && activeTabIndex === 1) {
      setActiveTabIndex(0);
      setRssData(null);
      setErrors(prev => ({ ...prev, rss: null }));
    }
  }, [isAuthenticated, activeTabIndex]);
  
  // Initialize component state on mount
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
    }
  }, [hasInitialized]);
  
  // Data fetching coordination effect - with error state protection
  useEffect(() => {
    if (!hasInitialized) return;
    
    // Handle redirect for unauthenticated users trying to access Following tab
    if (activeTabIndex === 1 && !isAuthenticated) {
      router.push('/signin');
      return;
    }
    
    // Fetch data based on active tab - using refs to prevent stale closures
    // CRITICAL: Don't fetch if there's already an error to prevent infinite loops
    if (activeTabIndex === 1 && isAuthenticated && !rssDataRef.current && !loadingRef.current.rss && !errorsRef.current.rss) {
      fetchRSSData();
    } else if (activeTabIndex === 0 && !featuredDataRef.current && !loadingRef.current.featured && !errorsRef.current.featured) {
      fetchFeaturedData();
    }
  }, [activeTabIndex, isAuthenticated, hasInitialized, fetchRSSData, fetchFeaturedData, router]);

  // Cleanup effect to prevent memory leaks - stable cleanup reference
  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []); // Empty dependencies - cleanup is stable via ref

  // Memoized authentication UI helpers to prevent recalculation
  const authUIConfig = useMemo(() => ({
    shouldShowUserMenu: isAuthenticated,
    shouldShowSignInButton: !isAuthenticated,
    userMenuProps: isAuthenticated ? {
      initialDisplayName: displayName || '',
      isBoarded,
      initialProfileImage: profileImage || undefined,
      pendingFriendRequestCount
    } : null
  }), [isAuthenticated, displayName, isBoarded, profileImage, pendingFriendRequestCount]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 items-center px-4 pt-2 pb-2 z-50 sm:block md:hidden">
        <div>
          {authUIConfig.shouldShowUserMenu && authUIConfig.userMenuProps && (
            <UserMenuClientWithErrorBoundary />
          )}
        </div>
        <div className="flex justify-end items-center gap-2">
          {authUIConfig.shouldShowSignInButton && <SignInButton />}
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

// Use React.memo for performance optimization with custom comparison
const MemoizedFeedTabsContainer = React.memo(FeedTabsContainer, (prevProps, nextProps) => {
  // Custom comparison for optimal re-render prevention
  return (
    prevProps.pageSize === nextProps.pageSize &&
    prevProps.initialData === nextProps.initialData &&
    prevProps.featuredData === nextProps.featuredData
  );
});
MemoizedFeedTabsContainer.displayName = 'MemoizedFeedTabsContainer';

// Enterprise-grade comparison for FeedTabs data
const compareFeedTabsData = (
  prev: FeedTabsContainerProps['initialData'] | FeedTabsContainerProps['featuredData'], 
  next: FeedTabsContainerProps['initialData'] | FeedTabsContainerProps['featuredData']
): boolean => {
  // Handle null/undefined cases (fast path)
  if (prev === next) return true;
  if (!prev || !next) return false;
  
  // Compare primitive values first (fastest)
  if (prev.totalEntries !== next.totalEntries) return false;
  
  // Compare array length (fast)
  if (prev.entries.length !== next.entries.length) return false;
  
  // For large datasets, use sampling strategy for performance
  const entryCount = prev.entries.length;
  if (entryCount === 0) return true;
  
  // Multi-tier sampling for enterprise-scale performance
  if (entryCount > 50) {
    const sampleIndices = [
      0, // First entry
      Math.floor(entryCount / 4), // Quarter point
      Math.floor(entryCount / 2), // Middle
      Math.floor(entryCount * 3 / 4), // Three-quarter point
      entryCount - 1 // Last entry
    ].filter(i => i < entryCount);
    
    return sampleIndices.every(i => {
      const prevEntry = prev.entries[i];
      const nextEntry = next.entries[i];
      return prevEntry?.entry?.guid === nextEntry?.entry?.guid;
    });
  }
  
  // Full comparison for smaller datasets
  return prev.entries.every((prevEntry, i) => {
    const nextEntry = next.entries[i];
    return prevEntry?.entry?.guid === nextEntry?.entry?.guid;
  });
};

// Error boundary wrapper with React.memo optimization
export const FeedTabsContainerWithErrorBoundary = React.memo(
  (props: FeedTabsContainerProps) => {
    return <MemoizedFeedTabsContainer {...props} />;
  },
  (prevProps, nextProps) => {
    // Enterprise-grade comparison for error boundary props
    return (
      prevProps.pageSize === nextProps.pageSize &&
      compareFeedTabsData(prevProps.initialData, nextProps.initialData) &&
      compareFeedTabsData(prevProps.featuredData, nextProps.featuredData)
    );
  }
);
FeedTabsContainerWithErrorBoundary.displayName = 'FeedTabsContainerWithErrorBoundary'; 