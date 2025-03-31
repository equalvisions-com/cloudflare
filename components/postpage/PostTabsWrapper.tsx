'use client';

import React, { useMemo } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { RSSFeedClient } from "@/components/postpage/RSSFeedClient";
import type { RSSItem } from "@/lib/rss";

// Define RSSEntryWithData interface (consider moving to a shared types file)
interface RSSEntryWithData {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
}

// Define props for the tabs wrapper
interface PostTabsWrapperProps {
  postTitle: string;
  feedUrl: string;
  rssData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null;
  featuredImg?: string;
  mediaType?: string;
}

// Define props for FeedTabContent including isActive
interface FeedTabContentProps {
  postTitle: string;
  feedUrl: string;
  rssData: PostTabsWrapperProps['rssData'];
  featuredImg?: string;
  mediaType?: string;
  isActive: boolean; // Add isActive prop
}

// Separated out as a standalone component
const FeedTabContent = React.memo(({ 
  postTitle,
  feedUrl,
  rssData,
  featuredImg,
  mediaType,
  isActive // Destructure isActive prop
}: FeedTabContentProps) => {
  if (!rssData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No RSS feed entries found for this podcast.</p>
        <p className="text-sm mt-2">Please check back later or contact the podcast owner.</p>
      </div>
    );
  }

  return (
    <RSSFeedClient
      postTitle={postTitle}
      feedUrl={feedUrl}
      initialData={rssData}
      featuredImg={featuredImg}
      mediaType={mediaType}
      isActive={isActive} // Pass isActive down to RSSFeedClient
    />
  );
});
FeedTabContent.displayName = 'FeedTabContent';

export function PostTabsWrapper({ 
  postTitle, 
  feedUrl, 
  rssData, 
  featuredImg, 
  mediaType 
}: PostTabsWrapperProps) {
  // Memoize the tabs configuration to prevent unnecessary re-creation
  const tabs = useMemo(() => [
    // Dynamic tab label based on mediaType
    {
      id: 'feed',
      label: mediaType === 'podcast' ? 'Episodes' : mediaType === 'newsletter' ? 'Newsletters' : 'Feed',
      component: ({ isActive }: { isActive: boolean }) => (
        <FeedTabContent 
          postTitle={postTitle} 
          feedUrl={feedUrl} 
          rssData={rssData}
          featuredImg={featuredImg}
          mediaType={mediaType}
          isActive={isActive} // Pass isActive from SwipeableTabs to FeedTabContent
        />
      )
    }
  ], [postTitle, feedUrl, rssData, featuredImg, mediaType]);

  return (
    <div className="w-full">
      <SwipeableTabs tabs={tabs} />
    </div>
  );
}

// Use React.memo for the entire component to prevent unnecessary re-renders
export const PostTabsWrapperWithErrorBoundary = React.memo(PostTabsWrapper);
PostTabsWrapperWithErrorBoundary.displayName = 'PostTabsWrapperWithErrorBoundary'; 