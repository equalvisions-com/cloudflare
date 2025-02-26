"use client";

import { useState, useMemo, Suspense } from "react";
import { CollapsibleSidebarWithErrorBoundary } from "./CollapsibleSidebar";
import { RightSidebar } from "@/components/homepage/RightSidebar";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { RSSEntriesClient } from "@/components/rss-feed/RSSEntriesDisplay.client";

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
}

interface LayoutManagerClientProps {
  initialData: InitialData | null;
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
        <Suspense 
          fallback={
            <div className="animate-pulse space-y-8">
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-24 w-24 bg-muted rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          {!initialData ? (
            <div className="text-center py-8 text-muted-foreground">
              No entries found. Please sign in and add some RSS feeds to get started.
            </div>
          ) : (
            <RSSEntriesClient
              initialData={initialData}
              pageSize={10}
            />
          )}
        </Suspense>
      </main>
      <RightSidebar className={rightSidebarClass} />
    </div>
  );
} 