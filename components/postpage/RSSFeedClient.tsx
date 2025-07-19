'use client';

import React, { useEffect, useRef, useMemo, useCallback, memo, useReducer, useContext, type JSX } from 'react';
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

// RSS Feed State Management with useReducer - Replacing Zustand
interface RSSFeedLoadingState {
  isLoading: boolean;
  isInitialRender: boolean;
  fetchError: Error | null;
}

interface RSSFeedPaginationState {
  currentPage: number;
  hasMore: boolean;
  totalEntries: number;
}

interface RSSFeedCommentDrawerState {
  isOpen: boolean;
  selectedEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
}

interface RSSFeedUIState {
  isActive: boolean;
  isSearchMode: boolean;
}

interface RSSFeedMetadata {
  postTitle: string;
  feedUrl: string;
  featuredImg?: string;
  mediaType?: string;
  verified: boolean;
  pageSize: number;
}

interface RSSFeedState {
  entries: RSSFeedEntry[];
  pagination: RSSFeedPaginationState;
  loading: RSSFeedLoadingState;
  commentDrawer: RSSFeedCommentDrawerState;
  ui: RSSFeedUIState;
  feedMetadata: RSSFeedMetadata;
}

// RSS Feed Actions
type RSSFeedAction =
  | { type: 'SET_ENTRIES'; payload: RSSFeedEntry[] }
  | { type: 'ADD_ENTRIES'; payload: RSSFeedEntry[] }
  | { type: 'UPDATE_ENTRY_METRICS'; payload: { entryGuid: string; metrics: RSSFeedEntry['initialData'] } }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_TOTAL_ENTRIES'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INITIAL_RENDER'; payload: boolean }
  | { type: 'SET_FETCH_ERROR'; payload: Error | null }
  | { type: 'OPEN_COMMENT_DRAWER'; payload: { entryGuid: string; feedUrl: string; initialData?: { count: number } } }
  | { type: 'CLOSE_COMMENT_DRAWER' }
  | { type: 'SET_ACTIVE'; payload: boolean }
  | { type: 'SET_SEARCH_MODE'; payload: boolean }
  | { type: 'SET_FEED_METADATA'; payload: Partial<RSSFeedMetadata> }
  | { type: 'RESET' }
  | { type: 'INITIALIZE'; payload: {
      entries: RSSFeedEntry[];
      totalEntries: number;
      hasMore: boolean;
      postTitle: string;
      feedUrl: string;
      featuredImg?: string;
      mediaType?: string;
      verified?: boolean;
      pageSize?: number;
    } };

// Initial state factory functions
const createInitialRSSFeedState = (): RSSFeedState => ({
  entries: [],
  pagination: {
    currentPage: 1,
    hasMore: false,
    totalEntries: 0,
  },
  loading: {
    isLoading: false,
    isInitialRender: true,
    fetchError: null,
  },
  commentDrawer: {
    isOpen: false,
    selectedEntry: null,
  },
  ui: {
    isActive: true,
    isSearchMode: false,
  },
  feedMetadata: {
    postTitle: '',
    feedUrl: '',
    featuredImg: undefined,
    mediaType: undefined,
    verified: false,
    pageSize: 30,
  },
});

