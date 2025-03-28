'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { RSSEntriesClient } from "@/components/rss-feed/RSSEntriesDisplay.client";
import { FeaturedFeedWrapper } from "@/components/featured/FeaturedFeedWrapper";
import type { FeaturedEntry } from "@/lib/featured_redis";
import useEmblaCarousel from 'embla-carousel-react';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { cn } from '@/lib/utils';

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

// Memoized tab header component
const TabHeaders = memo(({ 
  tabs, 
  selectedTab, 
  onTabClick 
}: { 
  tabs: { id: string; label: string }[], 
  selectedTab: number, 
  onTabClick: (index: number) => void 
}) => {
  return (
    <div className="flex w-full sticky top-0 bg-background/85 backdrop-blur-md z-50 border-b">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onTabClick(index)}
          className={cn(
            'flex-1 py-3 text-center font-bold text-sm relative transition-colors',
            selectedTab === index 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-primary/80'
          )}
          role="tab"
          aria-selected={selectedTab === index}
          aria-controls={`panel-${tab.id}`}
          id={`tab-${tab.id}`}
        >
          <span>{tab.label}</span>
          {selectedTab === index && (
            <div className="absolute bottom-0 left-0 w-full h-1 bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
});
TabHeaders.displayName = 'TabHeaders';

export function FeedTabsContainer({ initialData, featuredData, pageSize = 30 }: FeedTabsContainerProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Initialize Embla carousel with options
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: 'start',
      skipSnaps: false,
      dragFree: false,
      containScroll: 'trimSnaps',
      loop: false,
      duration: 20 // Fast but smooth scroll
    },
    [WheelGesturesPlugin()]
  );

  // Handle tab selection
  const handleTabClick = useCallback((index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
    }
    setSelectedTab(index);
  }, [emblaApi]);

  // Sync carousel with tab selection
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedTab(emblaApi.selectedScrollSnap());
    };

    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // Define tabs configuration
  const tabs = useMemo(() => [
    { id: 'discover', label: 'Discover' },
    { id: 'following', label: 'Following' }
  ], []);

  return (
    <div className="w-full">
      {/* Tab Headers */}
      <TabHeaders 
        tabs={tabs} 
        selectedTab={selectedTab} 
        onTabClick={handleTabClick} 
      />

      {/* Swipeable Content Area */}
      <div className="w-full overflow-hidden" ref={emblaRef}>
        <div className="flex">
          <div className="min-w-0 flex-[0_0_100%]">
            <FeaturedFeedWrapper 
              initialData={featuredData as { 
                entries: FeaturedEntryWithData[]; 
                totalEntries: number; 
              } | null}
            />
          </div>
          <div className="min-w-0 flex-[0_0_100%]">
            <RSSEntriesClient
              initialData={initialData as { 
                entries: RSSEntryWithData[]; 
                totalEntries: number; 
                hasMore: boolean; 
                postTitles?: string[]; 
              }}
              pageSize={pageSize}
            />
          </div>
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