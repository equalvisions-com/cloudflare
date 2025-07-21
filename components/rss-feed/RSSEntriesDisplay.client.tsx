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
import type { 
  RSSEntriesDisplayClientProps,
  RSSEntriesDisplayEntry,
} from "@/lib/types";

// Import custom hooks for business logic
import { useRSSEntriesMemoryManagement } from './hooks/useRSSEntriesMemoryManagement';
import { useRSSEntriesDataLoading } from './hooks/useRSSEntriesDataLoading';
import { useRSSEntriesRefresh } from './hooks/useRSSEntriesRefresh';
import { useRSSEntriesCommentDrawer } from './hooks/useRSSEntriesCommentDrawer';
import { useRSSEntriesInitialization } from './hooks/useRSSEntriesInitialization';
import { useRSSEntriesNewEntries } from './hooks/useRSSEntriesNewEntries';
import { useBatchEntryMetrics } from '@/hooks/useBatchEntryMetrics';

// Constants for performance optimization
const ITEMS_PER_REQUEST = 30;

// Memory optimization for large datasets - Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
  overscan: 2000, // Current buffer size
  maxBufferSize: 10000, // Maximum items to keep in memory
  recycleThreshold: 5000, // Start recycling items after this many
  increaseViewportBy: { top: 600, bottom: 600 }, // Viewport extension
};

// Memory management for large entry lists
const optimizeEntriesForMemory = (entries: RSSEntriesDisplayEntry[], maxSize: number = VIRTUAL_SCROLL_CONFIG.maxBufferSize): RSSEntriesDisplayEntry[] => {
  // If we're under the threshold, return as-is
  if (entries.length <= maxSize) {
    return entries;
  }
  
  // Keep the most recent entries up to maxSize
  // This ensures we don't run out of memory with very large feeds
  return entries.slice(0, maxSize);
};

// Memoize expensive date parsing operations
const memoizedDateParsers = {
  // Cache for parsed dates to avoid repeated parsing
  parseCache: new Map<string, Date>(),
  displayCache: new Map<string, Date>(),

// Helper function to consistently parse dates from the database
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
    // Convert MySQL datetime string - do NOT add 'Z' as the database times are in local timezone (EST)
    // Adding 'Z' incorrectly treats EST times as UTC, causing a 4-hour offset
    const [datePart, timePart] = dateString.split(' ');
      result = new Date(`${datePart}T${timePart}`); // No 'Z' - let JS interpret as local time
    } else {
      // Handle other formats
      result = new Date(dateString);
    }
    
    // Cache the result
    memoizedDateParsers.parseCache.set(cacheKey, result);
    return result;
  },

// Helper function specifically for timestamp display - treats database dates as UTC
  parseEntryDateForDisplay: (dateString: string | Date): Date => {
  if (dateString instanceof Date) {
    return dateString;
  }
    
    const cacheKey = `display_${String(dateString)}`;
    if (memoizedDateParsers.displayCache.has(cacheKey)) {
      return memoizedDateParsers.displayCache.get(cacheKey)!;
  }
  
  // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
  const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  
    let result: Date;
  if (typeof dateString === 'string' && mysqlDateRegex.test(dateString)) {
    // Convert MySQL datetime string to UTC time for consistent display
    const [datePart, timePart] = dateString.split(' ');
      result = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      result = new Date(dateString);
    }
    
    // Cache the result
    memoizedDateParsers.displayCache.set(cacheKey, result);
    return result;
  }
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

// State interface for useReducer
interface RSSEntriesState {
  // Core data
  entries: RSSEntriesDisplayEntry[];
  
  // Pagination
  currentPage: number;
  hasMore: boolean;
  totalEntries: number;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  hasRefreshed: boolean;
  fetchError: Error | null;
  refreshError: string | null;
  
  // UI states
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
  showNotification: boolean;
  notificationCount: number;
  notificationImages: string[];
  
  // Metadata
  postTitles: string[];
  feedUrls: string[];
  mediaTypes: string[];
  newEntries: RSSEntriesDisplayEntry[];
  
  // Initialization
  hasInitialized: boolean;
}

// Action types for useReducer
type RSSEntriesAction = 
  | { type: 'INITIALIZE'; payload: {
      entries: RSSEntriesDisplayEntry[];
      totalEntries: number;
      hasMore: boolean;
      postTitles: string[];
      feedUrls: string[];
      mediaTypes: string[];
    }}
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_HAS_REFRESHED'; payload: boolean }
  | { type: 'SET_FETCH_ERROR'; payload: Error | null }
  | { type: 'SET_REFRESH_ERROR'; payload: string | null }
  | { type: 'SET_ENTRIES'; payload: RSSEntriesDisplayEntry[] }
  | { type: 'ADD_ENTRIES'; payload: RSSEntriesDisplayEntry[] }
  | { type: 'PREPEND_ENTRIES'; payload: RSSEntriesDisplayEntry[] }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_TOTAL_ENTRIES'; payload: number }
  | { type: 'SET_POST_TITLES'; payload: string[] }
  | { type: 'SET_FEED_URLS'; payload: string[] }
  | { type: 'SET_MEDIA_TYPES'; payload: string[] }
  | { type: 'OPEN_COMMENT_DRAWER'; payload: {
      entryGuid: string;
      feedUrl: string;
      initialData?: { count: number };
    }}
  | { type: 'CLOSE_COMMENT_DRAWER' }
  | { type: 'SET_NOTIFICATION'; payload: {
      show: boolean;
      count?: number;
      images?: string[];
    }}
  | { type: 'SET_NEW_ENTRIES'; payload: RSSEntriesDisplayEntry[] }
  | { type: 'CLEAR_NEW_ENTRIES' }
  | { type: 'UPDATE_ENTRY_METRICS'; payload: {
      entryGuid: string;
      metrics: RSSEntriesDisplayEntry['initialData'];
    }};

