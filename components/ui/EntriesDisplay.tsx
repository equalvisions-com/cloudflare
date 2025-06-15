'use client';

import React, { useEffect, useMemo, useCallback, useRef, memo, MouseEvent, TouchEvent } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Podcast, Mail } from 'lucide-react';
import { LikeButtonClient } from '@/components/like-button/LikeButtonClient';
import { CommentSectionClient } from '@/components/comment-section/CommentSectionClient';
import { RetweetButtonClientWithErrorBoundary } from '@/components/retweet-button/RetweetButtonClient';
import { ShareButtonClient } from '@/components/share-button/ShareButtonClient';
import { BookmarkButtonClient } from '@/components/bookmark-button/BookmarkButtonClient';
import { Virtuoso } from 'react-virtuoso';
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerPlayTrack
} from '@/lib/stores/audioPlayerStore';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention } from "@/utils/FeedInteraction";
import { useEntriesData } from '@/lib/hooks/useEntriesData';
import { EntriesRSSEntry, EntriesDisplayProps, InteractionStates } from '@/lib/types';
import { SkeletonFeed } from '@/components/ui/skeleton-feed';
import { useInView } from 'react-intersection-observer';

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
    getEntryMetrics,
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

  // Set up intersection observer for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0.1,
    rootMargin: '200px',
  });

  // Load more entries when intersection observer triggers
  useEffect(() => {
    if (inView && hasMore && !isLoading && isVisible && entries.length > 0) {
      loadMore();
    }
  }, [inView, hasMore, isLoading, isVisible, entries.length, loadMore]);

  // Use a ref to store the itemContent callback to ensure stability
  const itemContentCallback = useCallback((index: number, entry: EntriesRSSEntry) => {
    // Get the metrics for this entry
    const metrics = getEntryMetrics(entry.guid);
    
    return (
      <EntryCard 
        entry={entry} 
        interactions={metrics}
        onOpenCommentDrawer={handleOpenCommentDrawer}
      />
    );
  }, [getEntryMetrics, handleOpenCommentDrawer]);

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
      <div className={cn("py-8 text-center", className)}>
        <p className="text-muted-foreground text-sm">No results found for &quot;{searchQuery}&quot;</p>
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
        data={entries}
        overscan={2000}
        itemContent={itemContentCallback}
        components={{
          Footer: () => null
        }}
        style={{ 
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
        className="focus:outline-none focus-visible:outline-none"
        computeItemKey={(_, item) => item.guid}
      />
      
      {/* Intersection observer target with loading indicator */}
      {hasMore && (
        <div ref={ref} className="h-52 flex items-center justify-center mb-20">
          {isLoading && (
            <NoFocusWrapper className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </NoFocusWrapper>
          )}
        </div>
      )}
      
      {selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={selectedCommentEntry.entryGuid}
          feedUrl={selectedCommentEntry.feedUrl}
          initialData={selectedCommentEntry.initialData}
          isOpen={commentDrawerOpen}
          setIsOpen={handleCommentDrawerClose}
        />
      )}
    </div>
  );
};

// Export the memoized version of the component
export const EntriesDisplay = memo(EntriesDisplayComponent);

// Modified EntryCard to accept interactions prop and onOpenCommentDrawer
const EntryCard = memo(({ entry, interactions, onOpenCommentDrawer }: { 
  entry: EntriesRSSEntry; 
  interactions: InteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}) => {
  // Get state and actions from Zustand store
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

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

  // Generate post URL if we have category and post slugs
  const postUrl = useMemo(() => 
    entry.category_slug && entry.post_slug 
      ? `/${entry.category_slug}/${entry.post_slug}`
      : null,
    [entry.category_slug, entry.post_slug]
  );

  // Handle card click for podcasts
  const handleCardClick = useCallback((e: MouseEvent) => {
    if (entry.post_media_type?.toLowerCase() === 'podcast' || entry.mediaType?.toLowerCase() === 'podcast') {
      e.preventDefault();
      e.stopPropagation();
      const creatorName = entry.post_title || entry.feed_title || undefined;
      playTrack(entry.link, entry.title, entry.image || undefined, creatorName);
    } else {
      e.stopPropagation();
      handleLinkInteraction(e);
    }
  }, [entry.post_media_type, entry.mediaType, entry.link, entry.title, entry.image, entry.post_title, entry.feed_title, playTrack, handleLinkInteraction]);
  
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
              <Link href={postUrl}>
                <AspectRatio ratio={1}>
                  <Image
                    src={entry.post_featured_img || entry.image || ''}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                    priority={false}
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
                      <Link href={postUrl}>
                        <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                          {entry.post_title || entry.title}
                          {entry.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                        </h3>
                      </Link>
                    </NoFocusLinkWrapper>
                  ) : (
                    <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                      {entry.post_title || entry.title}
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
                    {entry.title}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                      {entry.description}
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
                    {entry.title}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-[5px] leading-[1.5]">
                      {entry.description}
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
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={interactions.likes}
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
              data-comment-input
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feed_url || ''}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={interactions.retweets}
            />
          </NoFocusWrapper>
          <div className="flex items-center gap-4">
            <NoFocusWrapper className="flex items-center">
              <BookmarkButtonClient
                entryGuid={entry.guid}
                feedUrl={entry.feed_url || ''}
                title={entry.title}
                pubDate={entry.pub_date}
                link={entry.link}
                initialData={{ isBookmarked: false }}
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
      
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
});

EntryCard.displayName = 'EntryCard'; 