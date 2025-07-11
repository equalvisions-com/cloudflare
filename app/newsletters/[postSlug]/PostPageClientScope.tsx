"use client";

import React from "react";
import { PostTabsWrapperWithSearch } from "./PostTabsWrapperWithSearch";
import type { NewsletterPostPageClientScopeProps } from "@/lib/types";

export const PostPageClientScope = React.memo(function PostPageClientScope({ 
  mediaType, 
  postTitle, 
  feedUrl, 
  rssData, 
  featuredImg, 
  verified 
}: NewsletterPostPageClientScopeProps) {
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