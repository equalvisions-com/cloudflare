'use client';

import React, { useRef, useMemo, useCallback, useEffect, memo, lazy, Suspense } from 'react';
import { ErrorBoundary as ErrorBoundaryUI } from "@/components/ui/error-boundary";
import { ErrorBoundary } from 'react-error-boundary';
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { FeaturedEntry } from "@/lib/featured_kv";
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

// Production-ready hooks and store integration
import { FeaturedFeedStoreProvider } from '@/components/featured/FeaturedFeedStoreProvider';
import { useFeaturedFeedDataManagement } from '@/hooks/useFeaturedFeedDataManagement';
import { useFeaturedFeedUIManagement } from '@/hooks/useFeaturedFeedUI';
import { useFeaturedFeedMemoryManagement } from '@/hooks/useFeaturedFeedMemoryManagement';
import {
  useFeaturedFeedEntries,
  useFeaturedFeedLoading,
  useFeaturedFeedPagination,
  useFeaturedFeedActions
} from '@/components/featured/FeaturedFeedStoreProvider';

import type { 
  FeaturedFeedClientProps,
  FeaturedFeedEntryWithData,
  FeaturedFeedPostMetadata
} from '@/lib/types';

// PHASE 4.1: Dynamic imports for heavy components to reduce initial bundle size
const LikeButtonClient = lazy(() => 
  import("@/components/like-button/LikeButtonClient").then(mod => ({ default: mod.LikeButtonClient }))
);

const CommentSectionClient = lazy(() => 
  import("@/components/comment-section/CommentSectionClient").then(mod => ({ default: mod.CommentSectionClient }))
);

const ShareButtonClient = lazy(() => 
  import("@/components/share-button/ShareButtonClient").then(mod => ({ default: mod.ShareButtonClient }))
);

const RetweetButtonClientWithErrorBoundary = lazy(() => 
  import("@/components/retweet-button/RetweetButtonClient").then(mod => ({ default: mod.RetweetButtonClientWithErrorBoundary }))
);

const BookmarkButtonClient = lazy(() => 
  import("@/components/bookmark-button/BookmarkButtonClient").then(mod => ({ default: mod.BookmarkButtonClient }))
);

// PHASE 4.1: Loading fallback components for dynamic imports
const ButtonLoadingFallback = memo(() => (
  <div className="h-8 w-8 rounded bg-muted animate-pulse" />
));
ButtonLoadingFallback.displayName = 'ButtonLoadingFallback';

const CommentSectionLoadingFallback = memo(() => (
  <div className="flex items-center justify-center p-4 bg-background/50 backdrop-blur-sm">
    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    <span className="ml-2 text-sm text-muted-foreground">Loading comments...</span>
  </div>
));
CommentSectionLoadingFallback.displayName = 'CommentSectionLoadingFallback';

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

// Interface for entry props
interface FeaturedEntryProps {
  entryWithData: FeaturedFeedEntryWithData;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  isPriority?: boolean;
}