// Initial state factory
const createInitialState = (): RSSEntriesState => ({
  entries: [],
  currentPage: 1,
  hasMore: false,
  totalEntries: 0,
  isLoading: false,
  isRefreshing: false,
  hasRefreshed: false,
  fetchError: null,
  refreshError: null,
  commentDrawerOpen: false,
  selectedCommentEntry: null,
  showNotification: false,
  notificationCount: 0,
  notificationImages: [],
  postTitles: [],
  feedUrls: [],
  mediaTypes: [],
  newEntries: [],
  hasInitialized: false,
});

// Reducer function
const rssEntriesReducer = (state: RSSEntriesState, action: RSSEntriesAction): RSSEntriesState => {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        ...action.payload,
        hasInitialized: true,
        currentPage: 1,
        isLoading: false,
        isRefreshing: false,
        hasRefreshed: false,
        fetchError: null,
        refreshError: null,
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_REFRESHING':
      return { ...state, isRefreshing: action.payload };
    
    case 'SET_HAS_REFRESHED':
      return { ...state, hasRefreshed: action.payload };
    
    case 'SET_FETCH_ERROR':
      return { ...state, fetchError: action.payload };
    
    case 'SET_REFRESH_ERROR':
      return { ...state, refreshError: action.payload };
    
    case 'SET_ENTRIES':
      return { ...state, entries: action.payload };
    
    case 'ADD_ENTRIES':
      return { ...state, entries: [...state.entries, ...action.payload] };
    
    case 'PREPEND_ENTRIES':
      return { ...state, entries: [...action.payload, ...state.entries] };
    
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.payload };
    
    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };
    
    case 'SET_TOTAL_ENTRIES':
      return { ...state, totalEntries: action.payload };
    
    case 'SET_POST_TITLES':
      return { ...state, postTitles: action.payload };
    
    case 'SET_FEED_URLS':
      return { ...state, feedUrls: action.payload };
    
    case 'SET_MEDIA_TYPES':
      return { ...state, mediaTypes: action.payload };
    
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
    
    case 'SET_NOTIFICATION':
      return {
        ...state,
        showNotification: action.payload.show,
        notificationCount: action.payload.count || 0,
        notificationImages: action.payload.images || [],
      };
    
    case 'SET_NEW_ENTRIES':
      return { ...state, newEntries: action.payload };
    
    case 'CLEAR_NEW_ENTRIES':
      return { ...state, newEntries: [] };
    
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



interface RSSEntryProps {
  entryWithData: RSSEntriesDisplayEntry;
  metrics?: {
    likes: { count: number; isLiked: boolean };
    comments: { count: number };
    retweets?: { count: number; isRetweeted: boolean };
    bookmarks?: { isBookmarked: boolean };
  } | null;
}

