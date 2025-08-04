"use client";

import React from "react";
import { PostTabsWrapperWithSearch } from "./PostTabsWrapperWithSearch";
import type { PostPageClientScopeProps } from "@/lib/types";

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