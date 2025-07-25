'use client';

import React, { useEffect, useMemo, useCallback, useRef, memo, MouseEvent, TouchEvent } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { decode } from 'html-entities';
import { Podcast, Mail, Search } from 'lucide-react';
import { LikeButtonClient } from '@/components/like-button/LikeButtonClient';
import { CommentSectionClient } from '@/components/comment-section/CommentSectionClient';
import { RetweetButtonClientWithErrorBoundary } from '@/components/retweet-button/RetweetButtonClient';
import { ShareButtonClient } from '@/components/share-button/ShareButtonClient';
import { BookmarkButtonClient } from '@/components/bookmark-button/BookmarkButtonClient';
import { Virtuoso } from 'react-virtuoso';
import { useBatchEntryMetrics } from '@/hooks/useBatchEntryMetrics';

// Memory optimization for large datasets - Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
  overscan: 2000, // Current buffer size
  maxBufferSize: 10000, // Maximum items to keep in memory
  recycleThreshold: 5000, // Start recycling items after this many
  increaseViewportBy: { top: 600, bottom: 600 }, // Viewport extension
};

// Memory management for large entries lists
const optimizeEntriesForMemory = (entries: EntriesRSSEntry[], maxSize: number = VIRTUAL_SCROLL_CONFIG.maxBufferSize): EntriesRSSEntry[] => {
  // If we're under the threshold, return as-is
  if (entries.length <= maxSize) {
    return entries;
  }
  
  // Keep the most recent entries up to maxSize
  // This ensures we don't run out of memory with very large entry feeds
  return entries.slice(0, maxSize);
};
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerPlayTrack
} from '@/lib/stores/audioPlayerStore';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";
import { useEntriesData } from '@/lib/hooks/useEntriesData';
import { EntriesRSSEntry, EntriesDisplayProps, InteractionStates } from '@/lib/types';
import { SkeletonFeed } from '@/components/ui/skeleton-feed';

