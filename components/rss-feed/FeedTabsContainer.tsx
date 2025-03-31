'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { cn } from '@/lib/utils';
import { RSSEntriesClient } from "@/components/rss-feed/RSSEntriesDisplay.client";
import { FeaturedFeedWrapper } from "@/components/featured/FeaturedFeedWrapper";
import type { FeaturedEntry } from "@/lib/featured_redis";

// Define the RSSItem interface based on the database schema
export interface RSSItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  description?: string;
  image?: string;
  mediaType?: string;
  feedUrl: string;
  feedTitle?: string;
}

// Interface for post metadata
interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
}

// Define the interfaces that match the expected types in the child components
interface FeaturedEntryWithData {
  entry: FeaturedEntry;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
  postMetadata: PostMetadata;
}

interface RSSEntryWithData {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    categorySlug?: string;
    postSlug?: string;
  };
}

// Define types for our props
interface FeedTabsContainerProps {
  initialData: {
    entries: unknown[]; // Using unknown for type safety
    totalEntries: number;
    hasMore: boolean;
    postTitles?: string[];
  } | null;
  featuredData?: {
    entries: unknown[]; // Using unknown for type safety
    totalEntries: number;
  } | null;
  pageSize?: number;
}

// Add this constant at the top of the file
const MOBILE_BREAKPOINT = 768;

// Memoized tab headers component to prevent re-renders
const TabHeaders = React.memo(({ 
  tabs, 
  selectedTab, 
  onSelectTab,
}: { 
  tabs: Array<{ id: string; label: string; }>, 
  selectedTab: string, 
  onSelectTab: (tabId: string) => void,
}) => {
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [, forceUpdate] = useState({});

  // Force re-render when selected tab changes to ensure indicator width updates
  useEffect(() => {
    forceUpdate({});
  }, [selectedTab]);

  return (
    <div className="flex w-full sticky top-0 bg-background/85 backdrop-blur-md z-50 border-b">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onSelectTab(tab.id)}
          className={cn(
            'flex-1 py-3 text-center font-bold text-sm relative transition-colors',
            selectedTab === tab.id
              ? 'text-primary'
              : 'text-muted-foreground hover:text-primary/80'
          )}
          role="tab"
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
        >
          <span ref={(el) => { labelRefs.current[index] = el; }}>{tab.label}</span>
          {selectedTab === tab.id && (
            <div 
              className="absolute bottom-0 h-1 bg-primary rounded-full" 
              style={{ 
                width: labelRefs.current[index]?.offsetWidth || 'auto',
                left: '50%',
                transform: 'translateX(-50%)'
              }} 
            />
          )}
        </button>
      ))}
    </div>
  );
});
TabHeaders.displayName = 'TabHeaders';

export function FeedTabsContainer({ initialData, featuredData, pageSize = 30 }: FeedTabsContainerProps) {
  // State for selected tab
  const [selectedTabId, setSelectedTabId] = useState<string>('discover');
  const [isMobile, setIsMobile] = useState(false);
  
  // Create tab content objects
  const tabs = useMemo(() => [
    {
      id: 'discover',
      label: 'Discover',
      content: <FeaturedFeedWrapper initialData={featuredData as any} />,
    },
    {
      id: 'following',
      label: 'Following',
      content: <RSSEntriesClient initialData={initialData as any || { entries: [], totalEntries: 0, hasMore: false }} pageSize={pageSize} />,
    }
  ], [initialData, featuredData, pageSize]);

  // Update isMobile state based on window width
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize Embla carousel with conditional options for mobile
  const carouselOptions = useMemo(() => 
    isMobile ? {
      align: 'start' as const,
      skipSnaps: false,
      dragFree: false,
      containScroll: 'trimSnaps' as const
    } : { 
      align: 'start' as const,
      skipSnaps: true,
      dragFree: false,
      containScroll: 'keepSnaps' as const,
      active: false // Disable carousel on desktop
    },
    [isMobile]
  );

  const [contentRef, contentEmblaApi] = useEmblaCarousel(
    carouselOptions,
    isMobile ? [WheelGesturesPlugin()] : []
  );

  // Prevent browser back/forward navigation when interacting with the content carousel
  useEffect(() => {
    if (!contentEmblaApi || !isMobile) return;
    
    const contentViewport = contentEmblaApi.rootNode();
    if (!contentViewport) return;
    
    // Prevent horizontal swipe navigation only when actually dragging
    const preventNavigation = (e: TouchEvent) => {
      if (!contentEmblaApi.internalEngine().dragHandler.pointerDown()) return;
      
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      const handleTouchMove = (e: TouchEvent) => {
        if (!contentEmblaApi.internalEngine().dragHandler.pointerDown()) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        
        // Only prevent default if horizontal movement is greater than vertical
        if (deltaX > deltaY) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      
      const cleanup = () => {
        document.removeEventListener('touchmove', handleTouchMove);
      };
      
      document.addEventListener('touchend', cleanup, { once: true });
      document.addEventListener('touchcancel', cleanup, { once: true });
    };
    
    contentViewport.addEventListener('touchstart', preventNavigation, { passive: true });
    
    return () => {
      contentViewport.removeEventListener('touchstart', preventNavigation);
    };
  }, [contentEmblaApi, isMobile]);

  // Handle tab selection and sync with carousel
  const handleTabSelect = useCallback((tabId: string) => {
    setSelectedTabId(tabId);
    
    if (isMobile && contentEmblaApi) {
      const tabIndex = tabs.findIndex(tab => tab.id === tabId);
      if (tabIndex !== -1) {
        contentEmblaApi.scrollTo(tabIndex, true);
      }
    }
  }, [isMobile, contentEmblaApi, tabs]);

  // Sync carousel changes with tabs
  useEffect(() => {
    if (!contentEmblaApi) return;

    const onSelect = () => {
      const index = contentEmblaApi.selectedScrollSnap();
      const selectedTab = tabs[index];
      if (selectedTab && selectedTab.id !== selectedTabId) {
        setSelectedTabId(selectedTab.id);
      }
    };

    contentEmblaApi.on('select', onSelect);

    return () => {
      contentEmblaApi.off('select', onSelect);
    };
  }, [contentEmblaApi, tabs, selectedTabId]);

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTabId} 
        onSelectTab={handleTabSelect} 
      />

      {/* Content carousel */}
      <div className={cn(
        "overflow-hidden prevent-overscroll-navigation",
        !isMobile && "overflow-visible" // Remove overflow hidden on desktop
      )} ref={contentRef}>
        <div className={cn(
          "flex",
          !isMobile && "!transform-none" // Prevent transform on desktop
        )}>
          {tabs.map((tab) => (
            <div 
              key={`content-${tab.id}`} 
              className={cn(
                "flex-[0_0_100%] min-w-0",
                !isMobile && selectedTabId !== tab.id && "hidden" // Hide when not active on desktop
              )}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Use React.memo for the error boundary wrapper to prevent unnecessary re-renders
export const FeedTabsContainerWithErrorBoundary = React.memo(
  (props: FeedTabsContainerProps) => {
    return (
      <React.Fragment>
        <FeedTabsContainer {...props} />
      </React.Fragment>
    );
  }
);
FeedTabsContainerWithErrorBoundary.displayName = 'FeedTabsContainerWithErrorBoundary'; 