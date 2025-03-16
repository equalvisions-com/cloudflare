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
import { ProfileImage } from "@/components/profile/ProfileImage";

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
  name: string;
  profileImage?: string | null;
  initialData: {
    activities: ActivityItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics?: Record<string, InteractionStates>;
  } | null;
  pageSize?: number;
  apiEndpoint?: string;
}

// Custom hook for batch metrics - similar to EntriesDisplay.tsx
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
      return <Repeat className="h-3.5 w-3.5 text-muted-foreground stroke-[2.5px]" />;
  }
}

function ActivityDescription({ item, username, name, profileImage, timestamp }: { 
  item: ActivityItem; 
  username: string;
  name: string;
  profileImage?: string | null;
  timestamp?: string;
}) {
  switch (item.type) {
    case "like":
      return (
        <span>
          <span className="font-medium">{name}</span> liked{" "}
          <Link href={item.link || "#"} className="text-blue-500 hover:underline">
            {item.title || "a post"}
          </Link>
        </span>
      );
    case "comment":
      return (
        <div className="flex items-start gap-4">
          <ProfileImage 
            profileImage={profileImage}
            username={username}
            size="md-lg"
            className="flex-shrink-0"
          />
          <div className="flex-1">
            <div className="mb-1 flex justify-between items-center">
              <div>
                <span className="font-medium">{name}</span>
              </div>
              {timestamp && (
                <span className="text-sm leading-none text-muted-foreground flex-shrink-0">
                  {timestamp}
                </span>
              )}
            </div>
            <div className="mb-2">
              <Link href={`/@${username}`} className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                @{username}
              </Link>
            </div>
            {item.content && (
              <div className="text-sm text-muted-foreground">
                {item.content.length > 100 ? `${item.content.substring(0, 100)}...` : item.content}
              </div>
            )}
          </div>
        </div>
      );
    case "retweet":
      return (
        <span className="text-muted-foreground text-sm">
          <span className="font-semibold">{name}</span> <span className="font-semibold">shared</span>
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
  name,
  profileImage,
  entryDetails,
  getEntryMetrics
}: { 
  activity: ActivityItem; 
  username: string;
  name: string;
  profileImage?: string | null;
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
  
  // Format entry timestamp using the same logic as RSSFeedClient
  const entryTimestamp = useMemo(() => {
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

  // Format activity timestamp for comments
  const activityTimestamp = useMemo(() => {
    if (!activity.timestamp) return '';
    
    const now = new Date();
    const activityDate = new Date(activity.timestamp);
    
    // Ensure we're working with valid dates
    if (isNaN(activityDate.getTime())) {
      return '';
    }

    // Calculate time difference
    const diffInMs = now.getTime() - activityDate.getTime();
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
  }, [activity.timestamp]);

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
        <div className="flex items-start">
          {activity.type !== "comment" && (
            <div className="mt-1 mr-3">
              <ActivityIcon type={activity.type} />
            </div>
          )}
          <div className="flex-1">
            <ActivityDescription 
              item={activity} 
              username={username}
              name={name}
              profileImage={profileImage}
              timestamp={activity.type === "comment" ? activityTimestamp : undefined}
            />
            {activity.type !== "comment" && (
              <div className="text-xs text-gray-500 mt-2">
                {activity.type === "retweet" ? (
                  <span className="hidden">{activityTimestamp}</span>
                ) : (
                  activityTimestamp
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // With entry details, show a rich card similar to EntriesDisplay
  return (
    <article className={activity.type === "comment" ? "relative" : ""}>
      {/* Vertical line for comments - positioned absolutely relative to the article */}
      {activity.type === "comment" && (
        <div className="absolute left-[44.5px] top-[60px] bottom-[80px] w-[1px] bg-border z-0"></div>
      )}
      
      <div className="p-4 border-l border-r">
        {/* Activity header with icon and description */}
        <div className="flex items-start mb-0 relative">
          {activity.type !== "comment" && (
            <div className="mr-2">
              <ActivityIcon type={activity.type} />
            </div>
          )}
          <div className={`flex-1 ${activity.type === "retweet" ? "mt-[-6px]" : ""}`}>
            {activity.type !== "comment" && (
            <ActivityDescription 
              item={activity} 
              username={username}
              name={name}
              profileImage={profileImage}
                timestamp={undefined}
            />
            )}
            {activity.type !== "comment" && (
              <div className="text-xs text-gray-500 mt-2">
                {activity.type === "retweet" ? (
                  <span className="hidden">{entryTimestamp}</span>
                ) : (
                  entryTimestamp
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Different layouts based on activity type */}
        {activity.type === "comment" ? (
          // Comment layout with connecting line - Entry card in second column
        <div className="flex items-start gap-4 mb-4 relative">
          {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
            <div className="flex-shrink-0 relative">
          {(entryDetails.post_featured_img || entryDetails.image) && (
                <div className="w-14 h-14 relative z-10">
              <Link 
                href={entryDetails.category_slug && entryDetails.post_slug ? 
                  `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                  entryDetails.link}
                className="block w-full h-full relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
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
            </div>
          )}
            </div>
          
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
                  {entryTimestamp}
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
                
                {/* Entry Content Card - In second column for comments */}
                <div className="mt-4">
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
        </div>

                {/* Horizontal Interaction Buttons - In second column for comments */}
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
            </div>
          </div>
        ) : (
          // Original full-width layout for retweets/likes
          <>
            {/* Top Row: Featured Image and Title */}
            <div className="flex items-start gap-4 mb-4 relative">
              {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
              {(entryDetails.post_featured_img || entryDetails.image) && (
                <div className="flex-shrink-0 w-14 h-14">
                  <Link 
                    href={entryDetails.category_slug && entryDetails.post_slug ? 
                      `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                      entryDetails.link}
                    className="block w-full h-full relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
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
                </div>
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
                      {(() => {
                        if (!entryDetails.pub_date) return '';

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
                      })()}
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

            {/* Entry Content Card - Full width for retweets/likes */}
        <div>
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
        </div>

            {/* Horizontal Interaction Buttons - Full width for retweets/likes */}
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
          </>
        )}
      </div>
      
      <div id={`comments-${entryDetails.guid}`} className={activity.type === "comment" ? "" : "border-t border-border"} />
      
      {/* User Comment Activity - moved below the entry card */}
      {activity.type === "comment" && (
        <div className="px-4 py-3 border-l border-r border-b relative">
          <div className="relative z-10">
            <ActivityDescription 
              item={activity} 
              username={username}
              name={name}
              profileImage={profileImage}
              timestamp={(() => {
                const now = new Date();
                const commentDate = new Date(activity.timestamp);
                
                // Ensure we're working with valid dates
                if (isNaN(commentDate.getTime())) {
                  return '';
                }

                // Calculate time difference
                const diffInMs = now.getTime() - commentDate.getTime();
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
              })()}
            />
          </div>
        </div>
      )}
    </article>
  );
});
ActivityCard.displayName = 'ActivityCard';

/**
 * Client component that displays a user's activity feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
export function UserActivityFeed({ userId, username, name, profileImage, initialData, pageSize = 30, apiEndpoint = "/api/activity" }: UserActivityFeedProps) {
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
  const totalCount = initialData?.totalCount || 0;
  
  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(!initialData?.activities.length);
  
  // Get audio context at the component level
  const { playTrack, currentTrack } = useAudio();
  
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

  // Group activities by entry GUID for comments
  const groupedActivities = useMemo(() => {
    // Create a map to store activities by entry GUID and type
    const groupedMap = new Map<string, Map<string, ActivityItem[]>>();
    
    // First pass: collect all activities by entry GUID and type
    activities.forEach(activity => {
      const key = activity.entryGuid;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, new Map());
      }
      
      // Group only comments together, keep likes and retweets separate
      const typeKey = activity.type === 'comment' ? 'comment' : `${activity.type}-${activity._id}`;
      
      if (!groupedMap.get(key)!.has(typeKey)) {
        groupedMap.get(key)!.set(typeKey, []);
      }
      groupedMap.get(key)!.get(typeKey)!.push(activity);
    });
    
    // Second pass: create final structure
    const result: Array<{
      entryGuid: string;
      firstActivity: ActivityItem;
      comments: ActivityItem[];
      hasMultipleComments: boolean;
      type: string;
    }> = [];
    
    groupedMap.forEach((typeMap, entryGuid) => {
      typeMap.forEach((activitiesForType, typeKey) => {
        // Sort activities by timestamp (oldest first)
        const sortedActivities = [...activitiesForType].sort((a, b) => a.timestamp - b.timestamp);
        
        if (typeKey === 'comment') {
          // For comments, group them together
          result.push({
            entryGuid,
            firstActivity: sortedActivities[0],
            comments: sortedActivities,
            hasMultipleComments: sortedActivities.length > 1,
            type: 'comment'
          });
        } else {
          // For likes and retweets, each is a separate entry
          sortedActivities.forEach(activity => {
            result.push({
              entryGuid,
              firstActivity: activity,
              comments: [],
              hasMultipleComments: false,
              type: activity.type
            });
          });
        }
      });
    });
    
    // Sort the result by the timestamp of the first activity (newest first for the feed)
    return result.sort((a, b) => b.firstActivity.timestamp - a.firstActivity.timestamp);
  }, [activities]);

  // Log when initial data is received
  useEffect(() => {
    if (initialData?.activities) {
      console.log('📋 Initial activity data received from server:', {
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
      console.log(`📡 Fetching more activities from API, skip=${currentSkip}, limit=${pageSize}`);
      
      // Use the API route to fetch the next page
      const result = await fetch(`${apiEndpoint}?userId=${userId}&skip=${currentSkip}&limit=${pageSize}`);
      
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
        console.log('⚠️ No activities returned from API');
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      setActivities(prev => [...prev, ...data.activities]);
      setEntryDetails(prev => ({...prev, ...data.entryDetails}));
      setCurrentSkip(prev => prev + data.activities.length);
      setHasMore(data.hasMore);
      
      console.log(`📊 Updated state - total activities: ${activities.length + data.activities.length}, hasMore: ${data.hasMore}`);
    } catch (error) {
      console.error('❌ Error loading more activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentSkip, userId, pageSize, activities.length, apiEndpoint]);

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    const checkContentHeight = () => {
      if (!loadMoreRef.current || !hasMore || isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && activities.length > 0) {
        console.log('📏 Content is shorter than viewport, loading more activities');
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

  // No activities state
  if (activities.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No activity found for this user.</p>
      </div>
    );
  }

  // Render a group of activities for the same entry
  const renderActivityGroup = (group: {
    entryGuid: string;
    firstActivity: ActivityItem;
    comments: ActivityItem[];
    hasMultipleComments: boolean;
    type: string;
  }, index: number) => {
    const entryDetail = entryDetails[group.entryGuid];
    
    if (!entryDetail) {
      return null;
    }
    
    // Check if this entry is currently playing
    const isCurrentlyPlaying = currentTrack?.src === entryDetail.link;
    
    // Handle card click for podcasts
    const handleCardClick = (e: React.MouseEvent) => {
      if (entryDetail && (entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast')) {
        e.preventDefault();
        playTrack(entryDetail.link, entryDetail.title, entryDetail.image || undefined);
      }
    };
    
    // If this is a like or retweet, or there's only one comment, render a regular ActivityCard
    if (group.type !== 'comment' || group.comments.length <= 1) {
  return (
          <ActivityCard 
          key={`group-${group.entryGuid}-${group.type}-${index}`}
          activity={group.firstActivity}
            username={username}
            name={name}
            profileImage={profileImage}
          entryDetails={entryDetail}
            getEntryMetrics={getEntryMetrics}
          />
      );
    }
    
    // For multiple comments, render a special daisy-chained version
    return (
      <article key={`group-${group.entryGuid}-${group.type}-${index}`} className="relative">
        {/* Main vertical line for the entry card to comments - stops at the last comment's top */}
        <div className="absolute left-[44.5px] top-[60px] bottom-[80px] w-[1px] bg-border z-0"></div>
        
        <div className="p-4 border-l border-r">
          {/* Activity header with icon and description */}
          {group.firstActivity.type !== "comment" && (
            <div className="flex items-start mb-4 relative">
              <div className="mt-1 mr-3">
                <ActivityIcon type={group.firstActivity.type} />
              </div>
              <div className="flex-1">
                <ActivityDescription 
                  item={group.firstActivity} 
                  username={username}
                  name={name}
                  profileImage={profileImage}
                  timestamp={undefined}
                />
                <div className="text-xs text-gray-500 mt-2">
                  {(() => {
                    const now = new Date();
                    const activityDate = new Date(group.firstActivity.timestamp);
                    
                    // Ensure we're working with valid dates
                    if (isNaN(activityDate.getTime())) {
                      return '';
                    }

                    // Calculate time difference
                    const diffInMs = now.getTime() - activityDate.getTime();
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
                  })()}
                </div>
              </div>
            </div>
          )}
          
          {/* Comment layout with connecting line - Entry card in second column */}
          <div className="flex items-start gap-4 mb-4 relative">
            {/* Featured Image - Use post_featured_img if available, otherwise fallback to feed image */}
            <div className="flex-shrink-0 relative">
              {(entryDetail.post_featured_img || entryDetail.image) && (
                <div className="w-14 h-14 relative z-10">
                  <Link 
                    href={entryDetail.category_slug && entryDetail.post_slug ? 
                      `/${entryDetail.category_slug}/${entryDetail.post_slug}` : 
                      entryDetail.link}
                    className="block w-full h-full relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
                    target={entryDetail.category_slug && entryDetail.post_slug ? "_self" : "_blank"}
                    rel={entryDetail.category_slug && entryDetail.post_slug ? "" : "noopener noreferrer"}
                  >
                    <AspectRatio ratio={1}>
                      <Image
                        src={entryDetail.post_featured_img || entryDetail.image || ''}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                        loading="lazy"
                        priority={false}
                      />
                    </AspectRatio>
                  </Link>
                </div>
              )}
            </div>
            
            {/* Title and Timestamp */}
            <div className="flex-grow">
              <div className="w-full">
                <div className="flex items-center justify-between gap-2">
                  <Link 
                    href={entryDetail.category_slug && entryDetail.post_slug ? 
                      `/${entryDetail.category_slug}/${entryDetail.post_slug}` : 
                      entryDetail.link}
                    className="hover:opacity-80 transition-opacity"
                    target={entryDetail.category_slug && entryDetail.post_slug ? "_self" : "_blank"}
                    rel={entryDetail.category_slug && entryDetail.post_slug ? "" : "noopener noreferrer"}
                  >
                    <h3 className="text-base font-semibold text-primary leading-tight">
                      {entryDetail.post_title || entryDetail.feed_title || entryDetail.title}
                    </h3>
                  </Link>
                  <span 
                    className="text-sm leading-none text-muted-foreground flex-shrink-0"
                    title={entryDetail.pub_date ? 
                      format(new Date(entryDetail.pub_date), 'PPP p') : 
                      new Date(group.firstActivity.timestamp).toLocaleString()
                    }
                  >
                    {(() => {
                      if (!entryDetail.pub_date) return '';

                      // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
                      const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                      let pubDate: Date;
                      
                      if (typeof entryDetail.pub_date === 'string' && mysqlDateRegex.test(entryDetail.pub_date)) {
                        // Convert MySQL datetime string to UTC time
                        const [datePart, timePart] = entryDetail.pub_date.split(' ');
                        pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
                      } else {
                        // Handle other formats
                        pubDate = new Date(entryDetail.pub_date);
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
                    })()}
                  </span>
                </div>
                {/* Use post_media_type if available, otherwise fallback to mediaType */}
                {(entryDetail.post_media_type || entryDetail.mediaType) && (
                  <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                    {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') && 
                      <Podcast className="h-3 w-3" />
                    }
                    {(entryDetail.post_media_type?.toLowerCase() === 'newsletter' || entryDetail.mediaType?.toLowerCase() === 'newsletter') && 
                      <Mail className="h-3 w-3" />
                    }
                    {(entryDetail.post_media_type || entryDetail.mediaType || 'article').charAt(0).toUpperCase() + 
                     (entryDetail.post_media_type || entryDetail.mediaType || 'article').slice(1)}
                  </span>
                )}
                
                {/* Entry Content Card - In second column for comments */}
                <div className="mt-4">
                  {(entryDetail.post_media_type?.toLowerCase() === 'podcast' || entryDetail.mediaType?.toLowerCase() === 'podcast') ? (
                    <div>
                      <div 
                        onClick={handleCardClick}
                        className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
                      >
                        <Card className={`overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                          {entryDetail.image && (
                            <CardHeader className="p-0">
                              <AspectRatio ratio={16/9}>
                                <Image
                                  src={entryDetail.image}
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
                              {entryDetail.title}
                            </h3>
                            {entryDetail.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {entryDetail.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <a
                      href={entryDetail.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:opacity-80 transition-opacity"
                    >
                      <Card className="overflow-hidden shadow-none">
                        {entryDetail.image && (
                          <CardHeader className="p-0">
                            <AspectRatio ratio={16/9}>
                              <Image
                                src={entryDetail.image}
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
                            {entryDetail.title}
                          </h3>
                          {entryDetail.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {entryDetail.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </a>
                  )}
                </div>
                
                {/* Horizontal Interaction Buttons - In second column for comments */}
                <div className="flex justify-between items-center mt-4 h-[16px]">
                  <div>
                    <LikeButtonClient
                      entryGuid={entryDetail.guid}
                      feedUrl={entryDetail.feed_url || ''}
                      title={entryDetail.title}
                      pubDate={entryDetail.pub_date}
                      link={entryDetail.link}
                      initialData={getEntryMetrics(entryDetail.guid)?.likes || { isLiked: false, count: 0 }}
                    />
                  </div>
                  <div>
                    <CommentSectionClient
                      entryGuid={entryDetail.guid}
                      feedUrl={entryDetail.feed_url || ''}
                      initialData={getEntryMetrics(entryDetail.guid)?.comments || { count: 0 }}
                    />
                  </div>
                  <div>
                    <RetweetButtonClientWithErrorBoundary
                      entryGuid={entryDetail.guid}
                      feedUrl={entryDetail.feed_url || ''}
                      title={entryDetail.title}
                      pubDate={entryDetail.pub_date}
                      link={entryDetail.link}
                      initialData={getEntryMetrics(entryDetail.guid)?.retweets || { isRetweeted: false, count: 0 }}
                    />
                  </div>
                  <div>
                    <ShareButtonClient
                      url={entryDetail.link}
                      title={entryDetail.title}
                    />
                  </div>
                  <div className="flex justify-end">
                    <MoreOptionsDropdown entry={entryDetail} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div id={`comments-${entryDetail.guid}`} className="" />
        
        {/* Render all comments in chronological order */}
        <div className="border-l border-r border-b">
          {group.comments.map((comment, commentIndex) => {
            return (
              <div 
                key={`comment-${comment._id}`} 
                className="px-4 py-3 relative"
              >
                {/* Remove individual connector lines */}
                <div className="relative z-10">
                  <ActivityDescription 
                    item={comment} 
                    username={username}
                    name={name}
                    profileImage={profileImage}
                    timestamp={(() => {
                      const now = new Date();
                      const commentDate = new Date(comment.timestamp);
                      
                      // Ensure we're working with valid dates
                      if (isNaN(commentDate.getTime())) {
                        return '';
                      }

                      // Calculate time difference
                      const diffInMs = now.getTime() - commentDate.getTime();
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
                    })()}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </article>
    );
  };

  return (
    <div className="w-full">
      <Virtuoso
        useWindowScroll
        data={groupedActivities}
        endReached={loadMoreActivities}
        overscan={200}
        itemContent={(index, group) => renderActivityGroup(group, index)}
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
                  {activities.length > 0 ? 
                    `Showing ${activities.length} of ${totalCount} activities` : 
                    "No activities"
                  }
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  );
} 