// Memoize the RSSEntry component with optimized comparison for maximum performance
const RSSEntry = React.memo(({ entryWithData: { entry, initialData, postMetadata }, metrics, onOpenCommentDrawer }: RSSEntryProps & { onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void }) => {
  // Get audio player state and actions (from global audio store)
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();
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

  // Memoize expensive timestamp computation with caching
  const timestamp = useMemo(() => {
    // Use the display-specific date parsing helper for consistent timestamp display
    const pubDate = memoizedDateParsers.parseEntryDateForDisplay(entry.pubDate);
    
    // Ensure we're working with valid dates
    if (isNaN(pubDate.getTime())) {
      return '';
    }

    // Use a fixed reference time to prevent constant re-calculations
    // This improves performance by making timestamps stable for short periods
    const now = new Date();
    const referenceTime = Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000); // Round to 5-minute intervals
    const refDate = new Date(referenceTime);

    // Calculate time difference
    const diffInMs = refDate.getTime() - pubDate.getTime();
    const diffInMinutes = Math.floor(Math.abs(diffInMs) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    
    // For future dates (more than 1 minute ahead), show 'in X'
    const isFuture = diffInMs < -(60 * 1000); // 1 minute buffer for slight time differences
    const prefix = isFuture ? 'in ' : '';
    const suffix = isFuture ? '' : '';
    
    // Format based on time difference
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
      // For very old posts, show the actual date
      return format(pubDate, 'MMM d, yyyy');
    }
  }, [entry.pubDate]); // Only depend on pubDate for stable performance

  // Memoize decoded title and description
  const decodedContent = useMemo(() => ({
    title: decode(entry.title || ''),
    description: decode(entry.description || '')
  }), [entry.title, entry.description]);

  // Memoize image source with stable fallback to prevent re-renders
  const imageSrc = useMemo(() => {
    // Use a stable fallback to prevent unnecessary re-renders
    const primaryImage = entry.image;
    const fallbackImage = postMetadata?.featuredImg;
    const defaultImage = '/placeholder-image.jpg';
    
    // Return the first available image source
    return primaryImage || fallbackImage || defaultImage;
  }, [entry.image, postMetadata?.featuredImg]);

  // Memoize audio track data
  const audioTrackData = useMemo(() => {
    // Note: enclosure property may not exist on RSSItem type, skip audio functionality for now
    return null;
  }, []);

  // Memoize comment handler
  const handleOpenComments = useCallback(() => {
    onOpenCommentDrawer(entry.guid, entry.feedUrl, metrics?.comments || initialData?.comments);
  }, [entry.guid, entry.feedUrl, metrics?.comments, initialData?.comments, onOpenCommentDrawer]);

  // Memoize author display
  const authorDisplay = useMemo(() => {
    return postMetadata?.title || 'Unknown Author';
  }, [postMetadata?.title]);

  // Memoize verification status
  const isVerified = useMemo(() => {
    return postMetadata?.verified || false;
  }, [postMetadata?.verified]);

  // Ensure we have valid postMetadata
  const safePostMetadata = useMemo(() => {
    // Use type assertion to access feedTitle safely
    const feedTitle = (entry as any).feedTitle || '';
    
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
      playTrack(entry.link, decodedContent.title, imageSrc, safePostMetadata.title);
    }
  }, [safePostMetadata.mediaType, entry.link, decodedContent.title, imageSrc, safePostMetadata.title, playTrack]);

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
                        priority={false}
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
                        priority={false}
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
              feedUrl={entry.feedUrl}
              initialData={metrics?.comments || initialData.comments}
              buttonOnly={true}
              skipQuery={true}
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
              initialData={metrics?.retweets || initialData.retweets || { isRetweeted: false, count: 0 }}
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
                initialData={metrics?.bookmarks || initialData.bookmarks || { isBookmarked: false }}
                skipQuery={true}
              />
            </NoFocusWrapper>
            <NoFocusWrapper className="flex items-center">
              <ShareButtonClient
                url={entry.link}
                title={entry.title}
                internalUrl={safePostMetadata.mediaType === 'podcast' && postUrl ? postUrl : undefined}
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
  
  // Check entry properties that affect image rendering (CRITICAL for preventing image re-renders)
  if (prevEntry.entry.image !== nextEntry.entry.image) return false;
  if (prevEntry.entry.title !== nextEntry.entry.title) return false;
  if (prevEntry.entry.description !== nextEntry.entry.description) return false;
  if (prevEntry.entry.link !== nextEntry.entry.link) return false;
  if (prevEntry.entry.pubDate !== nextEntry.entry.pubDate) return false;
  
  // Check initialData metrics that affect UI (optimized order - most likely to change first)
  if (prevEntry.initialData?.likes?.count !== nextEntry.initialData?.likes?.count) return false;
  if (prevEntry.initialData?.likes?.isLiked !== nextEntry.initialData?.likes?.isLiked) return false;
  if (prevEntry.initialData?.comments?.count !== nextEntry.initialData?.comments?.count) return false;
  if (prevEntry.initialData?.retweets?.count !== nextEntry.initialData?.retweets?.count) return false;
  if (prevEntry.initialData?.retweets?.isRetweeted !== nextEntry.initialData?.retweets?.isRetweeted) return false;
  if (prevEntry.initialData?.bookmarks?.isBookmarked !== nextEntry.initialData?.bookmarks?.isBookmarked) return false;
  
  // Check postMetadata that affects display (CRITICAL for image src stability)
  if (prevEntry.postMetadata?.title !== nextEntry.postMetadata?.title) return false;
  if (prevEntry.postMetadata?.featuredImg !== nextEntry.postMetadata?.featuredImg) return false;
  if (prevEntry.postMetadata?.verified !== nextEntry.postMetadata?.verified) return false;
  if (prevEntry.postMetadata?.mediaType !== nextEntry.postMetadata?.mediaType) return false;
  
  // Check function reference (should be stable with useCallback)
  if (prevProps.onOpenCommentDrawer !== nextProps.onOpenCommentDrawer) return false;
  
  // Check metrics that affect UI
  if (prevProps.metrics?.likes?.count !== nextProps.metrics?.likes?.count) return false;
  if (prevProps.metrics?.likes?.isLiked !== nextProps.metrics?.likes?.isLiked) return false;
  if (prevProps.metrics?.comments?.count !== nextProps.metrics?.comments?.count) return false;
  if (prevProps.metrics?.retweets?.count !== nextProps.metrics?.retweets?.count) return false;
  if (prevProps.metrics?.retweets?.isRetweeted !== nextProps.metrics?.retweets?.isRetweeted) return false;
  if (prevProps.metrics?.bookmarks?.isBookmarked !== nextProps.metrics?.bookmarks?.isBookmarked) return false;
  
  // All checks passed - prevent re-render for optimal performance
  return true;
});
RSSEntry.displayName = 'RSSEntry';

