'use client';

import React, { useEffect, useRef, useMemo, useCallback, memo, useDeferredValue, useReducer } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerPlayTrack
} from '@/lib/stores/audioPlayerStore';
import { Podcast, Mail, Loader2, ArrowDown, MoveUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";
import { PrefetchAnchor } from "@/utils/PrefetchAnchor";
import { useBatchEntryMetrics } from '@/hooks/useBatchEntryMetrics';
import type { 
  FeaturedFeedClientProps,
  FeaturedFeedEntryWithData
} from "@/lib/types";

// Constants for performance optimization
const ITEMS_PER_REQUEST = 30;

// Virtual scrolling configuration for memory optimization
const VIRTUAL_SCROLL_CONFIG = {
  overscan: 2000,
  maxBufferSize: 10000,
  recycleThreshold: 5000,
  increaseViewportBy: { top: 600, bottom: 600 },
};

// Memory optimization for large datasets
const optimizeEntriesForMemory = (entries: FeaturedFeedEntryWithData[], maxSize: number = VIRTUAL_SCROLL_CONFIG.maxBufferSize): FeaturedFeedEntryWithData[] => {
  if (entries.length <= maxSize) {
    return entries;
  }
  return entries.slice(0, maxSize);
};

// Memoized date parsing operations
const memoizedDateParsers = {
  parseCache: new Map<string, Date>(),
  displayCache: new Map<string, Date>(),

  parseEntryDate: (dateString: string | Date): Date => {
    if (dateString instanceof Date) {
      return dateString;
    }
    
    const cacheKey = String(dateString);
    if (memoizedDateParsers.parseCache.has(cacheKey)) {
      return memoizedDateParsers.parseCache.get(cacheKey)!;
    }
    
    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    
    let result: Date;
    if (typeof dateString === 'string' && mysqlDateRegex.test(dateString)) {
      const [datePart, timePart] = dateString.split(' ');
      result = new Date(`${datePart}T${timePart}`);
    } else {
      result = new Date(dateString);
    }
    
    memoizedDateParsers.parseCache.set(cacheKey, result);
    return result;
  },

  parseEntryDateForDisplay: (dateString: string | Date): Date => {
    if (dateString instanceof Date) {
      return dateString;
    }
    
    const cacheKey = `display_${String(dateString)}`;
    if (memoizedDateParsers.displayCache.has(cacheKey)) {
      return memoizedDateParsers.displayCache.get(cacheKey)!;
    }
    
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    
    let result: Date;
    if (typeof dateString === 'string' && mysqlDateRegex.test(dateString)) {
      const [datePart, timePart] = dateString.split(' ');
      result = new Date(`${datePart}T${timePart}Z`);
    } else {
      result = new Date(dateString);
    }
    
    memoizedDateParsers.displayCache.set(cacheKey, result);
    return result;
  }
};

// State interface for useReducer
interface FeaturedFeedState {
  // Core data
  entries: FeaturedFeedEntryWithData[];
  
  // Pagination
  currentPage: number;
  hasMore: boolean;
  totalEntries: number;
  
  // Loading states
  isLoading: boolean;
  fetchError: Error | null;
  
  // UI states
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
  
  // Metadata
  feedMetadataCache: Record<string, FeaturedFeedEntryWithData['postMetadata']>;
  
  // Initialization
  hasInitialized: boolean;
}

// Action types for useReducer
type FeaturedFeedAction = 
  | { type: 'INITIALIZE'; payload: {
      entries: FeaturedFeedEntryWithData[];
      totalEntries: number;
    }}
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FETCH_ERROR'; payload: Error | null }
  | { type: 'SET_ENTRIES'; payload: FeaturedFeedEntryWithData[] }
  | { type: 'ADD_ENTRIES'; payload: FeaturedFeedEntryWithData[] }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_TOTAL_ENTRIES'; payload: number }
  | { type: 'OPEN_COMMENT_DRAWER'; payload: {
      entryGuid: string;
      feedUrl: string;
      initialData?: { count: number };
    }}
  | { type: 'CLOSE_COMMENT_DRAWER' }
  | { type: 'UPDATE_FEED_METADATA_CACHE'; payload: {
      feedUrl: string;
      metadata: FeaturedFeedEntryWithData['postMetadata'];
    }}
  | { type: 'UPDATE_ENTRY_METRICS'; payload: {
      entryGuid: string;
      metrics: FeaturedFeedEntryWithData['initialData'];
    }};

// Initial state factory
const createInitialState = (): FeaturedFeedState => ({
  entries: [],
  currentPage: 1,
  hasMore: false,
  totalEntries: 0,
  isLoading: false,
  fetchError: null,
  commentDrawerOpen: false,
  selectedCommentEntry: null,
  feedMetadataCache: {},
  hasInitialized: false,
});

// Reducer function
const featuredFeedReducer = (state: FeaturedFeedState, action: FeaturedFeedAction): FeaturedFeedState => {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        entries: action.payload.entries,
        totalEntries: action.payload.totalEntries,
        hasMore: false, // Featured feed doesn't paginate like RSS - it's client-side slicing
        hasInitialized: true,
        isLoading: false,
        fetchError: null,
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_FETCH_ERROR':
      return { ...state, fetchError: action.payload };
    
    case 'SET_ENTRIES':
      return { ...state, entries: action.payload };
    
    case 'ADD_ENTRIES':
      return { ...state, entries: [...state.entries, ...action.payload] };
    
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.payload };
    
    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };
    
    case 'SET_TOTAL_ENTRIES':
      return { ...state, totalEntries: action.payload };
    
    case 'OPEN_COMMENT_DRAWER':
      return {
        ...state,
        commentDrawerOpen: true,
        selectedCommentEntry: action.payload,
      };
    
    case 'CLOSE_COMMENT_DRAWER':
      return {
        ...state,
        commentDrawerOpen: false,
        selectedCommentEntry: null,
      };
    
    case 'UPDATE_FEED_METADATA_CACHE':
      return {
        ...state,
        feedMetadataCache: {
          ...state.feedMetadataCache,
          [action.payload.feedUrl]: action.payload.metadata,
        },
      };
    
    case 'UPDATE_ENTRY_METRICS':
      return {
        ...state,
        entries: state.entries.map(entry => 
          entry.entry.guid === action.payload.entryGuid 
            ? { ...entry, initialData: { ...entry.initialData, ...action.payload.metrics } }
            : entry
        ),
      };
    
    default:
      return state;
  }
};

