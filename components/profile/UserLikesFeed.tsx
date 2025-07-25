"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Podcast, Mail, Loader2 } from "lucide-react";
import Link from "next/link";
import { Virtuoso } from 'react-virtuoso';
import React, { useCallback, useRef, useMemo, memo, useReducer } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { Button } from "@/components/ui/button";
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerPlayTrack
} from '@/lib/stores/audioPlayerStore';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ErrorBoundary } from "react-error-boundary";
import { NoFocusWrapper, NoFocusLinkWrapper, useFeedFocusPrevention, useDelayedIntersectionObserver } from "@/utils/FeedInteraction";
import { useSidebar } from '@/components/ui/sidebar-context';
import { 
  UserLikesFeedProps, 
  UserLikesActivityItem, 
  UserLikesRSSEntry, 
  InteractionStates 
} from "@/lib/types";
import { useBatchEntryMetrics } from "@/hooks/useBatchEntryMetrics";

// Memory optimization for large datasets - Virtual scrolling configuration
const VIRTUAL_SCROLL_CONFIG = {
  overscan: 2000, // Current buffer size
  maxBufferSize: 10000, // Maximum items to keep in memory
  recycleThreshold: 5000, // Start recycling items after this many
  increaseViewportBy: { top: 600, bottom: 600 }, // Viewport extension
};

// Memory management for large likes lists
const optimizeLikesForMemory = (activities: UserLikesActivityItem[], maxSize: number = VIRTUAL_SCROLL_CONFIG.maxBufferSize): UserLikesActivityItem[] => {
  // If we're under the threshold, return as-is
  if (activities.length <= maxSize) {
    return activities;
  }
  
  // Keep the most recent likes up to maxSize
  // This ensures we don't run out of memory with very large likes feeds
  return activities.slice(0, maxSize);
};

// State interface for useReducer
interface UserLikesFeedState {
  activities: UserLikesActivityItem[];
  isLoading: boolean;
  hasMore: boolean;
  entryDetails: Record<string, UserLikesRSSEntry>;
  currentSkip: number;
  isInitialLoad: boolean;
  // Comment drawer state
  commentDrawerOpen: boolean;
  selectedCommentEntry: {
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null;
}

// Action types for useReducer
type UserLikesFeedAction = 
  | { type: 'SET_INITIAL_DATA'; payload: { 
      activities: UserLikesActivityItem[], 
      entryDetails: Record<string, UserLikesRSSEntry>, 
      hasMore: boolean 
    }}
  | { type: 'START_LOADING_MORE' }
  | { type: 'LOAD_MORE_SUCCESS'; payload: { 
      activities: UserLikesActivityItem[], 
      entryDetails: Record<string, UserLikesRSSEntry>, 
      hasMore: boolean 
    }}
  | { type: 'LOAD_MORE_FAILURE' }
  | { type: 'SET_INITIAL_LOAD_COMPLETE' }
  | { type: 'SET_CURRENT_SKIP'; payload: number }
  | { type: 'SET_COMMENT_DRAWER_OPEN'; payload: boolean }
  | { type: 'SET_SELECTED_COMMENT_ENTRY'; payload: UserLikesFeedState['selectedCommentEntry'] }
  | { type: 'RESET' };

// Initial state factory
const createInitialState = (): UserLikesFeedState => ({
  activities: [],
  isLoading: false,
  hasMore: false,
  entryDetails: {},
  currentSkip: 0,
  isInitialLoad: true,
  commentDrawerOpen: false,
  selectedCommentEntry: null,
});

// Reducer function
const userLikesFeedReducer = (state: UserLikesFeedState, action: UserLikesFeedAction): UserLikesFeedState => {
  switch (action.type) {
    case 'SET_INITIAL_DATA':
      return {
        ...state,
        activities: action.payload.activities,
        entryDetails: action.payload.entryDetails,
        hasMore: action.payload.hasMore,
        currentSkip: action.payload.activities.length,
        isLoading: false,
        isInitialLoad: false,
      };
    
    case 'START_LOADING_MORE':
      return { ...state, isLoading: true };
    
    case 'LOAD_MORE_SUCCESS':
      return {
        ...state,
        activities: [...state.activities, ...action.payload.activities],
        entryDetails: { ...state.entryDetails, ...action.payload.entryDetails },
        hasMore: action.payload.hasMore,
        currentSkip: state.currentSkip + action.payload.activities.length,
        isLoading: false,
      };
    
    case 'LOAD_MORE_FAILURE':
      return { ...state, isLoading: false };
    
    case 'SET_INITIAL_LOAD_COMPLETE':
      return { ...state, isInitialLoad: false };
    
    case 'SET_CURRENT_SKIP':
      return { ...state, currentSkip: action.payload };
    
    case 'SET_COMMENT_DRAWER_OPEN':
      return { ...state, commentDrawerOpen: action.payload };
    
    case 'SET_SELECTED_COMMENT_ENTRY':
      return { ...state, selectedCommentEntry: action.payload };
    
    case 'RESET':
      return createInitialState();
    
    default:
      return state;
  }
};

// Memoized timestamp formatter
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
    const isFuture = diffInMs < -(60 * 1000);
    const prefix = isFuture ? 'in ' : '';
    
