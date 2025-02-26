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
        <Suspense>
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