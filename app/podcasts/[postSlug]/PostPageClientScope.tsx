"use client";

import React from "react";
import { PostTabsWrapperWithSearch } from "./PostTabsWrapperWithSearch";
import type { RSSItem } from "@/lib/rss";

// Define RSSEntryWithData interface for type safety
interface RSSEntryWithData {
  entry: RSSItem;
  initialData: {
    likes: { isLiked: boolean; count: number };
    comments: { count: number };
    retweets?: { isRetweeted: boolean; count: number };
  };
}

interface PostPageClientScopeProps {
  mediaType?: string;
  postTitle: string;
  feedUrl: string;
  rssData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  } | null;
  featuredImg?: string;
  verified?: boolean;
}

export const PostPageClientScope = React.memo(function PostPageClientScope({ 
  mediaType, 
  postTitle, 
  feedUrl, 
  rssData, 
  featuredImg, 
  verified 
}: PostPageClientScopeProps) {
  return (
    <PostTabsWrapperWithSearch
      postTitle={postTitle}
      feedUrl={feedUrl}
      rssData={rssData}
      featuredImg={featuredImg}
      mediaType={mediaType}
      verified={verified}
    />
  );
}); 