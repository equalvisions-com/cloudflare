"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Podcast, Mail, Loader2, Bookmark } from "lucide-react";
import Link from "next/link";
import { Virtuoso } from 'react-virtuoso';

// Memory optimization for large datasets - Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
  overscan: 2000, // Current buffer size
  maxBufferSize: 10000, // Maximum items to keep in memory
  recycleThreshold: 5000, // Start recycling items after this many
  increaseViewportBy: { top: 600, bottom: 600 }, // Viewport extension
};

// Memory management for large bookmark lists
const optimizeBookmarksForMemory = (bookmarks: BookmarkItem[], maxSize: number = VIRTUAL_SCROLL_CONFIG.maxBufferSize): BookmarkItem[] => {
  // If we're under the threshold, return as-is
  if (bookmarks.length <= maxSize) {
    return bookmarks;
  }
  
  // Keep the most recent bookmarks up to maxSize
  // This ensures we don't run out of memory with very large bookmark collections
  return bookmarks.slice(0, maxSize);
};
import React, { useCallback, useEffect, useRef, useState, useMemo, memo, useReducer } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerPlayTrack
} from '@/lib/stores/audioPlayerStore';
import { 
  BookmarkItem, 
  BookmarkRSSEntry, 
  BookmarkInteractionStates, 
  BookmarksData,
  BookmarksFeedState,
  BookmarksFeedAction,
  BookmarksFeedProps,
  UseBookmarksPaginationProps,
  UseBookmarksPaginationReturn,
  BookmarkCardProps,
  MediaTypeBadgeProps,
  EntryCardContentProps,
  BookmarksFeedErrorBoundaryProps
} from "@/lib/types";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useBatchEntryMetrics } from "@/hooks/useBatchEntryMetrics";
import { filterActivitiesWithMissingEntries } from "@/lib/utils/missingEntryHandler";

// BookmarksFeed State Management Types now imported from @/lib/types

// BookmarksFeed Reducer
const bookmarksFeedReducer = (state: BookmarksFeedState, action: BookmarksFeedAction): BookmarksFeedState => {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        bookmarks: action.payload.bookmarks || [],
        entryDetails: action.payload.entryDetails || {},
        entryMetrics: action.payload.entryMetrics || {},
        hasMore: action.payload.hasMore || false,
        currentSkip: action.payload.bookmarks?.length || 0,
        isInitialLoad: false,
        error: null,
      };
    
    case 'LOAD_MORE_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    
    case 'LOAD_MORE_SUCCESS':
      return {
        ...state,
        bookmarks: [...state.bookmarks, ...action.payload.bookmarks],
        entryDetails: { ...state.entryDetails, ...action.payload.entryDetails },
        entryMetrics: { ...state.entryMetrics, ...action.payload.entryMetrics },
        hasMore: action.payload.hasMore,
        currentSkip: action.payload.newSkip,
        isLoading: false,
        error: null,
      };
    
    case 'LOAD_MORE_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    
    case 'OPEN_COMMENT_DRAWER':
      return {
        ...state,
        commentDrawer: {
          isOpen: true,
          selectedEntry: action.payload,
        },
      };
    
    case 'CLOSE_COMMENT_DRAWER':
      return {
        ...state,
        commentDrawer: {
          isOpen: false,
          selectedEntry: null,
        },
      };
    
    case 'RESET_ERROR':
      return {
        ...state,
        error: null,
      };
    
    default:
      return state;
  }
};

