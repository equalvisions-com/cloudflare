'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { SkeletonFeed } from "@/components/ui/skeleton-feed";
import type { RSSItem } from "@/lib/rss";

// Dynamically import RSSFeedClient with loading skeleton
const RSSFeedClient = dynamic(
  () => import("@/components/postpage/RSSFeedClient").then(mod => mod.RSSFeedClient),
  {
    ssr: false,
    loading: () => <SkeletonFeed count={3} />
  }
);

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
  verified?: boolean;
}

// Define props for FeedTabContent (removed isActive)
interface FeedTabContentProps {
  postTitle: string;
  feedUrl: string;
  rssData: PostTabsWrapperProps['rssData'];
  featuredImg?: string;
  mediaType?: string;
  verified?: boolean;
}

// Separated out as a standalone component
const FeedTabContent = React.memo(({ 
  postTitle,
  feedUrl,
  rssData,
  featuredImg,
  mediaType,
  verified
}: FeedTabContentProps) => {
  if (!rssData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <SkeletonFeed count={3} />
      </div>
    );
  }

  return (
    <RSSFeedClient
      key={`feed-client-default`}
      postTitle={postTitle}
      feedUrl={feedUrl}
      initialData={rssData}
      featuredImg={featuredImg}
      mediaType={mediaType}
      verified={verified}
    />
  );
});
FeedTabContent.displayName = 'FeedTabContent';

export function PostTabsWrapper({ 
  postTitle, 
  feedUrl, 
  rssData, 
  featuredImg, 
  mediaType,
  verified
}: PostTabsWrapperProps) {
  const contentKey = `feed-content-default`;
  
  return (
    <div className="w-full">
      <FeedTabContent 
        key={contentKey}
        postTitle={postTitle} 
        feedUrl={feedUrl} 
        rssData={rssData}
        featuredImg={featuredImg}
        mediaType={mediaType}
        verified={verified}
      />
    </div>
  );
} 