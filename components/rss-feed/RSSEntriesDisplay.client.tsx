'use client';

import React, { useEffect, useRef, useState, useMemo, useTransition, useCallback } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { RSSItem } from "@/lib/rss";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';
import { Headphones, Mail, MoreVertical, Loader } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import useSWRInfinite from 'swr/infinite';
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Add a consistent logging utility
const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📋 ${message}`, data !== undefined ? data : '');
    }
  },
  info: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`ℹ️ ${message}`, data !== undefined ? data : '');
    }
  },
  warn: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️ ${message}`, data !== undefined ? data : '');
    }
  },
  error: (message: string, error?: unknown) => {
    console.error(`❌ ${message}`, error !== undefined ? error : '');
  }
};

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

// Add these type definitions near the top of the file, after the existing interfaces
interface FeedTitle {
  feedTitle?: string;
  mediaType?: string;
}

type RSSItemWithFeedTitle = RSSItem & FeedTitle;

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

// Memoize the RSSEntry component to prevent unnecessary re-renders
const RSSEntry = React.memo(({ entryWithData: { entry, initialData, postMetadata } }: RSSEntryProps) => {
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

  // Ensure we have valid postMetadata
  const safePostMetadata = useMemo(() => {
    // Use type assertion to access feedTitle
    const feedTitle = (entry as RSSItemWithFeedTitle).feedTitle || '';
    
    return {
      title: postMetadata?.title || feedTitle,
      featuredImg: postMetadata?.featuredImg || entry.image || '',
      mediaType: postMetadata?.mediaType || 'article',
      categorySlug: postMetadata?.categorySlug || '',
      postSlug: postMetadata?.postSlug || ''
    };
  }, [postMetadata, entry]);

  // Generate post URL
  const postUrl = safePostMetadata.categorySlug && safePostMetadata.postSlug 
    ? `/${safePostMetadata.categorySlug}/${safePostMetadata.postSlug}`
    : null;

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (safePostMetadata.mediaType === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image);
    }
  }, [safePostMetadata.mediaType, entry.link, entry.title, entry.image, playTrack]);

  return (
    <article>
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-start gap-4 mb-4">
          {/* Featured Image */}
          {safePostMetadata.featuredImg && postUrl && (
            <Link href={postUrl} className="flex-shrink-0 w-14 h-14 relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={safePostMetadata.featuredImg}
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
              {safePostMetadata.title && postUrl && (
                <div className="flex items-center justify-between gap-2">
                  <Link href={postUrl} className="hover:opacity-80 transition-opacity">
                    <h3 className="text-base font-semibold text-primary leading-tight">
                      {safePostMetadata.title}
                    </h3>
                  </Link>
                  <span 
                    className="text-sm leading-none text-muted-foreground flex-shrink-0"
                    title={format(new Date(entry.pubDate), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {safePostMetadata.mediaType && (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                  {safePostMetadata.mediaType.toLowerCase() === 'podcast' && <Headphones className="h-3 w-3" />}
                  {safePostMetadata.mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" />}
                  {safePostMetadata.mediaType.charAt(0).toUpperCase() + safePostMetadata.mediaType.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {safePostMetadata.mediaType === 'podcast' ? (
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
});
RSSEntry.displayName = 'RSSEntry';

interface RSSEntriesClientProps {
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
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

// Add a debounce utility function for performance optimization
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
  // Create a stable reference to the loadMore function
  const stableLoadMore = useCallback(() => {
    if (hasMore && !isPending) {
      loadMore();
    }
  }, [hasMore, isPending, loadMore]);

  // Debounce the loadMore function to prevent multiple calls
  const debouncedLoadMore = useMemo(() => debounce(stableLoadMore, 0), [stableLoadMore]);

  // Set up intersection observer for better infinite loading
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    
    const observer = new IntersectionObserver((entries) => {
      // If the load more element is intersecting with the viewport and we're not already loading
      if (entries[0].isIntersecting && hasMore && !isPending) {
        logger.debug('Intersection observer triggered, loading more entries');
        debouncedLoadMore();
      }
    }, {
      rootMargin: '200px', // Load more when element is 200px from viewport
      threshold: 0.1, // Trigger when at least 10% of the element is visible
    });
    
    observer.observe(loadMoreRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [debouncedLoadMore, hasMore, isPending, loadMoreRef]);

  if (!paginatedEntries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in your RSS feeds.
      </div>
    );
  }

  return (
    <div className="border-0 md:border-l md:border-r md:border-b">
      <Virtuoso
        useWindowScroll
        totalCount={paginatedEntries.length}
        endReached={() => {
          if (hasMore && !isPending) {
            logger.debug('Virtuoso end reached, loading more entries');
            debouncedLoadMore();
          }
        }}
        overscan={20}
        initialTopMostItemIndex={0}
        itemContent={index => {
          const entryWithData = paginatedEntries[index];
          // Add null check to ensure entryWithData and entryWithData.entry exist
          if (!entryWithData || !entryWithData.entry || !entryWithData.entry.guid) {
            return <div className="p-4 text-muted-foreground">Invalid entry data</div>;
          }
          
          // If we have metrics from the batch query, use them to update the entry data
          if (entryMetrics && entryMetrics[entryWithData.entry.guid]) {
            const metrics = entryMetrics[entryWithData.entry.guid];
            // Create a new object to avoid mutating the original
            const updatedData = {
              ...entryWithData,
              initialData: {
                ...entryWithData.initialData,
                likes: metrics.likes,
                comments: metrics.comments,
                retweets: metrics.retweets
              }
            };
            return <RSSEntry entryWithData={updatedData} />;
          }
          return <RSSEntry entryWithData={entryWithData} />;
        }}
        components={{
          Footer: () => (
            <div ref={loadMoreRef} className="py-8">
              {isPending && hasMore ? (
                <div className="flex justify-center items-center">
                  <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : hasMore ? (
                <div className="flex justify-center items-center min-h-[100%]">
                  <Loader className="h-6 w-6 animate-spin text-primary" />
                  </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  No more entries to load
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  // Only re-render if the entries have changed, more entries are available,
  // or the loading state has changed
  const entriesChanged = prevProps.paginatedEntries !== nextProps.paginatedEntries;
  const hasMoreChanged = prevProps.hasMore !== nextProps.hasMore;
  const isPendingChanged = prevProps.isPending !== nextProps.isPending;
  const metricsChanged = prevProps.entryMetrics !== nextProps.entryMetrics;
  
  // Return true if props are equal (no re-render needed)
  return !(entriesChanged || hasMoreChanged || isPendingChanged || metricsChanged);
});

EntriesContent.displayName = 'EntriesContent';

export function RSSEntriesClientWithErrorBoundary(props: RSSEntriesClientProps) {
  return (
    <ErrorBoundary>
      <RSSEntriesClient {...props} />
    </ErrorBoundary>
  );
}

export function RSSEntriesClient({ initialData, pageSize = 30 }: RSSEntriesClientProps) {
  const [isPending, startTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Track errors for better error handling
  const [fetchError, setFetchError] = useState<Error | null>(null);
  
  // Use a fixed number of items per request for consistency
  const ITEMS_PER_REQUEST = pageSize;
  
  // Use a ref to track if we've already used the initial data
  const initialDataUsedRef = useRef(false);
  
  // Fetch entries with pagination - using a simpler and more reliable approach
  const { data, error, size, setSize } = useSWRInfinite(
    (pageIndex: number) => {
      // If this is the first page and we haven't used initial data yet,
      // we can skip fetching since we already have the data from the server
      if (pageIndex === 0 && !initialDataUsedRef.current) {
        initialDataUsedRef.current = true;
        return null; // Return null to skip this request
      }
      
      // Use absolute URL to avoid issues with relative URL parsing
      const baseUrl = new URL('/api/rss', window.location.origin);
      
      // Use a simpler offset-based pagination that's more reliable
      const offset = pageIndex * ITEMS_PER_REQUEST;
      baseUrl.searchParams.set('offset', offset.toString());
      baseUrl.searchParams.set('limit', ITEMS_PER_REQUEST.toString());
      baseUrl.searchParams.set('includePostMetadata', 'true'); // Request post metadata
      
      // Extract post titles from the initial data
      if (initialData && initialData.postTitles) {
        baseUrl.searchParams.set('postTitles', JSON.stringify(initialData.postTitles));
      } else if (initialData && initialData.entries && initialData.entries.length > 0) {
        const feedTitles = [...new Set(
          initialData.entries
            .filter(entry => entry && entry.postMetadata && entry.postMetadata.title)
            .map(entry => entry.postMetadata.title)
        )];
        
        if (feedTitles.length > 0) {
          baseUrl.searchParams.set('postTitles', JSON.stringify(feedTitles));
        }
      }
      
      logger.debug(`Fetching page ${pageIndex} with offset ${offset} and limit ${ITEMS_PER_REQUEST}`);
      return baseUrl.toString();
    },
    async (url: string) => {
      if (!url) return initialData; // Return initial data if URL is null
      
      try {
        logger.debug(`Fetching data from: ${url}`);
        
        const res = await fetch(url);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to fetch entries: ${res.status} ${errorText}`);
        }
        const responseData = await res.json();
        
        // Reset error state on successful fetch
        setFetchError(null);
        
        logger.debug(`Received ${responseData.entries?.length || 0} entries from API`);
        
        // Helper function to find post metadata from initialData based on feedUrl
        const findPostMetadataFromInitialData = (feedUrl: string) => {
          if (!initialData || !initialData.entries || initialData.entries.length === 0) {
            return null;
          }
          
          // Find an entry with the same feedUrl in initialData
          const matchingEntry = initialData.entries.find(
            entry => entry && entry.entry && entry.entry.feedUrl === feedUrl
          );
          
          if (matchingEntry && matchingEntry.postMetadata) {
            return matchingEntry.postMetadata;
          }
          
          return null;
        };
        
        // Transform and validate the response data
        if (responseData.entries && Array.isArray(responseData.entries)) {
          // Transform entries to ensure consistent structure
          const transformedEntries = responseData.entries
            .filter(Boolean)
            .map((entry: RSSEntryWithData | RSSItemWithFeedTitle | RSSItem | null) => {
              // If the entry is already in the expected format with complete metadata
              if (entry && 
                  'entry' in entry && 
                  entry.entry && 
                  entry.entry.guid && 
                  'postMetadata' in entry && 
                  entry.postMetadata && 
                  entry.postMetadata.title && 
                  entry.postMetadata.featuredImg) {
                return entry as RSSEntryWithData;
              }
              
              // If it has the basic structure but missing metadata
              if (entry && 'entry' in entry && entry.entry && entry.entry.guid) {
                // Try to find post metadata from initialData based on feedUrl
                const feedUrl = entry.entry.feedUrl;
                const existingMetadata = feedUrl ? findPostMetadataFromInitialData(feedUrl) : null;
                
                // Get title from entry - access it safely
                const entryTitle = entry.entry.title || '';
                // Get feed title if available - this might come as an additional property
                const feedTitle = (entry.entry as RSSItemWithFeedTitle).feedTitle || '';
                
                return {
                  ...entry,
                  postMetadata: existingMetadata || {
                    title: feedTitle || entryTitle || '',
                    featuredImg: entry.entry.image || '',
                    mediaType: (entry.entry as RSSItemWithFeedTitle).mediaType || 'article',
                    categorySlug: '',
                    postSlug: ''
                  }
                } as RSSEntryWithData;
              }
              
              // If it's a direct RSS item, wrap it with proper metadata
              if (entry && 'guid' in entry && entry.guid) {
                // Try to find post metadata from initialData based on feedUrl
                const feedUrl = 'feedUrl' in entry ? entry.feedUrl : '';
                const existingMetadata = feedUrl ? findPostMetadataFromInitialData(feedUrl) : null;
                
                // Get title directly
                const entryTitle = entry.title || '';
                // Get feed title if available - might be an additional property 
                const feedTitle = (entry as RSSItemWithFeedTitle).feedTitle || '';
                
                return {
                  entry: entry as RSSItem,
                  initialData: {
                    likes: { isLiked: false, count: 0 },
                    comments: { count: 0 },
                    retweets: { isRetweeted: false, count: 0 }
                  },
                  postMetadata: existingMetadata || {
                    title: feedTitle || entryTitle || '',
                    featuredImg: entry.image || '',
                    mediaType: (entry as RSSItemWithFeedTitle).mediaType || 'article',
                    categorySlug: '',
                    postSlug: ''
                  }
                } as RSSEntryWithData;
              }
              
              return null;
            })
            .filter(Boolean) as RSSEntryWithData[];
          
          // Always update the hasMore flag based on the latest response
          responseData.entries = transformedEntries;
          responseData.hasMore = responseData.hasMore ?? (transformedEntries.length >= ITEMS_PER_REQUEST);
        }
        
        return responseData;
      } catch (err) {
        // Store the error for better error handling
        const error = err instanceof Error ? err : new Error(String(err));
        setFetchError(error);
        throw error;
      }
    },
    {
      fallbackData: [initialData], // Use server-provided initialData as first page
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      revalidateOnMount: false, // Prevent initial refetch
      shouldRetryOnError: true,
      errorRetryCount: 3,
      errorRetryInterval: 5000, // Retry after 5 seconds
      dedupingInterval: 5000, // Prevent duplicate requests
    }
  );
  
  // Flatten paginated entries - preserving the structure from server
  const paginatedEntries = useMemo(() => {
    if (!data) return [];
    
    logger.debug('Recalculating paginatedEntries');
    
    // Create a map to track entries by guid for deduplication
    const entriesMap = new Map<string, RSSEntryWithData>();
    
    // First, add the initial entries to ensure they're always included
    if (initialData && initialData.entries) {
      initialData.entries.forEach((entry: RSSEntryWithData) => {
        if (entry && entry.entry && entry.entry.guid) {
          entriesMap.set(entry.entry.guid, entry);
        }
      });
    }
    
    // Then add all entries from the fetched data
    data.forEach((page, pageIndex) => {
      if (page && page.entries) {
        logger.debug(`Processing page entries`, { pageIndex, entriesCount: page.entries.length });
        page.entries.forEach((entry: RSSEntryWithData) => {
          if (entry && entry.entry && entry.entry.guid) {
            entriesMap.set(entry.entry.guid, entry);
          }
        });
      }
    });
    
    // Convert back to array and sort by publication date (newest first)
    const sortedEntries = Array.from(entriesMap.values())
      .sort((a, b) => {
        if (!a.entry || !a.entry.pubDate) return 1;
        if (!b.entry || !b.entry.pubDate) return -1;
        return new Date(b.entry.pubDate).getTime() - new Date(a.entry.pubDate).getTime();
      });
    
    logger.debug(`Total unique entries after merging`, { count: sortedEntries.length });
    return sortedEntries;
  }, [data, initialData]);
  
  // Extract all entry GUIDs and feed URLs for combined query
  const [entryGuids, feedUrls] = useMemo(() => {
    const guids = paginatedEntries
      .filter((entry: RSSEntryWithData) => entry && entry.entry && entry.entry.guid)
      .map((entry: RSSEntryWithData) => entry.entry.guid);
    
    const urls = [...new Set(
      paginatedEntries
        .filter((entry: RSSEntryWithData) => 
          entry && 
          entry.entry && 
          entry.entry.feedUrl && 
          (!entry.postMetadata || !entry.postMetadata.featuredImg)
        )
        .map((entry: RSSEntryWithData) => entry.entry.feedUrl)
    )];
    
    return [guids, urls];
  }, [paginatedEntries]);
  
  // Determine if there are more entries to load - improved reliability
  const hasMore = useMemo(() => {
    if (!data || data.length === 0) return false;
    
    // Check if the last page indicates more entries are available
    const lastPage = data[data.length - 1];
    const lastPageHasMore = lastPage && lastPage.hasMore;
    
    // If the server explicitly says there are more entries, trust it
    if (lastPageHasMore === true) return true;
    
    // If the server explicitly says there are no more entries, trust it
    if (lastPageHasMore === false) return false;
    
    // Fallback: if we got a full page of entries, assume there might be more
    return lastPage && lastPage.entries && lastPage.entries.length >= ITEMS_PER_REQUEST;
  }, [data, ITEMS_PER_REQUEST]);
  
  // Use the combined query to fetch both post metadata and entry metrics in one call
  const combinedData = useQuery(
    api.entries.getFeedDataWithMetrics,
    (entryGuids.length > 0 || feedUrls.length > 0) 
      ? { entryGuids, feedUrls } 
      : "skip"
  );
  
  // Create maps for O(1) lookups from the combined query results
  const [metricsMap, metadataMap] = useMemo(() => {
    if (!combinedData) return [new Map(), new Map()];
    
    const metrics = new Map(
      combinedData.entryMetrics.map(item => [item.guid, item.metrics])
    );
    
    const metadata = new Map(
      combinedData.postMetadata.map(item => [item.feedUrl, item.metadata])
    );
    
    logger.info(`Created lookup maps from combined query`, { 
      metricsCount: metrics.size, 
      metadataCount: metadata.size 
    });
    
    return [metrics, metadata];
  }, [combinedData]);
  
  // Create a ref to track processed metadata batches
  const processedMetadataRef = useRef<string | null>(null);
  
  // Update entries with post metadata - optimize with dependency tracking
  useEffect(() => {
    if (metadataMap.size === 0 || feedUrls.length === 0) return;
    
    // Track if we've already processed this batch of metadata
    const metadataSignature = `${metadataMap.size}-${feedUrls.join(',')}`;
    
    // Skip if we've already processed this exact metadata
    if (processedMetadataRef.current === metadataSignature) {
      logger.debug('Skipping metadata update (already processed this batch)');
      return;
    }
    
    logger.info(`Updating entries with metadata`, { mapSize: metadataMap.size });
    
    // Update entries with metadata - create new objects to ensure proper rendering
    let updatedCount = 0;
    const updatedEntries = paginatedEntries.map(entry => {
      if (entry && 
          entry.entry && 
          entry.entry.feedUrl && 
          (!entry.postMetadata || !entry.postMetadata.featuredImg || !entry.postMetadata.title)) {
        const metadata = metadataMap.get(entry.entry.feedUrl);
        if (metadata) {
          updatedCount++;
          // Create a new object to trigger re-renders
          return {
            ...entry,
            postMetadata: {
              ...entry.postMetadata,
              ...metadata, // Override with the fetched metadata
              // Ensure we have basic fallbacks if metadata is incomplete
              title: metadata.title || entry.postMetadata?.title || entry.entry.title || '',
              featuredImg: metadata.featuredImg || entry.postMetadata?.featuredImg || entry.entry.image || '',
            }
          };
        }
      }
      return entry;
    });
    
    // If any entries were updated, force a re-render by modifying paginatedEntries
    if (updatedCount > 0) {
      logger.debug(`Updated ${updatedCount} entries with metadata`);
      // Use a state update to trigger re-render with updated metadata
      setPaginatedEntriesWithMetadata(updatedEntries);
    }
    
    // Mark this batch as processed
    processedMetadataRef.current = metadataSignature;
  }, [metadataMap, feedUrls, paginatedEntries]);

  // Add a state to handle metadata updates
  const [paginatedEntriesWithMetadata, setPaginatedEntriesWithMetadata] = useState<RSSEntryWithData[]>([]);
  
  // Use either the metadata-updated entries or the original ones
  const displayEntries = useMemo(() => {
    return paginatedEntriesWithMetadata.length > 0 ? paginatedEntriesWithMetadata : paginatedEntries;
  }, [paginatedEntriesWithMetadata, paginatedEntries]);
  
  // Reset metadata entries when page refreshes
  useEffect(() => {
    if (paginatedEntries.length === 0) {
      setPaginatedEntriesWithMetadata([]);
    }
  }, [paginatedEntries.length]);
  
  // Get entry metrics map for use in rendering
  const entryMetricsMap = useMemo(() => {
    if (metricsMap.size === 0) return null;
    
    // Convert the map to a simple object for easier use in components
    const metricsObject: Record<string, EntryMetrics> = {};
    metricsMap.forEach((metrics, guid) => {
      metricsObject[guid] = metrics;
    });
    
    return metricsObject;
  }, [metricsMap]);
  
  // Track which pages have already been prefetched to avoid duplicate requests
  const prefetchedPagesRef = useRef<Set<number>>(new Set());
  
  // Function to prefetch the next page of content without incrementing the size
  const prefetchNextPage = useCallback((nextPageIndex: number) => {
    if (!hasMore) return;
    
    // Skip if we've already prefetched this page
    if (prefetchedPagesRef.current.has(nextPageIndex)) {
      logger.debug(`🔍 Page ${nextPageIndex} already prefetched, skipping`);
      return;
    }
    
    // Mark this page as being prefetched
    prefetchedPagesRef.current.add(nextPageIndex);
    
    // Generate the URL for the next page
    const baseUrl = new URL('/api/rss', window.location.origin);
    const offset = nextPageIndex * ITEMS_PER_REQUEST;
    baseUrl.searchParams.set('offset', offset.toString());
    baseUrl.searchParams.set('limit', ITEMS_PER_REQUEST.toString());
    baseUrl.searchParams.set('includePostMetadata', 'true');
    
    // Add post titles if available
    if (initialData && initialData.postTitles) {
      baseUrl.searchParams.set('postTitles', JSON.stringify(initialData.postTitles));
    } else if (initialData && initialData.entries && initialData.entries.length > 0) {
      const feedTitles = [...new Set(
        initialData.entries
          .filter(entry => entry && entry.postMetadata && entry.postMetadata.title)
          .map(entry => entry.postMetadata.title)
      )];
      
      if (feedTitles.length > 0) {
        baseUrl.searchParams.set('postTitles', JSON.stringify(feedTitles));
      }
    }
    
    // Fetch the next page in the background but don't update state
    logger.debug(`🔄 Prefetching next page: ${nextPageIndex} (offset: ${offset})`);
    fetch(baseUrl.toString())
      .then(res => {
        if (res.ok) {
          logger.debug(`✅ Successfully prefetched next page (offset: ${offset})`);
          // No need to do anything with the result - it will be cached by the browser
          // and used when the user actually requests this page
        }
      })
      .catch(error => {
        // On error, remove from prefetched pages set so we can try again later
        prefetchedPagesRef.current.delete(nextPageIndex);
        logger.error(`❌ Error prefetching next page: ${error.message}`);
      });
  }, [hasMore, ITEMS_PER_REQUEST, initialData]);
  
  // Function to load more entries - improved with better state tracking
  const loadMore = useCallback(() => {
    if (hasMore && !isPending) {
      logger.debug('Loading more entries', { currentSize: size });
      startTransition(() => {
        setSize(s => s + 1);
        
        // Immediately prefetch the next page after loading this one
        // This ensures we're always one page ahead of what the user is viewing
        prefetchNextPage(size + 1);
      });
    }
  }, [hasMore, isPending, size, setSize, prefetchNextPage]);
  
  // Create a debounced version of loadMore to prevent multiple rapid calls
  const debouncedLoadMore = useMemo(() => debounce(loadMore, 0), [loadMore]);
  
  // Prefetch the first "next page" as soon as the component loads
  useEffect(() => {
    // Only run this once after initial render when we have data
    if (data && data.length > 0) {
      prefetchNextPage(size);
    }
  }, [prefetchNextPage, data, size]);

  // Display error message if there's an error
  if (error || fetchError) {
    const errorMessage = fetchError?.message || error?.message || 'Error loading entries';
    logger.error('Feed loading error', { message: errorMessage });
    
    return (
      <div className="text-center py-8 text-destructive">
        <p className="mb-4">{errorMessage}</p>
        <Button 
          variant="outline" 
          onClick={() => {
            setFetchError(null);
            setSize(1); // Reset to first page
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  // Return the EntriesContent directly instead of using tabs
  return (
    <div className="w-full ">
      <EntriesContent
        paginatedEntries={displayEntries}
        hasMore={hasMore}
        loadMoreRef={loadMoreRef}
        isPending={isPending}
        loadMore={debouncedLoadMore}
        entryMetrics={entryMetricsMap}
      />
    </div>
  );
} 