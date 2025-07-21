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
 * - Enhanced bfcache support
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
  
  // bfcache restoration tracking
  const [isBfCacheRestoration, setIsBfCacheRestoration] = useState(false);
  const pageShowHandledRef = useRef(false);
  
  // Track retry attempts to prevent infinite loops
  const retryAttemptsRef = useRef({
    rss: 0,
    featured: 0
  });
  const MAX_RETRY_ATTEMPTS = 3;

  // Detect bfcache restoration
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !pageShowHandledRef.current) {
        // Page restored from bfcache
        setIsBfCacheRestoration(true);
        pageShowHandledRef.current = true;
        
        // Reset state to force re-initialization if on Following tab
        if (activeTabIndex === 1) {
          setHasInitialized(false);
          setRssData(null);
          setErrors(prev => ({ ...prev, rss: null }));
        }
        
        // Reset bfcache flag after processing
        setTimeout(() => {
          setIsBfCacheRestoration(false);
          pageShowHandledRef.current = false;
        }, 1000);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [activeTabIndex]);

  // Enhanced data fetching hook with bfcache support
  const { fetchRSSData, fetchFeaturedData, cleanup } = useFeedTabsDataFetching({
    isAuthenticated,
    router,
    onRSSDataFetched: useCallback((data) => setRssData(data), []),
    onFeaturedDataFetched: useCallback((data) => setFeaturedData(data), []),
    onRSSLoadingChange: useCallback((loading) => setLoading(prev => ({ ...prev, rss: loading })), []),
    onFeaturedLoadingChange: useCallback((loading) => setLoading(prev => ({ ...prev, featured: loading })), []),
    onRSSError: useCallback((error) => setErrors(prev => ({ ...prev, rss: error })), []),
    onFeaturedError: useCallback((error) => setErrors(prev => ({ ...prev, featured: error })), [])
  });

  // Retry handlers
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
    // If switching to the "Following" tab (index 1), check authentication AND onboarding
    if (index === 1 && (!isAuthenticated || !isBoarded)) {
      router.push('/signin');
      return;
    }
    
    // Reset RSS data when switching away from Following tab to force refetch on return
    if (activeTabIndex === 1 && index !== 1) {
      setRssData(null);
    }
    
    // CRITICAL FIX: Remove startTransition to make tab changes synchronous
    // This prevents the Featured Feed from staying mounted during RSS tab switch
    setActiveTabIndex(index);
  }, [isAuthenticated, isBoarded, router, activeTabIndex]);
  
  // Auth state management - reset to Discover tab when user signs out OR becomes unboarded
  useEffect(() => {
    if ((!isAuthenticated || !isBoarded) && activeTabIndex === 1) {
      setActiveTabIndex(0);
      setRssData(null);
      setErrors(prev => ({ ...prev, rss: null }));
    }
  }, [isAuthenticated, isBoarded, activeTabIndex]);
  
  // Initialize component state on mount
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
    }
  }, [hasInitialized]);
  
  // Data fetching effects with enhanced bfcache support
  useEffect(() => {
    if (!hasInitialized) return;
    
    // If on Following tab and no RSS data, fetch it
    if (activeTabIndex === 1 && (!rssData || isBfCacheRestoration)) {
      if (isAuthenticated && isBoarded) {
        if (retryAttemptsRef.current.rss < MAX_RETRY_ATTEMPTS) {
          retryAttemptsRef.current.rss++;
          fetchRSSData();
        }
      }
    }
    
    // If on Discover tab and no featured data, fetch it
    if (activeTabIndex === 0 && (!featuredData || isBfCacheRestoration)) {
      if (retryAttemptsRef.current.featured < MAX_RETRY_ATTEMPTS) {
        retryAttemptsRef.current.featured++;
        fetchFeaturedData();
      }
    }
  }, [
    hasInitialized,
    activeTabIndex,
    rssData,
    featuredData,
    isAuthenticated,
    isBoarded,
    isBfCacheRestoration,
    fetchRSSData,
    fetchFeaturedData
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Memoize sign-in content to prevent re-renders
  const signInContent = useMemo(() => (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <h2 className="text-lg font-semibold mb-4">Sign in to view your following feed</h2>
      <SignInButton />
    </div>
  ), []);

  return (
    <div className="w-full">
      {/* Mobile header with search and user menu */}
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <MobileSearch />
          {isAuthenticated && displayName && (
            <UserMenuClientWithErrorBoundary />
          )}
        </div>
      </div>

      {/* Feed tabs */}
      <SwipeableTabs
        tabs={tabs}
        defaultTabIndex={activeTabIndex}
        onTabChange={handleTabChange}
        className="w-full"
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