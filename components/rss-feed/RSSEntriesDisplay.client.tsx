'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback, memo, useDeferredValue } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { RSSItem } from "@/components/rss-feed/FeedTabsContainer";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';
import { Podcast, Mail, Loader2, ArrowUp, ArrowDown, MoveUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import useSWR from 'swr';
import { FOLLOWED_POSTS_KEY } from '@/components/follow-button/FollowButton';
import { NoFocusWrapper } from "@/utils/NoFocusButton";
import { NoFocusLinkWrapper, NoFocusAnchor } from "@/utils/NoFocusLink";
import { useFeedFocusPrevention } from "@/utils/FeedInteraction";
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

// Helper function to consistently parse dates from the database
const parseEntryDate = (dateString: string | Date): Date => {
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
  const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  
  if (typeof dateString === 'string' && mysqlDateRegex.test(dateString)) {
    // Convert MySQL datetime string - do NOT add 'Z' as the database times are in local timezone (EST)
    // Adding 'Z' incorrectly treats EST times as UTC, causing a 4-hour offset
    const [datePart, timePart] = dateString.split(' ');
    return new Date(`${datePart}T${timePart}`); // No 'Z' - let JS interpret as local time
  }
  
  // Handle other formats
  return new Date(dateString);
};

// Helper function to format dates back to MySQL format without timezone conversion
const formatDateForAPI = (date: Date): string => {
  // Format as YYYY-MM-DDTHH:MM:SS.sssZ but preserve the original timezone intent
  // Since our database stores EST times, we need to format without UTC conversion
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  // Return in ISO format but using local time components (no UTC conversion)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
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
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    categorySlug?: string;
    postSlug?: string;
    verified?: boolean;
  };
}

// Interface for post metadata used within the component
interface InternalPostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  categorySlug?: string;
  postSlug?: string;
  verified?: boolean;
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
}

