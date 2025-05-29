"use client";

import { PostTabsWrapperWithSearch } from "./PostTabsWrapperWithSearch";
import { ReactNode } from "react";

interface PostPageClientScopeProps {
  title: string;
  mediaType?: string;
  postTitle: string;
  feedUrl: string;
  rssData: {
    entries: any[];
    totalEntries: number;
    hasMore: boolean;
  } | null;
  featuredImg?: string;
  verified?: boolean;
}

export function PostPageClientScope({ 
  title, 
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
} 