    // Format based on the time difference
    if (diffInMinutes < 60) {
      return `${prefix}${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${prefix}${diffInHours}h`;
    } else if (diffInDays < 30) {
      return `${prefix}${diffInDays}d`;
    } else {
      return `${prefix}${diffInMonths}mo`;
    }
  }, [pubDate]);
};

// Memoized media type badge component
const MediaTypeBadge = memo(({ mediaType }: { mediaType?: string }) => {
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
const EntryCardContent = memo(({ entry }: { entry: UserLikesRSSEntry }) => (
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

// Memoized entry link component
const EntryLink = memo(({ 
  entryDetails, 
  children,
  className,
  onClick,
  onTouchStart
}: { 
  entryDetails: UserLikesRSSEntry; 
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}) => {
  const mediaType = entryDetails.post_media_type || entryDetails.mediaType;
  const isNewsletter = mediaType === 'newsletter';
  const isPodcast = mediaType === 'podcast';
  const isInternalContent = entryDetails.post_slug && (isNewsletter || isPodcast);
  
  // Memoize the href calculation
  const href = useMemo(() => {
    if (!entryDetails.post_slug) return entryDetails.link;
    
    if (isNewsletter) return `/newsletters/${entryDetails.post_slug}`;
    if (isPodcast) return `/podcasts/${entryDetails.post_slug}`;
    if (entryDetails.category_slug) return `/${entryDetails.category_slug}/${entryDetails.post_slug}`;
    
    return entryDetails.link;
  }, [entryDetails.post_slug, entryDetails.link, entryDetails.category_slug, isNewsletter, isPodcast]);
  
  return (
    <Link 
      href={href}
      className={className}
      target={isInternalContent ? "_self" : "_blank"}
      rel={isInternalContent ? "" : "noopener noreferrer"}
      onClick={onClick}
      onTouchStart={onTouchStart}
      prefetch={false}
    >
      {children}
    </Link>
  );
});
EntryLink.displayName = 'EntryLink';

// Memoized interaction buttons component
const InteractionButtons = memo(({ 
  entryDetails, 
  interactions,
  onOpenCommentDrawer
}: { 
  entryDetails: UserLikesRSSEntry;
  interactions: InteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}) => {
  // Handle opening comment drawer
  const handleOpenDrawer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCommentDrawer(entryDetails.guid, entryDetails.feed_url || '', interactions.comments);
  }, [entryDetails.guid, entryDetails.feed_url, interactions.comments, onOpenCommentDrawer]);
  
  return (
    <div className="flex justify-between items-center mt-4 h-[16px]" onClick={(e) => e.stopPropagation()}>
      <NoFocusWrapper className="flex items-center">
        <LikeButtonClient
          entryGuid={entryDetails.guid}
          feedUrl={entryDetails.feed_url || ''}
          title={entryDetails.title}
          pubDate={entryDetails.pub_date}
          link={entryDetails.link}
          initialData={interactions.likes}
          skipQuery={true}
        />
      </NoFocusWrapper>
      <NoFocusWrapper 
        className="flex items-center"
        onClick={handleOpenDrawer}
      >
        <CommentSectionClient
          entryGuid={entryDetails.guid}
          feedUrl={entryDetails.feed_url || ''}
          initialData={interactions.comments}
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
          initialData={interactions.retweets}
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
            initialData={interactions?.bookmarks || { isBookmarked: false }}
            skipQuery={true}
          />
        </NoFocusWrapper>
        <NoFocusWrapper className="flex items-center">
          <ShareButtonClient
            url={entryDetails.link}
            title={entryDetails.title}
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
  );
});
InteractionButtons.displayName = 'InteractionButtons';

// Memoized entry card header component
const EntryCardHeader = memo(({ 
  activity, 
  entryDetails,
  timestamp,
  handleLinkInteraction
}: { 
  activity: UserLikesActivityItem; 
  entryDetails: UserLikesRSSEntry;
  timestamp: string;
  handleLinkInteraction: (e: React.MouseEvent | React.TouchEvent) => void;
}) => {
  const displayTitle = useMemo(() => (
    entryDetails.post_title || entryDetails.feed_title || entryDetails.title
  ), [entryDetails.post_title, entryDetails.feed_title, entryDetails.title]);
  
  const mediaType = entryDetails.post_media_type || entryDetails.mediaType;
  
  // Memoize featured image source (for top-left small image)
  const featuredImageSrc = useMemo(() => {
    // Priority: Post featured image (primary) > Entry image (fallback) > Default
    const primaryImage = entryDetails.post_featured_img;
    const fallbackImage = entryDetails.image;
    const defaultImage = '/placeholder-image.jpg';
    
    return primaryImage || fallbackImage || defaultImage;
  }, [entryDetails.post_featured_img, entryDetails.image]);

  // Memoize entry content image source (for card content)
  const entryImageSrc = useMemo(() => {
    if (!entryDetails.image) return '/placeholder-image.jpg';
    return entryDetails.image;
  }, [entryDetails.image]);
  
  return (
    <div className="flex items-center gap-4 mb-4">
      {/* Featured Image */}
      {(entryDetails.post_featured_img || entryDetails.image) && (
        <NoFocusLinkWrapper 
          className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
          onClick={handleLinkInteraction}
          onTouchStart={handleLinkInteraction}
        >
          <EntryLink 
            entryDetails={entryDetails}
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
          </EntryLink>
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
              <EntryLink 
                entryDetails={entryDetails}
              >
                <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-2 mt-[2.5px]">
                  {displayTitle}
                  {entryDetails.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                </h3>
              </EntryLink>
            </NoFocusLinkWrapper>
            <span 
              className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
              title={entryDetails.pub_date ? 
                format(new Date(entryDetails.pub_date), 'PPP p') : 
                new Date(activity.timestamp).toLocaleString()
              }
            >
              {timestamp}
            </span>
          </div>
          <MediaTypeBadge mediaType={mediaType} />
        </div>
      </div>
    </div>
  );
});
EntryCardHeader.displayName = 'EntryCardHeader';

// Activity card with entry details
const ActivityCard = memo(({ 
  activity, 
  entryDetails,
  getEntryMetrics,
  onOpenCommentDrawer
}: { 
  activity: UserLikesActivityItem; 
  entryDetails?: UserLikesRSSEntry;
  getEntryMetrics: (entryGuid: string) => InteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}) => {
  // Get state and actions from Zustand store
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();
  
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
  
  // Always call all hooks at the top level
  // Get interactions for this entry - move outside of conditional
  const interactions = useMemo(() => 
    entryDetails ? getEntryMetrics(entryDetails.guid) : { 
      likes: { isLiked: false, count: 0 },
      comments: { count: 0 },
      retweets: { isRetweeted: false, count: 0 },
      bookmarks: { isBookmarked: false }
    },
    [entryDetails, getEntryMetrics]
  );
  
  // Format timestamp - move outside of conditional  
  const timestamp = useFormattedTimestamp(entryDetails?.pub_date);

  // Determine if entry is a podcast - move outside of conditional
  const isPodcast = useMemo(() => {
    if (!entryDetails) return false;
    return entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast';
  }, [entryDetails?.post_media_type, entryDetails?.mediaType]);
  
  // Handle podcast card click - move outside of conditional
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isPodcast && entryDetails) {
      e.preventDefault();
      e.stopPropagation();
      const creatorName = entryDetails.post_title || entryDetails.feed_title || undefined;
      playTrack(entryDetails.link, entryDetails.title, entryDetails.image || undefined, creatorName);
    }
  }, [isPodcast, entryDetails, playTrack]);
  
  // Check if this podcast is currently playing - move outside of conditional
  const isCurrentlyPlaying = isPodcast && entryDetails && currentTrack?.src === entryDetails.link;
  
  // Memoize entry content image source (for card content)
  const entryImageSrc = useMemo(() => {
    if (!entryDetails?.image) return '/placeholder-image.jpg';
    return entryDetails.image;
  }, [entryDetails?.image]);
  
  // Skip rendering if no entry details
  if (!entryDetails) return null;
  
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
        <EntryCardHeader 
          activity={activity} 
          entryDetails={entryDetails} 
          timestamp={timestamp} 
          handleLinkInteraction={handleLinkInteraction}
        />

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

        {/* Interaction Buttons */}
        <InteractionButtons 
          entryDetails={entryDetails} 
          interactions={interactions} 
          onOpenCommentDrawer={onOpenCommentDrawer} 
        />
      </div>
      
      <div id={`comments-${entryDetails.guid}`} className="border-t border-border" />
    </article>
  );
});
ActivityCard.displayName = 'ActivityCard';

// Fallback UI for error boundary
const ErrorFallback = memo(({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => {
  return (
    <div className="p-4 text-red-500">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <Button onClick={resetErrorBoundary} className="mt-2">Try again</Button>
    </div>
  );
});
ErrorFallback.displayName = 'ErrorFallback';

// Loading spinner component
const LoadingSpinner = memo(() => (
  <div className="flex justify-center items-center py-10">
    <Loader2 className="h-6 w-6 animate-spin" />
  </div>
));
LoadingSpinner.displayName = 'LoadingSpinner';

// Create a memoized version of the component with error boundary
const UserLikesFeedComponent = memo(({ userId, username, initialData, pageSize = 30, isActive = true }: UserLikesFeedProps) => {
  // Get current user ID from sidebar context to optimize API calls
  const { userId: currentUserId } = useSidebar();
  
  // Main state with useReducer
  const [state, dispatch] = useReducer(userLikesFeedReducer, createInitialState());
  
  // Refs for state persistence
  const isMountedRef = useRef(true);
  const currentSkipRef = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Memoized dispatch actions
  const setInitialData = useCallback((payload: { 
    activities: UserLikesActivityItem[], 
    entryDetails: Record<string, UserLikesRSSEntry>, 
    hasMore: boolean 
  }) => dispatch({ type: 'SET_INITIAL_DATA', payload }), []);
  
  const startLoadingMore = useCallback(() => dispatch({ type: 'START_LOADING_MORE' }), []);
  
  const loadMoreSuccess = useCallback((payload: { 
    activities: UserLikesActivityItem[], 
    entryDetails: Record<string, UserLikesRSSEntry>, 
    hasMore: boolean 
  }) => dispatch({ type: 'LOAD_MORE_SUCCESS', payload }), []);
  
  const loadMoreFailure = useCallback(() => dispatch({ type: 'LOAD_MORE_FAILURE' }), []);
  
  const setCommentDrawerOpen = useCallback((open: boolean) => dispatch({ type: 'SET_COMMENT_DRAWER_OPEN', payload: open }), []);
  
  const setSelectedCommentEntry = useCallback((entry: UserLikesFeedState['selectedCommentEntry']) => 
    dispatch({ type: 'SET_SELECTED_COMMENT_ENTRY', payload: entry }), []);

  // Sync refs with state
  currentSkipRef.current = state.currentSkip;

  // Process initial data when received - use useMemo for efficiency
  useMemo(() => {
    if (!initialData?.activities) return;
    
    setInitialData({
      activities: initialData.activities,
      entryDetails: initialData.entryDetails || {},
      hasMore: initialData.hasMore
    });
    currentSkipRef.current = initialData.activities.length;
  }, [initialData, setInitialData]);

  // Function to load more activities
  const loadMoreActivities = useCallback(async () => {
    if (!isMountedRef.current || state.isLoading || !state.hasMore) {
      return;
    }

    startLoadingMore();
    
    try {
      // Get current skip value from ref to ensure it's up-to-date
      const skipValue = currentSkipRef.current;
      
      // Use the public API route to fetch the next page for this specific user  
      const result = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          currentUserId,
          skip: skipValue,
          limit: pageSize
        })
      });
      
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      
      const data = await result.json();
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (!data.activities?.length) {
        loadMoreFailure();
        return;
      }
      
      // Update both the ref and the state for the new skip value
      const newSkip = skipValue + data.activities.length;
      currentSkipRef.current = newSkip;
      
      loadMoreSuccess({
        activities: data.activities,
        entryDetails: data.entryDetails || {},
        hasMore: data.hasMore
      });
    } catch (error) {
      loadMoreFailure();
    }
  }, [userId, currentUserId, pageSize, state.isLoading, state.hasMore, startLoadingMore, loadMoreSuccess, loadMoreFailure]);
  
  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, [setSelectedCommentEntry, setCommentDrawerOpen]);

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !state.commentDrawerOpen, '.user-likes-feed-container');

  // Single legitimate cleanup useEffect for component mount/unmount
  React.useEffect(() => {
    // Set mounted to true when component mounts
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Check if we need to load more when content is short - legitimate useEffect for timer cleanup
  React.useEffect(() => {
    if (!state.hasMore || state.isLoading || state.activities.length === 0) return;
    
    const checkContentHeight = () => {
      if (!isMountedRef.current || !loadMoreRef.current) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight) {
        loadMoreActivities();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [state.activities.length, state.hasMore, state.isLoading, loadMoreActivities]);

  // Get entry GUIDs for batch metrics query - FIXED: Extract from stable initial data only
  const entryGuids = useMemo(() => {
    if (!initialData?.entryMetrics) return [];
    
    // Extract GUIDs from initial server data keys
    return Object.keys(initialData.entryMetrics);
  }, [initialData?.entryMetrics]); // Only depend on stable server data
  
  // Extract initial metrics from initial data for server-side rendering optimization
  const initialMetrics = useMemo(() => {
    const metrics: Record<string, any> = {};
    if (initialData?.entryMetrics) {
      Object.entries(initialData.entryMetrics).forEach(([guid, entryMetrics]) => {
        metrics[guid] = entryMetrics;
      });
    }
    return metrics;
  }, [initialData?.entryMetrics]);

  // Use batch metrics hook with initial server metrics to prevent button flashing
  // Server provides initial metrics for fast rendering, client hook provides reactive updates
  const { getMetrics: getBatchMetrics, isLoading: isMetricsLoading } = useBatchEntryMetrics(
    isActive ? entryGuids : [], // Only fetch metrics when tab is active
    { 
      includeCommentLikes: false, // Likes feed doesn't need comment likes
      initialMetrics
      // Removed skipInitialQuery - we NEED the reactive subscription for cross-feed updates
    }
  );
  
  // Wrapper function to convert batch metrics to InteractionStates format
  const getMetrics = useCallback((entryGuid: string): InteractionStates => {
    const batchMetrics = getBatchMetrics(entryGuid);
    if (!batchMetrics) {
      return {
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 },
        bookmarks: { isBookmarked: false }
      };
    }
    
    return {
      likes: batchMetrics.likes,
      comments: batchMetrics.comments,
      retweets: batchMetrics.retweets || { isRetweeted: false, count: 0 },
      bookmarks: batchMetrics.bookmarks || { isBookmarked: false }
    };
  }, [getBatchMetrics]);

  // Universal delayed intersection observer hook - exactly like RSSEntriesDisplay
  useDelayedIntersectionObserver(loadMoreRef, loadMoreActivities, {
    enabled: state.hasMore && !state.isLoading,
    isLoading: state.isLoading,
    hasMore: state.hasMore,
    rootMargin: '1000px',
    threshold: 0.1
  });

  // Apply memory optimization to prevent excessive memory usage
  const optimizedActivities = useMemo(() => 
    optimizeLikesForMemory(state.activities), 
    [state.activities]
  );

  // Use a ref to store the itemContent callback to ensure stability - matching RSSEntriesDisplay exactly
  const itemContentCallback = useCallback((index: number, activity: UserLikesActivityItem) => {
    // Get the details for this activity
    return (
      <ActivityCard 
        activity={activity} 
        entryDetails={state.entryDetails[activity.entryGuid]}
        getEntryMetrics={getMetrics}
        onOpenCommentDrawer={handleOpenCommentDrawer}
      />
    );
  }, [state.entryDetails, getMetrics, handleOpenCommentDrawer]);

  // Loading state - only show for initial load and initial metrics fetch
  if ((state.isLoading && state.isInitialLoad) || (state.isInitialLoad && state.activities.length > 0 && isMetricsLoading)) {
    return <LoadingSpinner />;
  }

  // No likes state - handled by UserProfileTabs
  if (state.activities.length === 0 && !state.isLoading) {
    return null;
  }

  return (
    <div 
      className="w-full user-likes-feed-container" 
      style={{ 
        // CSS properties to prevent focus scrolling
        scrollBehavior: 'auto',
        WebkitOverflowScrolling: 'touch',
        WebkitTapHighlightColor: 'transparent'
      }}
    >
      <Virtuoso
        useWindowScroll
        data={optimizedActivities}
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
      
      {/* Fixed position load more container at bottom - exactly like RSSEntriesDisplay */}
      <div ref={loadMoreRef} className="h-52 flex items-center justify-center mb-20">
        {state.hasMore && state.isLoading && <Loader2 className="h-6 w-6 animate-spin" />}
        {!state.hasMore && state.activities.length > 0 && <div></div>}
      </div>
      
      {state.selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={state.selectedCommentEntry.entryGuid}
          feedUrl={state.selectedCommentEntry.feedUrl}
          initialData={state.selectedCommentEntry.initialData}
          isOpen={state.commentDrawerOpen}
          setIsOpen={setCommentDrawerOpen}
          skipQuery={true}
        />
      )}
    </div>
  );
});
UserLikesFeedComponent.displayName = 'UserLikesFeedComponent';

/**
 * Client component that displays a user's likes feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
export function UserLikesFeed({ userId, username, initialData, pageSize = 30, isActive = true }: UserLikesFeedProps) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <UserLikesFeedComponent {...{ userId, username, initialData, pageSize, isActive }} />
    </ErrorBoundary>
  );
} 