interface FeaturedEntryProps {
  entryWithData: FeaturedFeedEntryWithData;
  metrics?: {
    likes: { count: number; isLiked: boolean };
    comments: { count: number };
    retweets?: { count: number; isRetweeted: boolean };
    bookmarks?: { isBookmarked: boolean };
  } | null;
}

// Memoized FeaturedEntry component with optimized comparison
const FeaturedEntry = React.memo(({ entryWithData: { entry, initialData, postMetadata }, metrics, onOpenCommentDrawer, isPriority = false, articleIndex, totalArticles }: FeaturedEntryProps & { onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void, isPriority?: boolean, articleIndex?: number, totalArticles?: number }) => {
  // Get audio player state and actions (from global audio store)
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

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

  // Memoized timestamp computation with caching
  const timestamp = useMemo(() => {
    const pubDate = memoizedDateParsers.parseEntryDateForDisplay(entry.pub_date);
    
    if (isNaN(pubDate.getTime())) {
      return '';
    }

    const now = new Date();
    const referenceTime = Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
    const refDate = new Date(referenceTime);

    const diffInMs = refDate.getTime() - pubDate.getTime();
    const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    
    const isFuture = diffInMs < -(60 * 1000);
    const prefix = isFuture ? 'in ' : '';
    const suffix = isFuture ? '' : '';
    
    if (diffInMinutes < 1) {
      return 'now';
    } else if (diffInMinutes < 60) {
      return `${prefix}${diffInMinutes}m${suffix}`;
    } else if (diffInHours < 24) {
      return `${prefix}${diffInHours}h${suffix}`;
    } else if (diffInDays < 30) {
      return `${prefix}${diffInDays}d${suffix}`;
    } else if (diffInMonths < 12) {
      return `${prefix}${diffInMonths}mo${suffix}`;
    } else {
      return format(pubDate, 'MMM d, yyyy');
    }
  }, [entry.pub_date]);

  // Memoized decoded content
  const decodedContent = useMemo(() => ({
    title: decode(entry.title || ''),
    description: decode(entry.description || '')
  }), [entry.title, entry.description]);

  // Memoized image source with stable fallback
  const imageSrc = useMemo(() => {
    const primaryImage = entry.image;
    const fallbackImage = postMetadata?.featuredImg;
    const defaultImage = '/placeholder-image.jpg';
    
    return primaryImage || fallbackImage || defaultImage;
  }, [entry.image, postMetadata?.featuredImg]);

  // Memoized comment handler
  const handleOpenComments = useCallback(() => {
    onOpenCommentDrawer(entry.guid, entry.feed_url, metrics?.comments || initialData?.comments);
  }, [entry.guid, entry.feed_url, metrics?.comments, initialData?.comments, onOpenCommentDrawer]);

  // Memoized verification status
  const isVerified = useMemo(() => {
    return postMetadata?.verified || false;
  }, [postMetadata?.verified]);

  // Generate post URL
  const postUrl = postMetadata?.postSlug
    ? postMetadata.mediaType === 'newsletter'
      ? `/newsletters/${postMetadata.postSlug}`
      : postMetadata.mediaType === 'podcast'
        ? `/podcasts/${postMetadata.postSlug}`
        : postMetadata.categorySlug 
          ? `/${postMetadata.categorySlug}/${postMetadata.postSlug}`
          : null
    : null;

  // Direct click handler for podcasts
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (postMetadata?.mediaType === 'podcast') {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entry.link, decodedContent.title, imageSrc, postMetadata?.title);
    }
  }, [postMetadata?.mediaType, entry.link, decodedContent.title, imageSrc, postMetadata?.title, playTrack]);

  // Generate unique IDs for ARIA labeling
  const titleId = `entry-title-${entry.guid}`;
  const contentId = `entry-content-${entry.guid}`;

  return (
    <article 
      role="article"
      aria-labelledby={titleId}
      aria-describedby={contentId}
      aria-posinset={articleIndex}
      aria-setsize={totalArticles || -1}
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
          {postMetadata?.featuredImg && postUrl && (
            <NoFocusLinkWrapper className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
              onClick={handleLinkInteraction}
              onTouchStart={handleLinkInteraction}
            >
              <PrefetchAnchor 
                href={postUrl}
                aria-label={`View ${postMetadata.title || decodedContent.title} ${postMetadata.mediaType || 'content'}`}
              >
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
              {postMetadata?.title && (
                <div className="flex items-start justify-between gap-2">
                  {postUrl ? (
                    <NoFocusLinkWrapper 
                      className="hover:opacity-80 transition-opacity"
                      onClick={handleLinkInteraction}
                      onTouchStart={handleLinkInteraction}
                    >
                      <PrefetchAnchor href={postUrl}>
                        <h2 id={titleId} className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                          {postMetadata.title}
                          {isVerified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                        </h2>
                      </PrefetchAnchor>
                    </NoFocusLinkWrapper>
                  ) : (
                    <h2 id={titleId} className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                      {postMetadata.title}
                      {isVerified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h2>
                  )}
                  <span 
                    className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                    title={format(new Date(entry.pub_date), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {postMetadata?.mediaType && (
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
        {postMetadata?.mediaType === 'podcast' ? (
          <div id={contentId}>
            <div 
              onClick={(e) => {
                handleLinkInteraction(e);
                handleCardClick(e);
              }}
              onTouchStart={handleLinkInteraction}
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
            >
              <Card className={`rounded-xl overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                {imageSrc && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={2/1}>
                      <Image
                        key={`${entry.guid}-podcast-image`}
                        src={imageSrc}
                        alt={`${decodedContent.title} podcast cover`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 516px) 100vw, 516px"
                        priority={isPriority}
                        unoptimized={false}
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
            </div>
          </div>
        ) : (
          <div id={contentId}>
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
              >
                <Card className="rounded-xl border overflow-hidden shadow-none">
                  {imageSrc && (
                    <CardHeader className="p-0">
                      <AspectRatio ratio={2/1}>
                        <Image
                          key={`${entry.guid}-article-image`}
                          src={imageSrc}
                          alt={`${decodedContent.title} article image`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 516px) 100vw, 516px"
                          priority={isPriority}
                          unoptimized={false}
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
          </div>
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
              initialData={metrics?.likes || initialData.likes}
              skipQuery={true}
            />
          </NoFocusWrapper>
          <NoFocusWrapper 
            className="flex items-center" 
            onClick={handleOpenComments}
          >
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              initialData={metrics?.comments || initialData.comments}
              buttonOnly={true}
              skipQuery={true}
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
              initialData={metrics?.retweets || initialData.retweets || { isRetweeted: false, count: 0 }}
              skipQuery={true}
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
                initialData={metrics?.bookmarks || initialData.bookmarks || { isBookmarked: false }}
                skipQuery={true}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entry.link}
                title={entry.title}
                internalUrl={postMetadata?.mediaType === 'podcast' && postUrl ? postUrl : undefined}
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
  
  // Check entry properties that affect rendering
  if (prevEntry.entry.image !== nextEntry.entry.image) return false;
  if (prevEntry.entry.title !== nextEntry.entry.title) return false;
  if (prevEntry.entry.description !== nextEntry.entry.description) return false;
  if (prevEntry.entry.link !== nextEntry.entry.link) return false;
  if (prevEntry.entry.pub_date !== nextEntry.entry.pub_date) return false;
  
  // Check initialData metrics that affect UI
  if (prevEntry.initialData?.likes?.count !== nextEntry.initialData?.likes?.count) return false;
  if (prevEntry.initialData?.likes?.isLiked !== nextEntry.initialData?.likes?.isLiked) return false;
  if (prevEntry.initialData?.comments?.count !== nextEntry.initialData?.comments?.count) return false;
  if (prevEntry.initialData?.retweets?.count !== nextEntry.initialData?.retweets?.count) return false;
  if (prevEntry.initialData?.retweets?.isRetweeted !== nextEntry.initialData?.retweets?.isRetweeted) return false;
  if (prevEntry.initialData?.bookmarks?.isBookmarked !== nextEntry.initialData?.bookmarks?.isBookmarked) return false;
  
  // Check postMetadata that affects display
  if (prevEntry.postMetadata?.title !== nextEntry.postMetadata?.title) return false;
  if (prevEntry.postMetadata?.featuredImg !== nextEntry.postMetadata?.featuredImg) return false;
  if (prevEntry.postMetadata?.verified !== nextEntry.postMetadata?.verified) return false;
  if (prevEntry.postMetadata?.mediaType !== nextEntry.postMetadata?.mediaType) return false;
  
  // Check function reference
  if (prevProps.onOpenCommentDrawer !== nextProps.onOpenCommentDrawer) return false;
  
  // Check isPriority prop
  if (prevProps.isPriority !== nextProps.isPriority) return false;
  
  // Check new ARIA props
  if (prevProps.articleIndex !== nextProps.articleIndex) return false;
  if (prevProps.totalArticles !== nextProps.totalArticles) return false;
  
  // CRITICAL FIX: Check metrics that affect UI
  if (prevProps.metrics?.likes?.count !== nextProps.metrics?.likes?.count) return false;
  if (prevProps.metrics?.likes?.isLiked !== nextProps.metrics?.likes?.isLiked) return false;
  if (prevProps.metrics?.comments?.count !== nextProps.metrics?.comments?.count) return false;
  if (prevProps.metrics?.retweets?.count !== nextProps.metrics?.retweets?.count) return false;
  if (prevProps.metrics?.retweets?.isRetweeted !== nextProps.metrics?.retweets?.isRetweeted) return false;
  if (prevProps.metrics?.bookmarks?.isBookmarked !== nextProps.metrics?.bookmarks?.isBookmarked) return false;
  
  return true;
});
FeaturedEntry.displayName = 'FeaturedEntry';

// Featured Content component with virtualization
interface FeaturedContentProps {
  paginatedEntries: FeaturedFeedEntryWithData[];
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  isPending: boolean;
  loadMore: () => void;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  isInitializing?: boolean;
  pageSize: number;
  getMetrics?: (entryGuid: string) => { likes: { count: number; isLiked: boolean }; comments: { count: number }; retweets?: { count: number; isRetweeted: boolean }; bookmarks?: { isBookmarked: boolean }; } | null;
}

function FeaturedContentComponent({
  paginatedEntries,
  hasMore,
  loadMoreRef,
  isPending,
  loadMore,
  onOpenCommentDrawer,
  isInitializing = false,
  pageSize,
  getMetrics
}: FeaturedContentProps) {
  const endReachedCalledRef = useRef(false);
  const entriesDataRef = useRef(paginatedEntries);
  const virtuosoRef = useRef<any>(null);
  
  entriesDataRef.current = paginatedEntries;
  
  const currentEntriesLength = paginatedEntries.length;
  const prevEntriesLengthRef = useRef(currentEntriesLength);
  if (prevEntriesLengthRef.current !== currentEntriesLength) {
    endReachedCalledRef.current = false;
    prevEntriesLengthRef.current = currentEntriesLength;
  }
  
  const itemContentCallback = useCallback((index: number, item: FeaturedFeedEntryWithData) => {
    const metrics = getMetrics ? getMetrics(item.entry.guid) : null;
    
    return (
      <FeaturedEntry 
        entryWithData={item}
        metrics={metrics}
        onOpenCommentDrawer={onOpenCommentDrawer}
        isPriority={index < 2} // First two entries get priority loading
        articleIndex={index + 1} // ARIA position starts from 1
        totalArticles={paginatedEntries.length}
      />
    );
  }, [onOpenCommentDrawer, paginatedEntries.length, getMetrics]);
  
  const handleEndReached = useCallback(() => {
    if (hasMore && !isPending && !endReachedCalledRef.current) {
      endReachedCalledRef.current = true;
      loadMore();
    }
  }, [hasMore, isPending, loadMore]);
  
  // Use universal delayed intersection observer hook
  useDelayedIntersectionObserver(loadMoreRef, loadMore, {
    enabled: hasMore && !isPending,
    isLoading: isPending,
    hasMore,
    rootMargin: '1000px',
    threshold: 0.1
  });
  
  const hasLoggedInitialCreateRef = useRef(false);
  
  const virtuosoStyle = useMemo(() => ({ 
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation'
  }), []);

  const virtuosoComponents = useMemo(() => ({
    Footer: () => null
  }), []);
  
  const virtuosoComponent = useMemo(() => {
    if (paginatedEntries.length === 0 && !isInitializing) {
      return null;
    }
    
    if (!hasLoggedInitialCreateRef.current) {
      hasLoggedInitialCreateRef.current = true;
    }
    
    return (
      <Virtuoso
        ref={virtuosoRef}
        useWindowScroll
        data={paginatedEntries}
        computeItemKey={(_, item) => item.entry.guid}
        itemContent={itemContentCallback}
        overscan={VIRTUAL_SCROLL_CONFIG.overscan}
        components={virtuosoComponents}
        style={virtuosoStyle}
        className="focus:outline-none focus-visible:outline-none"
        increaseViewportBy={VIRTUAL_SCROLL_CONFIG.increaseViewportBy}
        restoreStateFrom={undefined}
      />
    );
  }, [paginatedEntries.length, itemContentCallback, isInitializing, virtuosoRef, virtuosoComponents, virtuosoStyle]);

  if (paginatedEntries.length === 0 && !isInitializing) {
    return (
      <section 
        className="flex justify-center items-center py-10"
        role="status"
        aria-live="polite"
        aria-label="Loading featured entries"
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading featured entries...</span>
      </section>
    );
  }

  return (
    <section 
      className="space-y-0 featured-feed-container" 
      role="region"
      aria-label="Featured feed entries"
      aria-busy={isPending ? 'true' : 'false'}
      style={{ 
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      {virtuosoComponent}
      
      <div 
        ref={loadMoreRef} 
        className="h-52 flex items-center justify-center mb-20"
        role="status"
        aria-live="polite"
        aria-label={hasMore ? (isPending ? "Loading more entries..." : "Scroll to load more entries") : "All entries loaded"}
      >
        {hasMore && isPending && (
          <>
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading more entries...</span>
          </>
        )}
        {!hasMore && paginatedEntries.length > 0 && (
          <span className="sr-only">All entries have been loaded</span>
        )}
      </div>
    </section>
  );
}

const FeaturedContent = React.memo<FeaturedContentProps>(
  FeaturedContentComponent, 
  (prevProps, nextProps) => {
    if (prevProps.hasMore !== nextProps.hasMore) return false;
    if (prevProps.isPending !== nextProps.isPending) return false;
    if (prevProps.isInitializing !== nextProps.isInitializing) return false;
    if (prevProps.pageSize !== nextProps.pageSize) return false;
    
    const prevLength = prevProps.paginatedEntries.length;
    const nextLength = nextProps.paginatedEntries.length;
    if (prevLength !== nextLength) return false;
    
    if (prevLength > 0 && nextLength > 0) {
      const prevFirst = prevProps.paginatedEntries[0];
      const nextFirst = nextProps.paginatedEntries[0];
      const prevLast = prevProps.paginatedEntries[prevLength - 1];
      const nextLast = nextProps.paginatedEntries[nextLength - 1];
      
      if (prevFirst?.entry.guid !== nextFirst?.entry.guid) return false;
      if (prevLast?.entry.guid !== nextLast?.entry.guid) return false;
      
      if (prevLength > 10) {
        const midIndex = Math.floor(prevLength / 2);
        const prevMid = prevProps.paginatedEntries[midIndex];
        const nextMid = nextProps.paginatedEntries[midIndex];
        if (prevMid?.entry.guid !== nextMid?.entry.guid) return false;
      }
    }
    
    if (prevProps.loadMore !== nextProps.loadMore) return false;
    if (prevProps.onOpenCommentDrawer !== nextProps.onOpenCommentDrawer) return false;
    
    // CRITICAL FIX: Check getMetrics function reference for batch metrics reactivity
    if (prevProps.getMetrics !== nextProps.getMetrics) return false;
    
    return true;
  }
);

FeaturedContent.displayName = 'FeaturedContent';

// Main client component
const FeaturedFeedClientComponent = ({ 
  initialData, 
  pageSize = 30, 
  isActive = true
}: FeaturedFeedClientProps) => {
  // Main state with useReducer
  const [state, dispatch] = useReducer(featuredFeedReducer, createInitialState());

  // Refs for state persistence
  const isMountedRef = useRef(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initialize with server data
  useEffect(() => {
    if (!state.hasInitialized && initialData && isMountedRef.current) {
      dispatch({ type: 'INITIALIZE', payload: initialData });
    }
  }, [state.hasInitialized, initialData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load more entries function (client-side pagination via slicing)
  const loadMoreEntries = useCallback(() => {
    if (state.hasMore && !state.isLoading && isMountedRef.current) {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Simulate loading delay for better UX
      setTimeout(() => {
        if (isMountedRef.current) {
          dispatch({ type: 'SET_CURRENT_PAGE', payload: state.currentPage + 1 });
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      }, 300);
    }
  }, [state.hasMore, state.isLoading, state.currentPage]);

  // Calculate visible entries based on current page (client-side slicing)
  const visibleEntries = useMemo(() => {
    return state.entries.slice(0, state.currentPage * pageSize);
  }, [state.entries, state.currentPage, pageSize]);

  // Apply memory optimization
  const optimizedEntries = useMemo(() => 
    optimizeEntriesForMemory(visibleEntries), 
    [visibleEntries]
  );

  // Update hasMore based on visible vs total entries
  useEffect(() => {
    const newHasMore = visibleEntries.length < state.entries.length;
    if (newHasMore !== state.hasMore) {
      dispatch({ type: 'SET_HAS_MORE', payload: newHasMore });
    }
  }, [visibleEntries.length, state.entries.length, state.hasMore]);

  // Get entry GUIDs for batch metrics query - extract from stable initial data only
  const entryGuids = useMemo(() => {
    if (!initialData?.entries) return [];
    
    // Extract GUIDs from initial server data (slice for pagination)
    return initialData.entries
      .slice(0, state.currentPage * pageSize)
      .map(entry => entry.entry.guid);
  }, [initialData?.entries, state.currentPage, pageSize]); // Only depend on stable server data and pagination state
  
  // Extract initial metrics from server data for fast rendering without button flashing
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
  const { getMetrics, isLoading: metricsLoading } = useBatchEntryMetrics(
    isActive ? entryGuids : [], // Only query when feed is active
    { 
      initialMetrics
      // Reactive subscription for cross-feed updates
    }
  );

  // Focus prevention
  const shouldPreventFocus = useMemo(() => 
    isActive && !state.commentDrawerOpen, 
    [isActive, state.commentDrawerOpen]
  );

  useFeedFocusPrevention(shouldPreventFocus, '.featured-feed-container');

  // Memoized comment handlers
  const openCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => 
    dispatch({ type: 'OPEN_COMMENT_DRAWER', payload: { entryGuid, feedUrl, initialData } }), []);
  
  const closeCommentDrawer = useCallback(() => dispatch({ type: 'CLOSE_COMMENT_DRAWER' }), []);
  
  const memoizedCommentHandlers = useMemo(() => ({
    open: openCommentDrawer,
    close: closeCommentDrawer
  }), [openCommentDrawer, closeCommentDrawer]);

  return (
    <main className="w-full featured-feed-container" role="main" aria-label="Featured Feed">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-primary-foreground"
      >
        Skip to main content
      </a>
      
      <section id="main-content" aria-labelledby="feed-heading">
        <h1 id="feed-heading" className="sr-only">
          Featured Feed Entries
          {state.totalEntries > 0 && ` (${state.totalEntries} total entries)`}
          {state.isLoading && ' - Loading...'}
        </h1>
        
        <FeaturedContent
          paginatedEntries={optimizedEntries}
          hasMore={state.hasMore}
          loadMoreRef={loadMoreRef}
          isPending={state.isLoading}
          loadMore={loadMoreEntries}
          onOpenCommentDrawer={memoizedCommentHandlers.open}
          isInitializing={!state.hasInitialized}
          pageSize={pageSize}
          getMetrics={getMetrics}
        />
      </section>
      
      {/* Comment drawer */}
      {state.commentDrawerOpen && state.selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={state.selectedCommentEntry.entryGuid}
          feedUrl={state.selectedCommentEntry.feedUrl}
          initialData={state.selectedCommentEntry.initialData}
          isOpen={state.commentDrawerOpen}
          setIsOpen={memoizedCommentHandlers.close}
          skipQuery={true}
        />
      )}
    </main>
  );
};

// Export the memoized version with optimized comparison
export const FeaturedFeedClient = memo(FeaturedFeedClientComponent, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.pageSize !== nextProps.pageSize) return false;
  
  if (!prevProps.initialData && nextProps.initialData) return false;
  if (prevProps.initialData && !nextProps.initialData) return false;
  
  if (prevProps.initialData && nextProps.initialData) {
    if (prevProps.initialData.entries?.length !== nextProps.initialData.entries?.length) return false;
    if (prevProps.initialData.totalEntries !== nextProps.initialData.totalEntries) return false;
    
    const prevEntries = prevProps.initialData.entries;
    const nextEntries = nextProps.initialData.entries;
    if (prevEntries?.length !== nextEntries?.length) return false;
    if (prevEntries?.length && nextEntries?.length && prevEntries.length > 0) {
      if (prevEntries[0] !== nextEntries[0]) return false;
      if (prevEntries[prevEntries.length - 1] !== nextEntries[nextEntries.length - 1]) return false;
      
      if (prevEntries.length > 10) {
        const midIndex = Math.floor(prevEntries.length / 2);
        if (prevEntries[midIndex] !== nextEntries[midIndex]) return false;
      }
    }
  }
  
  return true;
});
FeaturedFeedClient.displayName = 'FeaturedFeedClient';

// Export with error boundary (no store provider needed)
export const FeaturedFeedClientWithErrorBoundary = memo(function FeaturedFeedClientWithErrorBoundary(props: FeaturedFeedClientProps) {
  return (
    <ErrorBoundary>
        <FeaturedFeedClient {...props} />
    </ErrorBoundary>
  );
}); 