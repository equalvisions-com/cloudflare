'use client';

import React, { useRef, useState, useMemo, useCallback, useEffect, memo } from 'react';
import { ErrorBoundary as ErrorBoundaryUI } from "@/components/ui/error-boundary";
import { ErrorBoundary } from 'react-error-boundary';
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { FeaturedEntry } from "@/lib/featured_redis";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Podcast, Mail, Loader2, RefreshCw } from "lucide-react";
import { Virtuoso } from 'react-virtuoso';
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";
import { PrefetchAnchor } from "@/utils/PrefetchAnchor";

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

// Interface for post metadata
interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
  verified?: boolean;
}

// Interface for entry with data
interface FeaturedEntryWithData {
  entry: FeaturedEntry;
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
  postMetadata: PostMetadata;
}

interface FeaturedEntryProps {
  entryWithData: FeaturedEntryWithData;
}

// Memoize the FeaturedEntry component
const FeaturedEntry = memo(({ entryWithData: { entry, initialData, postMetadata }, onOpenCommentDrawer, isPriority = false }: FeaturedEntryProps & { onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void, isPriority?: boolean }) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Helper function to prevent scroll jumping on link interaction
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

  // Format the timestamp based on age
  const timestamp = useMemo(() => {
    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let pubDate: Date;
    
    if (typeof entry.pub_date === 'string' && mysqlDateRegex.test(entry.pub_date)) {
      // Convert MySQL datetime string to UTC time
      const [datePart, timePart] = entry.pub_date.split(' ');
      pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      pubDate = new Date(entry.pub_date);
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
  }, [entry.pub_date]);

  // Generate post URL if we have category and post slugs
  const postUrl = postMetadata.postSlug
    ? postMetadata.mediaType === 'newsletter'
      ? `/newsletters/${postMetadata.postSlug}`
      : postMetadata.mediaType === 'podcast'
        ? `/podcasts/${postMetadata.postSlug}`
        : postMetadata.categorySlug 
          ? `/${postMetadata.categorySlug}/${postMetadata.postSlug}`
          : null
    : null;

  // Handle podcast playback
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (postMetadata.mediaType?.toLowerCase() === 'podcast') {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entry.link, decode(entry.title), entry.image || undefined);
    }
  }, [postMetadata.mediaType, entry.link, entry.title, entry.image, playTrack]);

  const handleOpenComment = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCommentDrawer(entry.guid, entry.feed_url, initialData.comments);
  }, [onOpenCommentDrawer, entry.guid, entry.feed_url, initialData.comments]);

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
          {postMetadata.featuredImg && postUrl && (
            <NoFocusLinkWrapper 
              className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
              onClick={handleLinkInteraction}
              onTouchStart={handleLinkInteraction}
            >
              <PrefetchAnchor href={postUrl}>
                <AspectRatio ratio={1}>
                  <Image
                    src={postMetadata.featuredImg}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                    priority={isPriority}
                  />
                </AspectRatio>
              </PrefetchAnchor>
            </NoFocusLinkWrapper>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              {postMetadata.title && (
                <div className="flex items-start justify-between gap-2">
                  {postUrl ? (
                    <NoFocusLinkWrapper 
                      className="hover:opacity-80 transition-opacity"
                      onClick={handleLinkInteraction}
                      onTouchStart={handleLinkInteraction}
                    >
                      <PrefetchAnchor href={postUrl}>
                        <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                          {postMetadata.title}
                          {postMetadata.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                        </h3>
                      </PrefetchAnchor>
                    </NoFocusLinkWrapper>
                  ) : (
                    <h3 className="text-sm font-bold text-primary leading-tight">
                      {postMetadata.title}
                      {postMetadata.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h3>
                  )}
                  <span 
                    className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                    title={format(new Date(entry.pub_date), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {postMetadata.mediaType && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
                  {postMetadata.mediaType.toLowerCase() === 'podcast' && <Podcast className="h-3 w-3" />}
                  {postMetadata.mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" strokeWidth={2.5} />}
                  {postMetadata.mediaType.charAt(0).toUpperCase() + postMetadata.mediaType.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {postMetadata.mediaType?.toLowerCase() === 'podcast' ? (
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
                        priority={isPriority}
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
              // rel="noopener noreferrer" // Removed to make opener potentially bfcache-ineligible
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
                        priority={isPriority}
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
              feedUrl={entry.feed_url}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={initialData.likes}
            />
          </NoFocusWrapper>
          <NoFocusWrapper 
            className="flex items-center"
            onClick={handleOpenComment}
          >
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              initialData={initialData.comments}
              buttonOnly={true}
              data-comment-input
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={initialData.retweets || { isRetweeted: false, count: 0 }}
            />
          </NoFocusWrapper>
          <div className="flex items-center gap-4">
            <NoFocusWrapper className="flex items-center">
              <BookmarkButtonClient
                entryGuid={entry.guid}
                feedUrl={entry.feed_url}
                title={entry.title}
                pubDate={entry.pub_date}
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
});
FeaturedEntry.displayName = 'FeaturedEntry';

// Feed content component is already memoized
const FeedContent = React.memo(({ 
  entries,
  visibleEntries,
  loadMoreRef,
  hasMore,
  loadMore,
  isLoading,
  onOpenCommentDrawer,
  onRefresh
}: { 
  entries: FeaturedEntryWithData[],
  visibleEntries: FeaturedEntryWithData[],
  loadMoreRef: React.MutableRefObject<HTMLDivElement | null>,
  hasMore: boolean,
  loadMore: () => void,
  isLoading: boolean,
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void,
  onRefresh: () => void
}) => {
  // Add ref to prevent multiple endReached calls - MOVED BEFORE CONDITIONAL
  const endReachedCalledRef = useRef(false);
  
  // Reset the endReachedCalled flag when entries change - MOVED BEFORE CONDITIONAL
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [visibleEntries.length]);
  
  // Use the shared hook for intersection observer with 3-second delay
  useDelayedIntersectionObserver(loadMoreRef, loadMore, {
    enabled: hasMore && !isLoading,
    isLoading,
    hasMore,
    rootMargin: '300px',
    threshold: 0.1,
    delay: 3000 // 3 second delay to prevent initial page load triggering
  });

  // Implement the itemContentCallback using the standard pattern
  const itemContentCallback = useCallback((index: number, entryWithData: FeaturedEntryWithData) => {
    // Create a consistent interface for the FeaturedEntry component
    return (
      <FeaturedEntry
        entryWithData={entryWithData}
        onOpenCommentDrawer={onOpenCommentDrawer}
        isPriority={index < 2} // Set priority for the first 2 entries
      />
    );
  }, [onOpenCommentDrawer]);

  if (!entries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-4">
        <p>No featured entries found.</p>
        <Button 
          variant="outline" 
          onClick={onRefresh}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="space-y-0 feed-container" 
      style={{ 
        // CSS properties to prevent focus scrolling
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <Virtuoso
        useWindowScroll
        data={visibleEntries}
        overscan={2000}
        itemContent={itemContentCallback}
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
      
      {/* Fixed position load more container at bottom - exactly like RSSEntriesDisplay */}
      <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
        {hasMore && isLoading && <Loader2 className="h-6 w-6 animate-spin" />}
        {!hasMore && visibleEntries.length > 0 && <div></div>}
      </div>
    </div>
  );
});
FeedContent.displayName = 'FeedContent';

interface FeaturedFeedClientProps {
  initialData: {
    entries: FeaturedEntryWithData[];
    totalEntries: number;
  };
  pageSize?: number;
  isActive?: boolean;
}

// Refreshable Error UI Component
const RefreshableErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => {
  return (
    <div className="w-full flex flex-col items-center justify-center p-8 space-y-4">
      <p className="text-muted-foreground text-center">Something went wrong loading the feed.</p>
      <Button 
        variant="outline" 
        onClick={resetErrorBoundary}
        className="flex items-center gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
};

export const FeaturedFeedClientWithErrorBoundary = memo(function FeaturedFeedClientWithErrorBoundary(props: FeaturedFeedClientProps) {
  const [key, setKey] = useState(0);
  
  // Reset key to force component remount
  const handleReset = useCallback(() => {
    setKey(prevKey => prevKey + 1);
    // Force refresh the window if no other refresh method is available
    window.location.reload();
  }, []);
  
  return (
    <ErrorBoundary 
      FallbackComponent={RefreshableErrorFallback}
      onReset={() => {
        handleReset();
      }}
    >
      <FeaturedFeedClient 
        key={key} 
        {...props} 
      />
    </ErrorBoundary>
  );
});

// Create the client component that will be memoized
const FeaturedFeedClientComponent = ({ initialData, pageSize = 30, isActive = true }: FeaturedFeedClientProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // --- Drawer state for comments ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !commentDrawerOpen, '.feed-container');

  // Log to confirm we're using prefetched data from LayoutManager
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    logger.debug('FeaturedFeedClient: Using prefetched data from LayoutManager', {
      entriesCount: initialData?.entries?.length || 0
    });
  }, [initialData]);
  
  // Calculate visible entries based on current page
  const visibleEntries = useMemo(() => {
    return initialData.entries.slice(0, currentPage * pageSize);
  }, [initialData.entries, currentPage, pageSize]);
  
  // Check if there are more entries to load
  const hasMore = visibleEntries.length < initialData.entries.length;
  
  // Function to load more entries - just update the page number
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      if (!isMountedRef.current) return;
      
      logger.debug('🔄 Loading more featured entries, current page:', currentPage);
      setIsLoading(true);
      // Simulate loading delay for better UX
      setTimeout(() => {
        if (isMountedRef.current) {
          setCurrentPage(prev => prev + 1);
          setIsLoading(false);
          logger.debug('✅ Finished loading more featured entries');
        }
      }, 300);
    }
  }, [hasMore, isLoading, currentPage]);
  
  // Check if we need to load more when component mounts or content is short
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const checkContentHeight = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If content is shorter than viewport and we have more entries to load, load them
      if (documentHeight <= viewportHeight && visibleEntries.length > 0 && hasMore && !isLoading) {
        logger.debug('📏 Content is shorter than viewport, loading more entries automatically');
        loadMore();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [visibleEntries.length, hasMore, isLoading, loadMore]);
  
  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);

  // Memoize the comment drawer state change handler
  const handleCommentDrawerOpenChange = useCallback((open: boolean) => {
    if (!isMountedRef.current) return;
    setCommentDrawerOpen(open);
  }, []);

  // Handle refresh by resetting page
  const handleRefresh = useCallback(() => {
    if (!isMountedRef.current) return;
    setCurrentPage(1);
    // Could trigger a data refetch here if needed
  }, []);

  return (
    <div className="w-full feed-container">
      <FeedContent
        entries={initialData.entries}
        visibleEntries={visibleEntries}
        loadMoreRef={loadMoreRef}
        hasMore={hasMore}
        loadMore={loadMore}
        isLoading={isLoading}
        onOpenCommentDrawer={handleOpenCommentDrawer}
        onRefresh={handleRefresh}
      />
      {selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={selectedCommentEntry.entryGuid}
          feedUrl={selectedCommentEntry.feedUrl}
          initialData={selectedCommentEntry.initialData}
          isOpen={commentDrawerOpen}
          setIsOpen={handleCommentDrawerOpenChange}
        />
      )}
    </div>
  );
};

// Export the memoized version of the component
export const FeaturedFeedClient = memo(FeaturedFeedClientComponent); 