"use client";

import { useState, useMemo, Suspense } from "react";
import { CollapsibleSidebarWithErrorBoundary } from "./CollapsibleSidebar";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { RSSEntriesClient } from "@/components/rss-feed/RSSEntriesDisplay.client";
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

// Simple Skeleton component
function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />;
}

interface EntryData {
  entry: {
    guid: string;
    title: string;
    link: string;
    pubDate: string;
    feedUrl: string;
  };
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
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    postSlug: string;
    categorySlug: string;
  };
}

interface InitialData {
  entries: EntryData[];
  totalEntries: number;
  hasMore: boolean;
  postTitles?: string[];
}

interface LayoutManagerClientProps {
  initialData: InitialData | null;
}

// Loading skeleton for the feed
function FeedSkeleton() {
  return (
    <div className="space-y-4 py-4">
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="flex flex-col space-y-3 p-4 border rounded-lg">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <div className="flex space-x-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

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

export function LayoutManagerClientWithErrorBoundary(props: LayoutManagerClientProps) {
  return (
    <ErrorBoundary>
      <LayoutManagerClient {...props} />
    </ErrorBoundary>
  );
}

export function LayoutManagerClient({ initialData }: LayoutManagerClientProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const mainContentClass = useMemo(() => {
    return `w-full ${sidebarCollapsed ? "md:w-[62%]" : "md:w-[56%]"}`;
  }, [sidebarCollapsed]);

  const rightSidebarClass = useMemo(() => {
    return `hidden md:block ${sidebarCollapsed ? "md:w-[29%]" : "md:w-[26%]"}`;
  }, [sidebarCollapsed]);

  return (
    <div className="container flex flex-col md:flex-row h-screen md:gap-6 p-0 md:px-6">
      <div className="hidden md:block">
        <CollapsibleSidebarWithErrorBoundary onCollapse={setSidebarCollapsed} />
      </div>
      <main className={mainContentClass}>
        <Suspense fallback={<FeedSkeleton />}>
          <ReactErrorBoundary FallbackComponent={FeedErrorFallback}>
            {!initialData ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No entries found. Please sign in and add some RSS feeds to get started.</p>
                <p className="text-sm mt-2">If you&apos;ve already added feeds, try refreshing the page.</p>
              </div>
            ) : (
              <RSSEntriesClient
                initialData={initialData}
                pageSize={30}
              />
            )}
          </ReactErrorBoundary>
        </Suspense>
      </main>
      <RightSidebar className={rightSidebarClass} />
    </div>
  );
} 