// Main component using modern React patterns
const EntriesDisplayComponent = ({
  mediaType,
  searchQuery,
  className,
  isVisible = false,
  pageSize = 30,
}: EntriesDisplayProps) => {
  // Use custom hook for all data management
  const {
    entries,
    hasMore,
    isLoading,
    isInitialLoad,
    isMetricsLoading,
    commentDrawerOpen,
    selectedCommentEntry,
    getMetrics,
    loadMore,
    handleOpenCommentDrawer,
    handleCommentDrawerClose,
  } = useEntriesData({
    mediaType,
    searchQuery,
    isVisible,
    pageSize,
  });

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isVisible && !commentDrawerOpen, '.entries-display-container');

  // Create a ref for the intersection observer target
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Add ref for tracking if endReached was already called
  const endReachedCalledRef = useRef(false);

  // Use universal delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMore, {
    enabled: isVisible && hasMore && !isLoading && entries.length > 0,
    isLoading,
    hasMore,
    rootMargin: '1000px',
    threshold: 0.1
  });

  // Reset endReachedCalled flag when entries length changes
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [entries.length]);

  // Apply memory optimization to prevent excessive memory usage
  const optimizedEntries = useMemo(() => 
    optimizeEntriesForMemory(entries), 
    [entries]
  );

  // Get entry GUIDs for batch metrics query
  const entryGuids = useMemo(() => {
    const guids = optimizedEntries.map(entry => entry.guid);
    
    // Debug logging for pagination tracking
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Entries Display: entryGuids calculated', {
        totalEntries: optimizedEntries.length,
        totalGuids: guids.length,
        firstFew: guids.slice(0, 3),
        lastFew: guids.slice(-3),
        timestamp: Date.now()
      });
    }
    
    return guids;
  }, [optimizedEntries]);
  
  // Debug logging for entries changes
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Entries Display: entries changed', {
        totalEntries: entries.length,
        optimizedEntries: optimizedEntries.length,
        entryGuids: entryGuids.length,
        timestamp: Date.now()
      });
    }
  }, [entries.length, optimizedEntries.length, entryGuids.length]);
  
  // Use batch metrics hook for reactive updates (getMetrics comes from useEntriesData)
  // The useEntriesData hook already handles server metrics via useBatchEntryMetrics with initialMetrics

  // Use a ref to store the itemContent callback to ensure stability
  const itemContentCallback = useCallback((index: number, entry: EntriesRSSEntry) => {
    // Get metrics from batch query - use universal pattern like other feeds
    const metrics = getMetrics ? getMetrics(entry.guid) : null;
    
    // Use default interactions when no batch metrics available
    const defaultInteractions = {
      likes: { isLiked: false, count: 0 },
      comments: { count: 0 },
      retweets: { isRetweeted: false, count: 0 },
      bookmarks: { isBookmarked: false }
    };
    
    return (
      <EntryCard 
        entry={entry} 
        interactions={metrics || defaultInteractions}
        onOpenCommentDrawer={handleOpenCommentDrawer}
        useBatchMetrics={true}
      />
    );
  }, [getMetrics, handleOpenCommentDrawer]);

  // Don't render anything if tab is not visible
  if (!isVisible) {
    return null;
  }

  // Derived loading state - show skeleton only for initial load, not pagination
  const shouldShowSkeleton = (isLoading && isInitialLoad) || (entries.length === 0 && isInitialLoad);
  
  // Derived empty state - only show after we've confirmed no results
  const shouldShowEmpty = entries.length === 0 && !isLoading && !isInitialLoad;

  if (shouldShowSkeleton) {
    return (
      <div className={cn("", className)}>
        <SkeletonFeed count={5} />
      </div>
    );
  }

  if (shouldShowEmpty) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-6 px-4", className)}>
        {/* Icon cluster */}
        <div className="relative mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-muted to-muted/60 rounded-2xl flex items-center justify-center border border-border shadow-lg">
            <Search className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text content */}
        <div className="text-center space-y-1">
          <h3 className="text-foreground font-medium text-sm">No matches found</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Try different keywords or browse categories
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("w-full entries-display-container", className)}
      style={{ 
        // CSS properties to prevent focus scrolling
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <Virtuoso
        useWindowScroll
        data={optimizedEntries}
        overscan={VIRTUAL_SCROLL_CONFIG.overscan}
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
        computeItemKey={(_, item) => item.guid}
        increaseViewportBy={VIRTUAL_SCROLL_CONFIG.increaseViewportBy}
        restoreStateFrom={undefined}
      />
      
      {/* Footer with spacing for mobile dock - always show for proper mobile UX */}
      <div 
        ref={hasMore ? loadMoreRef : undefined} 
        className="h-52 flex items-center justify-center mb-20"
      >
        {hasMore && isLoading && (
          <NoFocusWrapper className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </NoFocusWrapper>
        )}
      </div>
      
      {selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={selectedCommentEntry.entryGuid}
          feedUrl={selectedCommentEntry.feedUrl}
          initialData={selectedCommentEntry.initialData}
          isOpen={commentDrawerOpen}
          setIsOpen={handleCommentDrawerClose}
          skipQuery={true}
        />
      )}
    </div>
  );
};

// Export the memoized version of the component with batch metrics comparison
export const EntriesDisplay = memo(EntriesDisplayComponent, (prevProps, nextProps) => {
  // Fast path: check primitive values first
  if (prevProps.isVisible !== nextProps.isVisible) return false;
  if (prevProps.pageSize !== nextProps.pageSize) return false;
  if (prevProps.mediaType !== nextProps.mediaType) return false;
  if (prevProps.searchQuery !== nextProps.searchQuery) return false;
  if (prevProps.className !== nextProps.className) return false;
  
  // All checks passed - prevent re-render for optimal performance
  return true;
});

