'use client';

import React, { useRef, useState, useMemo, useCallback, useEffect, memo } from 'react';
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { FeaturedEntry } from "@/lib/featured_redis";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Podcast, Mail, Loader2 } from "lucide-react";
import { Virtuoso } from 'react-virtuoso';
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';
import { VerifiedBadge } from "@/components/VerifiedBadge";

// Interface for post metadata
interface PostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  postSlug: string;
  categorySlug: string;
  verified?: boolean;
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
    bookmarks?: {
      isBookmarked: boolean;
    };
  };
  postMetadata: PostMetadata;
}

interface FeaturedEntryProps {
  entryWithData: FeaturedEntryWithData;
}

// Memoize the FeaturedEntry component
const FeaturedEntry = memo(({ entryWithData: { entry, initialData, postMetadata }, onOpenCommentDrawer }: FeaturedEntryProps & { onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void }) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Format the timestamp based on age
  const timestamp = useMemo(() => {
    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let pubDate: Date;
    
    if (typeof entry.pub_date === 'string' && mysqlDateRegex.test(entry.pub_date)) {
      // Convert MySQL datetime string to UTC time
      const [datePart, timePart] = entry.pub_date.split(' ');
      pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      pubDate = new Date(entry.pub_date);
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
  }, [entry.pub_date]);

  // Generate post URL if we have category and post slugs
  const postUrl = postMetadata.postSlug
    ? postMetadata.mediaType === 'newsletter'
      ? `/newsletters/${postMetadata.postSlug}`
      : postMetadata.mediaType === 'podcast'
        ? `/podcasts/${postMetadata.postSlug}`
        : postMetadata.categorySlug 
          ? `/${postMetadata.categorySlug}/${postMetadata.postSlug}`
          : null
    : null;

  // Handle podcast playback
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (postMetadata.mediaType?.toLowerCase() === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image);
    }
  }, [postMetadata.mediaType, entry.link, entry.title, entry.image, playTrack]);

  const handleOpenComment = useCallback(() => {
    onOpenCommentDrawer(entry.guid, entry.feed_url, initialData.comments);
  }, [onOpenCommentDrawer, entry.guid, entry.feed_url, initialData.comments]);

  return (
    <article>
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-center gap-4 mb-4">
          {/* Featured Image */}
          {postMetadata.featuredImg && postUrl && (
            <Link href={postUrl} className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={postMetadata.featuredImg}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                  priority={false}
                />
              </AspectRatio>
            </Link>
          )}
          
          {/* Title and Timestamp */}
          <div className="flex-grow">
            <div className="w-full">
              {postMetadata.title && (
                <div className="flex items-start justify-between gap-2">
                  {postUrl ? (
                    <Link href={postUrl} className="hover:opacity-80 transition-opacity">
                      <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                        {postMetadata.title}
                        {postMetadata.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                      </h3>
                    </Link>
                  ) : (
                    <h3 className="text-sm font-bold text-primary leading-tight">
                      {postMetadata.title}
                      {postMetadata.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                    </h3>
                  )}
                  <span 
                    className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                    title={format(new Date(entry.pub_date), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {postMetadata.mediaType && (
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
        {postMetadata.mediaType?.toLowerCase() === 'podcast' ? (
          <div>
            <div 
              onClick={handleCardClick}
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
                        sizes="(max-width: 768px) 100vw, 768px"
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
          <a
            href={entry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-80 transition-opacity"
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
                      sizes="(max-width: 768px) 100vw, 768px"
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
          <div onClick={handleOpenComment}>
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              initialData={initialData.comments}
              buttonOnly={true}
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
          <div className="flex items-center gap-4">
            <BookmarkButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={initialData.bookmarks || { isBookmarked: false }}
            />
            <ShareButtonClient
              url={entry.link}
              title={entry.title}
            />
          </div>
        </div>
      </div>
      
      {/* Comments Section */}
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
});
FeaturedEntry.displayName = 'FeaturedEntry';

// Feed content component is already memoized
const FeedContent = React.memo(({ 
  entries,
  visibleEntries,
  loadMoreRef,
  hasMore,
  loadMore,
  isLoading,
  onOpenCommentDrawer
}: { 
  entries: FeaturedEntryWithData[],
  visibleEntries: FeaturedEntryWithData[],
  loadMoreRef: React.MutableRefObject<HTMLDivElement | null>,
  hasMore: boolean,
  loadMore: () => void,
  isLoading: boolean,
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void
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
          console.log(`🏁 Virtuoso endReached called, hasMore: ${hasMore}, isLoading: ${isLoading}, entries: ${visibleEntries.length}`);
          if (hasMore && !isLoading) {
            console.log('📥 Virtuoso end reached, loading more entries');
            loadMore();
          } else {
            console.log(`⚠️ Not loading more from Virtuoso endReached: hasMore=${hasMore}, isLoading=${isLoading}`);
          }
        }}
        overscan={20}
        initialTopMostItemIndex={0}
        itemContent={index => {
          const entryWithData = visibleEntries[index];
          return (
            <FeaturedEntry
              entryWithData={entryWithData}
              onOpenCommentDrawer={onOpenCommentDrawer}
            />
          );
        }}
        components={{
          Footer: () => 
            isLoading && hasMore ? (
              <div ref={loadMoreRef} className="text-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
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

export const FeaturedFeedClientWithErrorBoundary = memo(function FeaturedFeedClientWithErrorBoundary(props: FeaturedFeedClientProps) {
  return (
    <ErrorBoundary>
      <FeaturedFeedClient {...props} />
    </ErrorBoundary>
  );
});

// Create the client component that will be memoized
const FeaturedFeedClientComponent = ({ initialData, pageSize = 30 }: FeaturedFeedClientProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // --- Drawer state for comments ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Log to confirm we're using prefetched data from LayoutManager
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    console.log('FeaturedFeedClient: Using prefetched data from LayoutManager', {
      entriesCount: initialData?.entries?.length || 0
    });
  }, [initialData]);
  
  // Calculate visible entries based on current page
  const visibleEntries = useMemo(() => {
    return initialData.entries.slice(0, currentPage * pageSize);
  }, [initialData.entries, currentPage, pageSize]);
  
  // Check if there are more entries to load
  const hasMore = visibleEntries.length < initialData.entries.length;
  
  // Function to load more entries - just update the page number
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      if (!isMountedRef.current) return;
      
      setIsLoading(true);
      // Simulate loading delay for better UX
      setTimeout(() => {
        if (isMountedRef.current) {
          setCurrentPage(prev => prev + 1);
          setIsLoading(false);
        }
      }, 300);
    }
  }, [hasMore, isLoading]);
  
  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    if (!isMountedRef.current) return;
    
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);

  // Memoize the comment drawer state change handler
  const handleCommentDrawerOpenChange = useCallback((open: boolean) => {
    if (!isMountedRef.current) return;
    setCommentDrawerOpen(open);
  }, []);

  return (
    <div className="w-full">
      <FeedContent
        entries={initialData.entries}
        visibleEntries={visibleEntries}
        loadMoreRef={loadMoreRef}
        hasMore={hasMore}
        loadMore={loadMore}
        isLoading={isLoading}
        onOpenCommentDrawer={handleOpenCommentDrawer}
      />
      {selectedCommentEntry && (
        <CommentSectionClient
          entryGuid={selectedCommentEntry.entryGuid}
          feedUrl={selectedCommentEntry.feedUrl}
          initialData={selectedCommentEntry.initialData}
          isOpen={commentDrawerOpen}
          setIsOpen={handleCommentDrawerOpenChange}
        />
      )}
    </div>
  );
};

// Export the memoized version of the component
export const FeaturedFeedClient = memo(FeaturedFeedClientComponent); 