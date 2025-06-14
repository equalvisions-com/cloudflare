'use client';

import React, { useEffect, useRef, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { RSSFeedErrorBoundary } from "./RSSFeedErrorBoundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { RSSItem } from "@/lib/rss";
import type { 
  RSSFeedEntry, 
  RSSEntryProps, 
  FeedContentProps, 
  RSSFeedClientProps,
  RSSFeedAPIResponse
} from "@/lib/types";
import { 
  createRSSFeedStore,
  RSSFeedStoreContext,
  useRSSFeedEntries,
  useRSSFeedLoading,
  useRSSFeedPagination as useRSSFeedPaginationState,
  useRSSFeedCommentDrawer,
  useRSSFeedInitialize,
  useRSSFeedSetActive,
  useRSSFeedSetSearchMode,
  useRSSFeedHasMore,
  useRSSFeedIsLoading
} from '@/lib/stores/rssFeedStore';
import { useRSSFeedPaginationHook } from '@/hooks/useRSSFeedPagination';
import { useRSSFeedMetrics } from '@/hooks/useRSSFeedMetrics';
import { useRSSFeedUI } from '@/hooks/useRSSFeedUI';
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
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
import { useFeedFocusPrevention, NoFocusWrapper, NoFocusLinkWrapper, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";

// PHASE 4: Dynamic import for CommentSectionClient to reduce initial bundle size
const CommentSectionClient = lazy(() => import("@/components/comment-section/CommentSectionClient").then(module => ({ default: module.CommentSectionClient })));

// PHASE 4: Loading fallback component for dynamic imports
const CommentSectionFallback = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span className="ml-2 text-sm text-muted-foreground">Loading comments...</span>
  </div>
);

// PHASE 4: Enhanced production-ready error logging utility
const logger = {
  error: (message: string, error?: unknown, context?: Record<string, any>) => {
    // In production, errors are handled gracefully without console output
    // Error tracking would be implemented here (e.g., Sentry, LogRocket)
    if (process.env.NODE_ENV === 'development') {
      console.error(`[RSS Feed Error] ${message}`, { error, context });
    }
    // TODO: Implement production error tracking
    // Sentry.captureException(error, { extra: { message, context } });
  },
  warn: (message: string, context?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[RSS Feed Warning] ${message}`, context);
    }
  },
  info: (message: string, context?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[RSS Feed Info] ${message}`, context);
    }
  }
};

// Use centralized types from @/lib/types
type RSSEntryWithData = RSSFeedEntry;

interface APIRSSEntry {
  entry: RSSItem;
  initialData?: RSSFeedEntry['initialData'];
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

  // PHASE 4: Advanced memoization with stable dependencies for timestamp calculation
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
    
