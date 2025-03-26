'use client';

import React from 'react';
import { RSSEntriesClientWithErrorBoundary } from './RSSEntriesDisplay.client';

// Define the interfaces needed from the original component
interface RSSItem {
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

interface RSSEntriesClientProps {
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
  };
  pageSize?: number;
}

export function RSSEntriesClient({
  initialData,
  pageSize = 30
}: RSSEntriesClientProps) {
  return (
    <RSSEntriesClientWithErrorBoundary
      initialData={initialData}
      pageSize={pageSize}
    />
  );
} 