// Initial state factory
const createInitialState = (initialData: BookmarksData | null): BookmarksFeedState => ({
  bookmarks: initialData?.bookmarks || [],
  entryDetails: initialData?.entryDetails || {},
  entryMetrics: initialData?.entryMetrics || {},
  hasMore: initialData?.hasMore || false,
  isLoading: false,
  currentSkip: initialData?.bookmarks?.length || 0,
  isInitialLoad: !initialData?.bookmarks?.length,
  error: null,
  commentDrawer: {
    isOpen: false,
    selectedEntry: null,
  },
});

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
const MediaTypeBadge = React.memo(({ mediaType }: MediaTypeBadgeProps) => {
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
const EntryCardContent = React.memo(({ entry }: EntryCardContentProps) => (
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
  onOpenCommentDrawer,
  metrics
}: BookmarkCardProps & { metrics?: { likes: { count: number; isLiked: boolean }; comments: { count: number }; retweets?: { count: number; isRetweeted: boolean }; bookmarks?: { isBookmarked: boolean }; } | null }) => {
  // Get audio player state and actions
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();
  const isCurrentlyPlaying = entryDetails && currentTrack?.src === entryDetails.link;
  
  const timestamp = useFormattedTimestamp(entryDetails?.pub_date);
  
  // Use batch metrics if available, otherwise fall back to individual metrics
  const finalInteractions = metrics || interactions;

  // Memoize featured image source (for top-left small image)
  const featuredImageSrc = useMemo(() => {
    if (!entryDetails) return '/placeholder-image.jpg';
    
    // Priority: Post featured image (primary) > Entry image (fallback) > Default
    const primaryImage = entryDetails.post_featured_img;
    const fallbackImage = entryDetails.image;
    const defaultImage = '/placeholder-image.jpg';
    
    return primaryImage || fallbackImage || defaultImage;
  }, [entryDetails?.post_featured_img, entryDetails?.image]);

  // Memoize entry content image source (for card content)
  const entryImageSrc = useMemo(() => {
    if (!entryDetails?.image) return '/placeholder-image.jpg';
    return entryDetails.image;
  }, [entryDetails?.image]);

  // Audio track data
  const audioTrackData = useMemo(() => {
    return null;
  }, []);

  // Universal focus prevention pattern - matches RSS feed implementation
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
      const creatorName = entryDetails.post_title || entryDetails.feed_title || undefined;
      playTrack(entryDetails.link, entryDetails.title, entryDetails.image || undefined, creatorName);
    }
  }, [entryDetails, playTrack]);

  // Universal mouse down handler for focus prevention - matches RSS feed pattern
  const handleNonInteractiveMouseDown = useCallback((e: React.MouseEvent) => {
    // Only prevent default if this isn't an interactive element
    const target = e.target as HTMLElement;
    if (
      target.tagName !== 'BUTTON' && 
      target.tagName !== 'A' && 
      target.tagName !== 'INPUT' && 
      target.tagName !== 'TEXTAREA' && 
      !target.closest('button') && 
      !target.closest('a') && 
      !target.closest('input') &&
      !target.closest('textarea') &&
      !target.closest('[data-comment-input]')
    ) {
      e.preventDefault();
    }
  }, []);
  
  if (!entryDetails) {
    // Fallback to basic bookmark data if entry details aren't available
    return (
      <article 
        className="p-4 border-b border-gray-100" 
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          
          const activeElement = document.activeElement as HTMLElement;
          if (activeElement) {
            // Check if the active element is an input type that should retain focus
            const isTheReplyTextarea =
              activeElement.tagName === 'TEXTAREA' &&
              activeElement.hasAttribute('data-comment-input');

            // Only blur if it's not the reply textarea
            if (!isTheReplyTextarea) {
              activeElement.blur();
            }
          }
        }}
        onMouseDown={handleNonInteractiveMouseDown}
        style={{
          WebkitTapHighlightColor: 'transparent',
          outlineStyle: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          touchAction: 'manipulation'
        }}
      >
        <NoFocusLinkWrapper
          className="block"
          onClick={handleLinkInteraction}
          onTouchStart={handleLinkInteraction}
        >
          <Link href={bookmark.link} target="_blank" prefetch={false}>
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
        
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement) {
          // Check if the active element is an input type that should retain focus
          const isTheReplyTextarea =
            activeElement.tagName === 'TEXTAREA' &&
            activeElement.hasAttribute('data-comment-input');

          // Only blur if it's not the reply textarea
          if (!isTheReplyTextarea) {
            activeElement.blur();
          }
        }
      }} 
      className="outline-none focus:outline-none focus-visible:outline-none"
      tabIndex={-1}
      onMouseDown={handleNonInteractiveMouseDown}
      style={{
        WebkitTapHighlightColor: 'transparent',
        outlineStyle: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'manipulation'
      }}
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
                    src={featuredImageSrc}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="48px"
                    priority={false}
                    key={`${entryDetails.guid}-featured-image`}
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
                    <h2 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                      {entryDetails.post_title || entryDetails.feed_title || entryDetails.title}
                      {entryDetails.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h2>
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
                        src={entryImageSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                        key={`${entryDetails.guid}-article-image`}
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
                        src={entryImageSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={false}
                        key={`${entryDetails.guid}-article-image`}
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
              initialData={finalInteractions?.likes || { isLiked: false, count: 0 }}
              skipQuery={true}
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
              initialData={finalInteractions?.comments || { count: 0 }}
              buttonOnly={true}
              data-comment-input
              skipQuery={true}
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={finalInteractions?.retweets || { isRetweeted: false, count: 0 }}
              skipQuery={true}
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
                initialData={finalInteractions?.bookmarks || { isBookmarked: true }}
                skipQuery={true}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entryDetails.link}
                title={entryDetails.title}
                mediaType={entryDetails.post_media_type || entryDetails.mediaType}
                internalUrl={(() => {
                  const mediaType = entryDetails.post_media_type || entryDetails.mediaType;
                  if (mediaType === 'podcast' && entryDetails.post_slug) {
                    return `/podcasts/${entryDetails.post_slug}`;
                  }
                  return undefined;
                })()}
              />
            </NoFocusWrapper>
          </div>
        </div>
      </div>
      
      <div id={`comments-${entryDetails.guid}`} className="border-t border-border" />
    </article>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  const prevBookmark = prevProps.bookmark;
  const nextBookmark = nextProps.bookmark;
  const prevEntryDetails = prevProps.entryDetails;
  const nextEntryDetails = nextProps.entryDetails;
  
  // Only re-render if these key properties have changed
  if (prevBookmark?.entryGuid !== nextBookmark?.entryGuid) return false;
  
  // Check entry properties that affect image rendering (CRITICAL for preventing image re-renders)
  if (prevEntryDetails?.image !== nextEntryDetails?.image) return false;
  if (prevEntryDetails?.post_featured_img !== nextEntryDetails?.post_featured_img) return false;
  if (prevEntryDetails?.title !== nextEntryDetails?.title) return false;
  if (prevEntryDetails?.link !== nextEntryDetails?.link) return false;
  if (prevEntryDetails?.pub_date !== nextEntryDetails?.pub_date) return false;
  
  // Check interactions that affect UI
  if (prevProps.interactions?.likes?.count !== nextProps.interactions?.likes?.count) return false;
  if (prevProps.interactions?.likes?.isLiked !== nextProps.interactions?.likes?.isLiked) return false;
  if (prevProps.interactions?.comments?.count !== nextProps.interactions?.comments?.count) return false;
  if (prevProps.interactions?.retweets?.count !== nextProps.interactions?.retweets?.count) return false;
  if (prevProps.interactions?.retweets?.isRetweeted !== nextProps.interactions?.retweets?.isRetweeted) return false;
  if (prevProps.interactions?.bookmarks?.isBookmarked !== nextProps.interactions?.bookmarks?.isBookmarked) return false;
  
  // Check function reference (should be stable with useCallback)
  if (prevProps.onOpenCommentDrawer !== nextProps.onOpenCommentDrawer) return false;
  
  // Check metrics object for batch metrics reactivity
  if (prevProps.metrics !== nextProps.metrics) return false;
  
  // All checks passed - prevent re-render for optimal performance
  return true;
});
BookmarkCard.displayName = 'BookmarkCard';

