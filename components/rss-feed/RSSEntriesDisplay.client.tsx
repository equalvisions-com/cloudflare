'use client';

import { Card } from "@/components/ui/card";
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

interface RSSEntriesClientProps {
  initialData: {
    entries: RSSEntryWithData[];
  };
  pageSize?: number;
}

export function RSSEntriesClient({ initialData, pageSize = 10 }: RSSEntriesClientProps) {
  const [isPending, startTransition] = useTransition();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(1);

  // Keep a reference to the initial data for likes and comments
  const initialDataMap = useRef<Map<string, RSSEntryWithData['initialData']>>(new Map());
  
  // Initialize the map with first page data
  useEffect(() => {
    initialData.entries.forEach((entryWithData) => {
      initialDataMap.current.set(entryWithData.entry.guid, entryWithData.initialData);
    });
  }, [initialData]);

  const { data: allEntries, isLoading } = useSWR<{
    entries: RSSEntryWithData[];
    totalEntries: number;
  }>(
    '/api/rss',
    async (url: string) => {
      const res = await fetch(url, {
        next: {
          revalidate: 60 // Revalidate every minute
        }
      });
      if (!res.ok) throw new Error('Failed to fetch RSS entries');
      const data = await res.json();

      // Get entries that need state fetching
      const newGuids = data.entries
        .filter((entry: RSSItem) => !initialDataMap.current.has(entry.guid))
        .map((entry: RSSItem) => entry.guid);

      if (newGuids.length > 0) {
        // Batch fetch states for new entries
        const batchRes = await fetch('/api/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guids: newGuids }),
        });

        if (batchRes.ok) {
          const { entries: batchData } = await batchRes.json();
          // Store in our map
          Object.entries(batchData).forEach(([guid, data]) => {
            initialDataMap.current.set(guid, data as RSSEntryWithData['initialData']);
          });
        }
      }

      // Map entries with their states
      const entriesWithData = data.entries.map((entry: RSSItem) => ({
        entry,
        initialData: initialDataMap.current.get(entry.guid) || {
          likes: { isLiked: false, count: 0 },
          comments: { count: 0 },
        },
      }));
      
      return {
        entries: entriesWithData,
        totalEntries: data.totalEntries
      };
    },
    {
      fallbackData: { entries: initialData.entries, totalEntries: initialData.entries.length },
      revalidateOnFocus: true,   // Revalidate on focus to catch new entries
      revalidateOnReconnect: true, // Revalidate on reconnect to catch new entries
      dedupingInterval: 60 * 1000, // Cache for 1 minute
    }
  );

  // Handle pagination locally with transition
  const paginatedEntries = useMemo(() => {
    if (!allEntries?.entries) return [];
    return allEntries.entries.slice(0, size * pageSize);
  }, [allEntries, size, pageSize]);

  const hasMore = allEntries?.entries && paginatedEntries.length < allEntries.entries.length;

  useEffect(() => {
    if (loadMoreRef.current && !isLoading && hasMore) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            startTransition(() => {
              setSize(s => s + 1);
            });
          }
        },
        { threshold: 1.0 }
      );
      observerRef.current.observe(loadMoreRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [isLoading, hasMore]);

  if (!paginatedEntries.length && !isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in your RSS feeds.
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
        {(isLoading || isPending) && hasMore && (
          <div className="text-center py-4">Loading new entries...</div>
        )}
      </div>
    </div>
  );
} 