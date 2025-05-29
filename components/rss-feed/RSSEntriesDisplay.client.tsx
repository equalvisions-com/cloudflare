'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback, memo, useDeferredValue, useReducer } from 'react';
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
import { useAudio } from '@/components/audio-player/AudioContext';
import { Podcast, Mail, Loader2, ArrowDown, MoveUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import useSWR from 'swr';
import { FOLLOWED_POSTS_KEY } from '@/components/follow-button/FollowButton';
import { NoFocusWrapper } from "@/utils/NoFocusButton";
import { NoFocusLinkWrapper } from "@/utils/NoFocusLink";
import { useFeedFocusPrevention } from "@/utils/FeedInteraction";
import { PrefetchAnchor } from "@/utils/PrefetchAnchor";

// Production-ready error logging utility
const logger = {
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

// Helper function specifically for timestamp display - treats database dates as UTC
const parseEntryDateForDisplay = (dateString: string | Date): Date => {
  if (dateString instanceof Date) {
    return dateString;
  }
  
  // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
  const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  
  if (typeof dateString === 'string' && mysqlDateRegex.test(dateString)) {
    // Convert MySQL datetime string to UTC time for consistent display
    const [datePart, timePart] = dateString.split(' ');
    return new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
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

// Interface for refresh API response
interface RefreshApiResponse {
  success: boolean;
  error?: string;
  refreshedAny?: boolean;
  entries?: RSSEntryWithData[];
  postTitles?: string[];
  totalEntries?: number;
}

// Consolidated state interface for better state management
interface FeedState {
  // Core data
  entries: RSSEntryWithData[];
  currentPage: number;
  hasMore: boolean;
  totalEntries: number;
  postTitles: string[];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  hasRefreshed: boolean;
  
  // Error states
  fetchError: Error | null;
  refreshError: string | null;
  
  // UI states
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
  
  // Notification states
  showNotification: boolean;
  notificationCount: number;
  notificationImages: string[];
  
  // New entries buffer
  newEntries: RSSEntryWithData[];
  
  // Initialization flag
  hasInitialized: boolean;
}

// Action types for state management
type FeedAction =
  | { type: 'INITIALIZE'; payload: { entries: RSSEntryWithData[]; hasMore: boolean; totalEntries: number; postTitles: string[] } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  | { type: 'SET_HAS_REFRESHED'; payload: boolean }
  | { type: 'SET_FETCH_ERROR'; payload: Error | null }
  | { type: 'SET_REFRESH_ERROR'; payload: string | null }
  | { type: 'UPDATE_ENTRIES'; payload: RSSEntryWithData[] }
  | { type: 'APPEND_ENTRIES'; payload: RSSEntryWithData[] }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_TOTAL_ENTRIES'; payload: number }
  | { type: 'SET_POST_TITLES'; payload: string[] }
  | { type: 'SET_COMMENT_DRAWER'; payload: { open: boolean; entry?: { entryGuid: string; feedUrl: string; initialData?: { count: number } } | null } }
  | { type: 'SET_NOTIFICATION'; payload: { show: boolean; count?: number; images?: string[] } }
  | { type: 'SET_NEW_ENTRIES'; payload: RSSEntryWithData[] }
  | { type: 'CLEAR_NEW_ENTRIES' }
  | { type: 'RESET_TO_INITIAL'; payload: { entries: RSSEntryWithData[]; hasMore: boolean; totalEntries: number } };

// Reducer for consolidated state management
function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'INITIALIZE':
      return {
        ...state,
        entries: action.payload.entries,
        hasMore: action.payload.hasMore,
        totalEntries: action.payload.totalEntries,
        postTitles: action.payload.postTitles,
        currentPage: 1,
        hasInitialized: true,
        hasRefreshed: false,
        fetchError: null,
        refreshError: null
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
    
    case 'UPDATE_ENTRIES':
      return { ...state, entries: action.payload };
    
    case 'APPEND_ENTRIES':
      return { ...state, entries: [...state.entries, ...action.payload] };
    
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    
    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };
    
    case 'SET_TOTAL_ENTRIES':
      return { ...state, totalEntries: action.payload };
    
    case 'SET_POST_TITLES':
      return { ...state, postTitles: action.payload };
    
    case 'SET_COMMENT_DRAWER':
      return {
        ...state,
        commentDrawerOpen: action.payload.open,
        selectedCommentEntry: action.payload.entry || null
      };
    
    case 'SET_NOTIFICATION':
      return {
        ...state,
        showNotification: action.payload.show,
        notificationCount: action.payload.count || 0,
        notificationImages: action.payload.images || []
      };
    
    case 'SET_NEW_ENTRIES':
      return { ...state, newEntries: action.payload };
    
    case 'CLEAR_NEW_ENTRIES':
      return { ...state, newEntries: [] };
    
    case 'RESET_TO_INITIAL':
      return {
        ...state,
        entries: action.payload.entries,
        hasMore: action.payload.hasMore,
        totalEntries: action.payload.totalEntries,
        currentPage: 1,
        fetchError: null,
        refreshError: null
      };
    
    default:
      return state;
  }
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
    // Use the display-specific date parsing helper for consistent timestamp display
    const pubDate = parseEntryDateForDisplay(entry.pubDate);
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
  postMetadata?: Map<string, InternalPostMetadata>;
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
    feedUrls?: string[];
    mediaTypes?: string[];
    feedMetadataCache: Record<string, InternalPostMetadata>;
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
  // Remove debug logging for production
  useEffect(() => {
    // Component rendered - tracking for internal state management only
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
  // Consolidated state management using useReducer
  const [state, dispatch] = useReducer(feedReducer, {
    // Core data
    entries: [],
    currentPage: 1,
    hasMore: false,
    totalEntries: 0,
    postTitles: [],
    
    // Loading states
    isLoading: false,
    isRefreshing: false,
    hasRefreshed: false,
    
    // Error states
    fetchError: null,
    refreshError: null,
    
    // UI states
    commentDrawerOpen: false,
    selectedCommentEntry: null,
    
    // Notification states
    showNotification: false,
    notificationCount: 0,
    notificationImages: [],
    
    // New entries buffer
    newEntries: [],
    
    // Initialization flag
    hasInitialized: false
  });

  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Use a fixed number of items per request for consistency
  const ITEMS_PER_REQUEST = pageSize;
  
  // Persistent refs for state that needs to survive tab switches
  const entriesStateRef = useRef<RSSEntryWithData[]>([]);
  const currentPageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const postTitlesRef = useRef<string[]>(initialData?.postTitles || []);
  const totalEntriesRef = useRef(initialData?.totalEntries || 0);
  
  // Add a persistent cache for feed metadata to ensure consistency during pagination
  const feedMetadataCache = useRef<Record<string, InternalPostMetadata>>({});
  
  // Add state for mediaTypes
  const mediaTypesRef = useRef<string[] | undefined>(initialData?.mediaTypes);

  // Add a ref to store the newest entry date from BEFORE any refresh
  const preRefreshNewestEntryDateRef = useRef<string | undefined>(undefined);
  
  // Memory leak prevention - store active timeouts for cleanup
  const activeTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  
  // Helper function to create managed timeouts
  const createManagedTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      activeTimeoutsRef.current.delete(timeoutId);
      if (isMountedRef.current) {
        callback();
      }
    }, delay);
    
    activeTimeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);
  
  // Helper function to clear managed timeout
  const clearManagedTimeout = useCallback((timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    activeTimeoutsRef.current.delete(timeoutId);
  }, []);

  // Sync refs with state for tab switching persistence
  useEffect(() => {
    entriesStateRef.current = state.entries;
    currentPageRef.current = state.currentPage;
    hasMoreRef.current = state.hasMore;
    postTitlesRef.current = state.postTitles;
    totalEntriesRef.current = state.totalEntries;
  }, [state.entries, state.currentPage, state.hasMore, state.postTitles, state.totalEntries]);

  // Set up the mounted ref with comprehensive cleanup
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Capture the current timeouts set for cleanup
    const currentTimeouts = activeTimeoutsRef.current;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
      
      // Clear all active timeouts to prevent memory leaks
      currentTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      currentTimeouts.clear();
      
      // Clear any pending state updates
      // Note: React handles this automatically, but being explicit helps with debugging
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
  useFeedFocusPrevention(isActive && !state.commentDrawerOpen, '.rss-feed-container');

  // Initialize with initial data only once
  useEffect(() => {
    if (!initialData?.entries?.length || state.hasInitialized) return;
    
    // Initialize feed with initial data
    
    // Log actual mediaTypes for server validation
    if (!initialData.mediaTypes || initialData.mediaTypes.length === 0) {
      // No mediaTypes provided by server - this may affect functionality
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
    dispatch({ type: 'INITIALIZE', payload: { entries: initialData.entries, hasMore: !!initialData.hasMore, totalEntries: initialData.totalEntries || 0, postTitles: initialData.postTitles || [] } });
    
    // Update post titles
    if (initialData.postTitles) {
      dispatch({ type: 'SET_POST_TITLES', payload: initialData.postTitles });
    }
    
    // Create a ref for mediaTypes to ensure persistence
    if (initialData.mediaTypes) {
      mediaTypesRef.current = initialData.mediaTypes;
    }
    
    // Mark as initialized so we don't reset when tabs switch
    // DO NOT set hasRefreshed to true here - that prevents the automatic refresh!
  }, [initialData, dispatch]);

  // When returning to active tab, use the stored refs to restore state if needed
  useEffect(() => {
    if (isActive && state.hasInitialized) {
      // Only restore if the states don't match the refs (might happen due to React rendering)
      if (state.entries.length === 0 && entriesStateRef.current.length > 0) {
        dispatch({ type: 'UPDATE_ENTRIES', payload: entriesStateRef.current });
      }
      
      if (state.currentPage !== currentPageRef.current) {
        dispatch({ type: 'SET_PAGE', payload: currentPageRef.current });
      }
      
      if (state.hasMore !== hasMoreRef.current) {
        dispatch({ type: 'SET_HAS_MORE', payload: hasMoreRef.current });
      }
      
      if (state.totalEntries !== totalEntriesRef.current) {
        dispatch({ type: 'SET_TOTAL_ENTRIES', payload: totalEntriesRef.current });
      }
    }
  }, [isActive, state, currentPageRef, hasMoreRef, totalEntriesRef]);

  // Function to load more entries - update to use refs
  const loadMoreEntries = useCallback(async () => {
    // Only load more if the tab is active and not already loading/no more data
    if (!isActive || state.isLoading || !hasMoreRef.current) { 
      return;
    }
    
    if (!isMountedRef.current) {
      return;
    }
    
    // Set loading state immediately to prevent multiple calls
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // Use ONLY the server-provided complete list of post titles
      // This is the most reliable source of truth for ALL followed feeds
      const postTitlesParam = JSON.stringify(postTitlesRef.current);
      
      // Also include feed URLs for proper pagination of newly created feeds
      const feedUrlsParam = JSON.stringify(initialData?.feedUrls || []);
      
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
      
      // Pass the total entries to avoid unnecessary COUNT queries on the server
      // Use our dynamically updated totalEntriesRef instead of the static initialData
      if (totalEntriesRef.current > 0) {
        baseUrl.searchParams.set('totalEntries', totalEntriesRef.current.toString());
      }
      
      // Add cache busting parameter to ensure we get fresh data
      baseUrl.searchParams.set('t', Date.now().toString());
      
      const response = await fetch(baseUrl.toString());
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update total entries if provided in response
      if (data.totalEntries && data.totalEntries !== totalEntriesRef.current) {
        dispatch({ type: 'SET_TOTAL_ENTRIES', payload: data.totalEntries });
      }
      
      // Update post titles from the response if available
      if (data.postTitles && data.postTitles.length > 0) {
        dispatch({ type: 'SET_POST_TITLES', payload: data.postTitles });
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
      
      // Update state with new entries, only if component is still mounted
      if (isMountedRef.current) {
        // Use our updateX functions to keep refs and state in sync
        const updatedEntries = [...entriesStateRef.current, ...transformedEntries];
        
        // Batch state updates to reduce re-renders
        dispatch({ type: 'UPDATE_ENTRIES', payload: updatedEntries });
        dispatch({ type: 'SET_PAGE', payload: nextPage });
        dispatch({ type: 'SET_HAS_MORE', payload: data.hasMore });
      }
      
    } catch (error) {
      logger.error('❌ Error loading more entries:', error);
      if (isMountedRef.current) {
        dispatch({ type: 'SET_FETCH_ERROR', payload: error instanceof Error ? error : new Error(String(error)) });
      }
    } finally {
      if (isMountedRef.current) {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
  }, [
    initialData, 
    state.isLoading, 
    ITEMS_PER_REQUEST, 
    isActive, 
    dispatch, 
    currentPageRef, 
    hasMoreRef, 
    totalEntriesRef,
    postTitlesRef
  ]);
  
  // Extract all entry GUIDs for metrics query - optimized
  const entryGuids = useMemo(() => {
    return state.entries
      .filter((entry: RSSEntryWithData) => entry?.entry?.guid)
      .map((entry: RSSEntryWithData) => entry.entry.guid);
  }, [state.entries]);
  
  // Extract unique feed URLs for metadata query - optimized
  const feedUrls = useMemo(() => {
    const urls = state.entries
      .filter((entry: RSSEntryWithData) => entry?.entry?.feedUrl)
      .map((entry: RSSEntryWithData) => entry.entry.feedUrl);
    return [...new Set(urls)];
  }, [state.entries]);
  
  // Use the combined query to fetch entry metrics - ONLY IF ACTIVE
  const combinedData = useQuery(
    api.entries.getFeedDataWithMetrics,
    isActive && entryGuids.length > 0 ? { entryGuids, feedUrls } : "skip"
  );
  
  // Defer data updates to prevent synchronous re-renders that may cause scroll jumps
  const deferredCombinedData = useDeferredValue(combinedData);
  
  // Update metadata cache with any new data from the Convex query - optimized
  useEffect(() => {
    if (!deferredCombinedData?.postMetadata) return;
    
    // Batch cache updates to reduce re-renders
    const updates: Record<string, InternalPostMetadata> = {};
    let hasUpdates = false;
    
    deferredCombinedData.postMetadata.forEach(item => {
      if (item.feedUrl && item.metadata) {
        // Only update if the data has actually changed
        const existing = feedMetadataCache.current[item.feedUrl];
        if (!existing || JSON.stringify(existing) !== JSON.stringify(item.metadata)) {
          updates[item.feedUrl] = item.metadata;
          hasUpdates = true;
        }
      }
    });
    
    // Only update cache if there are actual changes
    if (hasUpdates) {
      Object.assign(feedMetadataCache.current, updates);
    }
  }, [deferredCombinedData?.postMetadata]);
  
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
    
    dispatch({ type: 'SET_FETCH_ERROR', payload: null });
    dispatch({ type: 'UPDATE_ENTRIES', payload: initialData?.entries || [] });
    dispatch({ type: 'SET_PAGE', payload: 1 });
    dispatch({ type: 'SET_HAS_MORE', payload: !!initialData?.hasMore });
  }, [initialData, dispatch]);
  
  // Memoize the comment drawer state change handler
  const handleCommentDrawerOpenChange = useCallback((open: boolean) => {
    if (!isMountedRef.current) return;
    dispatch({ type: 'SET_COMMENT_DRAWER', payload: { open, entry: null } });
  }, []);
  
  // Add function to handle new entries - optimized with memory leak prevention
  const handleNewEntries = useCallback((entries: RSSEntryWithData[]) => {
    if (!entries.length) {
      return;
    }
    
    try {
      // Get current entries from ref for consistency
      const currentEntries = entriesStateRef.current;
      
      // Create a set of existing entry GUIDs for fast lookup
      const existingGuids = new Set(currentEntries.map(entry => entry.entry.guid));
      
      // Filter out any duplicate entries
      const uniqueNewEntries = entries.filter(entry => !existingGuids.has(entry.entry.guid));
      
      if (uniqueNewEntries.length === 0) {
        return;
      }
      
      // Sort new entries by publication date in descending order (newest first)
      // This ensures proper chronological ordering across all RSS feeds
      const sortedNewEntries = [...uniqueNewEntries].sort((a, b) => {
        const dateA = new Date(a.entry.pubDate).getTime();
        const dateB = new Date(b.entry.pubDate).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      
      // Save the count for notification and extract featured images
      const featuredImages = sortedNewEntries
        .slice(0, 3) // Take only first 3 entries
        .map(entry => {
          // Try to get featured image from postMetadata first, then from entry
          return entry.postMetadata?.featuredImg || entry.entry.image || '';
        })
        .filter(img => img !== ''); // Remove empty strings
      
      dispatch({ type: 'SET_NOTIFICATION', payload: { show: true, count: sortedNewEntries.length, images: featuredImages } });
      
      // Prepend sorted new entries to the existing ones using our update function to keep refs in sync
      const newEntriesArray = [...sortedNewEntries, ...currentEntries];
      
      dispatch({ type: 'UPDATE_ENTRIES', payload: newEntriesArray });
      
      // Set a timer to hide the notification after a few seconds - with managed cleanup
      createManagedTimeout(() => {
        dispatch({ type: 'SET_NOTIFICATION', payload: { show: false } });
      }, 5000);
      
    } catch (error) {
      logger.error('🔄 Error handling new entries:', error);
    }
  }, [dispatch, createManagedTimeout]);

  // Update the effect that processes new entries
  useEffect(() => {
    // When new entries are received, handle them automatically
    if (state.newEntries.length > 0) {
      handleNewEntries(state.newEntries);
      dispatch({ type: 'CLEAR_NEW_ENTRIES' });
    }
  }, [state.newEntries, handleNewEntries]);
  
  // Add function to trigger one-time background refresh - optimized dependencies
  const triggerOneTimeRefresh = useCallback(async () => {
    // Don't refresh if we've already refreshed or are currently refreshing
    if (state.isRefreshing || state.hasRefreshed) {
      return;
    }
    
    // Use ONLY the server-provided complete list from our state
    // This is the most reliable source of truth for ALL followed feeds
    const currentPostTitles = postTitlesRef.current;
    
    // Also use server-provided feed URLs
    const currentFeedUrls = initialData?.feedUrls || [];
    
    // Ensure we pass the server-provided mediaTypes - use the ref to ensure persistence
    const currentMediaTypes = mediaTypesRef.current || [];
    
    // Find the newest entry from our existing entries to maintain chronological order
    // This prevents older entries from newly created feeds from appearing at the top
    let newestEntryDate: string | undefined = undefined;
    
    // CRITICAL FIX: Use the pre-refresh newest entry date that was captured from initial data
    // This prevents using entries that were just inserted during previous refresh cycles
    if (preRefreshNewestEntryDateRef.current) {
      newestEntryDate = preRefreshNewestEntryDateRef.current;
    } else {
      // Fallback: Only use current state entries, not initial data, to avoid stale data
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
          
          // Get the date of the newest entry
          if (sortedEntries[0] && sortedEntries[0].entry.pubDate) {
            const candidateDate = parseEntryDate(sortedEntries[0].entry.pubDate);
            const currentTime = Date.now();
            
            // Validate that the date is not in the future (no buffer - exact comparison)
            if (candidateDate.getTime() <= currentTime) {
              newestEntryDate = formatDateForAPI(candidateDate);
            } else {
              // If the newest entry is in the future, use current time instead
              newestEntryDate = formatDateForAPI(new Date());
            }
          }
        }
      } catch (error) {
        logger.error('Error determining newest entry date:', error);
        // Continue without the newest date - better than not refreshing
      }
    }
    
    dispatch({ type: 'SET_REFRESHING', payload: true });
    dispatch({ type: 'SET_REFRESH_ERROR', payload: null });
    
    try {
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
      
      const data: RefreshApiResponse = await response.json();
      
      if (data.success) {
        // Mark that we've completed a refresh regardless of whether anything was refreshed
        dispatch({ type: 'SET_HAS_REFRESHED', payload: true });
        
        // Update post titles with the COMPLETE list of all followed titles
        // This is crucial for pagination to work with newly followed posts
        if (data.postTitles && data.postTitles.length > 0) {
          dispatch({ type: 'SET_POST_TITLES', payload: data.postTitles });
        }
        
        // Update total entries count if provided in the response
        if (data.totalEntries && data.totalEntries !== totalEntriesRef.current) {
          dispatch({ type: 'SET_TOTAL_ENTRIES', payload: data.totalEntries });
        }
        
        if (data.refreshedAny) {
          if (data.entries && data.entries.length > 0) {
            // Validate that entries have the expected structure
            const validEntries = data.entries.filter((entry: RSSEntryWithData) => {
              const isValid = entry && 
                             entry.entry && 
                             entry.entry.guid && 
                             entry.entry.title && 
                             entry.postMetadata;
              
              return isValid;
            });
            
            if (validEntries.length > 0) {
              // Force a state update by using a functional update
              dispatch({ type: 'SET_NEW_ENTRIES', payload: validEntries });
              
              // Also trigger the handler directly as a fallback for serverless environments
              // This ensures the entries get processed even if the useEffect doesn't fire properly
              createManagedTimeout(() => {
                if (isMountedRef.current) {
                  handleNewEntries(validEntries);
                }
              }, 100); // Small delay to allow state to settle
            }
          }
        }
      } else {
        throw new Error(data.error || 'Unknown error during refresh');
      }
    } catch (error) {
      logger.error('❌ Error during background refresh:', error);
      dispatch({ type: 'SET_REFRESH_ERROR', payload: typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      dispatch({ type: 'SET_REFRESHING', payload: false });
    }
  }, [
    // Optimized dependencies - only include what actually changes the behavior
    state.isRefreshing, 
    state.hasRefreshed,
    initialData?.feedUrls,
    dispatch,
    createManagedTimeout,
    handleNewEntries
  ]);

  // Trigger one-time refresh after initial render - always refresh immediately
  useEffect(() => {
    // Only check if the component is active and hasn't already refreshed
    // IMPORTANT: We still refresh even when there are no entries, which is essential for
    // creating feeds that don't exist yet
    if (!isActive || state.hasRefreshed || !state.hasInitialized) return;
    
    // Make sure we have initialData with either postTitles or feedUrls
    if (!initialData || (!initialData.postTitles?.length && !initialData.feedUrls?.length)) {
      return;
    }
    
    // Run immediately without delay
    triggerOneTimeRefresh();
    
  }, [isActive, initialData, state.hasRefreshed, state.hasInitialized, triggerOneTimeRefresh]);

  // Add back handleOpenCommentDrawer
  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    dispatch({ type: 'SET_COMMENT_DRAWER', payload: { open: true, entry: { entryGuid, feedUrl, initialData } } });
  }, []);

  // Extract the onSuccess callback to include updatePostTitlesState in dependencies
  const handleFollowedPostsUpdate = useCallback(async () => {
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
            dispatch({ type: 'SET_POST_TITLES', payload: data.postTitles });
          }
          
          // Update total entries count if available
          if (data.totalEntries) {
            dispatch({ type: 'SET_TOTAL_ENTRIES', payload: data.totalEntries });
          }
          
          // Only update entries if we got some
          if (data.entries && data.entries.length > 0) {
            // Use our update functions to keep refs and state in sync
            dispatch({ type: 'UPDATE_ENTRIES', payload: data.entries });
            dispatch({ type: 'SET_PAGE', payload: 1 });
            dispatch({ type: 'SET_HAS_MORE', payload: !!data.hasMore });
            
            // Reset hasRefreshed so we can refresh again if needed
            dispatch({ type: 'SET_HAS_REFRESHED', payload: false });
          }
        }
      } catch (error) {
        logger.error('Error refreshing feed after follow status change:', error);
      }
    }
  }, [dispatch]);

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
    dispatch({ type: 'SET_FETCH_ERROR', payload: null });
    dispatch({ type: 'SET_REFRESH_ERROR', payload: null });
    dispatch({ type: 'SET_REFRESHING', payload: false });
    
    // Reset hasRefreshed to allow triggering a new refresh
    dispatch({ type: 'SET_HAS_REFRESHED', payload: false });
    
    // Attempt to refresh immediately
    triggerOneTimeRefresh();
  }, [triggerOneTimeRefresh]);

  // Display error message if there's an error
  if (state.fetchError) {
    logger.error('Feed loading error', { message: state.fetchError.message || 'Error loading entries' });
    
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
      {state.showNotification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-out">
          <div className="py-2 px-4 bg-primary text-primary-foreground rounded-full shadow-md flex items-center gap-2">
            {state.notificationImages.length > 0 ? (
              <div className="flex items-center gap-1">
                <MoveUp className="h-3 w-3" />
                <div className="flex items-center -space-x-1">
                  {state.notificationImages.map((imageUrl, index) => (
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
            {state.notificationCount} new {state.notificationCount === 1 ? 'post' : 'posts'}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Show refresh button for any errors - no detailed error messages */}
      {state.refreshError && (
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
        paginatedEntries={state.entries}
        hasMore={state.hasMore}
        loadMoreRef={loadMoreRef}
        isPending={state.isLoading}
        loadMore={loadMoreEntries}
        entryMetrics={entryMetricsMap}
        postMetadata={postMetadataMap}
        initialData={{
          ...initialData,
          feedMetadataCache: feedMetadataCache.current
        }}
        onOpenCommentDrawer={handleOpenCommentDrawer}
        isInitializing={!state.hasInitialized || state.entries.length === 0}
        pageSize={ITEMS_PER_REQUEST}
      />
      
      {/* Comment drawer */}
      {state.selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={state.selectedCommentEntry.entryGuid}
          feedUrl={state.selectedCommentEntry.feedUrl}
          initialData={state.selectedCommentEntry.initialData}
          isOpen={state.commentDrawerOpen}
          setIsOpen={handleCommentDrawerOpenChange}
        />
      )}
    </div>
  );
};

// Export the memoized version of the component with optimized comparison
export const RSSEntriesClient = memo(RSSEntriesClientComponent, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  // Only re-render if these critical properties change
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.pageSize !== nextProps.pageSize) return false;
  
  // Deep comparison for initialData only if necessary
  if (!prevProps.initialData && nextProps.initialData) return false;
  if (prevProps.initialData && !nextProps.initialData) return false;
  
  if (prevProps.initialData && nextProps.initialData) {
    // Compare critical initialData properties
    if (prevProps.initialData.entries?.length !== nextProps.initialData.entries?.length) return false;
    if (prevProps.initialData.totalEntries !== nextProps.initialData.totalEntries) return false;
    if (prevProps.initialData.hasMore !== nextProps.initialData.hasMore) return false;
    
    // Compare arrays by length and first/last elements for performance
    const prevTitles = prevProps.initialData.postTitles;
    const nextTitles = nextProps.initialData.postTitles;
    if (prevTitles?.length !== nextTitles?.length) return false;
    if (prevTitles?.length && nextTitles?.length) {
      if (prevTitles[0] !== nextTitles[0] || prevTitles[prevTitles.length - 1] !== nextTitles[nextTitles.length - 1]) return false;
    }
  }
  
  // If all checks pass, prevent re-render
  return true;
});
RSSEntriesClient.displayName = 'RSSEntriesClient';

export const RSSEntriesClientWithErrorBoundary = memo(function RSSEntriesClientWithErrorBoundary(props: RSSEntriesClientProps) {
  return (
    <ErrorBoundary>
      <RSSEntriesClient {...props} />
    </ErrorBoundary>
  );
}); 