// RSS Feed Reducer
function rssFeedReducer(state: RSSFeedState, action: RSSFeedAction): RSSFeedState {
  switch (action.type) {
    case 'SET_ENTRIES':
      return { ...state, entries: action.payload };
    
    case 'ADD_ENTRIES':
      return { ...state, entries: [...state.entries, ...action.payload] };
    
    case 'UPDATE_ENTRY_METRICS':
      return {
        ...state,
        entries: state.entries.map(entry => 
          entry.entry.guid === action.payload.entryGuid 
            ? { ...entry, initialData: { ...entry.initialData, ...action.payload.metrics } }
            : entry
        ),
      };
    
    case 'SET_CURRENT_PAGE':
      return {
        ...state,
        pagination: { ...state.pagination, currentPage: action.payload },
      };
    
    case 'SET_HAS_MORE':
      return {
        ...state,
        pagination: { ...state.pagination, hasMore: action.payload },
      };
    
    case 'SET_TOTAL_ENTRIES':
      return {
        ...state,
        pagination: { ...state.pagination, totalEntries: action.payload },
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: { ...state.loading, isLoading: action.payload },
      };
    
    case 'SET_INITIAL_RENDER':
      return {
        ...state,
        loading: { ...state.loading, isInitialRender: action.payload },
      };
    
    case 'SET_FETCH_ERROR':
      return {
        ...state,
        loading: { ...state.loading, fetchError: action.payload },
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
    
    case 'SET_ACTIVE':
      return {
        ...state,
        ui: { ...state.ui, isActive: action.payload },
      };
    
    case 'SET_SEARCH_MODE':
      return {
        ...state,
        ui: { ...state.ui, isSearchMode: action.payload },
      };
    
    case 'SET_FEED_METADATA':
      return {
        ...state,
        feedMetadata: { ...state.feedMetadata, ...action.payload },
      };
    
    case 'RESET':
      return createInitialRSSFeedState();
    
    case 'INITIALIZE':
      const {
        entries,
        totalEntries,
        hasMore,
        postTitle,
        feedUrl,
        featuredImg,
        mediaType,
        verified = false,
        pageSize = 30,
      } = action.payload;

      return {
        entries,
        pagination: {
          currentPage: 1,
          hasMore,
          totalEntries,
        },
        loading: {
          isLoading: false,
          isInitialRender: true,
          fetchError: null,
        },
        commentDrawer: {
          isOpen: false,
          selectedEntry: null,
        },
        ui: {
          isActive: true,
          isSearchMode: false,
        },
        feedMetadata: {
          postTitle,
          feedUrl,
          featuredImg,
          mediaType,
          verified,
          pageSize,
        },
      };
    
    default:
      return state;
  }
}
import { useRSSFeedPaginationHook } from '@/hooks/useRSSFeedPagination';
import { useRSSFeedUI } from '@/hooks/useRSSFeedUI';
import { useBatchEntryMetrics } from '@/hooks/useBatchEntryMetrics';
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Link from "next/link";
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerPlayTrack
} from '@/lib/stores/audioPlayerStore';
import { Podcast, Mail, Loader2 } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { useFeedFocusPrevention, NoFocusWrapper, NoFocusLinkWrapper, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";

// Memory optimization for large datasets - Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
  overscan: 2000, // Current buffer size
  maxBufferSize: 10000, // Maximum items to keep in memory
  recycleThreshold: 5000, // Start recycling items after this many
  increaseViewportBy: { top: 600, bottom: 600 }, // Viewport extension
};

// Memory management for large RSS feed lists
const optimizeRSSEntriesForMemory = (entries: RSSFeedEntry[], maxSize: number = VIRTUAL_SCROLL_CONFIG.maxBufferSize): RSSFeedEntry[] => {
  // If we're under the threshold, return as-is
  if (entries.length <= maxSize) {
    return entries;
  }
  
  // Keep the most recent entries up to maxSize
  // This ensures we don't run out of memory with very large feeds
  return entries.slice(0, maxSize);
};

// PHASE 4: Enhanced production-ready error logging utility
const logger = {
  error: (message: string, error?: unknown, context?: Record<string, any>) => {
    // Error tracking removed for production
    // TODO: Implement production error tracking
    // Sentry.captureException(error, { extra: { message, context } });
  },
  warn: (message: string, context?: Record<string, any>) => {
    // Warning logging removed for production
  },
  info: (message: string, context?: Record<string, any>) => {
    // Info logging removed for production
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
      (prevProps.entryWithData.initialData.bookmarks?.isBookmarked === nextProps.entryWithData.initialData.bookmarks?.isBookmarked)) &&
    // Check metrics prop for batch metrics reactivity
    prevProps.metrics === nextProps.metrics
  );
};

