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
    return sidebarCollapsed ? "w-[62%]" : "w-[56%]";
  }, [sidebarCollapsed]);

  const rightSidebarClass = useMemo(() => {
    return sidebarCollapsed ? "w-[29%]" : "w-[26%]";
  }, [sidebarCollapsed]);

  return (
    <div className="container flex h-screen gap-6">
      <CollapsibleSidebarWithErrorBoundary onCollapse={setSidebarCollapsed} />
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