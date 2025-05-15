'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef, memo } from 'react';
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
import { Button } from '@/components/ui/button';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Virtuoso } from 'react-virtuoso';
import { useAudio } from '@/components/audio-player/AudioContext';
import { decode } from 'html-entities';
import { VerifiedBadge } from "@/components/VerifiedBadge";
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

// Define the shape of an RSS entry
interface RSSEntry {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_title?: string;
  feed_url?: string;
  mediaType?: string;
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean;
}

interface EntriesDisplayProps {
  mediaType: string;
  searchQuery: string;
  className?: string;
  isVisible?: boolean;
  pageSize?: number;
}

// This interface is now used directly where needed
interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

// Custom hook for batch metrics
function useEntriesMetrics(entryGuids: string[], isVisible: boolean) {
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const batchMetricsQuery = useQuery(
    api.entries.batchGetEntriesMetrics,
    isVisible && entryGuids.length > 0 ? { entryGuids } : "skip"
  );

  // Create a memoized metrics map
  const metricsMap = useMemo(() => {
    if (!batchMetricsQuery) {
      return new Map<string, InteractionStates>();
    }

    return new Map(
      entryGuids.map((guid, index) => [guid, batchMetricsQuery[index]])
    );
  }, [batchMetricsQuery, entryGuids]);

  // Memoize default values
  const defaultInteractions = useMemo(() => ({
    likes: { isLiked: false, count: 0 },
    comments: { count: 0 },
    retweets: { isRetweeted: false, count: 0 }
  }), []);

  // Return a function to get metrics for a specific entry
  const getEntryMetrics = useCallback((entryGuid: string) => {
    return metricsMap.get(entryGuid) || defaultInteractions;
  }, [metricsMap, defaultInteractions]);

  return {
    getEntryMetrics,
    isLoading: isVisible && entryGuids.length > 0 && !batchMetricsQuery,
    metricsMap
  };
}

// Convert to an arrow function component for consistency
const EntriesDisplayComponent = ({
  mediaType,
  searchQuery,
  className,
  isVisible = false,
  pageSize = 30,
}: EntriesDisplayProps) => {
  const [entries, setEntries] = useState<RSSEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Add ref to prevent multiple endReached calls
  const endReachedCalledRef = useRef(false);
  
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
  useFeedFocusPrevention(isVisible && !commentDrawerOpen, '.entries-display-container');

  // Reset the endReachedCalled flag when entries change
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [entries.length]);

  // Get entry guids for metrics
  const entryGuids = useMemo(() => entries.map(entry => entry.guid), [entries]);
  
  // Use our custom hook for metrics
  const { getEntryMetrics, isLoading: isMetricsLoading } = useEntriesMetrics(entryGuids, isVisible);

  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);

  // Memoize the comment drawer close handler
  const handleCommentDrawerClose = useCallback((open: boolean) => {
    if (!isMountedRef.current) return;
    setCommentDrawerOpen(open);
  }, []);

  // Memoize loadMore function
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !isVisible || !isMountedRef.current || endReachedCalledRef.current) return;

    endReachedCalledRef.current = true;
    const nextPage = page + 1;
    setIsLoading(true);
    
    try {
      logger.debug(`Fetching more entries from API, page=${nextPage}, mediaType=${mediaType}, query=${searchQuery}, pageSize=${pageSize}`);
      const response = await fetch(`/api/search/entries?query=${encodeURIComponent(searchQuery)}&mediaType=${encodeURIComponent(mediaType)}&page=${nextPage}&pageSize=${pageSize}`);
      const data = await response.json();
      
      if (isMountedRef.current) {
        logger.debug(`Received data from API:`, {
          entriesCount: data.entries?.length || 0,
          hasMore: data.hasMore
        });
        
        setEntries(prev => [...prev, ...data.entries]);
        setHasMore(data.hasMore);
        setPage(nextPage);
      }
    } catch (error) {
      logger.error('Error loading more entries:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [hasMore, isLoading, isVisible, page, searchQuery, mediaType, pageSize]);

  // Use the shared delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMore, {
    enabled: hasMore && !isLoading && isVisible,
    isLoading,
    hasMore,
    rootMargin: '800px',
    threshold: 0.1,
    delay: 3000 // 3 second delay to prevent initial page load triggering
  });

  // Reset state only when search query changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    if (searchQuery !== lastSearchQuery) {
      setEntries([]);
      setHasMore(true);
      setPage(1);
      setLastSearchQuery(searchQuery);
      setIsInitialLoad(true);
    }
  }, [searchQuery, lastSearchQuery]);

  // Initial search effect
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const searchEntries = async () => {
      setIsLoading(true);
      try {
        logger.debug(`Initial search for query=${searchQuery}, mediaType=${mediaType}, pageSize=${pageSize}`);
        const response = await fetch(`/api/search/entries?query=${encodeURIComponent(searchQuery)}&mediaType=${encodeURIComponent(mediaType)}&page=1&pageSize=${pageSize}`);
        const data = await response.json();
        
        if (isMountedRef.current) {
          logger.debug(`Received initial search results:`, {
            entriesCount: data.entries?.length || 0,
            hasMore: data.hasMore
          });
          
          setEntries(data.entries);
          setHasMore(data.hasMore);
          setPage(1);
        }
      } catch (error) {
        logger.error('Error searching entries:', error);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsInitialLoad(false);
        }
      }
    };

    if (searchQuery && isVisible && (searchQuery !== lastSearchQuery || entries.length === 0)) {
      searchEntries();
      setLastSearchQuery(searchQuery);
    }
  }, [searchQuery, mediaType, isVisible, lastSearchQuery, entries.length, pageSize]);

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    if (!isMountedRef.current || !loadMoreRef.current || !hasMore || isLoading || !isVisible) return;
    
    const checkContentHeight = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && entries.length > 0 && !endReachedCalledRef.current) {
        logger.debug('Content is shorter than viewport, loading more entries');
        loadMore();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [entries.length, hasMore, isLoading, loadMore, isVisible]);

  // Use a ref to store the itemContent callback to ensure stability - matching RSSEntriesDisplay exactly
  const itemContentCallback = useCallback((index: number, entry: RSSEntry) => {
    // Get the metrics for this entry
    const metrics = getEntryMetrics(entry.guid);
    
    // Create a consistent interface for the EntryCard
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

  // Loading state - only show for initial load and initial metrics fetch
  if ((isLoading && isInitialLoad) || (isInitialLoad && entries.length > 0 && isMetricsLoading)) {
    return (
      <div className={cn("flex justify-center items-center py-10", className)}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // No entries state
  if (entries.length === 0 && !isLoading) {
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
      
      {/* Fixed position load more container at bottom - exactly like RSSEntriesDisplay */}
      <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
        {hasMore && isLoading && (
          <NoFocusWrapper className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </NoFocusWrapper>
        )}
        {!hasMore && entries.length > 0 && <div></div>}
      </div>
      
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
const EntryCard = React.memo(({ entry, interactions, onOpenCommentDrawer }: { 
  entry: RSSEntry; 
  interactions: InteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playTrack(entry.link, entry.title, entry.image || undefined);
  }, [entry.link, entry.title, entry.image, playTrack]);
  
  // Memoize the comment handler
  const handleCommentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCommentDrawer(entry.guid, entry.feed_url || '', interactions.comments);
  }, [entry.guid, entry.feed_url, interactions.comments, onOpenCommentDrawer]);

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