const RSSEntry = React.memo(({ entryWithData: { entry, initialData }, featuredImg, postTitle, mediaType, verified, onOpenCommentDrawer, metrics }: RSSEntryProps & { metrics?: { likes: { count: number; isLiked: boolean }; comments: { count: number }; retweets?: { count: number; isRetweeted: boolean }; bookmarks?: { isBookmarked: boolean }; } | null }): JSX.Element => {
  // Get audio player state and actions (global store - intentionally kept)
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Use batch metrics if available, otherwise fall back to individual metrics
  const finalInteractions = metrics || initialData;

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
    onOpenCommentDrawer(entry.guid, entry.feedUrl, finalInteractions.comments);
  }, [entry.guid, entry.feedUrl, finalInteractions.comments, onOpenCommentDrawer]);

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
        <div className="flex justify-between items-center mt-4 h-[16px]" onClick={(e) => e.stopPropagation()}>
          <NoFocusWrapper className="flex items-center">
            <LikeButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={finalInteractions.likes}
              skipQuery={true}
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
              initialData={finalInteractions.comments}
              buttonOnly={true}
              skipQuery={true}
            />
          </NoFocusWrapper>
          <NoFocusWrapper className="flex items-center">
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={finalInteractions.retweets || { isRetweeted: false, count: 0 }}
              skipQuery={true}
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
                initialData={finalInteractions.bookmarks || { isBookmarked: false }}
                skipQuery={true}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entry.link}
                title={entry.title}
                internalUrl={mediaType === 'podcast' ? window.location.pathname : undefined}
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
  isInitialRender,
  getMetrics
}: FeedContentProps & { getMetrics?: (entryGuid: string) => { likes: { count: number; isLiked: boolean }; comments: { count: number }; retweets?: { count: number; isRetweeted: boolean }; bookmarks?: { isBookmarked: boolean }; } | null }) {
  
  // CRITICAL FIX: Remove double optimization - entries are already optimized in parent component
  // const optimizedEntries = useMemo(() => 
  //   optimizeRSSEntriesForMemory(entries), 
  //   [entries]
  // );
  
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
  
  // Create itemContent callback using the standard pattern
  const itemContentCallback = useCallback((index: number, item: RSSFeedEntry) => {
    const metrics = getMetrics ? getMetrics(item.entry.guid) : null;
    return (
      <RSSEntry 
        entryWithData={item} 
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
        verified={verified}
        onOpenCommentDrawer={onOpenCommentDrawer}
        metrics={metrics}
      />
    );
  }, [featuredImg, postTitle, mediaType, verified, onOpenCommentDrawer, getMetrics]);
  
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
            computeItemKey={(_, item) => item.entry.guid}
            increaseViewportBy={VIRTUAL_SCROLL_CONFIG.increaseViewportBy}
            restoreStateFrom={undefined}
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
}, (prevProps, nextProps) => {
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
  
  // Check getMetrics function reference for batch metrics reactivity
  if (prevProps.getMetrics !== nextProps.getMetrics) return false;
  
  return true;
});

// Add displayName for easier debugging
FeedContent.displayName = 'FeedContent';

// Use centralized RSSFeedClientProps from @/lib/types

// Create React Context for state and dispatch
const RSSFeedContext = React.createContext<{
  state: RSSFeedState;
  dispatch: React.Dispatch<RSSFeedAction>;
} | null>(null);

// Custom hook to use RSS Feed context
const useRSSFeedContext = () => {
  const context = useContext(RSSFeedContext);
  if (!context) {
    throw new Error('useRSSFeedContext must be used within RSSFeedProvider');
  }
  return context;
};

// RSS Feed Provider Component with useReducer
// This creates a fresh state instance for each RSS feed, preventing state pollution
const RSSFeedProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(rssFeedReducer, createInitialRSSFeedState());
  
  const contextValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  
  return (
    <RSSFeedContext.Provider value={contextValue}>
      {children}
    </RSSFeedContext.Provider>
  );
};

