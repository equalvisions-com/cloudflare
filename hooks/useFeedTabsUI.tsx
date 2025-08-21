import React, { useMemo, useEffect, useRef } from 'react';
import { SkeletonFeed } from '@/components/ui/skeleton-feed';
import dynamic from 'next/dynamic';
import type { 
  UseFeedTabsUIProps, 
  UseFeedTabsUIReturn,
  FeedTabsTabConfig
} from '@/lib/types';

// Optimized dynamic imports for Edge Runtime - enable SSR for faster loading
const RSSEntriesClientWithErrorBoundary = dynamic(
  () => import("@/components/rss-feed/RSSEntriesDisplay.client").then(mod => mod.RSSEntriesClientWithErrorBoundary),
  { 
    ssr: true,  // ✅ Enable SSR for faster loading
    loading: () => <SkeletonFeed count={3} />  // Reduced skeleton count
  }
);

const FeaturedFeedClientWithErrorBoundary = dynamic(
  () => import("@/components/featured/FeaturedFeedClient").then(mod => mod.FeaturedFeedClientWithErrorBoundary),
  {
    ssr: true,  // ✅ Enable SSR for faster loading  
    loading: () => <SkeletonFeed count={3} />  // Reduced skeleton count
  }
);

/**
 * Custom hook for managing UI rendering logic in FeedTabsContainer
 * 
 * Production-ready implementation with optimizations:
 * - Stable data references prevent unnecessary component recreation
 * - Intelligent preloading strategy for better UX
 * - Memory-efficient tab rendering with proper cleanup
 * - Development-only logging for debugging
 * - Error state handling with retry functionality
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
  
  // Stabilize the initial data references to prevent unnecessary tab recreation
  // Use useMemo to create stable references that only change when data becomes available
  const stableRssData = useMemo(() => {
    return rssData;  // ✅ Simplified - return actual data or undefined
  }, [!!rssData]); // Only recalculate when existence changes, not content
  
  const stableFeaturedData = useMemo(() => {
    return featuredData;  // ✅ Simplified - return actual data or undefined
  }, [!!featuredData]); // Only recalculate when existence changes, not content
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
        
        // ✅ Let the component handle its own loading state - remove double loading
        return (
          <div className="min-h-screen">
            <FeaturedFeedClientWithErrorBoundary
              initialData={stableFeaturedData as any /* Type adjustment for compatibility */}
              pageSize={30}
              isActive={true}
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
        
        // ✅ Let the component handle its own loading state - remove double loading
        return (
          <div className="min-h-screen">
            <RSSEntriesClientWithErrorBoundary 
              initialData={stableRssData as any /* Type adjustment for compatibility */} 
              pageSize={stableRssData?.entries?.length || 30}
              isActive={true}
            />
          </div>
        );
      }
    }
  ], [
    // Only recreate tabs if there's a fundamental change (error state or retry handlers)
    // Use stable references to prevent recreation on data updates
    !!stableRssData,
    !!stableFeaturedData,
    rssError,
    featuredError,
    onRetryRSS,
    onRetryFeatured
    // ✅ Removed loading dependencies - let components handle their own loading
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
   * Check if current tab is loading - simplified
   */
  const isCurrentTabLoading = () => {
    if (activeTabIndex === 0) {
      return isFeaturedLoading;
    } else if (activeTabIndex === 1) {
      return isRSSLoading;
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