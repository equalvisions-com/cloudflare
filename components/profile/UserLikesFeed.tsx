"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Heart, MessageCircle, Repeat, Loader2 } from "lucide-react";
import Link from "next/link";
import { Virtuoso } from 'react-virtuoso';
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Image from "next/image";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Podcast, Mail } from "lucide-react";
import { useAudio } from '@/components/audio-player/AudioContext';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

// Types for activity items
type ActivityItem = {
  type: "like" | "comment" | "retweet";
  timestamp: number;
  entryGuid: string;
  feedUrl: string;
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
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
};

// Define the shape of interaction states for batch metrics
interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

interface UserActivityFeedProps {
  userId: Id<"users">;
  username: string;
  initialData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics?: Record<string, InteractionStates>;
  } | null;
  pageSize?: number;
}

// Custom hook for batch metrics - same as in UserActivityFeed
function useEntriesMetrics(entryGuids: string[], initialMetrics?: Record<string, InteractionStates>) {
  // Fetch batch metrics for all entries
  const batchMetricsQuery = useQuery(
    api.entries.batchGetEntriesMetrics,
    entryGuids.length > 0 ? { entryGuids } : "skip"
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
    
    // If we have query results, they take precedence over initial metrics
    if (batchMetricsQuery) {
      entryGuids.forEach((guid, index) => {
        if (batchMetricsQuery[index]) {
          map.set(guid, batchMetricsQuery[index]);
        }
      });
    }
    
    return map;
  }, [batchMetricsQuery, entryGuids, initialMetrics]);
  
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
    isLoading: entryGuids.length > 0 && !batchMetricsQuery && !initialMetrics,
    metricsMap
  };
}

function ActivityIcon({ type }: { type: "like" | "comment" | "retweet" }) {
  switch (type) {
    case "like":
      return <Heart className="h-4 w-4 text-red-500" />;
    case "comment":
      return <MessageCircle className="h-4 w-4 text-blue-500" />;
    case "retweet":
      return <Repeat className="h-4 w-4 text-green-500" />;
  }
}

function ActivityDescription({ item, username }: { item: ActivityItem; username: string }) {
  switch (item.type) {
    case "like":
      return (
        <span>
          <span className="font-medium">{username}</span> liked{" "}
          <Link href={item.link || "#"} className="text-blue-500 hover:underline">
            {item.title || "a post"}
          </Link>
        </span>
      );
    case "comment":
      return (
        <span>
          <span className="font-medium">{username}</span> commented on{" "}
          <Link href={`/entry/${encodeURIComponent(item.feedUrl)}/${encodeURIComponent(item.entryGuid)}`} className="text-blue-500 hover:underline">
            a post
          </Link>
          {item.content && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
              &ldquo;{item.content.length > 100 ? `${item.content.substring(0, 100)}...` : item.content}&rdquo;
            </div>
          )}
        </span>
      );
    case "retweet":
      return (
        <span>
          <span className="font-medium">{username}</span> shared{" "}
          <Link href={item.link || "#"} className="text-blue-500 hover:underline">
            {item.title || "a post"}
          </Link>
        </span>
      );
  }
}

