'use client';

import React, { useEffect, useRef, useState, useMemo, useTransition, useCallback } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import useSWRInfinite from 'swr/infinite';
import type { RSSItem } from "@/lib/rss";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useAudio } from '@/components/audio-player/AudioContext';
import { Headphones, Mail, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
}

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

const RSSEntry = ({ entryWithData: { entry, initialData }, featuredImg, postTitle, mediaType }: RSSEntryProps) => {
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (mediaType === 'podcast') {
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
          {featuredImg && (
            <div className="flex-shrink-0 w-14 h-14 relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={featuredImg}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                  loading="lazy"
                  priority={false}
                />
              </AspectRatio>
            </div>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              {postTitle && (
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-primary leading-tight">
                    {postTitle}
                  </h3>
                  <span 
                    className="text-base text-muted-foreground flex-shrink-0"
                    title={format(new Date(entry.pubDate), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {mediaType && (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                  {mediaType.toLowerCase() === 'podcast' && <Headphones className="h-3 w-3" />}
                  {mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" />}
                  {mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {mediaType === 'podcast' ? (
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

// Add a debounce utility function
const debounce = <F extends (...args: unknown[]) => unknown>(func: F, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<F>): ReturnType<F> | undefined => {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
    
    return undefined;
  };
};

// Feed content component
const FeedContent = React.memo(({ 
  paginatedEntries, 
  hasMore, 
  loadMoreRef, 
  isPending, 
  featuredImg, 
  postTitle, 
  mediaType,
  loadMore,
  entryMetrics
}: { 
  paginatedEntries: RSSEntryWithData[],
  hasMore: boolean,
  loadMoreRef: React.MutableRefObject<HTMLDivElement | null>,
  isPending: boolean,
  featuredImg?: string,
  postTitle?: string,
  mediaType?: string,
  loadMore: () => void,
  entryMetrics: Record<string, EntryMetrics> | null
}) => {
  // Debounce the loadMore function to prevent multiple calls
  const debouncedLoadMore = useMemo(() => debounce(loadMore, 300), [loadMore]);

  if (!paginatedEntries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in this feed.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <Virtuoso
        useWindowScroll
        totalCount={paginatedEntries.length}
        endReached={() => {
          if (hasMore && !isPending) {
            debouncedLoadMore();
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
              featuredImg={featuredImg}
              postTitle={postTitle}
              mediaType={mediaType}
            />
          );
        }}
        components={{
          Footer: () => 
            isPending && hasMore ? (
              <div ref={loadMoreRef} className="text-center py-4">Loading more entries...</div>
            ) : <div ref={loadMoreRef} className="h-0" />
        }}
      />
    </div>
  );
});
FeedContent.displayName = 'FeedContent';

interface RSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  };
  pageSize?: number;
  featuredImg?: string;
  mediaType?: string;
}

export function RSSFeedClientWithErrorBoundary(props: RSSFeedClientProps) {
  return (
    <ErrorBoundary>
      <RSSFeedClient {...props} />
    </ErrorBoundary>
  );
}

export function RSSFeedClient({ postTitle, feedUrl, initialData, pageSize = 10, featuredImg, mediaType }: RSSFeedClientProps) {
  const [isPending, startTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Increase the number of pages fetched per request to reduce API calls
  const PAGES_PER_FETCH = 3; // Fetch 3 pages at once instead of 1
  
  // Use a ref to track if we've already used the initial data
  const initialDataUsedRef = useRef(false);
  
  // Track if there are more entries to load
  const [hasMoreEntries, setHasMoreEntries] = useState(initialData.hasMore);
  
  // Fetch entries with pagination - using the same structure as server component
  // The correct endpoint for single feed entries is /api/rss/[postTitle]?feedUrl=...
  const { data, error, size, setSize } = useSWRInfinite(
    (pageIndex: number) => {
      // If this is the first page and we haven't used initial data yet,
      // we can skip fetching since we already have the data from the server
      if (pageIndex === 0 && !initialDataUsedRef.current) {
        initialDataUsedRef.current = true;
        console.log('📦 Using initial data for first page, skipping fetch');
        return null; // Return null to skip this request
      }
      
      // Calculate the actual page number based on our batching strategy
      // Ensure we always have a positive startPage value
      const startPage = Math.max(1, (pageIndex - 1) * PAGES_PER_FETCH + 1);
      
      let url = `/api/rss/${encodeURIComponent(postTitle)}?feedUrl=${encodeURIComponent(feedUrl)}&startPage=${startPage}&pageCount=${PAGES_PER_FETCH}&pageSize=${pageSize}`;
      
      // Add mediaType parameter if provided
      if (mediaType) {
        url += `&mediaType=${encodeURIComponent(mediaType)}`;
      }
      
      console.log(`🔍 SWR key generated for page ${pageIndex}: ${url}`);
      // Request multiple pages at once - no need for skipFirstPage parameter
      return url;
    },
    async (url: string) => {
      if (!url) {
        console.log('📄 Returning initial data for null URL');
        return initialData; // Return initial data if URL is null
      }
      
      console.log(`📡 Fetching data from: ${url}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch feed entries');
      const responseData = await res.json();
      
      // Update hasMore state based on API response
      setHasMoreEntries(responseData.hasMore);
      console.log(`✅ Fetched ${responseData.entries?.length || 0} entries, hasMore: ${responseData.hasMore}`);
      
      return responseData;
    },
    {
      fallbackData: [initialData], // Use server-provided initialData as first page
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      revalidateOnMount: false, // Prevent initial refetch
      dedupingInterval: 60000, // Deduplicate requests within 1 minute
      shouldRetryOnError: false, // Don't retry on error to prevent multiple requests
      focusThrottleInterval: 10000, // Throttle focus events
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
  
  // Use a single combined query to get metrics for all entries
  const combinedData = useQuery(
    api.entries.getFeedDataWithMetrics,
    entryGuids.length > 0 
      ? { entryGuids, feedUrls: [feedUrl] } 
      : "skip"
  );
  
  // Create a map of metrics keyed by entryGuid for easier lookup
  const entryMetricsMap = useMemo(() => {
    if (!combinedData || !combinedData.entryMetrics) return null;
    
    // Convert the metrics array to a map for O(1) lookups
    const metricsMap: Record<string, EntryMetrics> = {};
    combinedData.entryMetrics.forEach(item => {
      metricsMap[item.guid] = item.metrics;
    });
    
    return metricsMap;
  }, [combinedData]);
  
  // Track which URLs have already been prefetched to avoid duplicate requests
  const prefetchedUrlsRef = useRef<Set<string>>(new Set());
  
  // Track if we've done the initial prefetch
  const initialPrefetchDoneRef = useRef(false);
  
  // Prefetch the next batch of entries when approaching the end
  const prefetchNextBatch = useCallback(() => {
    if (data && hasMoreEntries) {
      const nextBatchIndex = size;
      
      // Don't skip the initial prefetch, but avoid redundant prefetches
      // Only skip if we're beyond the first page and have already loaded this batch
      if (nextBatchIndex > 1 && nextBatchIndex <= data.length) return;
      
      // Use the same calculation as in the key function with the same safety check
      const startPage = Math.max(1, (nextBatchIndex - 1) * PAGES_PER_FETCH + 1);
      let url = `/api/rss/${encodeURIComponent(postTitle)}?feedUrl=${encodeURIComponent(feedUrl)}&startPage=${startPage}&pageCount=${PAGES_PER_FETCH}&pageSize=${pageSize}`;
      
      // Add mediaType parameter if provided
      if (mediaType) {
        url += `&mediaType=${encodeURIComponent(mediaType)}`;
      }
      
      // Only prefetch if we haven't already prefetched this URL
      if (!prefetchedUrlsRef.current.has(url)) {
        console.log(`🔄 Prefetching next batch: ${url}`);
        prefetchedUrlsRef.current.add(url);
        // Prefetch the next batch but don't update state yet
        fetch(url).catch(() => {/* Silently handle prefetch errors */});
      }
    }
  }, [data, size, PAGES_PER_FETCH, pageSize, postTitle, feedUrl, hasMoreEntries, mediaType]);
  
  // Function to load more entries
  const loadMore = () => {
    if (hasMoreEntries && !isPending) {
      // Prevent multiple calls while loading
      if (loadMoreRef.current?.textContent === 'Loading more entries...') {
        console.log('⏳ Already loading more entries, skipping duplicate call');
        return;
      }
      
      console.log(`📥 Loading more entries, current size: ${size}`);
      startTransition(() => {
        setSize((s: number) => {
          const newSize = s + 1;
          console.log(`📈 Increasing size from ${s} to ${newSize}`);
          // Trigger prefetch of the next batch
          setTimeout(() => prefetchNextBatch(), 100); // Slight delay to ensure state is updated
          return newSize;
        });
      });
    }
  };
  
  // Prefetch the next batch of entries - no need for scroll listener
  // as Virtuoso's endReached will handle this
  useEffect(() => {
    // Initial prefetch - only run once on mount
    if (!initialPrefetchDoneRef.current) {
      console.log('🚀 Running initial prefetch');
      initialPrefetchDoneRef.current = true;
      prefetchNextBatch();
    }
  }, [prefetchNextBatch]);
  
  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading feed entries. Please try again later.
      </div>
    );
  }
  
  // Directly render the FeedContent component instead of using tabs
  return (
    <div className="w-full">
      <FeedContent
        paginatedEntries={paginatedEntries}
        hasMore={hasMoreEntries}
        loadMoreRef={loadMoreRef}
        isPending={isPending}
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
        loadMore={loadMore}
        entryMetrics={entryMetricsMap}
      />
    </div>
  );
}