// Internal RSSFeedClient component that uses the reducer state from context
function RSSFeedClientInternal({ postTitle, feedUrl, initialData, pageSize = 30, featuredImg, mediaType, isActive = true, verified, customLoadMore, isSearchMode, externalIsLoading }: RSSFeedClientProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Get state and dispatch from context
  const { state, dispatch } = useRSSFeedContext();
  
  // Extract state values for easier access
  const { entries, loading, pagination, commentDrawer, ui } = state;
  const hasMore = pagination.hasMore;
  const isLoading = loading.isLoading;
  
  // Create a unique key for this podcast page to force complete reset
  const pageKey = useMemo(() => `${feedUrl}-${postTitle}`, [feedUrl, postTitle]);
  
  // PHASE 3 OPTIMIZATION: Use useEffect for state updates to prevent render-phase updates
  // This prevents "Cannot update a component while rendering" errors
  useEffect(() => {
    dispatch({ type: 'SET_ACTIVE', payload: isActive });
  }, [isActive, dispatch]);
  
  useEffect(() => {
    if (isSearchMode !== undefined) {
      dispatch({ type: 'SET_SEARCH_MODE', payload: isSearchMode });
    }
  }, [isSearchMode, dispatch]);

  // Initialize store on mount - React key handles component reset
  const initializationKeyRef = useRef<string>('');
  
  useEffect(() => {
    if (initialData && initializationKeyRef.current !== pageKey) {
      dispatch({
        type: 'INITIALIZE',
        payload: {
          entries: initialData.entries || [],
          totalEntries: initialData.totalEntries || 0,
          hasMore: initialData.hasMore || false,
          postTitle,
          feedUrl,
          featuredImg,
          mediaType,
          verified,
          pageSize
        }
      });
      
      initializationKeyRef.current = pageKey;
    }
  }, [initialData, postTitle, feedUrl, featuredImg, mediaType, verified, pageSize, dispatch, pageKey]);
  
  // Additional effect for search mode - update entries when initialData changes
  useEffect(() => {
    if (isSearchMode && initialData) {
      dispatch({
        type: 'SET_ENTRIES',
        payload: initialData.entries || []
      });
      dispatch({
        type: 'SET_TOTAL_ENTRIES',
        payload: initialData.totalEntries || 0
      });
      dispatch({
        type: 'SET_HAS_MORE',
        payload: initialData.hasMore || false
      });
    }
  }, [isSearchMode, initialData, dispatch]);
  
  // Use custom hooks for business logic - pass state and dispatch
  const paginationHook = useRSSFeedPaginationHook(state, dispatch, customLoadMore, isActive);
  const uiHook = useRSSFeedUI(state, dispatch);
  
  // Apply memory optimization to prevent excessive memory usage
  const optimizedEntries = useMemo(() => 
    optimizeRSSEntriesForMemory(entries), 
    [entries]
  );

  // Get entry GUIDs for batch metrics query - FIXED: Extract from stable initial data only
  const entryGuids = useMemo(() => {
    if (!initialData?.entries) return [];
    
    // Extract GUIDs from initial server data
    return initialData.entries.map(entry => entry.entry.guid);
  }, [initialData?.entries]); // Only depend on stable server data
  
  // Extract initial metrics from server data for fast rendering without button flashing
  // CRITICAL: Only set once from initial data, don't update reactively
  const initialMetrics = useMemo(() => {
    if (!initialData?.entries) return {};
    
    const metrics: Record<string, any> = {};
    initialData.entries.forEach(entry => {
      if (entry.initialData && entry.entry.guid) {
        metrics[entry.entry.guid] = entry.initialData;
      }
    });
    return metrics;
  }, [initialData?.entries]); // Only depend on initial server data
  
  // Use batch metrics hook with server metrics for immediate correct rendering
  // Server provides initial metrics for fast rendering, client hook provides reactive updates
  const { getMetrics, isLoading: metricsLoading } = useBatchEntryMetrics(
    isActive ? entryGuids : [], // Only query when feed is active
    { 
      initialMetrics
      // Removed skipInitialQuery - we NEED the reactive subscription for cross-feed updates
    }
  );
  
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
            dispatch({
              type: 'INITIALIZE',
              payload: {
                entries: initialData.entries || [],
                totalEntries: initialData.totalEntries || 0,
                hasMore: initialData.hasMore || false,
                postTitle,
                feedUrl,
                featuredImg,
                mediaType,
                verified,
                pageSize
              }
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
        entries={optimizedEntries}
        hasMore={hasMore} // PHASE 4: Use granular selector
        loadMoreRef={loadMoreRef}
        isPending={isSearchMode && externalIsLoading !== undefined ? externalIsLoading : paginationHook.isLoading} // Use external loading only in search mode
        loadMore={paginationHook.loadMoreEntries}
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
        verified={verified}
        onOpenCommentDrawer={uiHook.handleCommentDrawer.open}
        isInitialRender={loading.isInitialRender}
        getMetrics={getMetrics}
      />
      {/* Single global comment drawer with direct loading */}
      {commentDrawer.selectedEntry && (
        <CommentSectionClient
            entryGuid={commentDrawer.selectedEntry.entryGuid}
            feedUrl={commentDrawer.selectedEntry.feedUrl}
            initialData={commentDrawer.selectedEntry.initialData}
            isOpen={commentDrawer.isOpen}
            setIsOpen={uiHook.handleCommentDrawer.close}
            skipQuery={true}
        />
      )}
    </div>
  );
}

// Main RSSFeedClient component with reducer provider
export function RSSFeedClient(props: RSSFeedClientProps) {
  return (
    <RSSFeedProvider>
      <RSSFeedClientInternal {...props} />
    </RSSFeedProvider>
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