    // PHASE 4: Use a stable time reference to prevent constant recalculation
    // Update every minute instead of every render
    const now = new Date();
    const currentMinute = Math.floor(now.getTime() / (1000 * 60));
    
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
  }, [entry.pubDate, Math.floor(Date.now() / (1000 * 60))]); // Update every minute

  // Memoize handlers to prevent recreating them on every render
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (mediaType === 'podcast') {
      e.preventDefault();
      e.stopPropagation();
      const creatorName = postTitle || undefined;
      playTrack(entry.link, decode(entry.title), entry.image || undefined, creatorName);
    }
  }, [mediaType, entry.link, entry.title, entry.image, postTitle, playTrack]);

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
              onClick={(e: React.MouseEvent) => {
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
            onClick={(e: React.MouseEvent) => {
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
        <div className="flex justify-between items-center mt-4 h-[16px]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
            onClick={(e: React.MouseEvent) => {
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

// Use centralized FeedContentProps from @/lib/types

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
  
  // PHASE 3 OPTIMIZATION: Direct assignment during render instead of useEffect
  // This eliminates 1 useEffect anti-pattern while maintaining the same functionality
  // Reset the endReachedCalled flag when entries change
  const currentEntriesLength = entries.length;
  const previousEntriesLengthRef = useRef(currentEntriesLength);
  
  if (previousEntriesLengthRef.current !== currentEntriesLength) {
    endReachedCalledRef.current = false;
    previousEntriesLengthRef.current = currentEntriesLength;
  }
  
  // CRITICAL: Use intersection observer for throttled, event-driven loading
  // This prevents the "Maximum update depth exceeded" error by avoiding synchronous re-render loops
  useDelayedIntersectionObserver(loadMoreRef, loadMore, {
    enabled: hasMore && !isPending,
    isLoading: isPending,
    hasMore,
    rootMargin: '800px',
    threshold: 0.1,
    delay: 1000 // Universal 1-second delay consistent with other feeds
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
      {/* Fix flash issue: Only show EmptyState when not loading AND no entries */}
      {entries.length === 0 && !isPending && !isInitialRender ? <EmptyState /> : entries.length > 0 ? (
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
      ) : null}
    </div>
  );
}, areFeedContentPropsEqual);

// Add displayName for easier debugging
FeedContent.displayName = 'FeedContent';

// Use centralized RSSFeedClientProps from @/lib/types

// RSS Feed Store Provider Component
// This creates a fresh store instance for each RSS feed, preventing state pollution
const RSSFeedStoreProvider = ({ children }: { children: React.ReactNode }) => {
  const store = useMemo(() => createRSSFeedStore(), []);
  
  return (
    <RSSFeedStoreContext.Provider value={store}>
      {children}
    </RSSFeedStoreContext.Provider>
  );
};

// Internal RSSFeedClient component that uses the store from context
function RSSFeedClientInternal({ postTitle, feedUrl, initialData, pageSize = 30, featuredImg, mediaType, isActive = true, verified, customLoadMore, isSearchMode, externalIsLoading }: RSSFeedClientProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Create a unique key for this podcast page to force complete reset
  const pageKey = useMemo(() => `${feedUrl}-${postTitle}`, [feedUrl, postTitle]);
  
  // PHASE 4: Use granular selectors to minimize re-renders
  const entries = useRSSFeedEntries();
  const loading = useRSSFeedLoading();
  const pagination = useRSSFeedPaginationState();
  const commentDrawer = useRSSFeedCommentDrawer();
  
  // PHASE 4: Use specific selectors for frequently accessed values
  const hasMore = useRSSFeedHasMore();
  const isLoading = useRSSFeedIsLoading();
  
  // Use external loading state when provided (for search mode), otherwise use internal state
  const effectiveIsLoading = externalIsLoading !== undefined ? externalIsLoading : isLoading;
  
  // Get individual actions from store (prevents object recreation)
  const initialize = useRSSFeedInitialize();
  const setActive = useRSSFeedSetActive();
  const setSearchMode = useRSSFeedSetSearchMode();
  
  // PHASE 3 OPTIMIZATION: Use useEffect for state updates to prevent render-phase updates
  // This prevents "Cannot update a component while rendering" errors
  useEffect(() => {
    setActive(isActive);
  }, [isActive, setActive]);
  
  useEffect(() => {
    if (isSearchMode !== undefined) {
      setSearchMode(isSearchMode);
    }
  }, [isSearchMode, setSearchMode]);

  // Initialize store on mount - React key handles component reset
  useEffect(() => {
    if (initialData) {
      logger.info('Initializing RSS feed store', {
        pageKey,
        entriesCount: initialData.entries?.length || 0
      });
      
      initialize({
        entries: initialData.entries || [],
        totalEntries: initialData.totalEntries || 0,
        hasMore: initialData.hasMore || false,
    postTitle,
    feedUrl,
    featuredImg,
        mediaType,
        verified,
        pageSize
      });
    }
  }, [initialData, postTitle, feedUrl, featuredImg, mediaType, verified, pageSize, initialize, pageKey]);
  
  // Use custom hooks for business logic
  const paginationHook = useRSSFeedPaginationHook(customLoadMore, isActive);
  const metricsHook = useRSSFeedMetrics();
  const uiHook = useRSSFeedUI();
  
  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !commentDrawer.isOpen, '.rss-feed-container');
  
  // Create error UI as a separate component
  const ErrorUI = () => (
    <div className="text-center py-8 text-destructive">
      <p className="mb-4">Error loading feed entries</p>
      <Button 
        variant="outline" 
        onClick={() => {
          // Reset to initial data
          if (initialData) {
            initialize({
              entries: initialData.entries || [],
              totalEntries: initialData.totalEntries || 0,
              hasMore: initialData.hasMore || false,
              postTitle,
              feedUrl,
              featuredImg,
              mediaType,
              verified,
              pageSize
            });
          }
        }}
      >
        Try Again
      </Button>
    </div>
  );
  
  if (loading.fetchError) {
    return <ErrorUI />;
  }
  
  return (
    <div className="w-full rss-feed-container">
      <FeedContent
        entries={metricsHook.enhancedEntries}
        hasMore={hasMore} // PHASE 4: Use granular selector
        loadMoreRef={loadMoreRef}
        isPending={effectiveIsLoading} // PHASE 4: Use granular selector
        loadMore={paginationHook.loadMoreEntries}
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
        verified={verified}
        onOpenCommentDrawer={uiHook.handleCommentDrawer.open}
        isInitialRender={loading.isInitialRender}
      />
      {/* PHASE 4: Single global comment drawer with dynamic loading */}
      {commentDrawer.selectedEntry && (
        <Suspense fallback={<CommentSectionFallback />}>
        <CommentSectionClient
            entryGuid={commentDrawer.selectedEntry.entryGuid}
            feedUrl={commentDrawer.selectedEntry.feedUrl}
            initialData={commentDrawer.selectedEntry.initialData}
            isOpen={commentDrawer.isOpen}
            setIsOpen={uiHook.handleCommentDrawer.close}
        />
        </Suspense>
      )}
    </div>
  );
}

// Main RSSFeedClient component with store provider
export function RSSFeedClient(props: RSSFeedClientProps) {
  return (
    <RSSFeedStoreProvider>
      <RSSFeedClientInternal {...props} />
    </RSSFeedStoreProvider>
  );
}

// Memoize the RSSFeedClient component for better performance when used in parent components
const MemoizedRSSFeedClient = React.memo(RSSFeedClient);
MemoizedRSSFeedClient.displayName = "MemoizedRSSFeedClient";

// PHASE 4: Export the memoized component with enhanced error boundary
export function RSSFeedClientWithErrorBoundary(props: RSSFeedClientProps) {
  return (
    <RSSFeedErrorBoundary>
      <MemoizedRSSFeedClient {...props} />
    </RSSFeedErrorBoundary>
  );
}