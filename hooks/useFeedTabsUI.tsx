import React, { useMemo, useEffect, useRef } from 'react';
import { SkeletonFeed } from '@/components/ui/skeleton-feed';
import dynamic from 'next/dynamic';
import type { 
  UseFeedTabsUIProps, 
  UseFeedTabsUIReturn,
  FeedTabsTabConfig
} from '@/lib/types';

// Optimized dynamic imports for Edge Runtime
const RSSEntriesClientWithErrorBoundary = dynamic(
  () => import("@/components/rss-feed/RSSEntriesDisplay.client").then(mod => mod.RSSEntriesClientWithErrorBoundary),
  { 
    ssr: false,
    loading: () => <SkeletonFeed count={5} />
  }
);

const FeaturedFeedClientWithErrorBoundary = dynamic(
  () => import("@/components/featured/FeaturedFeedClient").then(mod => mod.FeaturedFeedClientWithErrorBoundary),
  {
    ssr: false,
    loading: () => <SkeletonFeed count={5} />
  }
);

/**
 * Custom hook for managing UI rendering logic in FeedTabsContainer
 * 
 * Uses props for state management:
 * - Accepts state as props from parent component
 * - Preserves all dynamic import functionality
 * - Maintains intelligent preloading strategy
 * - Keeps skeleton loading states
 * - Error state rendering with retry functionality
 * 
 * @param props - Hook configuration props with state and callbacks
 * @returns UI rendering functions and configurations
 */
export const useFeedTabsUI = ({
  rssData,
  featuredData,
  isRSSLoading,
  isFeaturedLoading,
  rssError,
  featuredError,
  activeTabIndex,
  onRetryRSS,
  onRetryFeatured
}: UseFeedTabsUIProps): UseFeedTabsUIReturn => {
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

      // Preload the non-active tab component when browser is idle
      if (activeTabIndex === 0) {
        schedulePreload('RSSEntriesDisplay', () => 
          import("@/components/rss-feed/RSSEntriesDisplay.client")
        );
      } else if (activeTabIndex === 1) {
        schedulePreload('FeaturedFeedClientWithErrorBoundary', () => 
          import("@/components/featured/FeaturedFeedClient")
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
   * Memoized tabs configuration - optimized for re-render prevention
   */
  const tabs: FeedTabsTabConfig[] = useMemo(() => [
    // Discover tab - first in order
    {
      id: 'discover',
      label: 'Discover',
      component: () => {
        if (featuredError) {
          return renderErrorState(featuredError, onRetryFeatured);
        }
        
        if (isFeaturedLoading || featuredData === null) {
          return renderLoadingState();
        }
        
        return (
          <div className="min-h-screen">
            <FeaturedFeedClientWithErrorBoundary
              initialData={featuredData as any /* Type adjustment for compatibility */}
              pageSize={30}
              isActive={activeTabIndex === 0}
            />
          </div>
        );
      }
    },
    // Following tab - shows RSS feed content
    {
      id: 'following',
      label: 'Following',
      component: () => {
        if (rssError) {
          return renderErrorState(rssError, onRetryRSS);
        }
        
        if (isRSSLoading || rssData === null) {
          return renderLoadingState();
        }
        
        return (
          <div className="min-h-screen">
            <RSSEntriesClientWithErrorBoundary 
              key="rss-following-feed" // Stable key to prevent remounting on tab switches
              initialData={rssData as any /* Type adjustment for compatibility */} 
              pageSize={rssData.entries?.length || 30}
              isActive={activeTabIndex === 1} // Only active when Following tab is selected
            />
          </div>
        );
      }
    }
  ], [
    // Added activeTabIndex back because we use it in isActive prop
    activeTabIndex,
    rssData,
    featuredData,
    rssError,
    isRSSLoading,
    featuredError,
    isFeaturedLoading,
    onRetryRSS,
    onRetryFeatured
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