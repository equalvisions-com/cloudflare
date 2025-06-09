"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Podcast, Mail, Loader2 } from "lucide-react";
import Link from "next/link";
import { Virtuoso } from 'react-virtuoso';
import React, { useCallback, useEffect, useRef, useState, useMemo, memo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { useAudio } from '@/components/audio-player/AudioContext';
import { BookmarkItem, BookmarkRSSEntry, BookmarkInteractionStates, BookmarksData } from "@/lib/types";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";

// Memoized timestamp formatter (copied from UserLikesFeed)
const useFormattedTimestamp = (pubDate?: string) => {
  return useMemo(() => {
    if (!pubDate) return '';

    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let date: Date;
    
    if (typeof pubDate === 'string' && mysqlDateRegex.test(pubDate)) {
      // Convert MySQL datetime string to UTC time
      const [datePart, timePart] = pubDate.split(' ');
      date = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      date = new Date(pubDate);
    }
    
    const now = new Date();
    
    // Ensure we're working with valid dates
    if (isNaN(date.getTime())) {
      return '';
    }

    // Calculate time difference
    const diffInMs = now.getTime() - date.getTime();
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
  }, [pubDate]);
};

// Memoized media type badge component
const MediaTypeBadge = React.memo(({ mediaType }: { mediaType?: string }) => {
  if (!mediaType) return null;
  
  const type = mediaType.toLowerCase();
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
      {type === 'podcast' && <Podcast className="h-3 w-3" />}
      {type === 'newsletter' && <Mail className="h-3 w-3" strokeWidth={2.5} />}
      {mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
    </span>
  );
});
MediaTypeBadge.displayName = 'MediaTypeBadge';

// Memoized entry card content component
const EntryCardContent = React.memo(({ entry }: { entry: BookmarkRSSEntry }) => (
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
));
EntryCardContent.displayName = 'EntryCardContent';

// Bookmark card with entry details
const BookmarkCard = memo(({ 
  bookmark, 
  entryDetails,
  interactions,
  onOpenCommentDrawer
}: { 
  bookmark: BookmarkItem; 
  entryDetails?: BookmarkRSSEntry;
  interactions?: BookmarkInteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = entryDetails && currentTrack?.src === entryDetails.link;
  
  const timestamp = useFormattedTimestamp(entryDetails?.pub_date);

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

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (entryDetails && (entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast')) {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entryDetails.link, entryDetails.title, entryDetails.image || undefined);
    }
  }, [entryDetails, playTrack]);
  
  if (!entryDetails) {
    // Fallback to basic bookmark data if entry details aren't available
    return (
      <article 
        className="p-4 border-b border-gray-100" 
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <NoFocusLinkWrapper
          className="block"
          onClick={handleLinkInteraction}
          onTouchStart={handleLinkInteraction}
        >
          <Link href={bookmark.link} target="_blank">
            <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 mb-1">{bookmark.title}</h3>
          </Link>
        </NoFocusLinkWrapper>
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500">
            Published: {new Date(bookmark.pubDate).toLocaleDateString()}
          </div>
        </div>
      </article>
    );
  }
  
  const mediaType = entryDetails.post_media_type || entryDetails.mediaType;
  const isPodcast = mediaType?.toLowerCase() === 'podcast';
  
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
          {(entryDetails.post_featured_img || entryDetails.image) && (
            <NoFocusLinkWrapper 
              className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
              onClick={handleLinkInteraction}
              onTouchStart={handleLinkInteraction}
            >
              <Link 
                href={entryDetails.post_slug ? 
                  (entryDetails.post_media_type === 'newsletter' ? 
                    `/newsletters/${entryDetails.post_slug}` : 
                    entryDetails.post_media_type === 'podcast' ? 
                      `/podcasts/${entryDetails.post_slug}` : 
                      entryDetails.category_slug ? 
                        `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                        entryDetails.link) : 
                  entryDetails.link}
                target={entryDetails.post_slug ? "_self" : "_blank"}
                rel={entryDetails.post_slug ? "" : "noopener noreferrer"}
              >
                <AspectRatio ratio={1}>
                  <Image
                    src={entryDetails.post_featured_img || entryDetails.image || ''}
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
              <div className="flex items-start justify-between gap-2">
                <NoFocusLinkWrapper
                  className="hover:opacity-80 transition-opacity"
                  onClick={handleLinkInteraction}
                  onTouchStart={handleLinkInteraction}
                >
                  <Link 
                    href={entryDetails.post_slug ? 
                      (entryDetails.post_media_type === 'newsletter' ? 
                        `/newsletters/${entryDetails.post_slug}` : 
                        entryDetails.post_media_type === 'podcast' ? 
                          `/podcasts/${entryDetails.post_slug}` : 
                          entryDetails.category_slug ? 
                            `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                            entryDetails.link) : 
                      entryDetails.link}
                    target={entryDetails.post_slug ? "_self" : "_blank"}
                    rel={entryDetails.post_slug ? "" : "noopener noreferrer"}
                  >
                    <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                      {entryDetails.post_title || entryDetails.feed_title || entryDetails.title}
                      {entryDetails.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h3>
                  </Link>
                </NoFocusLinkWrapper>
                <span 
                  className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                  title={entryDetails.pub_date ? 
                    format(new Date(entryDetails.pub_date), 'PPP p') : 
                    new Date(bookmark.bookmarkedAt).toLocaleString()
                  }
                >
                  {timestamp}
                </span>
              </div>
              <MediaTypeBadge mediaType={mediaType} />
            </div>
          </div>
        </div>

        {/* Entry Content Card */}
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
                {entryDetails.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={2/1}>
                      <Image
                        src={entryDetails.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <EntryCardContent entry={entryDetails} />
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
              href={entryDetails.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card className="rounded-xl border overflow-hidden shadow-none">
                {entryDetails.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={2/1}>
                      <Image
                        src={entryDetails.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <EntryCardContent entry={entryDetails} />
              </Card>
            </a>
          </NoFocusLinkWrapper>
        )}

        {/* Horizontal Interaction Buttons */}
        <div className="flex justify-between items-center mt-4 h-[16px]" onClick={(e) => e.stopPropagation()}>
          <NoFocusWrapper className="flex items-center">
            <LikeButtonClient
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={interactions?.likes || { isLiked: false, count: 0 }}
            />
          </NoFocusWrapper>
          <NoFocusWrapper 
            className="flex items-center"
            onClick={(e) => {
              e.stopPropagation();
              onOpenCommentDrawer(entryDetails.guid, entryDetails.feed_url || '', interactions?.comments);
            }}
          >
            <CommentSectionClient
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              initialData={interactions?.comments || { count: 0 }}
              buttonOnly={true}
              data-comment-input
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={interactions?.retweets || { isRetweeted: false, count: 0 }}
            />
          </NoFocusWrapper>
          <div className="flex items-center gap-4">
            <NoFocusWrapper className="flex items-center">
              <BookmarkButtonClient
                entryGuid={entryDetails.guid}
                feedUrl={entryDetails.feed_url || ''}
                title={entryDetails.title}
                pubDate={entryDetails.pub_date}
                link={entryDetails.link}
                initialData={{ isBookmarked: true }} // Always true since these are bookmarks
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entryDetails.link}
                title={entryDetails.title}
              />
            </NoFocusWrapper>
          </div>
        </div>
      </div>
      
      <div id={`comments-${entryDetails.guid}`} className="border-t border-border" />
    </article>
  );
});
BookmarkCard.displayName = 'BookmarkCard';

interface BookmarksFeedProps {
  userId: Id<"users">;
  initialData: BookmarksData | null;
  pageSize?: number;
  isSearchResults?: boolean;
  isActive?: boolean;
}

/**
 * Client component that displays bookmarks feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
const BookmarksFeedComponent = ({ userId, initialData, pageSize = 30, isSearchResults = false, isActive = true }: BookmarksFeedProps) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(
    initialData?.bookmarks || []
  );
  const [entryDetails, setEntryDetails] = useState<Record<string, BookmarkRSSEntry>>(
    initialData?.entryDetails || {}
  );
  const [entryMetrics, setEntryMetrics] = useState<Record<string, BookmarkInteractionStates>>(
    initialData?.entryMetrics || {}
  );
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track skip with a ref to avoid closure problems
  const currentSkipRef = useRef<number>(initialData?.bookmarks.length || 0);
  const [currentSkip, setCurrentSkip] = useState(initialData?.bookmarks.length || 0);
  
  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(!initialData?.bookmarks.length);

  // --- Drawer state for comments ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Add ref to prevent multiple endReached calls
  const endReachedCalledRef = useRef(false);
  
  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !commentDrawerOpen, '.bookmarks-feed-container');
  
  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);

  // Log when initial data is received
  useEffect(() => {
    if (initialData?.bookmarks) {
      setBookmarks(initialData.bookmarks);
      setEntryDetails(initialData.entryDetails || {});
      setEntryMetrics(initialData.entryMetrics || {});
      setHasMore(initialData.hasMore);
      setCurrentSkip(initialData.bookmarks.length);
      currentSkipRef.current = initialData.bookmarks.length;
      setIsInitialLoad(false);
    }
  }, [initialData]);
  
  // Function to load more bookmarks - MOVED UP before it's used in dependencies
  const loadMoreBookmarks = useCallback(async () => {
    if (isLoading || !hasMore || isSearchResults) {
      return;
    }

    setIsLoading(true);
    
    try {
      const skipValue = currentSkipRef.current;
      
      // Use the API route to fetch the next page
      const result = await fetch(`/api/bookmarks?userId=${userId}&skip=${skipValue}&limit=${pageSize}`);
      
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      
      const data = await result.json();
      
      if (!data.bookmarks?.length) {
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      // Update both the ref and the state for the new skip value
      const newSkip = skipValue + data.bookmarks.length;
      currentSkipRef.current = newSkip;
      setCurrentSkip(newSkip);
      
      setBookmarks(prev => [...prev, ...data.bookmarks]);
      setEntryDetails(prev => ({...prev, ...data.entryDetails}));
      setEntryMetrics(prev => ({...prev, ...data.entryMetrics}));
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error loading more bookmarks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, userId, pageSize, bookmarks.length, isSearchResults]);

  // Reset the endReachedCalled flag when bookmarks change
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [bookmarks.length]);
  
  // Use the shared delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMoreBookmarks, {
    enabled: hasMore && !isLoading && !isSearchResults,
    isLoading,
    hasMore,
    rootMargin: '300px',
    threshold: 0.1,
    delay: 3000 // 3 second delay to prevent initial page load triggering
  });

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    const checkContentHeight = () => {
      if (!loadMoreRef.current || !hasMore || isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && bookmarks.length > 0) {
        loadMoreBookmarks();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [bookmarks.length, hasMore, isLoading, loadMoreBookmarks]);

  // Implement the itemContentCallback using the standard pattern
  const itemContentCallback = useCallback((index: number, bookmark: BookmarkItem) => {
    return (
      <BookmarkCard 
        key={bookmark._id} 
        bookmark={bookmark} 
        entryDetails={entryDetails[bookmark.entryGuid]}
        interactions={entryMetrics[bookmark.entryGuid]}
        onOpenCommentDrawer={handleOpenCommentDrawer}
      />
    );
  }, [entryDetails, entryMetrics, handleOpenCommentDrawer]);

  // Loading state - only show for initial load
  if (isLoading && isInitialLoad) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // No bookmarks state
  if (bookmarks.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>You haven&apos;t bookmarked any posts yet.</p>
      </div>
    );
  }

  return (
    <div 
      className="w-full bookmarks-feed-container" 
      style={{ 
        // CSS properties to prevent focus scrolling
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <Virtuoso
        useWindowScroll
        data={bookmarks}
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
        computeItemKey={(_, item) => item.entryGuid || item._id}
      />
      
      {/* Fixed position load more container at bottom - exactly like RSSEntriesDisplay */}
      <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
        {hasMore && isLoading && !isSearchResults && <Loader2 className="h-6 w-6 animate-spin" />}
        {(!hasMore || isSearchResults) && bookmarks.length > 0 && <div></div>}
      </div>
      
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

export const BookmarksFeed = memo(BookmarksFeedComponent);
BookmarksFeed.displayName = 'BookmarksFeed'; 