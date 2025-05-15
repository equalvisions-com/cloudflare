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
import { Button } from "@/components/ui/button";
import { useAudio } from '@/components/audio-player/AudioContext';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ErrorBoundary } from "react-error-boundary";
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

// Types for activity items
type ActivityItem = {
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  _id: string;
};

// Type for RSS entry from PlanetScale
type RSSEntry = {
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
  // Additional fields from Convex posts
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean; // Add verified field
};

// Define the shape of interaction states for batch metrics
interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

interface UserLikesFeedProps {
  userId: Id<"users">;
  initialData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics?: Record<string, InteractionStates>;
  } | null;
  pageSize?: number;
  isActive?: boolean;
}

// Custom hook for batch metrics - same as in UserActivityFeed
function useEntriesMetrics(entryGuids: string[], initialMetrics?: Record<string, InteractionStates>) {
  // Add mount tracking ref
  const isMountedRef = useRef(true);
  
  // Set up mounted ref cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Track if we've already received initial metrics
  const hasInitialMetrics = useMemo(() => 
    Boolean(initialMetrics && Object.keys(initialMetrics).length > 0), 
    [initialMetrics]
  );
  
  // Create a stable representation of entry guids
  const memoizedGuids = useMemo(() => 
    entryGuids.length > 0 ? entryGuids : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entryGuids.join(',')]
  );
  
  // Only fetch from Convex if we don't have initial metrics or if we need to refresh
  const shouldFetchMetrics = useMemo(() => {
    // If we have no guids, no need to fetch
    if (!memoizedGuids.length) return false;
    
    // If we have no initial metrics, we need to fetch
    if (!hasInitialMetrics) return true;
    
    // If we have initial metrics, check if we have metrics for all guids
    const missingMetrics = memoizedGuids.some(guid => 
      !initialMetrics || !initialMetrics[guid]
    );
    
    return missingMetrics;
  }, [memoizedGuids, hasInitialMetrics, initialMetrics]);
  
  // Fetch batch metrics for all entries only when needed
  const batchMetricsQuery = useQuery(
    api.entries.batchGetEntriesMetrics,
    shouldFetchMetrics ? { entryGuids: memoizedGuids } : "skip"
  );
  
  // Create a memoized metrics map that combines initial metrics with query results
  const metricsMap = useMemo(() => {
    // Start with initial metrics if available
    const map = new Map<string, InteractionStates>();
    
    // Add initial metrics first
    if (initialMetrics) {
      Object.entries(initialMetrics).forEach(([guid, metrics]) => {
        map.set(guid, metrics);
      });
    }
    
    // If we have query results AND we specifically queried for them,
    // they take precedence over initial metrics
    if (batchMetricsQuery && shouldFetchMetrics) {
      memoizedGuids.forEach((guid, index) => {
        if (batchMetricsQuery[index]) {
          map.set(guid, batchMetricsQuery[index]);
        }
      });
    }
    
    return map;
  }, [batchMetricsQuery, memoizedGuids, initialMetrics, shouldFetchMetrics]);
  
  // Memoize default values
  const defaultInteractions = useMemo(() => ({
    likes: { isLiked: false, count: 0 },
    comments: { count: 0 },
    retweets: { isRetweeted: false, count: 0 }
  }), []);
  
  // Return a function to get metrics for a specific entry
  const getEntryMetrics = useCallback((entryGuid: string) => {
    // Always use the metrics from the server or default values
    return metricsMap.get(entryGuid) || defaultInteractions;
  }, [metricsMap, defaultInteractions]);
  
  return {
    getEntryMetrics,
    isLoading: shouldFetchMetrics && !batchMetricsQuery,
    metricsMap
  };
}

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
const EntryCardContent = memo(({ entry }: { entry: RSSEntry }) => (
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
  entryDetails: RSSEntry; 
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
  entryDetails: RSSEntry;
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
            initialData={{ isBookmarked: false }}
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
  activity: ActivityItem; 
  entryDetails: RSSEntry;
  timestamp: string;
  handleLinkInteraction: (e: React.MouseEvent | React.TouchEvent) => void;
}) => {
  const displayTitle = useMemo(() => (
    entryDetails.post_title || entryDetails.feed_title || entryDetails.title
  ), [entryDetails.post_title, entryDetails.feed_title, entryDetails.title]);
  
  const mediaType = entryDetails.post_media_type || entryDetails.mediaType;
  
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
                src={entryDetails.post_featured_img || entryDetails.image || ''}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
                priority={false}
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
  activity: ActivityItem; 
  entryDetails?: RSSEntry;
  getEntryMetrics: (entryGuid: string) => InteractionStates;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}) => {
  const { playTrack, currentTrack } = useAudio();
  
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
      retweets: { isRetweeted: false, count: 0 }
    },
    [entryDetails, getEntryMetrics]
  );
  
  // Format timestamp - move outside of conditional  
  const timestamp = useFormattedTimestamp(entryDetails?.pub_date);

  // Determine if entry is a podcast - move outside of conditional
  const mediaType = entryDetails?.post_media_type || entryDetails?.mediaType;
  const isPodcast = useMemo(() => 
    mediaType?.toLowerCase() === 'podcast',
    [mediaType]
  );
  
  // Handle podcast card click - move outside of conditional
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isPodcast && entryDetails) {
      e.preventDefault();
      e.stopPropagation();
      playTrack(entryDetails.link, entryDetails.title, entryDetails.image || undefined);
    }
  }, [isPodcast, entryDetails, playTrack]);
  
  // Check if this podcast is currently playing - move outside of conditional
  const isCurrentlyPlaying = isPodcast && entryDetails && currentTrack?.src === entryDetails.link;
  
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

