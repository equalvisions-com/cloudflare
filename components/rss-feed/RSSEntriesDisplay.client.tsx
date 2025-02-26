'use client';

import React, { useEffect, useRef, useState, useMemo, useTransition, useCallback } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { RSSItem } from "@/lib/redis";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';
import { Headphones, Mail, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SwipeableTabs } from "@/components/ui/swipeable-tabs";
import dynamic from 'next/dynamic';
import useSWRInfinite from 'swr/infinite';
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Dynamically import the placeholder component with no SSR
// This ensures it's not loaded during initial page render
const RSSPlaceholder = dynamic(
  () => import('@/components/rss-feed/placeholder'),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-secondary/20"></div> }
);

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
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    categorySlug?: string;
    postSlug?: string;
  };
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
}

// Add the MoreOptionsDropdown component before the RSSEntry component
interface MoreOptionsDropdownProps {
  entry: RSSItem;
}

const MoreOptionsDropdown = ({ entry }: MoreOptionsDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="px-0 hover:bg-transparent -mr-2 focus-visible:ring-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => window.open(entry.link, '_blank')}
          className="cursor-pointer"
        >
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => navigator.clipboard.writeText(entry.link)}
          className="cursor-pointer"
        >
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => window.open(`mailto:?subject=${encodeURIComponent(entry.title)}&body=${encodeURIComponent(entry.link)}`, '_blank')}
          className="cursor-pointer"
        >
          Email this
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const RSSEntry = ({ entryWithData: { entry, initialData, postMetadata } }: RSSEntryProps) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Format the timestamp based on age
  const timestamp = useMemo(() => {
    const pubDate = new Date(entry.pubDate);
    const now = new Date();
    const diffInMs = now.getTime() - pubDate.getTime();
    const diffInMinutes = diffInMs / (1000 * 60);
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;
    const diffInMonths = diffInDays / 30;
    
    if (diffInMinutes < 60) {
      // Less than an hour: show minutes
      const mins = Math.floor(diffInMinutes);
      return `${mins}${mins === 1 ? 'min' : 'mins'}`;
    } else if (diffInHours < 24) {
      // Less than a day: show hours
      const hrs = Math.floor(diffInHours);
      return `${hrs}${hrs === 1 ? 'hr' : 'hrs'}`;
    } else if (diffInDays < 30) {
      // Less than a month: show days
      const days = Math.floor(diffInDays);
      return `${days}${days === 1 ? 'd' : 'd'}`;
    } else {
      // More than a month: show months
      const months = Math.floor(diffInMonths);
      return `${months}${months === 1 ? 'mo' : 'mo'}`;
    }
  }, [entry.pubDate]);

  // Generate post URL
  const postUrl = postMetadata.categorySlug && postMetadata.postSlug 
    ? `/${postMetadata.categorySlug}/${postMetadata.postSlug}`
    : null;

  const handleCardClick = (e: React.MouseEvent) => {
    if (postMetadata.mediaType === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image);
    }
  };

  return (
    <article>
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-start gap-4 mb-4">
          {/* Featured Image */}
          {postMetadata.featuredImg && postUrl && (
            <Link href={postUrl} className="flex-shrink-0 w-14 h-14 relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={postMetadata.featuredImg}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                  loading="lazy"
                  priority={false}
                />
              </AspectRatio>
            </Link>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              {postMetadata.title && postUrl && (
                <div className="flex items-center justify-between gap-2">
                  <Link href={postUrl} className="hover:opacity-80 transition-opacity">
                    <h3 className="text-base font-semibold text-primary leading-tight">
                      {postMetadata.title}
                    </h3>
                  </Link>
                  <span 
                    className="text-base text-muted-foreground flex-shrink-0"
                    title={format(new Date(entry.pubDate), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {postMetadata.mediaType && (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                  {postMetadata.mediaType.toLowerCase() === 'podcast' && <Headphones className="h-3 w-3" />}
                  {postMetadata.mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" />}
                  {postMetadata.mediaType.charAt(0).toUpperCase() + postMetadata.mediaType.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {postMetadata.mediaType === 'podcast' ? (
          <div>
            <div 
              onClick={handleCardClick}
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
            >
              <Card className={`overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                {entry.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={16/9}>
                      <Image
                        src={entry.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 768px"
                        loading="lazy"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <CardContent className="p-4 bg-secondary/60 border-t">
                  <h3 className="text-lg font-semibold leading-tight">
                    {decode(entry.title)}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {decode(entry.description)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-80 transition-opacity"
          >
            <Card className="overflow-hidden shadow-none">
              {entry.image && (
                <CardHeader className="p-0">
                  <AspectRatio ratio={16/9}>
                    <Image
                      src={entry.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 768px"
                      loading="lazy"
                      priority={false}
                    />
                  </AspectRatio>
                </CardHeader>
              )}
              <CardContent className="p-4 bg-secondary/60 border-t">
                <h3 className="text-lg font-semibold leading-tight">
                  {decode(entry.title)}
                </h3>
                {entry.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {decode(entry.description)}
                  </p>
                )}
              </CardContent>
            </Card>
          </a>
        )}
        
        {/* Horizontal Interaction Buttons */}
        <div className="flex justify-between items-center mt-4 h-[16px]">
          <div>
            <LikeButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={initialData.likes}
            />
          </div>
          <div>
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              initialData={initialData.comments}
            />
          </div>
          <div>
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={initialData.retweets || { isRetweeted: false, count: 0 }}
            />
          </div>
          <div>
            <ShareButtonClient
              url={entry.link}
              title={entry.title}
            />
          </div>
          <div className="flex justify-end">
            <MoreOptionsDropdown entry={entry} />
          </div>
        </div>
      </div>
      
      {/* Comments Section */}
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
};

interface RSSEntriesClientProps {
  initialData: {
    entries: RSSEntryWithData[];
  };
  pageSize?: number;
}

// Define a proper type for entry metrics
interface EntryMetrics {
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
}

// Memoized feed content component
const EntriesContent = React.memo(({ 
  paginatedEntries, 
  hasMore, 
  loadMoreRef, 
  isPending,
  loadMore,
  entryMetrics
}: { 
  paginatedEntries: RSSEntryWithData[],
  hasMore: boolean,
  loadMoreRef: React.MutableRefObject<HTMLDivElement | null>,
  isPending: boolean,
  loadMore: () => void,
  entryMetrics: Record<string, EntryMetrics> | null
}) => {
  if (!paginatedEntries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in your RSS feeds.
      </div>
    );
  }

  return (
    <div className="border-l border-r border-b">
      <Virtuoso
        useWindowScroll
        totalCount={paginatedEntries.length}
        endReached={() => {
          if (hasMore && !isPending) {
            loadMore();
          }
        }}
        overscan={20}
        initialTopMostItemIndex={0}
        itemContent={index => {
          const entryWithData = paginatedEntries[index];
          // If we have metrics from the batch query, use them to update the entry data
          if (entryMetrics && entryMetrics[entryWithData.entry.guid]) {
            const metrics = entryMetrics[entryWithData.entry.guid];
            entryWithData.initialData = {
              ...entryWithData.initialData,
              likes: metrics.likes,
              comments: metrics.comments,
              retweets: metrics.retweets
            };
          }
          return (
            <RSSEntry
              entryWithData={entryWithData}
            />
          );
        }}
        components={{
          Footer: () => 
            isPending && hasMore ? (
              <div ref={loadMoreRef} className="text-center py-4">Loading more entries...</div>
            ) : <div ref={loadMoreRef} className="h-10" />
        }}
      />
    </div>
  );
});
EntriesContent.displayName = 'EntriesContent';

export function RSSEntriesClientWithErrorBoundary(props: RSSEntriesClientProps) {
  return (
    <ErrorBoundary>
      <RSSEntriesClient {...props} />
    </ErrorBoundary>
  );
}

export function RSSEntriesClient({ initialData, pageSize = 10 }: RSSEntriesClientProps) {
  const [isPending, startTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Increase the number of pages fetched per request to reduce API calls
  const PAGES_PER_FETCH = 3; // Fetch 3 pages at once instead of 1
  
  // Use a ref to track if we've already used the initial data
  const initialDataUsedRef = useRef(false);
  
  // Fetch entries with pagination - using the same structure as server component
  // The correct endpoint for merged entries is /api/rss (not /api/rss/entries)
  const { data, error, size, setSize } = useSWRInfinite(
    (pageIndex: number) => {
      // If this is the first page and we haven't used initial data yet,
      // we can skip fetching since we already have the data from the server
      if (pageIndex === 0 && !initialDataUsedRef.current) {
        initialDataUsedRef.current = true;
        return null; // Return null to skip this request
      }
      
      // Calculate the actual page number based on our batching strategy
      // Ensure we always have a positive startPage value
      const startPage = Math.max(1, (pageIndex - 1) * PAGES_PER_FETCH + 1);
      
      // Request multiple pages at once - no need for skipFirstPage parameter
      return `/api/rss?startPage=${startPage}&pageCount=${PAGES_PER_FETCH}&pageSize=${pageSize}`;
    },
    async (url: string) => {
      if (!url) return initialData; // Return initial data if URL is null
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch entries');
      return res.json();
    },
    {
      fallbackData: [initialData], // Use server-provided initialData as first page
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      revalidateOnMount: false, // Prevent initial refetch
    }
  );
  
  // Flatten paginated entries - preserving the structure from server
  const paginatedEntries = useMemo(() => {
    if (!data) return [];
    
    // Make sure we always include the initial data (first 10 entries)
    // Create a map to track entries by guid for deduplication
    const entriesMap = new Map<string, RSSEntryWithData>();
    
    // First, add the initial entries to ensure they're always included
    if (initialData && initialData.entries) {
      initialData.entries.forEach((entry: RSSEntryWithData) => {
        entriesMap.set(entry.entry.guid, entry);
      });
    }
    
    // Then add all entries from the fetched data
    data.forEach(page => {
      if (page.entries) {
        page.entries.forEach((entry: RSSEntryWithData) => {
          entriesMap.set(entry.entry.guid, entry);
        });
      }
    });
    
    // Convert back to array and sort by publication date (newest first)
    return Array.from(entriesMap.values())
      .sort((a, b) => new Date(b.entry.pubDate).getTime() - new Date(a.entry.pubDate).getTime());
  }, [data, initialData]);
  
  // Extract all entry GUIDs for batch query
  const entryGuids = useMemo(() => {
    return paginatedEntries.map((entry: RSSEntryWithData) => entry.entry.guid);
  }, [paginatedEntries]);
  
  // Create a map of already fetched metrics to avoid redundant queries
  const [fetchedMetricsMap, setFetchedMetricsMap] = useState<Record<string, EntryMetrics>>({});
  
  // Only fetch metrics for entries that don't already have up-to-date metrics
  const entriesNeedingMetrics = useMemo(() => {
    return entryGuids.filter(guid => !fetchedMetricsMap[guid]);
  }, [entryGuids, fetchedMetricsMap]);
  
  // Use a ref to track already prefetched URLs to prevent duplicate prefetches
  const prefetchedUrlsRef = useRef<Set<string>>(new Set());
  
  // Modified prefetch function that prevents duplicate prefetches
  const prefetchWithoutDuplicates = useCallback(() => {
    if (data && data.length > 0) {
      const nextBatchIndex = size;
      // Use the same calculation as in the key function with the same safety check
      const startPage = Math.max(1, (nextBatchIndex - 1) * PAGES_PER_FETCH + 1);
      const url = `/api/rss?startPage=${startPage}&pageCount=${PAGES_PER_FETCH}&pageSize=${pageSize}`;
      
      // Only prefetch if we haven't already prefetched this URL
      if (!prefetchedUrlsRef.current.has(url)) {
        prefetchedUrlsRef.current.add(url);
        // Prefetch the next batch but don't update state yet
        fetch(url).catch(() => {/* Silently handle prefetch errors */});
      }
    }
  }, [data, size, PAGES_PER_FETCH, pageSize]);
  
  // This effect runs only once on initial render
  useEffect(() => {
    // Initial prefetch
    prefetchWithoutDuplicates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this only runs once
  
  // This effect runs when the size changes to prefetch the next batch
  useEffect(() => {
    if (size > 1) { // Only prefetch after the first page
      prefetchWithoutDuplicates();
    }
  }, [size, prefetchWithoutDuplicates]);
  
  // Use a single batch query to get metrics for all entries
  // We're using a larger batch size to reduce the number of queries
  const batchMetrics = useQuery(
    api.entries.batchGetEntryData,
    entriesNeedingMetrics.length > 0 ? { entryGuids: entriesNeedingMetrics } : "skip"
  );
  
  // Update the fetched metrics map when new metrics are received
  useEffect(() => {
    if (batchMetrics && entriesNeedingMetrics.length > 0) {
      const newMetricsMap = { ...fetchedMetricsMap };
      
      batchMetrics.forEach((metrics: EntryMetrics, index: number) => {
        if (index < entriesNeedingMetrics.length) {
          newMetricsMap[entriesNeedingMetrics[index]] = metrics;
        }
      });
      
      setFetchedMetricsMap(newMetricsMap);
    }
  }, [batchMetrics, entriesNeedingMetrics, fetchedMetricsMap]);
  
  // Convert array of metrics to a map keyed by entryGuid for easier lookup
  const entryMetricsMap = useMemo(() => {
    return fetchedMetricsMap;
  }, [fetchedMetricsMap]);
  
  // Check if there are more entries to load
  const hasMore = useMemo(() => {
    if (!data) return false;
    const lastPage = data[data.length - 1];
    return lastPage.hasMore;
  }, [data]);
  
  // Function to load more entries
  const loadMore = () => {
    if (hasMore && !isPending) {
      startTransition(() => {
        setSize((s: number) => s + 1);
        // Trigger prefetch of the next batch
        prefetchWithoutDuplicates();
      });
    }
  };
  
  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading entries. Please try again later.
      </div>
    );
  }
  
  // Tabs configuration
  const tabs = [
    {
      id: 'for-you',
      label: 'Discover',
      content: (
        <EntriesContent
          paginatedEntries={paginatedEntries}
          hasMore={hasMore}
          loadMoreRef={loadMoreRef}
          isPending={isPending}
          loadMore={loadMore}
          entryMetrics={entryMetricsMap}
        />
      ),
    },
    {
      id: 'following',
      label: 'Following',
      content: (
        <React.Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
          <RSSPlaceholder />
        </React.Suspense>
      ),
    },
  ];
  
  return (
    <div className="w-full">
      <SwipeableTabs tabs={tabs} />
    </div>
  );
} 