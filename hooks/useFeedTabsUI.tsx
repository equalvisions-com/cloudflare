import React, { useMemo, useEffect, useRef } from 'react';
import {
  useFeedTabsRSSData,
  useFeedTabsFeaturedData,
  useFeedTabsIsRSSLoading,
  useFeedTabsIsFeaturedLoading,
  useFeedTabsRSSError,
  useFeedTabsFeaturedError,
  useFeedTabsActiveTabIndex
} from '@/lib/stores/feedTabsStore';
import { SkeletonFeed } from '@/components/ui/skeleton-feed';
import dynamic from 'next/dynamic';
import { FeaturedFeedWrapper } from '@/components/featured/FeaturedFeedWrapper';
import type { 
  UseFeedTabsUIProps, 
  UseFeedTabsUIReturn,
  FeedTabsTabConfig
} from '@/lib/types';

// Single dynamic import for RSS entries only
const RSSEntriesClientWithErrorBoundary = dynamic(
  () => import("@/components/rss-feed/RSSEntriesDisplay.client").then(mod => mod.RSSEntriesClientWithErrorBoundary),
  { 
    ssr: false,
    loading: () => <SkeletonFeed count={5} />
  }
);

/**
 * Custom hook for managing UI rendering logic in FeedTabsContainer
 * 
 * Extracts all UI rendering business logic from the component following
 * the established production patterns:
 * - Memoized tab configurations
 * - Error state rendering
 * - Loading state rendering
 * - Dynamic component loading with skeletons
 * 
 * @param props - Hook configuration props (currently none needed)
 * @returns UI rendering functions and configurations
 */
export const useFeedTabsUI = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  props: UseFeedTabsUIProps = {}
): UseFeedTabsUIReturn => {
  // Zustand store selectors
  const rssData = useFeedTabsRSSData();
  const featuredData = useFeedTabsFeaturedData();
  const isRSSLoading = useFeedTabsIsRSSLoading();
  const isFeaturedLoading = useFeedTabsIsFeaturedLoading();
  const rssError = useFeedTabsRSSError();
  const featuredError = useFeedTabsFeaturedError();
  const activeTabIndex = useFeedTabsActiveTabIndex();

  // Track if components have been preloaded to avoid duplicate preloads
  const preloadedRef = useRef<Set<string>>(new Set());

  // Intelligent preloading that doesn't block initial render
  useEffect(() => {
    // Only preload after the page has fully loaded and user is idle
    const preloadWhenIdle = () => {
      // Use requestIdleCallback if available, otherwise fallback to setTimeout
      const schedulePreload = (componentName: string, importFn: () => Promise<any>) => {
        // Skip if already preloaded
        if (preloadedRef.current.has(componentName)) {
          return;
        }

        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            importFn().then(() => {
              preloadedRef.current.add(componentName);
            }).catch(() => {
              // Silently fail if preload fails - not critical
            });
          }, { timeout: 5000 });
        } else {
          setTimeout(() => {
            importFn().then(() => {
              preloadedRef.current.add(componentName);
            }).catch(() => {
              // Silently fail if preload fails - not critical
            });
          }, 2000); // Fallback for browsers without requestIdleCallback
        }
      };

      // Preload the RSS entries component when on Featured tab (tab 0)
      if (activeTabIndex === 0) {
        schedulePreload('RSSEntriesDisplay', () => 
          import("@/components/rss-feed/RSSEntriesDisplay.client")
        );
      }
    };

    // Only start preloading after initial render is complete and DOM is ready
    const preloadTimer = setTimeout(preloadWhenIdle, 100);
    
    return () => clearTimeout(preloadTimer);
  }, [activeTabIndex]);

  /**
   * Render error state with retry functionality
   */
  const renderErrorState = (error: string, onRetry: () => void) => (
    <div className="p-8 text-center text-destructive">
      <p>{error}</p>
      <button 
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        onClick={onRetry}
      >
        Try Again
      </button>
    </div>
  );

  /**
   * Render loading state
   */
  const renderLoadingState = () => <SkeletonFeed count={5} />;

  /**
   * Memoized tabs configuration
   */
  const tabs: FeedTabsTabConfig[] = useMemo(() => [
    // Discover tab - first in order
    {
      id: 'discover',
      label: 'Discover',
      component: () => {
        if (featuredError) {
          return renderErrorState(featuredError, () => {
            // This will be handled by the parent component
            console.log('🔄 Retry featured data fetch requested');
          });
        }
        
        if (isFeaturedLoading || featuredData === null) {
          return renderLoadingState();
        }
        
        return (
          <FeaturedFeedWrapper
            initialData={featuredData as any /* Type adjustment for compatibility */}
          />
        );
      }
    },
    // Following tab - shows RSS feed content
    {
      id: 'following',
      label: 'Following',
      component: () => {
        if (rssError) {
          return renderErrorState(rssError, () => {
            // This will be handled by the parent component
            console.log('🔄 Retry RSS data fetch requested');
          });
        }
        
        if (isRSSLoading || rssData === null) {
          return renderLoadingState();
        }
        
        return (
          <RSSEntriesClientWithErrorBoundary 
            initialData={rssData as any /* Type adjustment for compatibility */} 
            pageSize={rssData.entries?.length || 30}
          />
        );
      }
    }
  ], [
    rssData,
    featuredData,
    rssError,
    isRSSLoading,
    featuredError,
    isFeaturedLoading
  ]);

  /**
   * Get current tab configuration
   */
  const getCurrentTab = () => {
    return tabs[activeTabIndex] || tabs[0];
  };

  /**
   * Check if current tab has error
   */
  const hasCurrentTabError = () => {
    if (activeTabIndex === 0) {
      return Boolean(featuredError);
    } else if (activeTabIndex === 1) {
      return Boolean(rssError);
    }
    return false;
  };

  /**
   * Check if current tab is loading
   */
  const isCurrentTabLoading = () => {
    if (activeTabIndex === 0) {
      return isFeaturedLoading || featuredData === null;
    } else if (activeTabIndex === 1) {
      return isRSSLoading || rssData === null;
    }
    return false;
  };

  return {
    tabs,
    renderErrorState,
    renderLoadingState,
    getCurrentTab,
    hasCurrentTabError,
    isCurrentTabLoading
  };
}; 