// BookmarksFeedProps now imported from @/lib/types

// Custom hook for bookmark pagination following React best practices
const useBookmarksPagination = ({
  state,
  dispatch,
  userId,
  pageSize,
  isSearchResults
}: UseBookmarksPaginationProps): UseBookmarksPaginationReturn => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestInFlightRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Enhanced load more function with proper race condition handling
  const loadMoreBookmarks = useCallback(async () => {
    // Prevent multiple concurrent requests
    if (requestInFlightRef.current || state.isLoading || !state.hasMore || isSearchResults) {
      return;
    }

    requestInFlightRef.current = true;
    
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    dispatch({ type: 'LOAD_MORE_START' });
    
    try {
      const skipValue = state.currentSkip;
      
      // Use the API route to fetch the next page with AbortController
      const result = await fetch(`/api/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentUserId: userId,
          skip: skipValue,
          limit: pageSize
        }),
        signal: abortControllerRef.current.signal
      }).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
      });
      
      const data = await result.json();
      
      // Check if request was aborted (race condition protection)
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      if (!data.bookmarks?.length) {
        dispatch({ 
          type: 'LOAD_MORE_SUCCESS', 
          payload: { 
            bookmarks: [], 
            entryDetails: {}, 
            entryMetrics: {}, 
            hasMore: false,
            newSkip: skipValue
          } 
        });
        return;
      }
      
      // Calculate new skip value
      const newSkip = skipValue + data.bookmarks.length;
      
      dispatch({
        type: 'LOAD_MORE_SUCCESS',
        payload: {
          bookmarks: data.bookmarks,
          entryDetails: data.entryDetails || {},
          entryMetrics: data.entryMetrics || {},
          hasMore: data.hasMore,
          newSkip
        }
      });
    } catch (error) {
      // Only handle real errors, not aborted requests
      if (error instanceof Error && error.name !== 'AbortError') {
        const errorMessage = error.message || 'Failed to load bookmarks';
        dispatch({ type: 'LOAD_MORE_ERROR', payload: errorMessage });
        

      }
    } finally {
      requestInFlightRef.current = false;
    }
  }, [state.isLoading, state.hasMore, state.currentSkip, userId, pageSize, isSearchResults]);

  // Use universal delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMoreBookmarks, {
    enabled: !isSearchResults && state.hasMore && !state.isLoading,
    isLoading: state.isLoading,
    hasMore: state.hasMore,
    rootMargin: '1000px',
    threshold: 0.1
  });

  // Auto-load when content is too short (with proper delay)
  useEffect(() => {
    let ignore = false;
    let timer: number;
    
    const checkContentHeight = () => {
      if (ignore || !loadMoreRef.current || !state.hasMore || state.isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Only trigger if content is significantly shorter than viewport
      // and we have a reasonable amount of content already loaded
      if (documentHeight <= viewportHeight * 0.8 && state.bookmarks.length >= 10) {
        loadMoreBookmarks();
      }
    };
    
    // Add significant delay to prevent initial render triggering
    timer = window.setTimeout(() => {
      if (!ignore) checkContentHeight();
    }, 1000); // Universal 1-second delay consistent with other feeds
    
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [state.bookmarks.length, state.hasMore, state.isLoading, loadMoreBookmarks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Reset request flags
      requestInFlightRef.current = false;
    };
  }, []);

  return {
    loadMoreRef,
    loadMoreBookmarks
  };
};

/**
 * Client component that displays bookmarks feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 * 
 * Phase 1 Improvements:
 * - useReducer for complex state management
 * - AbortController for API request cancellation
 * - Fixed memory leaks in event listeners
 * - Proper cleanup on unmount
 */
const BookmarksFeedComponent = ({ userId, initialData, pageSize = 30, isSearchResults = false, isActive = true }: BookmarksFeedProps) => {
  // Initialize state with useReducer
  const [state, dispatch] = useReducer(bookmarksFeedReducer, initialData, createInitialState);
  
  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !state.commentDrawer.isOpen, '.bookmarks-feed-container');
  
  // Comment drawer handlers
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    dispatch({ 
      type: 'OPEN_COMMENT_DRAWER', 
      payload: { entryGuid, feedUrl, initialData } 
    });
  }, []);

  const handleCloseCommentDrawer = useCallback(() => {
    dispatch({ type: 'CLOSE_COMMENT_DRAWER' });
  }, []);

  // Initialize with initial data
  useEffect(() => {
    if (initialData && !state.bookmarks.length) {
      dispatch({ type: 'INITIALIZE', payload: initialData });
    }
  }, [initialData]);

  // Use custom pagination hook
  const { loadMoreRef, loadMoreBookmarks } = useBookmarksPagination({
    state,
    dispatch,
    userId,
    pageSize,
    isSearchResults
  });

  // Apply memory optimization and filter out missing entries
  const optimizedBookmarks = useMemo(() => {
    const bookmarksWithEntries = filterActivitiesWithMissingEntries(
      state.bookmarks,
      state.entryDetails,
      'BookmarksFeed'
    );
    
    return optimizeBookmarksForMemory(bookmarksWithEntries);
  }, [state.bookmarks, state.entryDetails]);
  
  // Get entry GUIDs for batch metrics query - FIXED: Extract from stable initial data only
  const entryGuids = useMemo(() => {
    if (!initialData?.entryMetrics) return [];
    
    // Extract GUIDs from initial server data keys
    return Object.keys(initialData.entryMetrics);
  }, [initialData?.entryMetrics]); // Only depend on stable server data
  
  // Extract initial metrics from server data for fast rendering without button flashing
  // CRITICAL: Only set once from initial data, don't update reactively
  const initialMetrics = useMemo(() => {
    if (!initialData?.entryMetrics) return {};
    
    const metrics: Record<string, any> = {};
    Object.entries(initialData.entryMetrics).forEach(([guid, entryMetrics]) => {
      metrics[guid] = entryMetrics;
    });
    return metrics;
  }, [initialData?.entryMetrics]); // Only depend on initial server data
  
  // Use batch metrics hook with server metrics for immediate correct rendering
  // Server provides initial metrics for fast rendering, client hook provides reactive updates
  const { getMetrics, isLoading: metricsLoading } = useBatchEntryMetrics(
    isActive ? entryGuids : [], // Only query when feed is active
    { 
      initialMetrics
      // Removed skipInitialQuery - we NEED the reactive subscription for cross-feed updates
    }
  );

  // Implement the itemContentCallback using the standard pattern
  const itemContentCallback = useCallback((index: number, bookmark: BookmarkItem) => {
    const metrics = getMetrics(bookmark.entryGuid);
    return (
      <BookmarkCard 
        key={bookmark._id} 
        bookmark={bookmark} 
        entryDetails={state.entryDetails[bookmark.entryGuid]}
        interactions={state.entryMetrics[bookmark.entryGuid]}
        onOpenCommentDrawer={handleOpenCommentDrawer}
        metrics={metrics}
      />
    );
  }, [state.entryDetails, state.entryMetrics, handleOpenCommentDrawer, getMetrics]);

  // Error state
  if (state.error && state.bookmarks.length === 0) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>Error loading bookmarks: {state.error}</p>
        <button 
          onClick={() => {
            dispatch({ type: 'RESET_ERROR' });
            loadMoreBookmarks();
          }}
          className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state - only show for initial load
  if (state.isLoading && state.isInitialLoad) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // No bookmarks state
  if (state.bookmarks.length === 0 && !state.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-4">
        {/* Icon cluster */}
        <div className="relative mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-muted to-muted/60 rounded-2xl flex items-center justify-center border border-border shadow-lg">
            <Bookmark className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
        </div>

        {/* Text content */}
        <div className="text-center space-y-1">
          <h3 className="text-foreground font-medium text-sm">No bookmarks yet</h3>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your bookmarks will appear here
          </p>
        </div>
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
        data={optimizedBookmarks}
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
        computeItemKey={(_, item) => item.entryGuid || item._id}
        increaseViewportBy={VIRTUAL_SCROLL_CONFIG.increaseViewportBy}
        restoreStateFrom={undefined}
      />
      
      {/* Fixed position load more container at bottom */}
      <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
        {state.hasMore && state.isLoading && !isSearchResults && <Loader2 className="h-6 w-6 animate-spin" />}
        {(!state.hasMore || isSearchResults) && state.bookmarks.length > 0 && <div></div>}
      </div>
      
      {/* Error banner for load more errors */}
      {state.error && state.bookmarks.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-md shadow-lg z-50">
          <div className="flex items-center justify-between">
            <span className="text-sm">{state.error}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => loadMoreBookmarks()}
                className="text-sm underline hover:no-underline"
              >
                Retry
              </button>
              <button 
                onClick={() => dispatch({ type: 'RESET_ERROR' })}
                className="text-sm underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      
      {state.commentDrawer.selectedEntry && (
        <CommentSectionClient
          entryGuid={state.commentDrawer.selectedEntry.entryGuid}
          feedUrl={state.commentDrawer.selectedEntry.feedUrl}
          initialData={state.commentDrawer.selectedEntry.initialData}
          isOpen={state.commentDrawer.isOpen}
          setIsOpen={handleCloseCommentDrawer}
          skipQuery={true}
        />
      )}
    </div>
  );
} 

// Error Boundary wrapper for BookmarksFeed
const BookmarksFeedErrorBoundary = ({ children }: BookmarksFeedErrorBoundaryProps) => (
  <ErrorBoundary fallback={<div className="text-center py-8 text-red-600">Something went wrong loading bookmarks.</div>}>
    {children}
  </ErrorBoundary>
);

// Export wrapped component
export const BookmarksFeed = memo((props: BookmarksFeedProps) => (
  <BookmarksFeedErrorBoundary>
    <BookmarksFeedComponent {...props} />
  </BookmarksFeedErrorBoundary>
));
BookmarksFeed.displayName = 'BookmarksFeed'; 