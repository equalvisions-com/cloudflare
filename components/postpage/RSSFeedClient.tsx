'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback, memo } from 'react';
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
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';
import { Podcast, Mail, Loader2 } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";

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
    bookmarks?: {
      isBookmarked: boolean;
    };
  };
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
  verified?: boolean;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}

interface APIRSSEntry {
  entry: RSSItem;
  initialData?: {
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

// Custom equality function for RSSEntry to prevent unnecessary re-renders
const arePropsEqual = (prevProps: RSSEntryProps, nextProps: RSSEntryProps) => {
  // Compare essential props for rendering decisions
  return (
    prevProps.entryWithData.entry.guid === nextProps.entryWithData.entry.guid &&
    prevProps.entryWithData.initialData.likes.count === nextProps.entryWithData.initialData.likes.count &&
    prevProps.entryWithData.initialData.likes.isLiked === nextProps.entryWithData.initialData.likes.isLiked &&
    prevProps.entryWithData.initialData.comments.count === nextProps.entryWithData.initialData.comments.count &&
    prevProps.featuredImg === nextProps.featuredImg &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.mediaType === nextProps.mediaType &&
    prevProps.verified === nextProps.verified &&
    // For retweets and bookmarks, check if they exist and then compare
    ((!prevProps.entryWithData.initialData.retweets && !nextProps.entryWithData.initialData.retweets) ||
      (prevProps.entryWithData.initialData.retweets?.count === nextProps.entryWithData.initialData.retweets?.count &&
       prevProps.entryWithData.initialData.retweets?.isRetweeted === nextProps.entryWithData.initialData.retweets?.isRetweeted)) &&
    ((!prevProps.entryWithData.initialData.bookmarks && !nextProps.entryWithData.initialData.bookmarks) ||
      (prevProps.entryWithData.initialData.bookmarks?.isBookmarked === nextProps.entryWithData.initialData.bookmarks?.isBookmarked))
  );
};

const RSSEntry = React.memo(({ entryWithData: { entry, initialData }, featuredImg, postTitle, mediaType, verified, onOpenCommentDrawer }: RSSEntryProps): JSX.Element => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Helper function to prevent scroll jumping on link interaction
  // This works by preventing the default focus behavior that causes scrolling
  const handleLinkInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Let the event continue for the click
    // but prevent the focus-triggered scrolling afterward
    const target = e.currentTarget as HTMLElement;
    
    // Use a one-time event listener that removes itself after execution
    target.addEventListener('focusin', (focusEvent) => {
      focusEvent.preventDefault();
      // Immediately blur to prevent scroll adjustments
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        setTimeout(() => {
          // Use setTimeout to allow the click to complete first
          activeElement.blur();
        }, 0);
      }
    }, { once: true });
  }, []);

  // Memoize the timestamp calculation as it's a complex operation
  const timestamp = useMemo(() => {
    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let pubDate: Date;
    
    if (typeof entry.pubDate === 'string' && mysqlDateRegex.test(entry.pubDate)) {
      // Convert MySQL datetime string to UTC time
      const [datePart, timePart] = entry.pubDate.split(' ');
      pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      pubDate = new Date(entry.pubDate);
    }
    
    const now = new Date();
    
    // Ensure we're working with valid dates
    if (isNaN(pubDate.getTime())) {
      return '';
    }

    // Calculate time difference
    const diffInMs = now.getTime() - pubDate.getTime();
    const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    
    // For future dates (more than 1 minute ahead), show 'in X'
    const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
    const prefix = isFuture ? 'in ' : '';
    const suffix = isFuture ? '' : '';
    
    // Format based on the time difference
    if (diffInMinutes < 60) {
      return `${prefix}${diffInMinutes}${diffInMinutes === 1 ? 'm' : 'm'}${suffix}`;
    } else if (diffInHours < 24) {
      return `${prefix}${diffInHours}${diffInHours === 1 ? 'h' : 'h'}${suffix}`;
    } else if (diffInDays < 30) {
      return `${prefix}${diffInDays}${diffInDays === 1 ? 'd' : 'd'}${suffix}`;
    } else {
      return `${prefix}${diffInMonths}${diffInMonths === 1 ? 'mo' : 'mo'}${suffix}`;
    }
  }, [entry.pubDate]); // Only recalculate when pubDate changes

  // Memoize handlers to prevent recreating them on every render
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (mediaType === 'podcast') {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entry.link, decode(entry.title), entry.image || undefined);
    }
  }, [mediaType, entry.link, entry.title, entry.image, playTrack]);

  // Memoize the comment handler
  const handleOpenCommentDrawer = useCallback(() => {
    onOpenCommentDrawer(entry.guid, entry.feedUrl, initialData.comments);
  }, [entry.guid, entry.feedUrl, initialData.comments, onOpenCommentDrawer]);

  // Memoize the formatted date to prevent recalculation
  const formattedDate = useMemo(() => {
    try {
      return format(new Date(entry.pubDate), 'PPP p');
    } catch (e) {
      return '';
    }
  }, [entry.pubDate]);

  return (
    <article 
      onClick={(e) => {
        // Stop all click events from bubbling up to parent components
        e.stopPropagation();
      }} 
      className="outline-none focus:outline-none focus-visible:outline-none"
      tabIndex={-1}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-center gap-4 mb-4">
          {/* Featured Image */}
          {featuredImg && (
            <div className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={featuredImg}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                  priority={false}
                />
              </AspectRatio>
            </div>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              {postTitle && (
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-2 mt-[2.5px]">
                    {postTitle}
                    {verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                  </h3>
                  <span 
                    className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                    title={formattedDate}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {mediaType && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
                  {mediaType.toLowerCase() === 'podcast' && <Podcast className="h-3 w-3" />}
                  {mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" strokeWidth={2.5} />}
                  {mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {mediaType === 'podcast' ? (
          <div>
            <NoFocusWrapper 
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
              onClick={(e) => {
                handleLinkInteraction(e);
                handleCardClick(e);
              }}
              onTouchStart={handleLinkInteraction}
            >
              <Card className={`rounded-xl overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                {entry.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={2/1}>
                      <Image
                        src={entry.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <CardContent className="border-t pt-[11px] pl-4 pr-4 pb-[12px]">
                  <h3 className="text-base font-bold capitalize leading-[1.5]">
                    {decode(entry.title)}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                      {decode(entry.description)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </NoFocusWrapper>
          </div>
        ) : (
          <NoFocusLinkWrapper
            className="block hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleLinkInteraction(e);
            }}
            onTouchStart={handleLinkInteraction}
          >
            <a
              href={entry.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card className="rounded-xl border overflow-hidden shadow-none">
                {entry.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={2/1}>
                      <Image
                        src={entry.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <CardContent className="pl-4 pr-4 pb-[12px] border-t pt-[11px]">
                  <h3 className="text-base font-bold capitalize leading-[1.5]">
                    {decode(entry.title)}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                      {decode(entry.description)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </a>
          </NoFocusLinkWrapper>
        )}
        
        {/* Horizontal Interaction Buttons */}
        <div className="flex justify-between items-center mt-4 h-[16px]" onClick={(e) => e.stopPropagation()}>
          <NoFocusWrapper className="flex items-center">
            <LikeButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={initialData.likes}
            />
          </NoFocusWrapper>
          <NoFocusWrapper 
            className="flex items-center" 
            onClick={(e) => {
              e.stopPropagation();
              handleOpenCommentDrawer();
            }}
          >
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              initialData={initialData.comments}
              buttonOnly={true}
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={initialData.retweets || { isRetweeted: false, count: 0 }}
            />
          </NoFocusWrapper>
          <div className="flex items-center gap-4">
            <NoFocusWrapper className="flex items-center">
              <BookmarkButtonClient
                entryGuid={entry.guid}
                feedUrl={entry.feedUrl}
                title={entry.title}
                pubDate={entry.pubDate}
                link={entry.link}
                initialData={initialData.bookmarks || { isBookmarked: false }}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entry.link}
                title={entry.title}
              />
            </NoFocusWrapper>
          </div>
        </div>
      </div>
      
      {/* Comments Section */}
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
}, arePropsEqual); // Apply custom equality function

RSSEntry.displayName = 'RSSEntry';

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

// Define the FeedContent component interface
interface FeedContentProps {
  entries: RSSEntryWithData[];
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isPending: boolean;
  loadMore: () => Promise<void>;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
  verified?: boolean;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  isInitialRender: boolean;
}

// Custom equality function for FeedContent
const areFeedContentPropsEqual = (prevProps: FeedContentProps, nextProps: FeedContentProps) => {
  // Simple length check 
  if (prevProps.entries.length !== nextProps.entries.length) {
    return false;
  }
  
  // Check if hasMore or isPending changed
  if (prevProps.hasMore !== nextProps.hasMore || 
      prevProps.isPending !== nextProps.isPending ||
      prevProps.featuredImg !== nextProps.featuredImg ||
      prevProps.postTitle !== nextProps.postTitle ||
      prevProps.mediaType !== nextProps.mediaType ||
      prevProps.verified !== nextProps.verified ||
      prevProps.isInitialRender !== nextProps.isInitialRender) {
    return false;
  }
  
  // Deep comparison not needed for most cases since entries are typically just appended
  // and we already checked the length
  
  return true;
};

// Extract EmptyState as a separate component
const EmptyState = () => (
  <div className="text-center py-8 text-muted-foreground">
    No entries found for this feed.
  </div>
);
EmptyState.displayName = 'EmptyState';

// Memoize the FeedContent component to prevent unnecessary re-renders
const FeedContent = React.memo(function FeedContent({
  entries,
  hasMore,
  loadMoreRef,
  isPending,
  loadMore,
  featuredImg,
  postTitle,
  mediaType,
  verified,
  onOpenCommentDrawer,
  isInitialRender
}: FeedContentProps) {
  // Add ref to prevent multiple endReached calls
  const endReachedCalledRef = useRef(false);
  
  // Reset the endReachedCalled flag when entries change
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [entries.length]);
  
  // Use the shared delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMore, {
    enabled: hasMore && !isPending,
    isLoading: isPending,
    hasMore,
    rootMargin: '800px',
    threshold: 0.1,
    delay: 3000 // 3 second delay to prevent initial page load triggering
  });
  
  return (
    <div 
      className="space-y-0 rss-feed-container" 
      style={{ 
        // CSS properties to prevent focus scrolling
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      {entries.length === 0 ? <EmptyState /> : (
        <>
          <Virtuoso
            useWindowScroll
            data={entries}
            overscan={2000}
            itemContent={(index, item) => (
              <RSSEntry 
                entryWithData={item} 
                featuredImg={featuredImg}
                postTitle={postTitle}
                mediaType={mediaType}
                verified={verified}
                onOpenCommentDrawer={onOpenCommentDrawer}
              />
            )}
            components={{
              Footer: () => null
            }}
            style={{ 
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation'
            }}
            className="focus:outline-none focus-visible:outline-none"
            computeItemKey={(_, item) => item.entry.guid}
          />
          
          {/* Load more indicator */}
          <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
            {hasMore && isPending && <Loader2 className="h-6 w-6 animate-spin" />}
            {!hasMore && entries.length > 0 && <div></div>}
          </div>
        </>
      )}
    </div>
  );
}, areFeedContentPropsEqual);

// Add displayName for easier debugging
FeedContent.displayName = 'FeedContent';

interface RSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
    searchQuery?: string;
  };
  pageSize?: number;
  featuredImg?: string;
  mediaType?: string;
  isActive?: boolean;
  verified?: boolean;
}

export function RSSFeedClient({ postTitle, feedUrl, initialData, pageSize = 30, featuredImg, mediaType, isActive = true, verified }: RSSFeedClientProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  
  // Don't memoize simple values
  const ITEMS_PER_REQUEST = pageSize;
  
  // Track all entries manually
  const [allEntriesState, setAllEntriesState] = useState<RSSEntryWithData[]>(initialData.entries || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreState, setHasMoreState] = useState(initialData.hasMore || false);
  // Add a state variable to track initial render
  const [isInitialRender, setIsInitialRender] = useState(true);
  
  // --- Drawer state for comments ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive, '.rss-feed-container');

  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);
  
  // Debug log the initial data
  useEffect(() => {
    if (initialData) {
      logger.debug('Initial data received in client:', {
        entriesCount: initialData.entries?.length || 0,
        hasMore: initialData.hasMore,
        totalEntries: initialData.totalEntries,
        searchQuery: initialData.searchQuery
      });
      
      // Always reset state completely when initialData changes (including when search changes)
      // This ensures pagination works correctly after search state changes
      setAllEntriesState(initialData.entries || []);
      setCurrentPage(1);
      setHasMoreState(initialData.hasMore || false);
      setIsLoading(false);
    }
  }, [initialData]);
  
  // Create stable reference for URL parameters using useMemo
  const urlParams = useMemo(() => ({
    postTitle,
    feedUrl,
    pageSize: ITEMS_PER_REQUEST,
    totalEntries: initialData.totalEntries,
    searchQuery: initialData.searchQuery,
    mediaType
  }), [postTitle, feedUrl, ITEMS_PER_REQUEST, initialData.totalEntries, initialData.searchQuery, mediaType]);
  
  // Memoize URL creation for API requests with stable params reference
  const createApiUrl = useCallback((nextPage: number) => {
    const { postTitle, feedUrl, pageSize, totalEntries, searchQuery, mediaType } = urlParams;
    
    const baseUrl = new URL(`/api/rss/${encodeURIComponent(postTitle)}`, window.location.origin);
    baseUrl.searchParams.set('feedUrl', encodeURIComponent(feedUrl));
    baseUrl.searchParams.set('page', nextPage.toString());
    baseUrl.searchParams.set('pageSize', pageSize.toString());
    
    // Pass the cached total entries to avoid unnecessary COUNT queries
    if (totalEntries) {
      baseUrl.searchParams.set('totalEntries', totalEntries.toString());
    }
    
    if (mediaType) {
      baseUrl.searchParams.set('mediaType', encodeURIComponent(mediaType));
    }
    
    // Pass search query if it exists
    if (searchQuery) {
      baseUrl.searchParams.set('q', encodeURIComponent(searchQuery));
    }
    
    return baseUrl.toString();
  }, [urlParams]);
  
  // Create stable reference for entry transformation parameters
  const transformParams = useMemo(() => ({
    postTitle,
    featuredImg,
    mediaType
  }), [postTitle, featuredImg, mediaType]);
  
  // Memoize the transform function for API entries with stable params
  const transformApiEntries = useCallback((apiEntries: APIRSSEntry[]) => {
    const { postTitle, featuredImg, mediaType } = transformParams;
    
    return apiEntries
      .filter(Boolean)
      .map((entry: APIRSSEntry) => ({
        entry: entry.entry,
        initialData: entry.initialData || {
          likes: { isLiked: false, count: 0 },
          comments: { count: 0 },
          retweets: { isRetweeted: false, count: 0 }
        },
        postMetadata: {
          title: postTitle,
          featuredImg: featuredImg || entry.entry.image || '',
          mediaType: mediaType || 'article'
        }
      }));
  }, [transformParams]);
  
  // Create stable reference for loading dependencies
  const loadingDeps = useMemo(() => ({
    isActive,
    isLoading, 
    hasMoreState,
    currentPage,
    createApiUrl,
    transformApiEntries,
    ITEMS_PER_REQUEST
  }), [isActive, isLoading, hasMoreState, currentPage, createApiUrl, transformApiEntries, ITEMS_PER_REQUEST]);
  
  const loadMoreEntries = useCallback(async () => {
    const { isActive, isLoading, hasMoreState, currentPage, createApiUrl, transformApiEntries } = loadingDeps;
    
    if (!isActive || isLoading || !hasMoreState) {
      logger.debug(`Not loading more: isLoading=${isLoading}, hasMoreState=${hasMoreState}`);
      return;
    }
    
    setIsLoading(true);
    const nextPage = currentPage + 1;
    
    try {
      const apiUrl = createApiUrl(nextPage);
      logger.debug(`Fetching page ${nextPage} from API`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      logger.debug(`Received data from API - entries: ${data.entries?.length || 0}, hasMore: ${data.hasMore}, total: ${data.totalEntries}`);
      
      if (!data.entries?.length) {
        logger.debug('No entries returned from API');
        setIsLoading(false);
        return;
      }
      
      const transformedEntries = transformApiEntries(data.entries);
      logger.debug(`Transformed ${transformedEntries.length} entries`);
      
      setAllEntriesState(prev => [...prev, ...transformedEntries]);
      setCurrentPage(nextPage);
      setHasMoreState(data.hasMore);
      
    } catch (error) {
      logger.error('Error loading more entries:', error);
      setFetchError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [loadingDeps]);
  
  // Extract all entry GUIDs for metrics query
  const entryGuids = useMemo(() => 
    allEntriesState.map(entry => entry.entry.guid),
    [allEntriesState]
  );
  
  // Create stable feedUrlArray for query
  const feedUrlArray = useMemo(() => [feedUrl], [feedUrl]);
  
  // Use the combined query to fetch data, avoiding object literal in conditional
  const queryEnabled = entryGuids.length > 0;
  const queryArgs = useMemo(() => 
    queryEnabled ? { entryGuids, feedUrls: feedUrlArray } : "skip",
    [queryEnabled, entryGuids, feedUrlArray]
  );
  
  // Query data with proper memoization and stable arguments
  const combinedData = useQuery(api.entries.getFeedDataWithMetrics, queryArgs);
  
  // Extract metrics from combined data with memoization
  const entryMetricsMap = useMemo(() => {
    if (!combinedData?.entryMetrics) return null;
    return Object.fromEntries(
      combinedData.entryMetrics.map(item => [item.guid, item.metrics])
    );
  }, [combinedData]);
  
  // Extract post metadata from combined data with memoization
  const postMetadata = useMemo(() => {
    if (!combinedData?.postMetadata || combinedData.postMetadata.length === 0) return null;
    
    // The feedUrl is unique in this context, so we can safely use the first item
    const metadataItem = combinedData.postMetadata.find(item => item.feedUrl === feedUrl);
    return metadataItem?.metadata || null;
  }, [combinedData, feedUrl]);
  
  // Apply metrics to entries with memoization
  const enhancedEntries = useMemo(() => {
    if (!allEntriesState.length) return allEntriesState;
    
    if (!entryMetricsMap) return allEntriesState;
    
    return allEntriesState.map(entryWithData => {
      const enhanced = { ...entryWithData };
      
      // Apply metrics if available
      if (entryMetricsMap && enhanced.entry.guid in entryMetricsMap) {
        enhanced.initialData = {
          ...enhanced.initialData,
          ...entryMetricsMap[enhanced.entry.guid]
        };
      }
      
      return enhanced;
    });
  }, [allEntriesState, entryMetricsMap]);
  
  // Create stable reference for height check dependencies
  const heightCheckDeps = useMemo(() => ({
    hasMoreState,
    isLoading,
    allEntriesCount: allEntriesState.length,
    loadMoreEntries,
    isInitialRender
  }), [hasMoreState, isLoading, allEntriesState.length, loadMoreEntries, isInitialRender]);
  
  // Memoize the content height check function with stable dependencies
  const checkContentHeight = useCallback(() => {
    const { hasMoreState, isLoading, allEntriesCount, loadMoreEntries, isInitialRender } = heightCheckDeps;
    
    if (!loadMoreRef.current || !hasMoreState || isLoading) return;
    
    // Skip auto-loading on initial render to prevent layout shift
    if (isInitialRender) {
      logger.debug('Skipping auto-load on initial render to prevent layout shift');
      setIsInitialRender(false);
      return;
    }
    
    // Only proceed with auto-loading if we have at least page size of entries already viewed
    if (allEntriesCount < ITEMS_PER_REQUEST) {
      logger.debug(`Not enough entries viewed yet (${allEntriesCount}/${ITEMS_PER_REQUEST}), skipping auto-load`);
      return;
    }
    
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // If the document is shorter than the viewport, load more
    if (documentHeight <= viewportHeight && allEntriesCount > 0) {
      logger.debug('Content is shorter than viewport, loading more entries');
      loadMoreEntries();
    }
  }, [heightCheckDeps, loadMoreRef]);
  
  // Add a useEffect to check if we need to load more when the component is mounted
  useEffect(() => {
    // Run the check after a short delay to ensure the DOM has updated
    const timer = setTimeout(checkContentHeight, 200);
    return () => clearTimeout(timer);
  }, [checkContentHeight]);
  
  // Create error UI as a separate component
  const ErrorUI = () => (
    <div className="text-center py-8 text-destructive">
      <p className="mb-4">Error loading feed entries</p>
      <Button 
        variant="outline" 
        onClick={() => {
          setFetchError(null);
          setAllEntriesState(initialData.entries || []);
          setCurrentPage(1);
          setHasMoreState(initialData.hasMore || false);
        }}
      >
        Try Again
      </Button>
    </div>
  );
  
  if (fetchError) {
    return <ErrorUI />;
  }
  
  return (
    <div className="w-full rss-feed-container">
      <FeedContent
        entries={enhancedEntries}
        hasMore={hasMoreState}
        loadMoreRef={loadMoreRef}
        isPending={isLoading}
        loadMore={loadMoreEntries}
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
        verified={verified}
        onOpenCommentDrawer={handleOpenCommentDrawer}
        isInitialRender={isInitialRender}
      />
      {/* Single global comment drawer */}
      {selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={selectedCommentEntry.entryGuid}
          feedUrl={selectedCommentEntry.feedUrl}
          initialData={selectedCommentEntry.initialData}
          isOpen={commentDrawerOpen}
          setIsOpen={setCommentDrawerOpen}
        />
      )}
    </div>
  );
}

// Memoize the RSSFeedClient component for better performance when used in parent components
const MemoizedRSSFeedClient = React.memo(RSSFeedClient);
MemoizedRSSFeedClient.displayName = "MemoizedRSSFeedClient";

// Export the memoized component with error boundary
export function RSSFeedClientWithErrorBoundary(props: RSSFeedClientProps) {
  return (
    <ErrorBoundary>
      <MemoizedRSSFeedClient {...props} />
    </ErrorBoundary>
  );
}