// Memoize the FeaturedEntry component
const FeaturedEntry = memo(({ entryWithData: { entry, initialData, postMetadata }, onOpenCommentDrawer, isPriority = false }: FeaturedEntryProps) => {
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
      data-entry-id={entry.guid}
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
                <Image
                  src={postMetadata.featuredImg}
                  alt={postMetadata.title}
                  fill
                  className="object-cover"
                  sizes="48px"
                  priority={isPriority}
                />
              </PrefetchAnchor>
            </NoFocusLinkWrapper>
          )}
          
          {/* Title and Source */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm text-foreground truncate">
                {postMetadata.title}
              </h3>
              {postMetadata.verified && <VerifiedBadge />}
              {postMetadata.mediaType === 'podcast' && (
                <Podcast className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              {postMetadata.mediaType === 'newsletter' && (
                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {timestamp}
            </p>
          </div>
        </div>

        {/* Entry Content */}
        <div className="space-y-3">
          {/* Entry Image */}
          {entry.image && (
            <div className="relative w-full">
              <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
                <Image
                  src={entry.image}
                  alt={decode(entry.title)}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={isPriority}
                />
              </AspectRatio>
            </div>
          )}

          {/* Entry Title and Description */}
          <div className="space-y-2">
            <h2 className="font-semibold text-base leading-tight">
              <NoFocusLinkWrapper 
                className="hover:underline"
                onClick={handleLinkInteraction}
                onTouchStart={handleLinkInteraction}
              >
                <PrefetchAnchor href={entry.link} target="_blank" rel="noopener noreferrer">
                  {decode(entry.title)}
                </PrefetchAnchor>
              </NoFocusLinkWrapper>
            </h2>
            
            {entry.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {decode(entry.description)}
              </p>
            )}
          </div>

          {/* Action Buttons with Suspense for dynamic imports */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <Suspense fallback={<ButtonLoadingFallback />}>
                <LikeButtonClient
                  entryGuid={entry.guid}
                  feedUrl={entry.feed_url}
                  title={entry.title}
                  pubDate={entry.pub_date}
                  link={entry.link}
                  initialData={initialData.likes}
                />
              </Suspense>
              
              <NoFocusWrapper onClick={handleOpenComment}>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {initialData.comments.count}
                </Button>
              </NoFocusWrapper>

              <Suspense fallback={<ButtonLoadingFallback />}>
                <RetweetButtonClientWithErrorBoundary
                  entryGuid={entry.guid}
                  feedUrl={entry.feed_url}
                  title={entry.title}
                  pubDate={entry.pub_date}
                  link={entry.link}
                  initialData={initialData.retweets}
                />
              </Suspense>
            </div>

            <div className="flex items-center gap-2">
              <Suspense fallback={<ButtonLoadingFallback />}>
                <BookmarkButtonClient
                  entryGuid={entry.guid}
                  feedUrl={entry.feed_url}
                  title={entry.title}
                  pubDate={entry.pub_date}
                  link={entry.link}
                  initialData={initialData.bookmarks}
                />
              </Suspense>
              
              <Suspense fallback={<ButtonLoadingFallback />}>
                <ShareButtonClient
                  url={entry.link}
                  title={decode(entry.title)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
});
FeaturedEntry.displayName = 'FeaturedEntry';

// Feed Content Component with Virtualization
const FeedContent = memo(({ 
  entries, 
  visibleEntries, 
  loadMoreRef, 
  hasMore, 
  loadMore, 
  isLoading, 
  onOpenCommentDrawer, 
  onRefresh 
}: {
  entries: FeaturedFeedEntryWithData[];
  visibleEntries: FeaturedFeedEntryWithData[];
  loadMoreRef: React.MutableRefObject<HTMLDivElement | null>;
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  onRefresh: () => void;
}) => {
  // Use intersection observer for load more
  useDelayedIntersectionObserver(loadMoreRef, loadMore, { 
    enabled: hasMore && !isLoading,
    isLoading,
    hasMore,
    threshold: 0.1 
  });

  return (
    <div className="w-full">
      <Virtuoso
        data={visibleEntries}
        itemContent={(index, item) => (
          <div key={item.entry.guid} className="border-b border-border last:border-b-0">
            <FeaturedEntry
              entryWithData={item}
              onOpenCommentDrawer={onOpenCommentDrawer}
              isPriority={index < 3}
            />
          </div>
        )}
        className="focus:outline-none focus-visible:outline-none"
        computeItemKey={(_, item) => item.entry.guid}
      />
      
      {/* Fixed position load more container at bottom */}
      <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
        {hasMore && isLoading && <Loader2 className="h-6 w-6 animate-spin" />}
        {!hasMore && visibleEntries.length > 0 && <div></div>}
      </div>
    </div>
  );
});
FeedContent.displayName = 'FeedContent';

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

// Main Featured Feed Client Component (Production-Ready)
const FeaturedFeedClientComponent = ({ initialData, pageSize = 30, isActive = true }: FeaturedFeedClientProps) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Production-ready custom hooks
  const dataManagement = useFeaturedFeedDataManagement({
    isActive,
    pageSize,
    initialData
  });

  const uiManagement = useFeaturedFeedUIManagement({
    isActive
  });

  const memoryManagement = useFeaturedFeedMemoryManagement({
    maxCacheSize: 100,
    cleanupInterval: 5 * 60 * 1000 // 5 minutes
  });

  // Store state selectors
  const entries = useFeaturedFeedEntries();
  const loading = useFeaturedFeedLoading();
  const pagination = useFeaturedFeedPagination();
  const actions = useFeaturedFeedActions();

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !uiManagement.handleCommentDrawer.isOpen, '.feed-container');

  // Calculate visible entries based on current page
  const visibleEntries = useMemo(() => {
    return entries.slice(0, pagination.visibleEntries || pageSize);
  }, [entries, pagination.visibleEntries, pageSize]);

  // Check if there are more entries to load
  const hasMore = pagination.hasMore;

  // Handle refresh
  const handleRefresh = useCallback(() => {
    dataManagement.refreshEntries();
  }, [dataManagement]);

  // Auto-load more content if viewport is not filled
  useEffect(() => {
    const checkContentHeight = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If content is shorter than viewport and we have more entries to load, load them
      if (documentHeight <= viewportHeight && visibleEntries.length > 0 && hasMore && !loading.isLoading) {
        logger.debug('📏 Content is shorter than viewport, loading more entries automatically');
        dataManagement.loadMoreEntries();
      }
    };
    
    const timer = setTimeout(checkContentHeight, 200);
    return () => clearTimeout(timer);
  }, [visibleEntries.length, hasMore, loading.isLoading, dataManagement]);

  // Log initialization
  useEffect(() => {
    logger.debug('FeaturedFeedClient: Initialized with production-ready hooks', {
      entriesCount: entries.length,
      isActive,
      pageSize
    });
  }, [entries.length, isActive, pageSize]);

  return (
    <div className="w-full feed-container">
      <FeedContent
        entries={entries}
        visibleEntries={visibleEntries}
        loadMoreRef={loadMoreRef}
        hasMore={hasMore}
        loadMore={dataManagement.loadMoreEntries}
        isLoading={loading.isLoading}
        onOpenCommentDrawer={uiManagement.handleCommentDrawer.open}
        onRefresh={handleRefresh}
      />
      {uiManagement.handleCommentDrawer.selectedEntry && (
        <Suspense fallback={<CommentSectionLoadingFallback />}>
          <CommentSectionClient
            entryGuid={uiManagement.handleCommentDrawer.selectedEntry.entryGuid}
            feedUrl={uiManagement.handleCommentDrawer.selectedEntry.feedUrl}
            initialData={uiManagement.handleCommentDrawer.selectedEntry.initialData}
            isOpen={uiManagement.handleCommentDrawer.isOpen}
            setIsOpen={(open: boolean) => {
              if (!open) {
                uiManagement.handleCommentDrawer.close();
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

// Export the memoized version with store provider
export const FeaturedFeedClient = memo(function FeaturedFeedClient(props: FeaturedFeedClientProps) {
  return (
    <FeaturedFeedStoreProvider>
      <FeaturedFeedClientComponent {...props} />
    </FeaturedFeedStoreProvider>
  );
});

// Export with Error Boundary
export const FeaturedFeedClientWithErrorBoundary = memo(function FeaturedFeedClientWithErrorBoundary(props: FeaturedFeedClientProps) {
  const handleReset = useCallback(() => {
    // Force refresh the window if no other refresh method is available
    window.location.reload();
  }, []);
  
  return (
    <ErrorBoundary 
      FallbackComponent={RefreshableErrorFallback}
      onReset={handleReset}
    >
      <FeaturedFeedClient {...props} />
    </ErrorBoundary>
  );
}); 