// Modified EntryCard to accept interactions prop, onOpenCommentDrawer, and useBatchMetrics flag
const EntryCard = memo(({ entry, interactions, onOpenCommentDrawer, useBatchMetrics = false }: { 
  entry: EntriesRSSEntry; 
  interactions: InteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  useBatchMetrics?: boolean;
}) => {
  // Get state and actions from Zustand store
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Memoized decoded content (must be defined early since it's used in callbacks)
  const decodedContent = useMemo(() => ({
    title: decode(entry.title || ''),
    description: decode(entry.description || '')
  }), [entry.title, entry.description]);

  // Helper function to prevent scroll jumping on link interaction
  const handleLinkInteraction = useCallback((e: MouseEvent | TouchEvent) => {
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

  // Generate post URL if we have media type and post slugs
  const postUrl = useMemo(() => {
    const mediaType = entry.post_media_type || entry.mediaType;
    if (!mediaType || !entry.post_slug) return null;
    
    // Convert media type to plural form for URL
    const mediaTypeLower = mediaType.toLowerCase();
    const pluralMediaType = mediaTypeLower.endsWith('s') ? mediaTypeLower : `${mediaTypeLower}s`;
    
    return `/${pluralMediaType}/${entry.post_slug}`;
  }, [entry.post_media_type, entry.mediaType, entry.post_slug]);

  // Handle card click for podcasts
  const handleCardClick = useCallback((e: MouseEvent) => {
    if (entry.post_media_type?.toLowerCase() === 'podcast' || entry.mediaType?.toLowerCase() === 'podcast') {
      e.preventDefault();
      e.stopPropagation();
      const creatorName = entry.post_title || entry.feed_title || undefined;
      playTrack(entry.link, decodedContent.title, entry.image || undefined, creatorName);
    } else {
      e.stopPropagation();
      handleLinkInteraction(e);
    }
  }, [entry.post_media_type, entry.mediaType, entry.link, decodedContent.title, entry.image, entry.post_title, entry.feed_title, playTrack, handleLinkInteraction]);
  
  // Memoize the comment handler
  const handleCommentClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenCommentDrawer(entry.guid, entry.feed_url || '', { count: interactions.comments.count });
  }, [entry.guid, entry.feed_url, interactions.comments.count, onOpenCommentDrawer]);

  const isPodcast = useMemo(() => {
    return entry.post_media_type?.toLowerCase() === 'podcast' || entry.mediaType?.toLowerCase() === 'podcast';
  }, [entry.post_media_type, entry.mediaType]);
  
  const isNewsletter = useMemo(() => {
    return entry.post_media_type?.toLowerCase() === 'newsletter' || entry.mediaType?.toLowerCase() === 'newsletter';
  }, [entry.post_media_type, entry.mediaType]);
  
  const mediaTypeFormatted = useMemo(() => {
    const mediaType = entry.post_media_type || entry.mediaType || '';
    return mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
  }, [entry.post_media_type, entry.mediaType]);

  // Memoize featured image source (for top-left small image)
  const featuredImageSrc = useMemo(() => {
    // Priority: Post featured image (primary) > Entry image (fallback) > Default
    const primaryImage = entry.post_featured_img;
    const fallbackImage = entry.image;
    const defaultImage = '/placeholder-image.jpg';
    
    return primaryImage || fallbackImage || defaultImage;
  }, [entry.post_featured_img, entry.image]);

  // Memoize entry content image source (for card content)
  const entryImageSrc = useMemo(() => {
    if (!entry.image) return '/placeholder-image.jpg';
    return entry.image;
  }, [entry.image]);

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
          {(entry.post_featured_img || entry.image) && postUrl && (
            <NoFocusLinkWrapper
              className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
              onClick={handleLinkInteraction}
              onTouchStart={handleLinkInteraction}
            >
              <Link href={postUrl} prefetch={false}>
                <AspectRatio ratio={1}>
                  <Image
                    src={featuredImageSrc}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                    priority={false}
                    key={`${entry.guid}-featured-image`}
                  />
                </AspectRatio>
              </Link>
            </NoFocusLinkWrapper>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              {(entry.post_title || entry.title) && (
                <div className="flex items-start justify-between gap-2">
                  {postUrl ? (
                    <NoFocusLinkWrapper
                      className="hover:opacity-80 transition-opacity"
                      onClick={handleLinkInteraction}
                      onTouchStart={handleLinkInteraction}
                    >
                      <Link href={postUrl} prefetch={false}>
                        <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                          {entry.post_title || decodedContent.title}
                          {entry.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                        </h3>
                      </Link>
                    </NoFocusLinkWrapper>
                  ) : (
                    <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                      {entry.post_title || decodedContent.title}
                      {entry.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
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
              {(entry.post_media_type || entry.mediaType) && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
                  {isPodcast && <Podcast className="h-3 w-3" />}
                  {isNewsletter && <Mail className="h-3 w-3" strokeWidth={2.5} />}
                  {mediaTypeFormatted}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {isPodcast ? (
          <div>
            <NoFocusWrapper
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
              onClick={handleCardClick}
              onTouchStart={handleLinkInteraction}
            >
              <Card className={`rounded-xl overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                {entry.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={2/1}>
                      <Image
                        src={entryImageSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                        key={`${entry.guid}-podcast-image`}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <CardContent className="border-t pt-[11px] pl-4 pr-4 pb-[12px]">
                  <h3 className="text-base font-bold capitalize leading-[1.5]">
                    {decodedContent.title}
                  </h3>
                  {decodedContent.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                      {decodedContent.description}
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
                        src={entryImageSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                        key={`${entry.guid}-article-image`}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <CardContent className="pl-4 pr-4 pb-[12px] border-t pt-[11px]">
                  <h3 className="text-base font-bold capitalize leading-[1.5]">
                    {decodedContent.title}
                  </h3>
                  {decodedContent.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                      {decodedContent.description}
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
              feedUrl={entry.feed_url || ''}
              title={decodedContent.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={interactions.likes}
              skipQuery={useBatchMetrics}
            />
          </NoFocusWrapper>
          <NoFocusWrapper 
            className="flex items-center"
            onClick={handleCommentClick}
          >
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url || ''}
              initialData={interactions.comments}
              buttonOnly={true}
              skipQuery={useBatchMetrics}
              data-comment-input
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feed_url || ''}
              title={decodedContent.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={interactions.retweets}
              skipQuery={useBatchMetrics}
            />
          </NoFocusWrapper>
          <div className="flex items-center gap-4">
            <NoFocusWrapper className="flex items-center">
              <BookmarkButtonClient
                entryGuid={entry.guid}
                feedUrl={entry.feed_url || ''}
                title={decodedContent.title}
                pubDate={entry.pub_date}
                link={entry.link}
                initialData={interactions.bookmarks || { isBookmarked: false }}
                skipQuery={useBatchMetrics}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entry.link}
                title={decodedContent.title}
                internalUrl={isPodcast && postUrl ? postUrl : undefined}
              />
            </NoFocusWrapper>
          </div>
        </div>
      </div>
      
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  const prevEntry = prevProps.entry;
  const nextEntry = nextProps.entry;
  
  // Only re-render if these key properties have changed
  if (prevEntry.guid !== nextEntry.guid) return false;
  
  // Check entry properties that affect image rendering (CRITICAL for preventing image re-renders)
  if (prevEntry.image !== nextEntry.image) return false;
  if (prevEntry.post_featured_img !== nextEntry.post_featured_img) return false;
  if (prevEntry.title !== nextEntry.title) return false;
  if (prevEntry.description !== nextEntry.description) return false;
  if (prevEntry.link !== nextEntry.link) return false;
  if (prevEntry.pub_date !== nextEntry.pub_date) return false;
  
  // Check interactions that affect UI (CRITICAL for batch metrics reactivity)
  if (prevProps.interactions.likes.count !== nextProps.interactions.likes.count) return false;
  if (prevProps.interactions.likes.isLiked !== nextProps.interactions.likes.isLiked) return false;
  if (prevProps.interactions.comments.count !== nextProps.interactions.comments.count) return false;
  if (prevProps.interactions.retweets.count !== nextProps.interactions.retweets.count) return false;
  if (prevProps.interactions.retweets.isRetweeted !== nextProps.interactions.retweets.isRetweeted) return false;
  if (prevProps.interactions.bookmarks?.isBookmarked !== nextProps.interactions.bookmarks?.isBookmarked) return false;
  
  // Check function reference (should be stable with useCallback)
  if (prevProps.onOpenCommentDrawer !== nextProps.onOpenCommentDrawer) return false;
  
  // Check useBatchMetrics flag
  if (prevProps.useBatchMetrics !== nextProps.useBatchMetrics) return false;
  
  // All checks passed - prevent re-render for optimal performance
  return true;
});

EntryCard.displayName = 'EntryCard'; 