// Empty state component
const EmptyState = memo(() => (
  <div className="text-center py-8 text-muted-foreground">
    <p>No likes </p>
  </div>
));
EmptyState.displayName = 'EmptyState';

// Create a memoized version of the component with error boundary
const UserLikesFeedComponent = memo(({ userId, initialData, pageSize = 30, isActive = true }: UserLikesFeedProps) => {
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  const [activities, setActivities] = useState<ActivityItem[]>(
    initialData?.activities || []
  );
  const [entryDetails, setEntryDetails] = useState<Record<string, RSSEntry>>(
    initialData?.entryDetails || {}
  );
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track skip with a ref to avoid closure problems
  const currentSkipRef = useRef<number>(initialData?.activities.length || 0);
  const [currentSkip, setCurrentSkip] = useState(initialData?.activities.length || 0);
  
  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(!initialData?.activities.length);
  
  // Add ref to prevent multiple endReached calls
  const endReachedCalledRef = useRef(false);
  
  // Reset the endReachedCalled flag when activities change
  useEffect(() => {
    endReachedCalledRef.current = false;
  }, [activities.length]);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Get entry guids for metrics
  const entryGuids = useMemo(() => 
    activities.map(activity => activity.entryGuid), 
    [activities]
  );
  
  // Use our custom hook for metrics
  const { getEntryMetrics, isLoading: isMetricsLoading } = useEntriesMetrics(
    entryGuids,
    initialData?.entryMetrics
  );

  // --- Drawer state for comments ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Use the shared focus prevention hook
  useFeedFocusPrevention(isActive && !commentDrawerOpen, '.user-likes-feed-container');

  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);

  // Process initial data when received
  useEffect(() => {
    if (!isMountedRef.current || !initialData?.activities) return;
    
    setActivities(initialData.activities);
    setEntryDetails(initialData.entryDetails || {});
    setHasMore(initialData.hasMore);
    setCurrentSkip(initialData.activities.length);
    currentSkipRef.current = initialData.activities.length;
    setIsInitialLoad(false);
  }, [initialData]);

  // Create the API URL for loading more items
  const apiUrl = useMemo(() => 
    `/api/likes?userId=${userId}&skip=${currentSkipRef.current}&limit=${pageSize}`,
    [userId, pageSize]
  );

  // Function to load more activities
  const loadMoreActivities = useCallback(async () => {
    if (!isMountedRef.current || isLoading || !hasMore) {
      logger.debug(`⛔ Not loading more likes: isLoading=${isLoading}, hasMore=${hasMore}`);
      return;
    }

    setIsLoading(true);
    
    try {
      // Get current skip value from ref to ensure it's up-to-date
      const skipValue = currentSkipRef.current;
      logger.debug(`🔄 Fetching more likes, skip=${skipValue}, limit=${pageSize}`);
      
      // Use the API route to fetch the next page
      const result = await fetch(`/api/likes?userId=${userId}&skip=${skipValue}&limit=${pageSize}`);
      
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      
      const data = await result.json();
      logger.debug(`📦 Received likes data:`, {
        activitiesCount: data.activities?.length || 0,
        hasMore: data.hasMore
      });
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;
      
      if (!data.activities?.length) {
        logger.debug('⚠️ No likes returned from API');
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      // Update both the ref and the state for the new skip value
      const newSkip = skipValue + data.activities.length;
      currentSkipRef.current = newSkip;
      setCurrentSkip(newSkip);
      logger.debug(`⬆️ Updated skip from ${skipValue} to ${newSkip}`);
      
      setActivities(prev => [...prev, ...data.activities]);
      setEntryDetails(prev => ({...prev, ...data.entryDetails}));
      setHasMore(data.hasMore);
      
      logger.debug(`✅ Total likes now: ${activities.length + data.activities.length}`);
    } catch (error) {
      logger.error('❌ Error loading more likes:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isLoading, hasMore, userId, pageSize, activities.length]);
  
  // Use the shared hook for delayed intersection observer
  useDelayedIntersectionObserver(loadMoreRef, loadMoreActivities, {
    enabled: hasMore && !isLoading,
    isLoading,
    hasMore,
    rootMargin: '800px', // Increased from 300px to 800px in the shared utility
    threshold: 0.1,
    delay: 3000 // 3 second delay to prevent initial page load triggering
  });

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    if (!isMountedRef.current || !loadMoreRef.current || !hasMore || isLoading) return;
    
    const checkContentHeight = () => {
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && activities.length > 0) {
        logger.debug('📏 Content is shorter than viewport, loading more likes automatically');
        loadMoreActivities();
      }
    };
    
    // Reduced delay from 1000ms to 200ms for faster response
    const timer = setTimeout(checkContentHeight, 200);
    
    return () => clearTimeout(timer);
  }, [activities.length, hasMore, isLoading, loadMoreActivities]);

  // Use a ref to store the itemContent callback to ensure stability - matching RSSEntriesDisplay exactly
  const itemContentCallback = useCallback((index: number, activity: ActivityItem) => {
    // Get the details for this activity
    return (
      <ActivityCard 
        activity={activity} 
        entryDetails={entryDetails[activity.entryGuid]}
        getEntryMetrics={getEntryMetrics}
        onOpenCommentDrawer={handleOpenCommentDrawer}
      />
    );
  }, [entryDetails, getEntryMetrics, handleOpenCommentDrawer]);

  // Loading state - only show for initial load and initial metrics fetch
  if ((isLoading && isInitialLoad) || (isInitialLoad && activities.length > 0 && isMetricsLoading)) {
    return <LoadingSpinner />;
  }

  // No likes state
  if (activities.length === 0 && !isLoading) {
    return <EmptyState />;
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
      onMouseDown={(e) => {
        // Skip focus prevention when comment drawer is open
        if (commentDrawerOpen) return;
        
        // Prevent focus on non-interactive elements
        const target = e.target as HTMLElement;
        if (
          target.tagName !== 'BUTTON' && 
          target.tagName !== 'A' && 
          target.tagName !== 'INPUT' && 
          !target.closest('button') && 
          !target.closest('a') && 
          !target.closest('input')
        ) {
          e.preventDefault();
        }
      }}
    >
      <Virtuoso
        useWindowScroll
        data={activities}
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
        {hasMore && isLoading && <Loader2 className="h-6 w-6 animate-spin" />}
        {!hasMore && activities.length > 0 && <div></div>}
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
});
UserLikesFeedComponent.displayName = 'UserLikesFeedComponent';

/**
 * Client component that displays a user's likes feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
export function UserLikesFeed({ userId, initialData, pageSize = 30, isActive = true }: UserLikesFeedProps) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <UserLikesFeedComponent {...{ userId, initialData, pageSize, isActive }} />
    </ErrorBoundary>
  );
} 