// Memoized MoreOptionsDropdown component
const MoreOptionsDropdown = React.memo(({ entry }: { entry: RSSEntry }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-transparent p-0">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem asChild>
        <a
          href={entry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer"
        >
          Open in new tab
        </a>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
));
MoreOptionsDropdown.displayName = 'MoreOptionsDropdown';

// Activity card with entry details
const ActivityCard = React.memo(({ 
  activity, 
  username, 
  entryDetails,
  getEntryMetrics
}: { 
  activity: ActivityItem; 
  username: string;
  entryDetails?: RSSEntry;
  getEntryMetrics: (entryGuid: string) => InteractionStates;
}) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = entryDetails && currentTrack?.src === entryDetails.link;
  
  // Get metrics for this entry - don't use activity type as fallback anymore
  const interactions = useMemo(() => {
    if (!entryDetails) return undefined;
    return getEntryMetrics(entryDetails.guid);
  }, [entryDetails, getEntryMetrics]);
  
  // Format timestamp using the same logic as RSSFeedClient
  const timestamp = useMemo(() => {
    if (!entryDetails?.pub_date) return '';

    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let pubDate: Date;
    
    if (typeof entryDetails.pub_date === 'string' && mysqlDateRegex.test(entryDetails.pub_date)) {
      // Convert MySQL datetime string to UTC time
      const [datePart, timePart] = entryDetails.pub_date.split(' ');
      pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      pubDate = new Date(entryDetails.pub_date);
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
    const suffix = isFuture ? '' : ' ago';
    
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
  }, [entryDetails?.pub_date]);

  // Handle card click for podcasts
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (entryDetails && (entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast')) {
      e.preventDefault();
      playTrack(entryDetails.link, entryDetails.title, entryDetails.image || undefined);
    }
  }, [entryDetails, playTrack]);
  
  // If we don't have entry details, show a simplified card
  if (!entryDetails) {
    return (
      <div className="p-4 rounded-lg shadow-sm mb-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <ActivityIcon type={activity.type} />
          </div>
          <div className="flex-1">
            <ActivityDescription item={activity} username={username} />
            <div className="text-xs text-gray-500 mt-1">
              {timestamp}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // With entry details, show a rich card similar to EntriesDisplay
  return (
    <article className="">
      <div className="p-4 border-l border-r">
        {/* Activity header with icon and description */}
        <div className="flex items-start gap-3 mb-4">
          <div className="mt-1">
            <ActivityIcon type={activity.type} />
          </div>
          <div className="flex-1">
            <ActivityDescription item={activity} username={username} />
            <div className="text-xs text-gray-500 mt-1">
              {timestamp}
            </div>
          </div>
        </div>
        
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-start gap-4 mb-4">
          {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
          {(entryDetails.post_featured_img || entryDetails.image) && (
            <Link 
              href={entryDetails.category_slug && entryDetails.post_slug ? 
                `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                entryDetails.link}
              className="flex-shrink-0 w-14 h-14 relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
              target={entryDetails.category_slug && entryDetails.post_slug ? "_self" : "_blank"}
              rel={entryDetails.category_slug && entryDetails.post_slug ? "" : "noopener noreferrer"}
            >
              <AspectRatio ratio={1}>
                <Image
                  src={entryDetails.post_featured_img || entryDetails.image || ''}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                  loading="lazy"
                  priority={false}
                />
              </AspectRatio>
            </Link>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              <div className="flex items-center justify-between gap-2">
                <Link 
                  href={entryDetails.category_slug && entryDetails.post_slug ? 
                    `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                    entryDetails.link}
                  className="hover:opacity-80 transition-opacity"
                  target={entryDetails.category_slug && entryDetails.post_slug ? "_self" : "_blank"}
                  rel={entryDetails.category_slug && entryDetails.post_slug ? "" : "noopener noreferrer"}
                >
                  <h3 className="text-base font-semibold text-primary leading-tight">
                    {entryDetails.post_title || entryDetails.feed_title || entryDetails.title}
                  </h3>
                </Link>
                <span 
                  className="text-sm leading-none text-muted-foreground flex-shrink-0"
                  title={entryDetails.pub_date ? 
                    format(new Date(entryDetails.pub_date), 'PPP p') : 
                    new Date(activity.timestamp).toLocaleString()
                  }
                >
                  {timestamp}
                </span>
              </div>
              {/* Use post_media_type if available, otherwise fallback to mediaType */}
              {(entryDetails.post_media_type || entryDetails.mediaType) && (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                  {(entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast') && 
                    <Podcast className="h-3 w-3" />
                  }
                  {(entryDetails.post_media_type?.toLowerCase() === 'newsletter' || entryDetails.mediaType?.toLowerCase() === 'newsletter') && 
                    <Mail className="h-3 w-3" />
                  }
                  {(entryDetails.post_media_type || entryDetails.mediaType || 'article').charAt(0).toUpperCase() + 
                   (entryDetails.post_media_type || entryDetails.mediaType || 'article').slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Entry Content Card */}
        {(entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast') ? (
          <div>
            <div 
              onClick={handleCardClick}
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
            >
              <Card className={`overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                {entryDetails.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={16/9}>
                      <Image
                        src={entryDetails.image}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 768px"
                        loading="lazy"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <CardContent className="p-4 bg-secondary/60 border-t">
                  <h3 className="text-lg font-semibold leading-tight">
                    {entryDetails.title}
                  </h3>
                  {entryDetails.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {entryDetails.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <a
            href={entryDetails.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-80 transition-opacity"
          >
            <Card className="overflow-hidden shadow-none">
              {entryDetails.image && (
                <CardHeader className="p-0">
                  <AspectRatio ratio={16/9}>
                    <Image
                      src={entryDetails.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 768px"
                      loading="lazy"
                      priority={false}
                    />
                  </AspectRatio>
                </CardHeader>
              )}
              <CardContent className="p-4 bg-secondary/60 border-t">
                <h3 className="text-lg font-semibold leading-tight">
                  {entryDetails.title}
                </h3>
                {entryDetails.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {entryDetails.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </a>
        )}

        {/* Horizontal Interaction Buttons */}
        <div className="flex justify-between items-center mt-4 h-[16px]">
          <div>
            <LikeButtonClient
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={interactions?.likes || { isLiked: false, count: 0 }}
            />
          </div>
          <div>
            <CommentSectionClient
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              initialData={interactions?.comments || { count: 0 }}
            />
          </div>
          <div>
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={interactions?.retweets || { isRetweeted: false, count: 0 }}
            />
          </div>
          <div>
            <ShareButtonClient
              url={entryDetails.link}
              title={entryDetails.title}
            />
          </div>
          <div className="flex justify-end">
            <MoreOptionsDropdown entry={entryDetails} />
          </div>
        </div>
      </div>
      
      <div id={`comments-${entryDetails.guid}`} className="border-t border-border" />
    </article>
  );
});
ActivityCard.displayName = 'ActivityCard';

/**
 * Client component that displays a user's likes feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
export function UserLikesFeed({ userId, username, initialData, pageSize = 30 }: UserActivityFeedProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>(
    initialData?.activities || []
  );
  const [entryDetails, setEntryDetails] = useState<Record<string, RSSEntry>>(
    initialData?.entryDetails || {}
  );
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSkip, setCurrentSkip] = useState(initialData?.activities.length || 0);
  
  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(!initialData?.activities.length);
  
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

  // Log when initial data is received
  useEffect(() => {
    if (initialData?.activities) {
      console.log('📋 Initial likes data received from server:', {
        activitiesCount: initialData.activities.length,
        totalCount: initialData.totalCount,
        hasMore: initialData.hasMore,
        entryDetailsCount: Object.keys(initialData.entryDetails || {}).length,
        entryMetricsCount: Object.keys(initialData.entryMetrics || {}).length
      });
      setActivities(initialData.activities);
      setEntryDetails(initialData.entryDetails || {});
      setHasMore(initialData.hasMore);
      setCurrentSkip(initialData.activities.length);
      setIsInitialLoad(false);
    }
  }, [initialData]);

  // Function to load more activities
  const loadMoreActivities = useCallback(async () => {
    if (isLoading || !hasMore) {
      console.log(`⚠️ Not loading more: isLoading=${isLoading}, hasMore=${hasMore}`);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log(`📡 Fetching more likes from API, skip=${currentSkip}, limit=${pageSize}`);
      
      // Use the API route to fetch the next page
      const result = await fetch(`/api/likes?userId=${userId}&skip=${currentSkip}&limit=${pageSize}`);
      
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      
      const data = await result.json();
      console.log(`📦 Received data from API:`, {
        activitiesCount: data.activities?.length || 0,
        hasMore: data.hasMore,
        entryDetailsCount: Object.keys(data.entryDetails || {}).length,
        entryMetricsCount: Object.keys(data.entryMetrics || {}).length
      });
      
      if (!data.activities?.length) {
        console.log('⚠️ No likes returned from API');
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      setActivities(prev => [...prev, ...data.activities]);
      setEntryDetails(prev => ({...prev, ...data.entryDetails}));
      setCurrentSkip(prev => prev + data.activities.length);
      setHasMore(data.hasMore);
      
      console.log(`📊 Updated state - total likes: ${activities.length + data.activities.length}, hasMore: ${data.hasMore}`);
    } catch (error) {
      console.error('❌ Error loading more likes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentSkip, userId, pageSize, activities.length]);

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    const checkContentHeight = () => {
      if (!loadMoreRef.current || !hasMore || isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && activities.length > 0) {
        console.log('📏 Content is shorter than viewport, loading more likes');
        loadMoreActivities();
      }
    };
    
    // Run the check after a short delay to ensure the DOM has updated
    const timer = setTimeout(checkContentHeight, 1000);
    
    return () => clearTimeout(timer);
  }, [activities.length, hasMore, isLoading, loadMoreActivities]);

  // Loading state - only show for initial load and initial metrics fetch
  if ((isLoading && isInitialLoad) || (isInitialLoad && activities.length > 0 && isMetricsLoading)) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No likes state
  if (activities.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No likes found for this user.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Virtuoso
        useWindowScroll
        data={activities}
        endReached={loadMoreActivities}
        overscan={200}
        itemContent={(index, activity) => (
          <ActivityCard 
            key={activity._id} 
            activity={activity} 
            username={username} 
            entryDetails={entryDetails[activity.entryGuid]}
            getEntryMetrics={getEntryMetrics}
          />
        )}
        components={{
          Footer: () => (
            <div className="py-4 text-center">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading more...</span>
                </div>
              ) : hasMore ? (
                <div className="h-8" />
              ) : (
                <div className="text-muted-foreground text-sm py-2">
                  {activities.length > 0 ? 'No more likes to load' : 'No likes found'}
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  );
} 