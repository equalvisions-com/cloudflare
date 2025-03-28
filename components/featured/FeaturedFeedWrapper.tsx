'use client';

import React from 'react';
import { FeaturedFeedClient } from './FeaturedFeedClient';

// Define the interface for post metadata
interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
}

// Import the FeaturedEntry type
import type { FeaturedEntry } from "@/lib/featured_redis";

// Define the interface for featured entry with data
interface FeaturedEntryWithData {
  entry: FeaturedEntry;
  initialData: {
    likes: {
      isLiked: boolean;
      count: number;
    };
    comments: {
      count: number;
    };
    retweets?: {
      isRetweeted: boolean;
      count: number;
    };
  };
  postMetadata: PostMetadata;
}

interface FeaturedFeedWrapperProps {
  initialData: {
    entries: FeaturedEntryWithData[];
    totalEntries: number;
  } | null;
  isVisible?: boolean;
}

export function FeaturedFeedWrapper({ initialData, isVisible = true }: FeaturedFeedWrapperProps) {
  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No featured content available at the moment.</p>
        <p className="text-sm mt-2">Check back later for featured content.</p>
      </div>
    );
  }

  return (
    <FeaturedFeedClient
      initialData={initialData}
      pageSize={30}
      isVisible={isVisible}
    />
  );
} 