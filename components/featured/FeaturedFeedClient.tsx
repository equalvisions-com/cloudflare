'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { FeaturedEntry } from "@/lib/featured_redis";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { MoreVertical, Headphones, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';

// Interface for post metadata
interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
}

// Interface for entry with data
interface FeaturedEntryWithData {
  entry: FeaturedEntry;
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
  };
  postMetadata: PostMetadata;
}

interface FeaturedEntryProps {
  entryWithData: FeaturedEntryWithData;
}

interface MoreOptionsDropdownProps {
  entry: FeaturedEntry;
}

const MoreOptionsDropdown = ({ entry }: MoreOptionsDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="px-0 hover:bg-transparent -mr-2 focus-visible:ring-0 focus:ring-0 focus:ring-offset-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => window.open(entry.link, '_blank')}
          className="cursor-pointer"
        >
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => navigator.clipboard.writeText(entry.link)}
          className="cursor-pointer"
        >
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => window.open(`mailto:?subject=${encodeURIComponent(entry.title)}&body=${encodeURIComponent(entry.link)}`, '_blank')}
          className="cursor-pointer"
        >
          Email this
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const FeaturedEntry = ({ entryWithData: { entry, initialData, postMetadata } }: FeaturedEntryProps) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Format the timestamp based on age
  const timestamp = useMemo(() => {
    const pubDate = new Date(entry.pub_date);
    const now = new Date();
    const diffInMs = now.getTime() - pubDate.getTime();
    const diffInMinutes = diffInMs / (1000 * 60);
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;
    const diffInMonths = diffInDays / 30;
    
    if (diffInMinutes < 60) {
      // Less than an hour: show minutes
      const mins = Math.floor(diffInMinutes);
      return `${mins}${mins === 1 ? 'min' : 'mins'}`;
    } else if (diffInHours < 24) {
      // Less than a day: show hours
      const hrs = Math.floor(diffInHours);
      return `${hrs}${hrs === 1 ? 'hr' : 'hrs'}`;
    } else if (diffInDays < 30) {
      // Less than a month: show days
      const days = Math.floor(diffInDays);
      return `${days}${days === 1 ? 'd' : 'd'}`;
    } else {
      // More than a month: show months
      const months = Math.floor(diffInMonths);
      return `${months}${months === 1 ? 'mo' : 'mo'}`;
    }
  }, [entry.pub_date]);

  // Generate post URL if we have category and post slugs
  const postUrl = postMetadata.categorySlug && postMetadata.postSlug 
    ? `/${postMetadata.categorySlug}/${postMetadata.postSlug}`
    : null;

  // Handle podcast playback
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (postMetadata.mediaType?.toLowerCase() === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image);
    }
  }, [postMetadata.mediaType, entry.link, entry.title, entry.image, playTrack]);

  return (
    <article>
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-start gap-4 mb-4">
          {/* Featured Image */}
          {postMetadata.featuredImg && postUrl && (
            <Link href={postUrl} className="flex-shrink-0 w-14 h-14 relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={postMetadata.featuredImg}
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
              {postMetadata.title && (
                <div className="flex items-center justify-between gap-2">
                  {postUrl ? (
                    <Link href={postUrl} className="hover:opacity-80 transition-opacity">
                      <h3 className="text-base font-semibold text-primary leading-tight">
                        {postMetadata.title}
                      </h3>
                    </Link>
                  ) : (
                    <h3 className="text-base font-semibold text-primary leading-tight">
                      {postMetadata.title}
                    </h3>
                  )}
                  <span 
                    className="text-sm leading-none text-muted-foreground flex-shrink-0"
                    title={format(new Date(entry.pub_date), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {postMetadata.mediaType && (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                  {postMetadata.mediaType.toLowerCase() === 'podcast' && <Headphones className="h-3 w-3" />}
                  {postMetadata.mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" />}
                  {postMetadata.mediaType.charAt(0).toUpperCase() + postMetadata.mediaType.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content */}
        {postMetadata.mediaType?.toLowerCase() === 'podcast' ? (
          <div>
            <div 
              onClick={handleCardClick}
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
            >
              <Card className={`overflow-hidden shadow-none ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}>
                {entry.image && (
                  <CardHeader className="p-0">
                    <AspectRatio ratio={16/9}>
                      <Image
                        src={entry.image}
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
                    {decode(entry.title)}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {decode(entry.description)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-80 transition-opacity"
          >
            <Card className="overflow-hidden shadow-none">
              {entry.image && (
                <CardHeader className="p-0">
                  <AspectRatio ratio={16/9}>
                    <Image
                      src={entry.image}
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
                  {decode(entry.title)}
                </h3>
                {entry.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {decode(entry.description)}
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
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={initialData.likes}
            />
          </div>
          <div>
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              initialData={initialData.comments}
            />
          </div>
          <div>
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={initialData.retweets || { isRetweeted: false, count: 0 }}
            />
          </div>
          <div>
            <ShareButtonClient
              url={entry.link}
              title={entry.title}
            />
          </div>
          <div className="flex justify-end">
            <MoreOptionsDropdown entry={entry} />
          </div>
        </div>
      </div>
      
      {/* Comments Section */}
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
};

// Feed content component
const FeedContent = React.memo(({ 
  entries,
  visibleEntries,
  loadMoreRef,
  hasMore,
  loadMore,
  isLoading
}: { 
  entries: FeaturedEntryWithData[],
  visibleEntries: FeaturedEntryWithData[],
  loadMoreRef: React.MutableRefObject<HTMLDivElement | null>,
  hasMore: boolean,
  loadMore: () => void,
  isLoading: boolean
}) => {
  if (!entries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No featured entries found.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <Virtuoso
        useWindowScroll
        totalCount={visibleEntries.length}
        endReached={() => {
          if (hasMore && !isLoading) {
            loadMore();
          }
        }}
        overscan={20}
        initialTopMostItemIndex={0}
        itemContent={index => {
          const entryWithData = visibleEntries[index];
          return (
            <FeaturedEntry
              entryWithData={entryWithData}
            />
          );
        }}
        components={{
          Footer: () => 
            isLoading && hasMore ? (
              <div ref={loadMoreRef} className="text-center py-4">Loading more entries...</div>
            ) : <div ref={loadMoreRef} className="h-0" />
        }}
      />
    </div>
  );
});
FeedContent.displayName = 'FeedContent';

interface FeaturedFeedClientProps {
  initialData: {
    entries: FeaturedEntryWithData[];
    totalEntries: number;
  };
  pageSize?: number;
}

export function FeaturedFeedClientWithErrorBoundary(props: FeaturedFeedClientProps) {
  return (
    <ErrorBoundary>
      <FeaturedFeedClient {...props} />
    </ErrorBoundary>
  );
}

export function FeaturedFeedClient({ initialData, pageSize = 30 }: FeaturedFeedClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Calculate visible entries based on current page
  const visibleEntries = useMemo(() => {
    return initialData.entries.slice(0, currentPage * pageSize);
  }, [initialData.entries, currentPage, pageSize]);
  
  // Check if there are more entries to load
  const hasMore = visibleEntries.length < initialData.entries.length;
  
  // Function to load more entries - just update the page number
  const loadMore = () => {
    if (hasMore && !isLoading) {
      setIsLoading(true);
      // Simulate loading delay for better UX
      setTimeout(() => {
        setCurrentPage(prev => prev + 1);
        setIsLoading(false);
      }, 300);
    }
  };
  
  // Return the FeedContent directly instead of using tabs
  return (
    <div className="w-full border-0 md:border-l md:border-r md:border-b">
      <FeedContent
        entries={initialData.entries}
        visibleEntries={visibleEntries}
        loadMoreRef={loadMoreRef}
        hasMore={hasMore}
        loadMore={loadMore}
        isLoading={isLoading}
      />
    </div>
  );
} 