// Define a proper type for entry metrics
interface EntriesContentProps {
  paginatedEntries: RSSEntriesDisplayEntry[];
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  isPending: boolean;
  loadMore: () => void;
  entryMetrics: Record<string, RSSEntriesDisplayEntry['initialData']> | null;
  postMetadata?: Map<string, RSSEntriesDisplayEntry['postMetadata']>;
  initialData: {
    entries: RSSEntriesDisplayEntry[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
    feedMetadataCache: Record<string, RSSEntriesDisplayEntry['postMetadata']>;
  };
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
  isInitializing?: boolean;
  pageSize: number;
  getMetrics?: (entryGuid: string) => {
    likes: { count: number; isLiked: boolean };
    comments: { count: number };
    retweets?: { count: number; isRetweeted: boolean };
    bookmarks?: { isBookmarked: boolean };
  } | null;
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
  pageSize,
  getMetrics
}: EntriesContentProps) {
  // Add ref for tracking if endReached was already called
  const endReachedCalledRef = useRef(false);
  
  // Create a stable ref for entriesData to avoid unnecessary virtuoso recreations
  const entriesDataRef = useRef(paginatedEntries);
  
  // Add a ref for the Virtuoso component to control scrolling
  const virtuosoRef = useRef<any>(null);
  
  // Update refs during render phase (React best practice)
    entriesDataRef.current = paginatedEntries;
  
  // Reset endReachedCalled flag when entries length changes (render-phase computation)
  const currentEntriesLength = paginatedEntries.length;
  const prevEntriesLengthRef = useRef(currentEntriesLength);
  if (prevEntriesLengthRef.current !== currentEntriesLength) {
    endReachedCalledRef.current = false;
    prevEntriesLengthRef.current = currentEntriesLength;
  }
  
  // Optimized itemContent callback with performance enhancements
  const itemContentCallback = useCallback((index: number, item: RSSEntriesDisplayEntry) => {
    // Get metrics from batch query if available
    const metrics = getMetrics ? getMetrics(item.entry.guid) : null;
    
    // Fast path: if no external data sources and no batch metrics, return item as-is
    if (!entryMetrics && !postMetadata && !initialData.feedMetadataCache && !metrics) {
      return (
        <RSSEntry 
          entryWithData={item}
          metrics={null}
          onOpenCommentDrawer={onOpenCommentDrawer} 
        />
      );
    }
    
    // Only create new objects if we actually have updates to apply
    let needsUpdate = false;
    let updatedInitialData = item.initialData;
    let updatedPostMetadata = item.postMetadata;
    
    // Check for metrics updates (most common case)
    if (entryMetrics && item.entry.guid in entryMetrics) {
      const newMetrics = entryMetrics[item.entry.guid];
      if (newMetrics !== item.initialData) {
        updatedInitialData = newMetrics;
        needsUpdate = true;
      }
    }
    
    // Check for metadata updates
    if (postMetadata && postMetadata.has(item.entry.feedUrl)) {
      const metadata = postMetadata.get(item.entry.feedUrl);
      if (metadata && metadata !== item.postMetadata) {
        updatedPostMetadata = { ...item.postMetadata, ...metadata };
        needsUpdate = true;
      }
    }
    // Check cached metadata as fallback
    else if (initialData.feedMetadataCache && item.entry.feedUrl in initialData.feedMetadataCache) {
      const cachedMetadata = initialData.feedMetadataCache[item.entry.feedUrl];
      if (cachedMetadata && cachedMetadata !== item.postMetadata) {
        updatedPostMetadata = { ...item.postMetadata, ...cachedMetadata };
        needsUpdate = true;
      }
    }
    
    // Only create new object if we have actual updates
    const finalEntryWithData = needsUpdate ? {
      ...item,
      initialData: updatedInitialData,
      postMetadata: updatedPostMetadata
    } : item;
    
    return (
      <RSSEntry 
        entryWithData={finalEntryWithData}
        metrics={metrics || updatedInitialData}
        onOpenCommentDrawer={onOpenCommentDrawer} 
      />
    );
  }, [entryMetrics, postMetadata, initialData.feedMetadataCache, onOpenCommentDrawer, getMetrics]);
  
  // Handle endReached for pagination
  const handleEndReached = useCallback(() => {
    // Check if we're at the end and should load more
    if (hasMore && !isPending && !endReachedCalledRef.current) {
      endReachedCalledRef.current = true;
      loadMore();
    }
  }, [hasMore, isPending, loadMore]);
  
  // Create a manual load more handler
  const handleManualLoadMore = useCallback(() => {
    if (hasMore && !isPending) {
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
  
  // Store a reference to the first instance - will only log on initial creation
  const hasLoggedInitialCreateRef = useRef(false);
  
  // Memoize Virtuoso components and styles for better performance
  const virtuosoStyle = useMemo(() => ({ 
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation'
  }), []);

  const virtuosoComponents = useMemo(() => ({
    Footer: () => null
  }), []);
  
  // Memoize the Virtuoso component with minimal dependencies and memory optimization
  const virtuosoComponent = useMemo(() => {
    // Skip rendering Virtuoso if we have no entries yet
    if (paginatedEntries.length === 0 && !isInitializing) {
      return null;
    }
    
    // CRITICAL FIX: Remove double optimization - entries are already optimized in parent component
    // const optimizedEntries = optimizeEntriesForMemory(paginatedEntries);
    
    // Only log the first time to avoid duplicate messages
    if (!hasLoggedInitialCreateRef.current) {
      hasLoggedInitialCreateRef.current = true;
    }
    
    // When entries are available, render Virtuoso with memory optimization
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
  // FIXED: Include paginatedEntries.length so Virtuoso re-renders when entries are added
  }, [paginatedEntries.length, itemContentCallback, isInitializing, virtuosoRef, virtuosoComponents, virtuosoStyle]);

  // Check if this is truly empty (not just initial loading)
  if (paginatedEntries.length === 0 && !isInitializing) {
    return (
      <section 
        className="flex justify-center items-center py-10"
        role="status"
        aria-live="polite"
        aria-label="Loading RSS entries"
      >
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading RSS entries...</span>
      </section>
    );
  }

  // Render the memoized Virtuoso component and load more indicator
  return (
    <section 
      className="space-y-0 rss-feed-container" 
      role="feed"
      aria-label="RSS feed entries"
      aria-busy={isPending ? 'true' : 'false'}
      style={{ 
        // CSS properties to prevent focus scrolling
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      {virtuosoComponent}
      
      {/* Fixed position load more container at bottom with accessibility */}
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

// Then apply React.memo with highly optimized comparison for maximum performance
const EntriesContent = React.memo<EntriesContentProps>(
  EntriesContentComponent, 
  (prevProps, nextProps) => {
    // Fast path: check primitive values first (most common changes)
    if (prevProps.hasMore !== nextProps.hasMore) return false;
    if (prevProps.isPending !== nextProps.isPending) return false;
    if (prevProps.isInitializing !== nextProps.isInitializing) return false;
    if (prevProps.pageSize !== nextProps.pageSize) return false;
    
    // Check array length (very fast, catches pagination changes)
    const prevLength = prevProps.paginatedEntries.length;
    const nextLength = nextProps.paginatedEntries.length;
    if (prevLength !== nextLength) return false;
    
    // Multi-tier identity checking for arrays (optimized for performance)
    if (prevLength > 0 && nextLength > 0) {
      // Tier 1: Check first and last entries (catches most real changes)
      const prevFirst = prevProps.paginatedEntries[0];
      const nextFirst = nextProps.paginatedEntries[0];
      const prevLast = prevProps.paginatedEntries[prevLength - 1];
      const nextLast = nextProps.paginatedEntries[nextLength - 1];
      
      if (prevFirst?.entry.guid !== nextFirst?.entry.guid) return false;
      if (prevLast?.entry.guid !== nextLast?.entry.guid) return false;
      
      // Tier 2: For medium arrays, check middle entry
      if (prevLength > 10) {
        const midIndex = Math.floor(prevLength / 2);
        const prevMid = prevProps.paginatedEntries[midIndex];
        const nextMid = nextProps.paginatedEntries[midIndex];
        if (prevMid?.entry.guid !== nextMid?.entry.guid) return false;
      }
      
      // Tier 3: For large arrays, sample additional entries
      if (prevLength > 50) {
        const quarterIndex = Math.floor(prevLength / 4);
        const threeQuarterIndex = Math.floor(prevLength * 3 / 4);
        
        const prevQuarter = prevProps.paginatedEntries[quarterIndex];
        const nextQuarter = nextProps.paginatedEntries[quarterIndex];
        const prevThreeQuarter = prevProps.paginatedEntries[threeQuarterIndex];
        const nextThreeQuarter = nextProps.paginatedEntries[threeQuarterIndex];
        
        if (prevQuarter?.entry.guid !== nextQuarter?.entry.guid) return false;
        if (prevThreeQuarter?.entry.guid !== nextThreeQuarter?.entry.guid) return false;
      }
    }
    
    // Check reference equality for objects (fast)
    if (prevProps.entryMetrics !== nextProps.entryMetrics) return false;
    if (prevProps.postMetadata !== nextProps.postMetadata) return false;
    if (prevProps.initialData !== nextProps.initialData) return false;
    
    // Check function references (should be stable with useCallback)
    if (prevProps.loadMore !== nextProps.loadMore) return false;
    if (prevProps.onOpenCommentDrawer !== nextProps.onOpenCommentDrawer) return false;
    
    // CRITICAL FIX: Check getMetrics function reference for batch metrics reactivity
    if (prevProps.getMetrics !== nextProps.getMetrics) return false;
    
    // All checks passed - prevent re-render for maximum performance
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
}: RSSEntriesDisplayClientProps) => {
  // Main state with useReducer
  const [state, dispatch] = useReducer(rssEntriesReducer, createInitialState());

  // Refs for state persistence and memory management
  const isMountedRef = useRef(true);
  const entriesStateRef = useRef<RSSEntriesDisplayEntry[]>([]);
  const currentPageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const totalEntriesRef = useRef(0);
  const postTitlesRef = useRef<string[]>([]);
  const preRefreshNewestEntryDateRef = useRef<string | undefined>(undefined);
  const feedMetadataCache = useRef<Record<string, RSSEntriesDisplayEntry['postMetadata']>>({});

  // Custom hooks for business logic - now using dispatch instead of store setters
  const { createManagedTimeout, clearManagedTimeout, cleanup } = useRSSEntriesMemoryManagement();

  const { performInitialization, canInitialize } = useRSSEntriesInitialization({
    hasInitialized: state.hasInitialized,
    isMountedRef,
    preRefreshNewestEntryDateRef,
    entriesStateRef,
    currentPageRef, 
    hasMoreRef, 
    totalEntriesRef,
    postTitlesRef,
    feedMetadataCache,
    initialData,
    initialize: useCallback((data) => dispatch({ type: 'INITIALIZE', payload: data }), []),
  });

  const { loadMoreEntries } = useRSSEntriesDataLoading({
    isActive, 
    isLoading: state.isLoading,
    isMountedRef,
    hasMoreRef, 
    currentPageRef,
    totalEntriesRef,
    entriesStateRef,
    postTitlesRef,
    feedMetadataCache,
    initialData,
    pageSize,
    setLoading: useCallback((loading) => dispatch({ type: 'SET_LOADING', payload: loading }), []),
    setFetchError: useCallback((error) => dispatch({ type: 'SET_FETCH_ERROR', payload: error }), []),
    addEntries: useCallback((entries) => dispatch({ type: 'ADD_ENTRIES', payload: entries }), []),
    setCurrentPage: useCallback((page) => dispatch({ type: 'SET_CURRENT_PAGE', payload: page }), []),
    setHasMore: useCallback((hasMore) => dispatch({ type: 'SET_HAS_MORE', payload: hasMore }), []),
    setTotalEntries: useCallback((total) => dispatch({ type: 'SET_TOTAL_ENTRIES', payload: total }), []),
    setPostTitles: useCallback((titles) => dispatch({ type: 'SET_POST_TITLES', payload: titles }), []),
  });

  const { triggerOneTimeRefresh, handleRefreshAttempt } = useRSSEntriesRefresh({
    isActive,
    isRefreshing: state.isRefreshing,
    hasRefreshed: state.hasRefreshed,
    hasInitialized: state.hasInitialized,
    isMountedRef,
    preRefreshNewestEntryDateRef,
    entriesStateRef,
    initialData,
    currentPostTitles: state.postTitles,
    currentFeedUrls: state.feedUrls,
    currentMediaTypes: state.mediaTypes,
    setRefreshing: useCallback((refreshing) => dispatch({ type: 'SET_REFRESHING', payload: refreshing }), []),
    setHasRefreshed: useCallback((hasRefreshed) => dispatch({ type: 'SET_HAS_REFRESHED', payload: hasRefreshed }), []),
    setRefreshError: useCallback((error) => dispatch({ type: 'SET_REFRESH_ERROR', payload: error }), []),
    setFetchError: useCallback((error) => dispatch({ type: 'SET_FETCH_ERROR', payload: error }), []),
    setEntries: useCallback((entries) => dispatch({ type: 'SET_ENTRIES', payload: entries }), []),
    setCurrentPage: useCallback((page) => dispatch({ type: 'SET_CURRENT_PAGE', payload: page }), []),
    setHasMore: useCallback((hasMore) => dispatch({ type: 'SET_HAS_MORE', payload: hasMore }), []),
    setTotalEntries: useCallback((total) => dispatch({ type: 'SET_TOTAL_ENTRIES', payload: total }), []),
    setPostTitles: useCallback((titles) => dispatch({ type: 'SET_POST_TITLES', payload: titles }), []),
    setFeedUrls: useCallback((urls) => dispatch({ type: 'SET_FEED_URLS', payload: urls }), []),
    setMediaTypes: useCallback((types) => dispatch({ type: 'SET_MEDIA_TYPES', payload: types }), []),
    setNewEntries: useCallback((entries) => dispatch({ type: 'SET_NEW_ENTRIES', payload: entries }), []),
    setNotification: useCallback((show, count, images) => dispatch({ 
      type: 'SET_NOTIFICATION', 
      payload: { show, count, images } 
    }), []),
    createManagedTimeout,
  });

  const { open: openCommentDrawerHandler, close: closeCommentDrawerHandler } = useRSSEntriesCommentDrawer({
    commentDrawerOpen: state.commentDrawerOpen,
    selectedCommentEntry: state.selectedCommentEntry,
    openCommentDrawer: useCallback((entryGuid, feedUrl, initialData) => dispatch({ 
      type: 'OPEN_COMMENT_DRAWER', 
      payload: { entryGuid, feedUrl, initialData } 
    }), []),
    closeCommentDrawer: useCallback(() => dispatch({ type: 'CLOSE_COMMENT_DRAWER' }), []),
  });

  const { show: showNewEntriesNotification, handleClick: handleNotificationClick } = useRSSEntriesNewEntries({
    newEntries: state.newEntries,
    showNotification: state.showNotification,
    notificationCount: state.notificationCount,
    notificationImages: state.notificationImages,
    isMountedRef,
    createManagedTimeout,
    clearManagedTimeout,
    prependEntries: useCallback((entries) => dispatch({ type: 'PREPEND_ENTRIES', payload: entries }), []),
    setNotification: useCallback((show, count, images) => dispatch({ 
      type: 'SET_NOTIFICATION', 
      payload: { show, count, images } 
    }), []),
    clearNewEntries: useCallback(() => dispatch({ type: 'CLEAR_NEW_ENTRIES' }), []),
  });

  // Sync refs with state
  const optimizedEntries = useMemo(() => 
    optimizeEntriesForMemory(state.entries), 
    [state.entries]
  );
  
  entriesStateRef.current = optimizedEntries;
  currentPageRef.current = state.currentPage;
  hasMoreRef.current = state.hasMore;
  totalEntriesRef.current = state.totalEntries;
  postTitlesRef.current = state.postTitles;
  
  // Get entry GUIDs for batch metrics query
  const entryGuids = useMemo(() => {
    if (!initialData?.entries) return [];
    return initialData.entries.map(entry => entry.entry.guid);
  }, [initialData?.entries]);
  
  const initialMetrics = useMemo(() => {
    if (!initialData?.entries) return {};
    
    const metrics: Record<string, any> = {};
    initialData.entries.forEach(entry => {
      if (entry.initialData && entry.entry.guid) {
        metrics[entry.entry.guid] = entry.initialData;
      }
    });
    return metrics;
  }, [initialData?.entries]);

  // ALWAYS maintain live subscription for real-time updates across tabs
  const { getMetrics, isLoading: metricsLoading } = useBatchEntryMetrics(
    entryGuids, // Always pass GUIDs for live subscription
    { 
      initialMetrics
      // No skipInitialQuery - always keep subscription live for reactivity
    }
  );

  // Perform initialization when possible
  React.useEffect(() => {
    if (canInitialize) {
      performInitialization();
    }
  }, [canInitialize, performInitialization]);

  // Trigger refresh when appropriate
  const triggerRefreshRef = useRef(triggerOneTimeRefresh);
  triggerRefreshRef.current = triggerOneTimeRefresh;
  
  const shouldTriggerRefresh = useMemo(() => 
    isActive && state.hasInitialized && !state.hasRefreshed && !state.isRefreshing && state.postTitles.length > 0 && state.feedUrls.length > 0,
    [isActive, state.hasInitialized, state.hasRefreshed, state.isRefreshing, state.postTitles.length, state.feedUrls.length]
  );
  
  React.useEffect(() => {
    if (shouldTriggerRefresh) {
      triggerRefreshRef.current();
    }
  }, [shouldTriggerRefresh]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const ITEMS_PER_REQUEST = useMemo(() => pageSize, [pageSize]);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const shouldPreventFocus = useMemo(() => 
    isActive && !state.commentDrawerOpen, 
    [isActive, state.commentDrawerOpen]
  );

  useFeedFocusPrevention(shouldPreventFocus, '.rss-feed-container');

  const memoizedInitialData = useMemo(() => ({
    entries: initialData.entries,
    totalEntries: initialData.totalEntries,
    hasMore: initialData.hasMore,
    postTitles: initialData.postTitles,
    feedUrls: initialData.feedUrls,
    mediaTypes: initialData.mediaTypes,
    feedMetadataCache: feedMetadataCache.current,
  }), [
    initialData.entries,
    initialData.totalEntries,
    initialData.hasMore,
    initialData.postTitles,
    initialData.feedUrls,
    initialData.mediaTypes,
    feedMetadataCache.current
  ]);

  const memoizedCommentHandlers = useMemo(() => ({
    open: openCommentDrawerHandler,
    close: closeCommentDrawerHandler
  }), [openCommentDrawerHandler, closeCommentDrawerHandler]);

  const memoizedNotificationClick = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if ('key' in e) e.preventDefault();
    dispatch({ type: 'SET_NOTIFICATION', payload: { show: false } });
  }, []);

  // Error display
  if (state.fetchError) {
    return (
      <section 
        className="flex flex-col items-center justify-center py-8 px-4"
        role="alert"
        aria-live="polite"
        aria-labelledby="error-heading"
      >
        <h2 id="error-heading" className="sr-only">Error Loading Content</h2>
        <p className="text-muted-foreground text-sm mb-4" id="error-message">
          Unable to load content
        </p>
        <Button 
          variant="outline"
          className="flex items-center gap-2" 
          onClick={handleRefreshAttempt}
          aria-describedby="error-message"
          aria-label="Retry loading RSS feed content"
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
          Refresh Feed
        </Button>
      </section>
    );
  }
  
  return (
    <main className="w-full rss-feed-container" role="main" aria-label="RSS Entries Feed">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-primary-foreground"
      >
        Skip to main content
      </a>
      
      {/* Notification for new entries */}
      {state.showNotification && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-out"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <button 
            className="py-2 px-4 bg-primary text-primary-foreground rounded-full shadow-md flex items-center gap-2 cursor-pointer hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={memoizedNotificationClick}
            onKeyDown={memoizedNotificationClick}
            aria-label={`${state.notificationCount} new ${state.notificationCount === 1 ? 'post' : 'posts'} available. Click to view.`}
            tabIndex={0}
          >
            {state.notificationImages.length > 0 ? (
              <div className="flex items-center gap-1">
                <MoveUp className="h-3 w-3" aria-hidden="true" />
                <div className="flex items-center -space-x-1">
                                     {state.notificationImages.map((imageUrl: string, index: number) => (
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
              <>
                <MoveUp className="h-3 w-3" aria-hidden="true" />
              <span className="text-sm font-medium">
                  {state.notificationCount} new {state.notificationCount === 1 ? 'post' : 'posts'}
              </span>
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Error state for refresh */}
      {state.refreshError && (
        <section 
          className="p-4 flex justify-center"
          role="alert"
          aria-live="polite"
          aria-labelledby="refresh-error-heading"
        >
          <div>
            <h3 id="refresh-error-heading" className="sr-only">Refresh Error</h3>
            <Button 
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleRefreshAttempt}
                aria-label="Retry refreshing RSS feed"
          >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
            Refresh Feed
          </Button>
        </div>
          </section>
      )}
      
      {/* Main content */}
      <section id="main-content" aria-labelledby="feed-heading">
        <h1 id="feed-heading" className="sr-only">
          RSS Feed Entries
          {state.totalEntries > 0 && ` (${state.totalEntries} total entries)`}
          {state.isLoading && ' - Loading...'}
        </h1>
      <EntriesContent
        paginatedEntries={optimizedEntries}
          hasMore={state.hasMore}
        loadMoreRef={loadMoreRef}
          isPending={state.isLoading}
        loadMore={loadMoreEntries}
        entryMetrics={null}
        postMetadata={undefined}
        initialData={memoizedInitialData}
        onOpenCommentDrawer={memoizedCommentHandlers.open}
          isInitializing={!state.hasInitialized}
        pageSize={ITEMS_PER_REQUEST}
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

// Export the memoized version
export const RSSEntriesClient = memo(RSSEntriesClientComponent, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.pageSize !== nextProps.pageSize) return false;
  
  if (!prevProps.initialData && nextProps.initialData) return false;
  if (prevProps.initialData && !nextProps.initialData) return false;
  
  if (prevProps.initialData && nextProps.initialData) {
    if (prevProps.initialData.entries?.length !== nextProps.initialData.entries?.length) return false;
    if (prevProps.initialData.totalEntries !== nextProps.initialData.totalEntries) return false;
    if (prevProps.initialData.hasMore !== nextProps.initialData.hasMore) return false;
    
    const prevTitles = prevProps.initialData.postTitles;
    const nextTitles = nextProps.initialData.postTitles;
    if (prevTitles?.length !== nextTitles?.length) return false;
    if (prevTitles?.length && nextTitles?.length && prevTitles.length > 0) {
      if (prevTitles[0] !== nextTitles[0]) return false;
      if (prevTitles[prevTitles.length - 1] !== nextTitles[nextTitles.length - 1]) return false;
      
      if (prevTitles.length > 5) {
        const midIndex = Math.floor(prevTitles.length / 2);
        if (prevTitles[midIndex] !== nextTitles[midIndex]) return false;
      }
    }
    
    const prevUrls = prevProps.initialData.feedUrls;
    const nextUrls = nextProps.initialData.feedUrls;
    if (prevUrls?.length !== nextUrls?.length) return false;
    if (prevUrls?.length && nextUrls?.length && prevUrls.length > 0) {
      if (prevUrls[0] !== nextUrls[0] || prevUrls[prevUrls.length - 1] !== nextUrls[nextUrls.length - 1]) return false;
    }
    
    const prevMedia = prevProps.initialData.mediaTypes;
    const nextMedia = nextProps.initialData.mediaTypes;
    if (prevMedia?.length !== nextMedia?.length) return false;
    if (prevMedia?.length && nextMedia?.length && prevMedia.length > 0) {
      if (prevMedia[0] !== nextMedia[0] || prevMedia[prevMedia.length - 1] !== nextMedia[nextMedia.length - 1]) return false;
    }
    
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
RSSEntriesClient.displayName = 'RSSEntriesClient';

// Export with error boundary (no store provider needed)
export const RSSEntriesClientWithErrorBoundary = memo(function RSSEntriesClientWithErrorBoundary(props: RSSEntriesDisplayClientProps) {
  return (
    <ErrorBoundary>
      <RSSEntriesClient {...props} />
    </ErrorBoundary>
  );
}); 