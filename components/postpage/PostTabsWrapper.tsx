'use client';

import React, { useMemo } from 'react';
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import { RSSFeedClient } from "@/components/postpage/RSSFeedClient";
import About from "@/components/postpage/about";
import type { RSSItem } from "@/lib/rss";

// Define interfaces based on those in RSSFeedClient
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

// Memoized component for the "Feed" tab content
const FeedTabContent = React.memo(({ 
  postTitle,
  feedUrl,
  rssData,
  featuredImg,
  mediaType
}: { 
  postTitle: string;
  feedUrl: string;
  rssData: PostTabsWrapperProps['rssData'];
  featuredImg?: string;
  mediaType?: string;
}) => {
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
    />
  );
});
FeedTabContent.displayName = 'FeedTabContent';

// Memoized component for the "About" tab content (renamed from Announcements)
const AboutTabContent = React.memo(({ 
  postTitle 
}: { 
  postTitle: string 
}) => {
  return <About postTitle={postTitle} />;
});
AboutTabContent.displayName = 'AboutTabContent';

export function PostTabsWrapper({ 
  postTitle, 
  feedUrl, 
  rssData, 
  featuredImg, 
  mediaType 
}: PostTabsWrapperProps) {
  // Memoize the tabs configuration to prevent unnecessary re-creation
  const tabs = useMemo(() => [
    // Feed tab - shows RSS feed content
    {
      id: 'feed',
      label: 'Feed',
      content: (
        <FeedTabContent 
          postTitle={postTitle} 
          feedUrl={feedUrl} 
          rssData={rssData}
          featuredImg={featuredImg}
          mediaType={mediaType}
        />
      )
    },
    // About tab (renamed from Announcements)
    {
      id: 'about',
      label: 'About',
      content: <AboutTabContent postTitle={postTitle} />
    }
  ], [postTitle, feedUrl, rssData, featuredImg, mediaType]);

  return (
    <div className="w-full">
      <SwipeableTabs tabs={tabs} />
    </div>
  );
}

// Use React.memo for the error boundary wrapper to prevent unnecessary re-renders
export const PostTabsWrapperWithErrorBoundary = React.memo(
  (props: PostTabsWrapperProps) => {
    return (
      <React.Fragment>
        <PostTabsWrapper {...props} />
      </React.Fragment>
    );
  }
);
PostTabsWrapperWithErrorBoundary.displayName = 'PostTabsWrapperWithErrorBoundary'; 