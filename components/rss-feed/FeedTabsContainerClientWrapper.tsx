"use client";

import { Suspense } from "react";
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { FeedTabsContainerWithErrorBoundary } from "./FeedTabsContainer";
import type { FeaturedEntry } from "@/lib/featured_redis";

// Error fallback component
function FeedErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="text-center py-8 text-destructive">
      <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
      <p className="mb-4">{error.message}</p>
      <button 
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}

// Define the RSSItem interface to match what's returned from the API
interface RSSItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  feedUrl: string;
  feedTitle?: string;
  [key: string]: unknown; // For any additional properties
}

// Interface for post metadata
interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
}

// Interface for entry with data
interface RSSEntryWithData {
  entry: RSSItem;
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
  postMetadata?: PostMetadata;
}

// Interface for featured entry with data
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

interface InitialData {
  entries: RSSEntryWithData[];
  totalEntries: number;
  hasMore: boolean;
  postTitles?: string[];
}

interface FeaturedData {
  entries: FeaturedEntryWithData[];
  totalEntries: number;
}

interface FeedTabsContainerClientWrapperProps {
  initialData: InitialData | null;
  featuredData?: FeaturedData | null;
  pageSize: number;
}

/**
 * Client component wrapper for FeedTabsContainer to handle client-side functionality
 * like error boundaries and Suspense
 */
export function FeedTabsContainerClientWrapper({ 
  initialData, 
  featuredData, 
  pageSize
}: FeedTabsContainerClientWrapperProps) {
  return (
    <Suspense fallback={null}>
      <ReactErrorBoundary FallbackComponent={FeedErrorFallback}>
        <div className="pb-safe">
          <FeedTabsContainerWithErrorBoundary
            initialData={initialData}
            featuredData={featuredData}
            pageSize={pageSize}
          />
        </div>
      </ReactErrorBoundary>
    </Suspense>
  );
} 