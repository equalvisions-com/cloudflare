'use client';

import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import { decode } from 'html-entities';
import { useEffect, useRef, useState, useMemo, useTransition } from 'react';
import useSWR from 'swr';
import type { RSSItem } from "@/lib/redis";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";

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
  };
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
}

const RSSEntry = ({ entryWithData: { entry, initialData } }: RSSEntryProps) => (
  <Card key={entry.guid} className="overflow-hidden">
    <div className="group-hover:bg-muted/50 rounded-lg transition-colors group">
      <article className="p-4">
        <div className="flex gap-4">
          {entry.image && (
            <div className="flex-shrink-0 w-24 h-24 relative rounded-md overflow-hidden">
              <Image
                src={entry.image}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
                loading="lazy"
                priority={false}
              />
            </div>
          )}
          <div className="flex-grow min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <a
                href={entry.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block flex-grow"
              >
                <h3 className="text-lg font-medium group-hover:text-primary transition-colors">
                  {decode(entry.title)}
                </h3>
              </a>
            </div>
            {entry.description && (
              <p className="text-muted-foreground line-clamp-2">
                {decode(entry.description)}
              </p>
            )}
            <div className="text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <LikeButtonClient
                    entryGuid={entry.guid}
                    feedUrl={entry.feedUrl}
                    title={entry.title}
                    pubDate={entry.pubDate}
                    link={entry.link}
                    initialData={initialData.likes}
                  />
                  <CommentSectionClient
                    entryGuid={entry.guid}
                    feedUrl={entry.feedUrl}
                    initialData={initialData.comments}
                  />
                </div>
                <time 
                  dateTime={entry.pubDate}
                  title={format(new Date(entry.pubDate), 'PPP p')}
                >
                  {formatDistanceToNow(new Date(entry.pubDate), { addSuffix: true })}
                </time>
              </div>
            </div>
          </div>
        </div>
      </article>
      <div id={`comments-${entry.guid}`} className="border-t border-muted" />
    </div>
  </Card>
);

interface RSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  initialData: {
    entries: RSSEntryWithData[];
  };
  pageSize?: number;
}

export function RSSFeedClientWithErrorBoundary(props: RSSFeedClientProps) {
  return (
    <ErrorBoundary>
      <RSSFeedClient {...props} />
    </ErrorBoundary>
  );
}

export function RSSFeedClient({ postTitle, feedUrl, initialData, pageSize = 10 }: RSSFeedClientProps) {
  const [isPending, startTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(1);
  
  const { data: allEntries } = useSWR<{
    entries: RSSEntryWithData[];
    totalEntries: number;
  }>(
    `/api/rss/${encodeURIComponent(postTitle)}`,
    async (url: string) => {
      const res = await fetch(`${url}?feedUrl=${encodeURIComponent(feedUrl)}`, {
        next: {
          revalidate: 300 // Revalidate every 5 minutes
        }
      });
      if (!res.ok) throw new Error('Failed to fetch RSS entries');
      const data = await res.json();
      return {
        entries: data.entries,
        totalEntries: data.entries.length
      };
    },
    {
      fallbackData: {
        entries: initialData.entries,
        totalEntries: initialData.entries.length
      },
      revalidateOnFocus: false,    // Don't revalidate on focus
      revalidateOnReconnect: true, // Keep revalidating on reconnect to catch new entries
      dedupingInterval: 300 * 1000, // Cache for 5 minutes
      revalidateOnMount: false,    // Don't revalidate immediately on mount
      refreshInterval: 300 * 1000,  // Only refresh every 5 minutes
    }
  );

  // Handle pagination locally with transition
  const paginatedEntries = useMemo(() => {
    const entries = allEntries?.entries || [];
    return entries.slice(0, size * pageSize);
  }, [allEntries?.entries, size, pageSize]);

  const hasMore = allEntries?.entries && paginatedEntries.length < allEntries.entries.length;

  // Reset size when feed changes
  useEffect(() => {
    setSize(1);
  }, [feedUrl]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startTransition(() => {
            setSize(s => s + 1);
          });
        }
      },
      { threshold: 0.1 } // Lower threshold for earlier loading
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [hasMore]);

  if (!paginatedEntries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in this feed.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {paginatedEntries.map((entryWithData) => (
        <RSSEntry
          key={entryWithData.entry.guid}
          entryWithData={entryWithData}
        />
      ))}
      <div ref={loadMoreRef} className="h-10">
        {isPending && hasMore && (
          <div className="text-center py-4">Loading more entries...</div>
        )}
      </div>
    </div>
  );
}