// Memoize the RSSEntry component to prevent unnecessary re-renders
const RSSEntry = React.memo(({ entryWithData: { entry, initialData, postMetadata }, onOpenCommentDrawer }: RSSEntryProps & { onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void }) => {
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

  // Format the timestamp based on age
  const timestamp = useMemo(() => {
    // Use the consistent date parsing helper
    const pubDate = parseEntryDate(entry.pubDate);
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
  }, [entry.pubDate]);

  // Ensure we have valid postMetadata
  const safePostMetadata = useMemo(() => {
    // Use type assertion to access feedTitle
    const feedTitle = entry.feedTitle || '';
    
    return {
      title: postMetadata?.title || feedTitle,
      featuredImg: postMetadata?.featuredImg || entry.image || '',
      mediaType: postMetadata?.mediaType || entry.mediaType || '',
      categorySlug: postMetadata?.categorySlug || '',
      postSlug: postMetadata?.postSlug || '',
      verified: postMetadata?.verified || false
    };
  }, [postMetadata, entry]);

  // Generate post URL
  const postUrl = safePostMetadata.postSlug
    ? safePostMetadata.mediaType === 'newsletter'
      ? `/newsletters/${safePostMetadata.postSlug}`
      : safePostMetadata.mediaType === 'podcast'
        ? `/podcasts/${safePostMetadata.postSlug}`
        : safePostMetadata.categorySlug 
          ? `/${safePostMetadata.categorySlug}/${safePostMetadata.postSlug}`
          : null
    : null;

  // Direct click handler without scroll stabilization
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (safePostMetadata.mediaType === 'podcast') {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entry.link, decode(entry.title), entry.image || undefined);
    }
  }, [safePostMetadata.mediaType, entry.link, entry.title, entry.image, playTrack]);

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
          {safePostMetadata.featuredImg && postUrl && (
            <NoFocusLinkWrapper className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
              onClick={handleLinkInteraction}
              onTouchStart={handleLinkInteraction}
            >
              <PrefetchAnchor href={postUrl}>
                <AspectRatio ratio={1}>
                  <Image
                    src={safePostMetadata.featuredImg}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                    priority={false}
                  />
                </AspectRatio>
              </PrefetchAnchor>
            </NoFocusLinkWrapper>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              {safePostMetadata.title && (
                <div className="flex items-start justify-between gap-2">
                  {postUrl ? (
                    <NoFocusLinkWrapper 
                      className="hover:opacity-80 transition-opacity"
                      onClick={handleLinkInteraction}
                      onTouchStart={handleLinkInteraction}
                    >
                      <PrefetchAnchor href={postUrl}>
                        <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                          {safePostMetadata.title}
                          {safePostMetadata.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                        </h3>
                      </PrefetchAnchor>
                    </NoFocusLinkWrapper>
                  ) : (
                    <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                      {safePostMetadata.title}
                      {safePostMetadata.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h3>
                  )}
                  <span 
                    className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                    title={format(new Date(entry.pubDate), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {safePostMetadata.mediaType && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
                  {safePostMetadata.mediaType.toLowerCase() === 'podcast' && <Podcast className="h-3 w-3" />}
                  {safePostMetadata.mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" strokeWidth={2.5} />}
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
              onClick={(e) => {
                handleLinkInteraction(e);
                handleCardClick(e);
              }}
              onTouchStart={handleLinkInteraction}
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
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
            </div>
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
              onOpenCommentDrawer(entry.guid, entry.feedUrl, initialData.comments);
            }}
          >
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              initialData={initialData.comments}
              buttonOnly={true}
              data-comment-input
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
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  const prevEntry = prevProps.entryWithData;
  const nextEntry = nextProps.entryWithData;
  
  // Only re-render if these key properties have changed
  if (prevEntry.entry.guid !== nextEntry.entry.guid) return false;
  if (prevEntry.initialData.likes.count !== nextEntry.initialData.likes.count) return false;
  if (prevEntry.initialData.likes.isLiked !== nextEntry.initialData.likes.isLiked) return false;
  if (prevEntry.initialData.comments.count !== nextEntry.initialData.comments.count) return false;
  if (prevEntry.initialData.retweets?.count !== nextEntry.initialData.retweets?.count) return false;
  if (prevEntry.initialData.retweets?.isRetweeted !== nextEntry.initialData.retweets?.isRetweeted) return false;
  if (prevEntry.initialData.bookmarks?.isBookmarked !== nextEntry.initialData.bookmarks?.isBookmarked) return false;
  
  // Return true to prevent re-render if nothing important changed
  return true;
});
RSSEntry.displayName = 'RSSEntry';

interface RSSEntriesClientProps {
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
  };
  pageSize?: number;
  isActive?: boolean;
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

interface EntriesContentProps {
  paginatedEntries: RSSEntryWithData[];
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isPending: boolean;
  loadMore: () => void;
  entryMetrics: Record<string, EntryMetrics> | null;
  postMetadata?: Map<string, any>;
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
    feedMetadataCache: Record<string, any>;
  };
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  isInitializing?: boolean;
  pageSize: number;
}

// Define the component function first
function EntriesContentComponent({
  paginatedEntries,
  hasMore,
  loadMoreRef,
  isPending,
  loadMore,
  entryMetrics,
  postMetadata,
  initialData,
  onOpenCommentDrawer,
  isInitializing = false,
  pageSize
}: EntriesContentProps) {
  // Debug logging for pagination
  useEffect(() => {
    logger.debug(`📊 EntriesContent rendered with ${paginatedEntries.length} entries, hasMore: ${hasMore}, isPending: ${isPending}, isInitializing: ${isInitializing}`);
  }, [paginatedEntries.length, hasMore, isPending, isInitializing]);
  
  // Add ref for tracking if endReached was already called
  const endReachedCalledRef = useRef(false);
  
  // Create a stable ref for entriesData to avoid unnecessary virtuoso recreations
  const entriesDataRef = useRef(paginatedEntries);
  
  // Add a ref for the Virtuoso component to control scrolling
  const virtuosoRef = useRef<any>(null);
  
  // Only update the ref when entries actually change (not on every render)
  useEffect(() => {
    entriesDataRef.current = paginatedEntries;
  }, [paginatedEntries]);
  
  // Reset the endReachedCalled flag when entries change
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [paginatedEntries.length]);
  
  // Use a ref to store the itemContent callback to ensure stability
  const itemContentCallback = useCallback((index: number, item: RSSEntryWithData) => {
    // Make a shallow copy to avoid mutating the original
    const entryWithData = {...item};
    
    // Create a new initialData object instead of mutating directly
    let updatedInitialData = {...entryWithData.initialData};
    let updatedPostMetadata = {...entryWithData.postMetadata};
    
    // Use metrics from Convex query if available
    if (entryMetrics && entryWithData.entry.guid in entryMetrics) {
      updatedInitialData = {...entryMetrics[entryWithData.entry.guid]};
    }
    
    // Use metadata from Convex query if available
    if (postMetadata && postMetadata.has(entryWithData.entry.feedUrl)) {
      const metadata = postMetadata.get(entryWithData.entry.feedUrl);
      if (metadata) {
        updatedPostMetadata = {
          ...updatedPostMetadata,
          ...metadata
        };
      }
    }
    // Check the cached metadata as fallback
    else if (initialData.feedMetadataCache && 
             entryWithData.entry.feedUrl in initialData.feedMetadataCache) {
      const cachedMetadata = initialData.feedMetadataCache[entryWithData.entry.feedUrl];
      if (cachedMetadata) {
        updatedPostMetadata = {
          ...updatedPostMetadata,
          ...cachedMetadata
        };
      }
    }
    
    // Create a new entry object with updated data instead of mutating
    const finalEntryWithData = {
      ...entryWithData,
      initialData: updatedInitialData,
      postMetadata: updatedPostMetadata
    };
    
    return (
      <RSSEntry 
        entryWithData={finalEntryWithData} 
        onOpenCommentDrawer={onOpenCommentDrawer} 
      />
    );
  }, [entryMetrics, postMetadata, initialData.feedMetadataCache, onOpenCommentDrawer]);
  
  // Handle endReached separately to improve debugging
  const handleEndReached = useCallback(() => {
    // Check if we're at the end and should load more
    if (hasMore && !isPending && !endReachedCalledRef.current) {
      logger.debug('📜 Virtuoso reached end of list, loading more entries');
      endReachedCalledRef.current = true;
      loadMore();
    } else if (endReachedCalledRef.current) {
      logger.debug('📜 Virtuoso endReached already called, waiting for completion');
    } else {
      logger.debug(`📜 Not loading more: hasMore=${hasMore}, isPending=${isPending}`);
    }
  }, [hasMore, isPending, loadMore]);
  
  // Create a manual load more handler
  const handleManualLoadMore = useCallback(() => {
    if (hasMore && !isPending) {
      logger.debug('📜 Manual load more button clicked');
      loadMore();
    }
  }, [hasMore, isPending, loadMore]);
  
  // Setup intersection observer for load more detection
  useEffect(() => {
    if (!loadMoreRef.current) return;
    
    // Wait 3 seconds before establishing the observer
    // This prevents any initial load from triggering
    const timer = setTimeout(() => {
      // Store the reference to the DOM element to ensure it exists when observer runs
      const loadMoreElement = loadMoreRef.current;
      
      // Skip if element no longer exists
      if (!loadMoreElement) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (entry.isIntersecting && hasMore && !isPending && !endReachedCalledRef.current) {
            logger.debug('📜 Load more element visible, triggering load');
            endReachedCalledRef.current = true;
            loadMore();
          }
        },
        { 
          rootMargin: '300px',
          threshold: 0.1
        }
      );
      
      // Safe to observe now that we've checked it exists
      observer.observe(loadMoreElement);
      
      return () => {
        observer.disconnect();
      };
    }, 3000); // 3 second delay to prevent initial page load triggering
    
    return () => {
      clearTimeout(timer);
    };
  }, [loadMoreRef, hasMore, isPending, loadMore]);
  
  // Store a reference to the first instance - will only log on initial creation
  const hasLoggedInitialCreateRef = useRef(false);
  
  // Memoize the Virtuoso component with minimal dependencies
  const virtuosoComponent = useMemo(() => {
    // Skip rendering Virtuoso if we have no entries yet
    if (paginatedEntries.length === 0 && !isInitializing) {
      return null;
    }
    
    // Only log the first time to avoid duplicate messages
    if (!hasLoggedInitialCreateRef.current) {
      logger.debug('🎯 Creating Virtuoso component instance', {
        entriesCount: paginatedEntries.length,
        timestamp: new Date().toISOString(),
      });
      hasLoggedInitialCreateRef.current = true;
    }
    
    // When entries are available, render Virtuoso
    return (
      <Virtuoso
        ref={virtuosoRef}
        useWindowScroll
        data={paginatedEntries}
        computeItemKey={(_, item) => item.entry.guid}
        itemContent={itemContentCallback}
        overscan={2000}
        components={{
          Footer: () => null
        }}
        // Add focus prevention styling
        style={{ 
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation'
        }}
        className="focus:outline-none focus-visible:outline-none"
      />
    );
  // ⚠️ IMPORTANT: Use minimal dependencies to prevent recreation
  // DO NOT include paginatedEntries in the dependency array - Virtuoso handles data updates internally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemContentCallback, isInitializing, virtuosoRef]);

  // Check if this is truly empty (not just initial loading)
  if (paginatedEntries.length === 0 && !isInitializing) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Render the memoized Virtuoso component and load more indicator
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
      {virtuosoComponent}
      
      {/* Fixed position load more container at bottom */}
      <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
        {hasMore && isPending && <Loader2 className="h-6 w-6 animate-spin" />}
        {!hasMore && paginatedEntries.length > 0 && <div></div>}
      </div>
    </div>
  );
}

// Then apply React.memo with correct typing and custom comparison
const EntriesContent = React.memo<EntriesContentProps>(
  EntriesContentComponent, 
  (prevProps, nextProps) => {
    // Only re-render if these critical properties change
    if (prevProps.paginatedEntries.length !== nextProps.paginatedEntries.length) return false;
    if (prevProps.hasMore !== nextProps.hasMore) return false;
    if (prevProps.isPending !== nextProps.isPending) return false;
    
    // If entryMetrics changed in a meaningful way, re-render
    if (
      (!prevProps.entryMetrics && nextProps.entryMetrics) || 
      (prevProps.entryMetrics && !nextProps.entryMetrics)
    ) return false;
    
    // Skip deep comparison of entries if possible - assume they're immutable
    // If all the above checks pass, prevent re-render
    return true;
  }
);

// Add displayName to avoid React DevTools issues
EntriesContent.displayName = 'EntriesContent';

// Create the client component that will be memoized
const RSSEntriesClientComponent = ({ 
  initialData, 
  pageSize = 30, 
  isActive = true
}: RSSEntriesClientProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Track errors for better error handling
  const [fetchError, setFetchError] = useState<Error | null>(null);
  
  // Use a fixed number of items per request for consistency
  const ITEMS_PER_REQUEST = pageSize;
  
  // Track all entries manually - store in a ref to prevent loss during tab switching
  const [allEntriesState, setAllEntriesState] = useState<RSSEntryWithData[]>([]);
  const entriesStateRef = useRef<RSSEntryWithData[]>([]);
  
  // Add a persistent cache for feed metadata to ensure consistency during pagination
  const feedMetadataCache = useRef<Record<string, any>>({});
  
  // Store pagination state in refs to preserve during tab switches
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const [hasMoreState, setHasMoreState] = useState(false);
  const hasMoreRef = useRef(false);
  
  // Track currently followed post titles for accurate pagination
  const [currentPostTitles, setCurrentPostTitles] = useState<string[]>(initialData?.postTitles || []);
  const postTitlesRef = useRef<string[]>(initialData?.postTitles || []);
  
  // Track if we've initialized with the initial data
  const hasInitializedRef = useRef(false);
  
  // --- Drawer state for comments ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Add state for Twitter-style refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newEntries, setNewEntries] = useState<RSSEntryWithData[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [hasRefreshed, setHasRefreshed] = useState(false); // Track if we've already done a refresh
  
  // Add state for total entries count that can be updated
  const [totalEntriesCount, setTotalEntriesCount] = useState(initialData?.totalEntries || 0);
  const totalEntriesRef = useRef(initialData?.totalEntries || 0);

  // Add state for notification
  const [showNotification, setShowNotification] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationImages, setNotificationImages] = useState<string[]>([]);

  // Add state for mediaTypes
  const mediaTypesRef = useRef<string[] | undefined>(initialData?.mediaTypes);

  // Add a ref to store the newest entry date from BEFORE any refresh
  const preRefreshNewestEntryDateRef = useRef<string | undefined>(undefined);

  // Update state and refs together for better consistency
  const updateEntriesState = useCallback((newEntries: RSSEntryWithData[]) => {
    entriesStateRef.current = newEntries;
    setAllEntriesState(newEntries);
  }, []);

  const updatePageState = useCallback((page: number) => {
    currentPageRef.current = page;
    setCurrentPage(page);
  }, []);

  const updateHasMoreState = useCallback((hasMore: boolean) => {
    hasMoreRef.current = hasMore;
    setHasMoreState(hasMore);
  }, []);

  // Add function to update post titles
  const updatePostTitlesState = useCallback((titles: string[]) => {
    postTitlesRef.current = titles;
    setCurrentPostTitles(titles);
  }, []);

  // Update the updateTotalEntriesState function
  const updateTotalEntriesState = useCallback((count: number) => {
    totalEntriesRef.current = count;
    setTotalEntriesCount(count);
  }, []);

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Add a global mousedown handler to prevent focus on non-interactive elements
  useEffect(() => {
    if (!isActive) return;
    
    // Define handler for mousedown events - capture in the capture phase before focus can happen
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if the target is in a drawer content or is a text input/textarea
      const isInDrawer = target.closest('[data-drawer-content]') || 
                         target.closest('[role="dialog"]');
      const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
                         
      // Skip focus prevention for drawer content or input fields
      if (isInDrawer || isInputField) {
        return;
      }
      
      // If the target is inside our feed container, prevent focus behavior
      const isInFeed = target.closest('.rss-feed-container');
      if (isInFeed) {
        // Prevent default focus behavior
        e.preventDefault();
        e.stopPropagation();
        
        // Actively remove focus from any element that might have received it
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    
    // Define a handler for all click events in the feed to prevent focus
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Skip focus prevention for drawer content or input fields
      const isInDrawer = target.closest('[data-drawer-content]') || 
                         target.closest('[role="dialog"]');
      const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
                         
      if (isInDrawer || isInputField) {
        return;
      }
      
      // Only apply to elements inside our list
      const isInFeed = target.closest('.rss-feed-container');
      if (!isInFeed) return;
      
      // For any element in the feed, clear focus after click completes
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
    
    // Add passive scroll handler to improve performance
    const handleScroll = () => {
      // Clear any focus that might have been set during scroll
      if (document.activeElement instanceof HTMLElement && 
          document.activeElement.tagName !== 'BODY') {
        
        // Don't blur input elements or elements in drawers
        const isInDrawer = document.activeElement.closest('[data-drawer-content]') || 
                           document.activeElement.closest('[role="dialog"]');
        const isInputField = document.activeElement.tagName === 'INPUT' || 
                           document.activeElement.tagName === 'TEXTAREA' || 
                           document.activeElement.isContentEditable;
                           
        if (!isInDrawer && !isInputField) {
          document.activeElement.blur();
        }
      }
    };
    
    // Use capture phase to intercept before default browser behavior
    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    document.addEventListener('click', handleDocumentClick, true);
    // Passive event listener improves scroll performance
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [isActive]);

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !commentDrawerOpen, '.rss-feed-container');

  // Initialize with initial data only once
  useEffect(() => {
    if (!initialData?.entries?.length || hasInitializedRef.current) return;
    
    logger.debug('Initializing feed with initial data:', {
      entriesCount: initialData.entries.length,
      hasMore: initialData.hasMore,
      totalEntries: initialData.totalEntries,
      postTitles: initialData.postTitles?.length || 0,
      feedUrls: initialData.feedUrls?.length || 0, 
      mediaTypes: initialData.mediaTypes?.length || 0
    });

    // Log actual mediaTypes to help with debugging
    if (initialData.mediaTypes && initialData.mediaTypes.length > 0) {
      logger.debug('Server provided mediaTypes:', initialData.mediaTypes);
    } else {
      logger.warn('No mediaTypes provided by server!');
    }
    
    // CRITICAL: Capture the newest entry date from initial data BEFORE any refresh
    // This ensures we have a baseline that doesn't include refresh results
    if (initialData.entries.length > 0) {
      const sortedInitialEntries = [...initialData.entries].sort((a, b) => {
        const dateA = parseEntryDate(a.entry.pubDate).getTime();
        const dateB = parseEntryDate(b.entry.pubDate).getTime();
        return dateB - dateA; // Newest first
      });
      
      if (sortedInitialEntries[0]?.entry.pubDate) {
        const newestInitialDate = parseEntryDate(sortedInitialEntries[0].entry.pubDate);
        
        if (!isNaN(newestInitialDate.getTime()) && newestInitialDate.getTime() <= Date.now()) {
          preRefreshNewestEntryDateRef.current = formatDateForAPI(newestInitialDate);
          logger.debug(`📅 CAPTURED pre-refresh newest entry date: ${preRefreshNewestEntryDateRef.current} from entry: "${sortedInitialEntries[0].entry.title}"`);
        }
      }
    }
    
    // Cache all feed metadata from initial entries for consistent rendering
    initialData.entries.forEach(entry => {
      if (entry.entry.feedUrl && entry.postMetadata) {
        feedMetadataCache.current[entry.entry.feedUrl] = entry.postMetadata;
      }
    });
    
    // Initialize all our state
    updateEntriesState(initialData.entries);
    updateHasMoreState(!!initialData.hasMore);
    updatePageState(1);
    
    // Update total entries count
    if (initialData.totalEntries) {
      updateTotalEntriesState(initialData.totalEntries);
    }
    
    // Update post titles
    if (initialData.postTitles) {
      updatePostTitlesState(initialData.postTitles);
    }
    
    // Create a ref for mediaTypes to ensure persistence
    if (initialData.mediaTypes) {
      mediaTypesRef.current = initialData.mediaTypes;
    }
    
    // Mark as initialized so we don't reset when tabs switch
    hasInitializedRef.current = true;
  }, [initialData, updateEntriesState, updateHasMoreState, updatePageState, updateTotalEntriesState, updatePostTitlesState]);

  // When returning to active tab, use the stored refs to restore state if needed
  useEffect(() => {
    if (isActive && hasInitializedRef.current) {
      // Only restore if the states don't match the refs (might happen due to React rendering)
      if (allEntriesState.length === 0 && entriesStateRef.current.length > 0) {
        logger.debug('Restoring entries from ref on tab activation');
        setAllEntriesState(entriesStateRef.current);
      }
      
      if (currentPage !== currentPageRef.current) {
        setCurrentPage(currentPageRef.current);
      }
      
      if (hasMoreState !== hasMoreRef.current) {
        setHasMoreState(hasMoreRef.current);
      }
      
      if (totalEntriesCount !== totalEntriesRef.current) {
        setTotalEntriesCount(totalEntriesRef.current);
      }
    }
  }, [isActive, allEntriesState, currentPage, hasMoreState, totalEntriesCount]);

  // Function to load more entries - update to use refs
  const loadMoreEntries = useCallback(async () => {
    // Only load more if the tab is active and not already loading/no more data
    if (!isActive || isLoading || !hasMoreRef.current) { 
      logger.debug(`⚠️ Not loading more: isActive=${isActive}, isLoading=${isLoading}, hasMoreState=${hasMoreRef.current}`);
      return;
    }
    
    if (!isMountedRef.current) {
      logger.debug('Component not mounted, skipping loadMore');
      return;
    }
    
    // Set loading state immediately to prevent multiple calls
    setIsLoading(true);
    logger.debug(`📥 Loading more entries, current page: ${currentPageRef.current}, next page: ${currentPageRef.current + 1}, current entries: ${entriesStateRef.current.length}`);
    
    try {
      // Use ONLY the server-provided complete list of post titles
      // This is the most reliable source of truth for ALL followed feeds
      const postTitlesParam = JSON.stringify(postTitlesRef.current);
      
      // Also include feed URLs for proper pagination of newly created feeds
      const feedUrlsParam = JSON.stringify(initialData?.feedUrls || []);
      
      logger.debug(`📋 Using ${postTitlesRef.current.length} post titles and ${initialData?.feedUrls?.length || 0} feed URLs from server for pagination`);
      
      // Make a direct fetch to the API
      const baseUrl = new URL('/api/rss/paginate', window.location.origin);
      const nextPage = currentPageRef.current + 1;
      baseUrl.searchParams.set('page', nextPage.toString());
      baseUrl.searchParams.set('pageSize', ITEMS_PER_REQUEST.toString());
      baseUrl.searchParams.set('postTitles', postTitlesParam);
      
      // Add feedUrls to the query parameters
      if (initialData?.feedUrls && initialData.feedUrls.length > 0) {
        baseUrl.searchParams.set('feedUrls', feedUrlsParam);
      }
      
      // CRITICAL FIX: Pass the current number of entries the client has
      // This allows the server to calculate the correct offset that accounts for new entries
      // added to the top of the feed by the refresh process
      const currentEntriesCount = entriesStateRef.current.length;
      baseUrl.searchParams.set('currentEntriesCount', currentEntriesCount.toString());
      logger.debug(`📊 Passing current entries count for offset calculation: ${currentEntriesCount}`);
      
      // Pass the total entries to avoid unnecessary COUNT queries on the server
      // Use our dynamically updated totalEntriesRef instead of the static initialData
      if (totalEntriesRef.current > 0) {
        baseUrl.searchParams.set('totalEntries', totalEntriesRef.current.toString());
        logger.debug(`📊 Passing updated totalEntries: ${totalEntriesRef.current}`);
      }
      
      // Add cache busting parameter to ensure we get fresh data
      baseUrl.searchParams.set('t', Date.now().toString());
      
      logger.debug(`📡 Fetching page ${nextPage} from API: ${baseUrl.toString()}`);
      
      const response = await fetch(baseUrl.toString());
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      logger.debug(`📦 Received data from API:`, {
        entriesCount: data.entries?.length || 0,
        hasMore: data.hasMore,
        totalEntries: data.totalEntries
      });
      
      // Update total entries if provided in response
      if (data.totalEntries && data.totalEntries !== totalEntriesRef.current) {
        logger.debug(`📊 Updating totalEntries from ${totalEntriesRef.current} to ${data.totalEntries}`);
        updateTotalEntriesState(data.totalEntries);
      }
      
      // Update post titles from the response if available
      if (data.postTitles && data.postTitles.length > 0) {
        logger.debug(`📋 Updating post titles from response: ${data.postTitles.length} titles`);
        updatePostTitlesState(data.postTitles);
      }
      
      // Transform the entries to match the expected format
      const transformedEntries = data.entries
        .filter(Boolean)
        .map((entry: RSSItem) => {
          // If it's a direct RSS item, wrap it with proper metadata
          if (entry && 'guid' in entry && entry.guid) {
            // Try to find post metadata from initialData based on feedUrl
            const feedUrl = 'feedUrl' in entry ? entry.feedUrl : '';
            
            // First check our cached metadata
            let existingMetadata = null;
            if (feedUrl && feedMetadataCache.current[feedUrl]) {
              existingMetadata = feedMetadataCache.current[feedUrl];
            } else {
              // Fallback to finding in initialData
              if (initialData && initialData.entries && initialData.entries.length > 0) {
                const matchingEntry = initialData.entries.find(
                  e => e && e.entry && e.entry.feedUrl === feedUrl
                );
                
                if (matchingEntry && matchingEntry.postMetadata) {
                  existingMetadata = matchingEntry.postMetadata;
                  // Cache this for future use
                  feedMetadataCache.current[feedUrl] = existingMetadata;
                }
              }
            }
            
            // Get title directly
            const entryTitle = entry.title || '';
            // Get feed title if available
            const feedTitle = entry.feedTitle || '';
            
            // Create final metadata
            const finalMetadata = existingMetadata || {
              title: feedTitle || entryTitle || '',
              featuredImg: entry.image || '',
              mediaType: entry.mediaType || '',
              categorySlug: '',
              postSlug: '',
              verified: false // Default verified to false
            };
            
            // Cache this metadata for future entries from this feed
            if (feedUrl) {
              feedMetadataCache.current[feedUrl] = finalMetadata;
            }
            
            return {
              entry: entry,
              initialData: {
                likes: { isLiked: false, count: 0 },
                comments: { count: 0 },
                retweets: { isRetweeted: false, count: 0 },
                bookmarks: { isBookmarked: false }
              },
              postMetadata: finalMetadata
            } as RSSEntryWithData;
          }
          
          return null;
        })
        .filter(Boolean) as RSSEntryWithData[];
      
      logger.debug(`✅ Transformed ${transformedEntries.length} entries`);
      
      // Update state with new entries, only if component is still mounted
      if (isMountedRef.current) {
        // Use our updateX functions to keep refs and state in sync
        const updatedEntries = [...entriesStateRef.current, ...transformedEntries];
        
        // Batch state updates to reduce re-renders
        updateEntriesState(updatedEntries);
        updatePageState(nextPage);
        updateHasMoreState(data.hasMore);
      }
      
    } catch (error) {
      logger.error('❌ Error loading more entries:', error);
      if (isMountedRef.current) {
        setFetchError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    initialData, 
    isLoading, 
    ITEMS_PER_REQUEST, 
    isActive, 
    updateEntriesState, 
    updatePageState, 
    updateHasMoreState, 
    updateTotalEntriesState,
    updatePostTitlesState, 
    postTitlesRef
  ]);
  
  // Extract all entry GUIDs for metrics query
  const entryGuids = useMemo(() => {
    return allEntriesState
      .filter((entry: RSSEntryWithData) => entry && entry.entry && entry.entry.guid)
      .map((entry: RSSEntryWithData) => entry.entry.guid);
  }, [allEntriesState]);
  
  // Extract unique feed URLs for metadata query
  const feedUrls = useMemo(() => {
    return [...new Set(
      allEntriesState
        .filter((entry: RSSEntryWithData) => entry && entry.entry && entry.entry.feedUrl)
        .map((entry: RSSEntryWithData) => entry.entry.feedUrl)
    )];
  }, [allEntriesState]);
  
  // Use the combined query to fetch entry metrics - ONLY IF ACTIVE
  const combinedData = useQuery(
    api.entries.getFeedDataWithMetrics,
    isActive && entryGuids.length > 0 ? { entryGuids, feedUrls } : "skip"
  );
  
  // Defer data updates to prevent synchronous re-renders that may cause scroll jumps
  const deferredCombinedData = useDeferredValue(combinedData);
  
  // Update metadata cache with any new data from the Convex query
  useEffect(() => {
    if (!deferredCombinedData?.postMetadata) return;
    
    deferredCombinedData.postMetadata.forEach(item => {
      if (item.feedUrl && item.metadata) {
        // Update our metadata cache with latest Convex data
        feedMetadataCache.current[item.feedUrl] = item.metadata;
      }
    });
  }, [deferredCombinedData]);
  
  // Create a map for metrics lookups with better memoization
  const metricsMap = useMemo(() => {
    if (!deferredCombinedData?.entryMetrics?.length) return new Map();
    
    return new Map(
      deferredCombinedData.entryMetrics.map(item => [item.guid, item.metrics])
    );
  }, [deferredCombinedData?.entryMetrics]);
  
  // Create a map for post metadata lookups with better memoization
  const postMetadataMap = useMemo(() => {
    if (!deferredCombinedData?.postMetadata?.length) return new Map<string, InternalPostMetadata>();

    return new Map<string, InternalPostMetadata>(
      deferredCombinedData.postMetadata.map(item => [item.feedUrl, item.metadata])
    );
  }, [deferredCombinedData?.postMetadata]);
  
  // Get entry metrics map for use in rendering with better memoization
  const entryMetricsMap = useMemo(() => {
    if (!metricsMap || metricsMap.size === 0) return null;
    
    // Convert the map to a simple object for easier use in components
    const metricsObject: Record<string, EntryMetrics> = {};
    metricsMap.forEach((metrics, guid) => {
      metricsObject[guid] = metrics;
    });
    
    return metricsObject;
  }, [metricsMap]);
  
  // Memoize the try again handler
  const handleTryAgain = useCallback(() => {
    if (!isMountedRef.current) return;
    
    setFetchError(null);
    updateEntriesState(initialData?.entries || []);
    updatePageState(1);
    updateHasMoreState(!!initialData?.hasMore);
  }, [initialData, updateEntriesState, updatePageState, updateHasMoreState]);
  
  // Memoize the comment drawer state change handler
  const handleCommentDrawerOpenChange = useCallback((open: boolean) => {
    if (!isMountedRef.current) return;
    setCommentDrawerOpen(open);
  }, []);
  
  // Add function to handle new entries
  const handleNewEntries = useCallback((entries: RSSEntryWithData[]) => {
    if (!entries.length) {
      logger.debug('No new entries to handle');
      return;
    }
    
    logger.debug(`🔄 handleNewEntries called with ${entries.length} entries`);
    logger.debug(`🔄 Current entries count before update: ${entriesStateRef.current.length}`);
    logger.debug(`🔄 Component mounted: ${isMountedRef.current}`);
    
    try {
      // Get current entries from ref for consistency
      const currentEntries = entriesStateRef.current;
      
      // Create a set of existing entry GUIDs for fast lookup
      const existingGuids = new Set(currentEntries.map(entry => entry.entry.guid));
      
      // Filter out any duplicate entries
      const uniqueNewEntries = entries.filter(entry => !existingGuids.has(entry.entry.guid));
      
      if (uniqueNewEntries.length === 0) {
        logger.debug('No unique new entries to show after filtering');
        return;
      }
      
      logger.debug(`🔄 Found ${uniqueNewEntries.length} unique new entries after deduplication`);
      
      // Sort new entries by publication date in descending order (newest first)
      // This ensures proper chronological ordering across all RSS feeds
      const sortedNewEntries = [...uniqueNewEntries].sort((a, b) => {
        const dateA = new Date(a.entry.pubDate).getTime();
        const dateB = new Date(b.entry.pubDate).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      
      logger.debug(`🔄 Prepending ${sortedNewEntries.length} chronologically sorted entries to ${currentEntries.length} existing entries`);
      
      // Save the count for notification
      setNotificationCount(sortedNewEntries.length);
      
      // Extract featured images from the first 3 new entries
      const featuredImages = sortedNewEntries
        .slice(0, 3) // Take only first 3 entries
        .map(entry => {
          // Try to get featured image from postMetadata first, then from entry
          return entry.postMetadata?.featuredImg || entry.entry.image || '';
        })
        .filter(img => img !== ''); // Remove empty strings
      
      setNotificationImages(featuredImages);
      
      // Show notification
      setShowNotification(true);
      logger.debug(`🔄 Notification set to show with count: ${sortedNewEntries.length}`);
      
      // Prepend sorted new entries to the existing ones using our update function to keep refs in sync
      const newEntriesArray = [...sortedNewEntries, ...currentEntries];
      logger.debug(`🔄 About to update entries state with ${newEntriesArray.length} total entries`);
      
      updateEntriesState(newEntriesArray);
      
      logger.debug(`🔄 Entries state updated. New total: ${newEntriesArray.length}`);
      
      // Set a timer to hide the notification after a few seconds
      setTimeout(() => {
        if (isMountedRef.current) {
        setShowNotification(false);
          logger.debug(`🔄 Notification hidden after timeout`);
        }
      }, 5000);
      
    } catch (error) {
      logger.error('🔄 Error handling new entries:', error);
    }
  }, [updateEntriesState]);

  // Update the effect that processes new entries
  useEffect(() => {
    logger.debug(`🔄 useEffect for newEntries triggered. Length: ${newEntries.length}`);
    
    // When new entries are received, handle them automatically
    if (newEntries.length > 0) {
      logger.debug(`🔄 Processing ${newEntries.length} new entries via useEffect`);
      handleNewEntries(newEntries);
      setNewEntries([]); // Clear after handling
      logger.debug(`🔄 Cleared newEntries state after processing`);
    } else {
      logger.debug(`🔄 No new entries to process in useEffect`);
    }
  }, [newEntries, handleNewEntries]);
  
  // Add function to trigger one-time background refresh
  const triggerOneTimeRefresh = useCallback(async () => {
    // Don't refresh if we've already refreshed or are currently refreshing
    if (isRefreshing || hasRefreshed) {
      logger.debug('Skipping refresh: already refreshed or currently refreshing');
      return;
    }
    
    // Use ONLY the server-provided complete list from our state
    // This is the most reliable source of truth for ALL followed feeds
    const currentPostTitles = postTitlesRef.current;
    
    // Also use server-provided feed URLs
    const currentFeedUrls = initialData?.feedUrls || [];
    
    // Ensure we pass the server-provided mediaTypes - use the ref to ensure persistence
    const currentMediaTypes = mediaTypesRef.current || [];
    
    logger.debug(`🔄 Refreshing using server-provided data:
    - Post titles: ${currentPostTitles.length}
    - Feed URLs: ${currentFeedUrls.length}
    - Media types: ${currentMediaTypes.length} - ${currentMediaTypes.join(', ')}`);
    
    // Find the newest entry from our existing entries to maintain chronological order
    // This prevents older entries from newly created feeds from appearing at the top
    let newestEntryDate: string | undefined = undefined;
    
    // CRITICAL FIX: Use the pre-refresh newest entry date that was captured from initial data
    // This prevents using entries that were just inserted during previous refresh cycles
    if (preRefreshNewestEntryDateRef.current) {
      newestEntryDate = preRefreshNewestEntryDateRef.current;
      logger.debug(`📅 Using pre-refresh newest entry date: ${newestEntryDate}`);
    } else {
      // Fallback: Only use current state entries, not initial data, to avoid stale data
      logger.debug(`📅 No pre-refresh date available, calculating from current state only`);
      logger.debug(`📅 Current state has ${entriesStateRef.current.length} entries`);
      logger.debug(`📅 Sample current entries:`, entriesStateRef.current.slice(0, 3).map(e => ({
        title: e.entry.title,
        pubDate: e.entry.pubDate,
        guid: e.entry.guid
      })));
      
      try {
        // Only use entries from current state, not initial data
        const currentEntries = entriesStateRef.current;
        
        if (currentEntries.length > 0) {
          // Sort by publication date in descending order to find the newest
          const sortedEntries = [...currentEntries].sort((a, b) => {
            const dateA = parseEntryDate(a.entry.pubDate).getTime();
            const dateB = parseEntryDate(b.entry.pubDate).getTime();
            return dateB - dateA; // Newest first
          });
          
          logger.debug(`📅 Top 3 entries after sorting:`, sortedEntries.slice(0, 3).map(e => ({
            title: e.entry.title,
            pubDate: e.entry.pubDate,
            timestamp: parseEntryDate(e.entry.pubDate).getTime()
          })));
          
          // Get the date of the newest entry
          if (sortedEntries[0] && sortedEntries[0].entry.pubDate) {
            const candidateDate = parseEntryDate(sortedEntries[0].entry.pubDate);
            const currentTime = Date.now();
            
            logger.debug(`📅 Candidate newest entry: "${sortedEntries[0].entry.title}" with pubDate: ${sortedEntries[0].entry.pubDate}`);
            
            // Validate that the date is not in the future (no buffer - exact comparison)
            if (candidateDate.getTime() <= currentTime) {
              newestEntryDate = formatDateForAPI(candidateDate);
              logger.debug(`📅 Fallback: Found valid newest entry date: ${newestEntryDate} from "${sortedEntries[0].entry.title}"`);
            } else {
              // If the newest entry is in the future, use current time instead
              const futureMs = candidateDate.getTime() - currentTime;
              logger.warn(`⚠️ CLIENT: Newest entry date is ${(futureMs / 1000).toFixed(1)} seconds in the future, using current time instead`);
              newestEntryDate = formatDateForAPI(new Date());
            }
          }
        } else {
          logger.debug(`📅 No current entries available for newest date calculation`);
        }
      } catch (error) {
        logger.error('Error determining newest entry date:', error);
        // Continue without the newest date - better than not refreshing
      }
    }
    
    logger.debug(`📅 FINAL: Will send newestEntryDate: ${newestEntryDate} to refresh API`);
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      logger.debug('🔄 Starting one-time refresh of feeds (and creating missing ones)');
      
      // Collect all existing entry GUIDs from the ref to avoid duplicates
      const existingGuids = entriesStateRef.current.map(entry => entry.entry.guid);
      
      const response = await fetch('/api/refresh-feeds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postTitles: currentPostTitles,
          feedUrls: currentFeedUrls,
          mediaTypes: currentMediaTypes,
          existingGuids, // Send existing GUIDs to filter out duplicates
          newestEntryDate // Send the newest entry date for chronological filtering
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // SERVERLESS FIX: Add comprehensive logging of the response
      logger.debug(`🔄 Refresh API response:`, {
        success: data.success,
        refreshedAny: data.refreshedAny,
        entriesCount: data.entries?.length || 0,
        newEntriesCount: data.newEntriesCount,
        hasEntries: !!(data.entries && Array.isArray(data.entries)),
        responseKeys: Object.keys(data)
      });
      
      if (data.success) {
        // Mark that we've completed a refresh regardless of whether anything was refreshed
        setHasRefreshed(true);
        
        // Update post titles with the COMPLETE list of all followed titles
        // This is crucial for pagination to work with newly followed posts
        if (data.postTitles && data.postTitles.length > 0) {
          logger.debug(`📋 Updating post titles from refresh response - COMPLETE LIST: ${data.postTitles.length} titles`);
          updatePostTitlesState(data.postTitles);
        }
        
        // Update total entries count if provided in the response
        if (data.totalEntries && data.totalEntries !== totalEntriesRef.current) {
          logger.debug(`📊 Updating totalEntries from refresh response: ${data.totalEntries}`);
          updateTotalEntriesState(data.totalEntries);
        }
        
        if (data.refreshedAny) {
          logger.debug(`✅ Successfully refreshed feeds, found ${data.newEntriesCount} truly new entries`);
          
          if (data.entries && data.entries.length > 0) {
            // Add more robust logging and validation for serverless environments
            logger.debug(`🔄 Processing ${data.entries.length} new entries from refresh response`);
            logger.debug(`🔄 Entry sample:`, data.entries[0]);
            
            // Validate that entries have the expected structure
            const validEntries = data.entries.filter((entry: any) => {
              const isValid = entry && 
                             entry.entry && 
                             entry.entry.guid && 
                             entry.entry.title && 
                             entry.postMetadata;
              
              if (!isValid) {
                logger.warn(`🔄 Invalid entry structure:`, entry);
              }
              
              return isValid;
            });
            
            if (validEntries.length > 0) {
              logger.debug(`🔄 Setting ${validEntries.length} valid new entries to state`);
              
              // Force a state update by using a functional update
              setNewEntries(prevNewEntries => {
                logger.debug(`🔄 Previous newEntries length: ${prevNewEntries.length}`);
                logger.debug(`🔄 Setting new entries length: ${validEntries.length}`);
                return validEntries;
              });
              
              // Also trigger the handler directly as a fallback for serverless environments
              // This ensures the entries get processed even if the useEffect doesn't fire properly
              setTimeout(() => {
                if (isMountedRef.current) {
                  logger.debug(`🔄 Fallback - directly calling handleNewEntries with ${validEntries.length} entries`);
                  handleNewEntries(validEntries);
                }
              }, 100); // Small delay to allow state to settle
              
            } else {
              logger.warn(`🔄 No valid entries found after validation`);
            }
          } else {
            logger.debug('No new entries found after refresh');
          }
        } else {
          logger.debug('✅ No feeds needed refreshing (all were fetched within 4 hours)');
        }
      } else {
        throw new Error(data.error || 'Unknown error during refresh');
      }
    } catch (error) {
      logger.error('❌ Error during background refresh:', error);
      setRefreshError(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsRefreshing(false);
    }
  }, [
    // Only include dependencies that should actually trigger a recreation of this callback
    // Remove initialData?.entries and callback dependencies that cause unnecessary recreations
    initialData?.feedUrls, 
    isRefreshing, 
    hasRefreshed
    // Removed: initialData?.entries, updateTotalEntriesState, updatePostTitlesState, postTitlesRef, entriesStateRef, mediaTypesRef
    // These are accessed via refs or are stable, so they don't need to be in dependencies
  ]);

  // Trigger one-time refresh after initial render - always refresh immediately
  useEffect(() => {
    // Only check if the component is active and hasn't already refreshed
    // IMPORTANT: We still refresh even when there are no entries, which is essential for
    // creating feeds that don't exist yet
    if (!isActive || hasRefreshed) return;
    
    // Make sure we have initialData with either postTitles or feedUrls
    if (!initialData || (!initialData.postTitles?.length && !initialData.feedUrls?.length)) {
      logger.warn('Cannot refresh: Missing initialData or both postTitles and feedUrls');
      return;
    }
    
    // Run immediately without delay
    logger.debug('Triggering immediate automatic refresh for all feeds');
    triggerOneTimeRefresh();
    
  }, [isActive, initialData, hasRefreshed, triggerOneTimeRefresh]);

  // Add back handleOpenCommentDrawer
  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);

  // Extract the onSuccess callback to include updatePostTitlesState in dependencies
  const handleFollowedPostsUpdate = useCallback(async () => {
    logger.debug('Followed posts update detected, refreshing feed data');
    if (isMountedRef.current) {
      // Fetch latest entries from server - but keep the old ones until we get new ones
      try {
        // Add cache busting parameter to ensure we get fresh data
        const cacheKey = `${FOLLOWED_POSTS_KEY}${FOLLOWED_POSTS_KEY.includes('?') ? '&' : '?'}t=${Date.now()}`;
        const response = await fetch(cacheKey);
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        if (isMountedRef.current && data) {
          // CRITICAL: Update our post titles list FIRST to ensure we have the complete list
          // This is especially important after following new posts
          if (data.postTitles) {
            logger.debug(`📋 HIGH PRIORITY: Updating post titles after follow change - complete list: ${data.postTitles.length} titles`);
            updatePostTitlesState(data.postTitles);
          }
          
          // Update total entries count if available
          if (data.totalEntries) {
            logger.debug(`📊 Updating totalEntries after follow change: ${data.totalEntries}`);
            updateTotalEntriesState(data.totalEntries);
          }
          
          // Only update entries if we got some
          if (data.entries && data.entries.length > 0) {
            // Use our update functions to keep refs and state in sync
            updateEntriesState(data.entries);
            updatePageState(1);
            updateHasMoreState(!!data.hasMore);
            
            // Reset hasRefreshed so we can refresh again if needed
            setHasRefreshed(false);
          }
        }
      } catch (error) {
        logger.error('Error refreshing feed after follow status change:', error);
      }
    }
  }, [updatePostTitlesState, updateTotalEntriesState, updateEntriesState, updatePageState, updateHasMoreState]);

  // Listen for global followed posts changes with improved handling
  useSWR(FOLLOWED_POSTS_KEY, null, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 0,
    onSuccess: handleFollowedPostsUpdate
  });

  // Add a combined function to handle all refresh attempts
  const handleRefreshAttempt = useCallback(() => {
    // Clear all error states
    setFetchError(null);
    setRefreshError(null);
    setIsRefreshing(false);
    
    // Reset hasRefreshed to allow triggering a new refresh
    setHasRefreshed(false);
    
    // Attempt to refresh immediately
    triggerOneTimeRefresh();
  }, [triggerOneTimeRefresh]);

  // Display error message if there's an error
  if (fetchError) {
    logger.error('Feed loading error', { message: fetchError.message || 'Error loading entries' });
    
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <p className="text-muted-foreground text-sm mb-4">Unable to load content</p>
        <Button 
          variant="outline"
          className="flex items-center gap-2" 
          onClick={handleRefreshAttempt}
        >
          <ArrowDown className="h-4 w-4" />
          Refresh Feed
        </Button>
      </div>
    );
  }
  
  // Return the EntriesContent directly
  return (
    <div className="w-full rss-feed-container">
      {/* Floating notification for new posts */}
      {showNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-out">
          <div className="py-2 px-4 bg-primary text-primary-foreground rounded-full shadow-md flex items-center gap-2">
            {notificationImages.length > 0 ? (
              <div className="flex items-center gap-1">
                <MoveUp className="h-3 w-3" />
                <div className="flex items-center -space-x-1">
                  {notificationImages.map((imageUrl, index) => (
                    <div key={index} className="relative w-4 h-4 rounded-full overflow-hidden">
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="16px"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-sm font-medium">
            {notificationCount} new {notificationCount === 1 ? 'post' : 'posts'}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Show refresh button for any errors - no detailed error messages */}
      {refreshError && (
        <div className="p-4 flex justify-center">
          <Button 
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleRefreshAttempt}
          >
            <ArrowDown className="h-4 w-4" />
            Refresh Feed
          </Button>
        </div>
      )}
      
      {/* Main content */}
      <EntriesContent
        paginatedEntries={allEntriesState}
        hasMore={hasMoreState}
        loadMoreRef={loadMoreRef}
        isPending={isLoading}
        loadMore={loadMoreEntries}
        entryMetrics={entryMetricsMap}
        postMetadata={postMetadataMap}
        initialData={{
          ...initialData,
          feedMetadataCache: feedMetadataCache.current
        }}
        onOpenCommentDrawer={handleOpenCommentDrawer}
        isInitializing={!hasInitializedRef.current || allEntriesState.length === 0}
        pageSize={ITEMS_PER_REQUEST}
      />
      
      {/* Comment drawer */}
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
export const RSSEntriesClient = memo(RSSEntriesClientComponent);
RSSEntriesClient.displayName = 'RSSEntriesClient';

export const RSSEntriesClientWithErrorBoundary = memo(function RSSEntriesClientWithErrorBoundary(props: RSSEntriesClientProps) {
  return (
    <ErrorBoundary>
      <RSSEntriesClient {...props} />
    </ErrorBoundary>
  );
}); 