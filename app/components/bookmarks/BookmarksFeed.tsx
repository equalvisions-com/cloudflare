"use client";

import { Id } from "@/convex/_generated/dataModel";
import { format } from "date-fns";
import { Podcast, Mail, Loader2 } from "lucide-react";
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
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { useAudio } from '@/components/audio-player/AudioContext';
import { BookmarkItem, RSSEntry, InteractionStates } from "@/app/actions/bookmarkActions";

// Memoized timestamp formatter (copied from UserLikesFeed)
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
const MediaTypeBadge = React.memo(({ mediaType }: { mediaType?: string }) => {
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
const EntryCardContent = React.memo(({ entry }: { entry: RSSEntry }) => (
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

// Bookmark card with entry details
const BookmarkCard = React.memo(({ 
  bookmark, 
  entryDetails,
  interactions
}: { 
  bookmark: BookmarkItem; 
  entryDetails?: RSSEntry;
  interactions?: InteractionStates;
}) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = entryDetails && currentTrack?.src === entryDetails.link;
  
  const timestamp = useFormattedTimestamp(entryDetails?.pub_date);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (entryDetails && (entryDetails.post_media_type?.toLowerCase() === 'podcast' || entryDetails.mediaType?.toLowerCase() === 'podcast')) {
      e.preventDefault();
      playTrack(entryDetails.link, entryDetails.title, entryDetails.image || undefined);
    }
  }, [entryDetails, playTrack]);
  
  if (!entryDetails) {
    // Fallback to basic bookmark data if entry details aren't available
    return (
      <article className="p-4 border-b border-gray-100">
        <Link href={bookmark.link} target="_blank">
          <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 mb-1">{bookmark.title}</h3>
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500">
            Published: {new Date(bookmark.pubDate).toLocaleDateString()}
          </div>
        </div>
      </article>
    );
  }
  
  const mediaType = entryDetails.post_media_type || entryDetails.mediaType;
  const isPodcast = mediaType?.toLowerCase() === 'podcast';
  
  return (
    <article className="">
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-center gap-4 mb-4">
          {/* Featured Image */}
          {(entryDetails.post_featured_img || entryDetails.image) && (
            <Link 
              href={entryDetails.category_slug && entryDetails.post_slug ? 
                `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                entryDetails.link}
              className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity"
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
              <div className="flex items-start justify-between gap-2">
                <Link 
                  href={entryDetails.category_slug && entryDetails.post_slug ? 
                    `/${entryDetails.category_slug}/${entryDetails.post_slug}` : 
                    entryDetails.link}
                  className="hover:opacity-80 transition-opacity"
                  target={entryDetails.category_slug && entryDetails.post_slug ? "_self" : "_blank"}
                  rel={entryDetails.category_slug && entryDetails.post_slug ? "" : "noopener noreferrer"}
                >
                  <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                    {entryDetails.post_title || entryDetails.feed_title || entryDetails.title}
                  </h3>
                </Link>
                <span 
                  className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                  title={entryDetails.pub_date ? 
                    format(new Date(entryDetails.pub_date), 'PPP p') : 
                    new Date(bookmark.bookmarkedAt).toLocaleString()
                  }
                >
                  {timestamp}
                </span>
              </div>
              <MediaTypeBadge mediaType={mediaType} />
            </div>
          </div>
        </div>

        {/* Entry Content Card */}
        {isPodcast ? (
          <div>
            <div 
              onClick={handleCardClick}
              className={`cursor-pointer ${!isCurrentlyPlaying ? 'hover:opacity-80 transition-opacity' : ''}`}
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
                        sizes="(max-width: 768px) 100vw, 768px"
                        loading="lazy"
                        priority={false}
                      />
                    </AspectRatio>
                  </CardHeader>
                )}
                <EntryCardContent entry={entryDetails} />
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
            <Card className="rounded-xl border overflow-hidden shadow-none">
              {entryDetails.image && (
                <CardHeader className="p-0">
                  <AspectRatio ratio={2/1}>
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
              <EntryCardContent entry={entryDetails} />
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
          <div className="flex items-center gap-4">
            <BookmarkButtonClient
              entryGuid={entryDetails.guid}
              feedUrl={entryDetails.feed_url || ''}
              title={entryDetails.title}
              pubDate={entryDetails.pub_date}
              link={entryDetails.link}
              initialData={{ isBookmarked: true }} // Always true since these are bookmarks
            />
            <ShareButtonClient
              url={entryDetails.link}
              title={entryDetails.title}
            />
          </div>
        </div>
      </div>
      
      <div id={`comments-${entryDetails.guid}`} className="border-t border-border" />
    </article>
  );
});
BookmarkCard.displayName = 'BookmarkCard';

interface BookmarksFeedProps {
  userId: Id<"users">;
  initialData: {
    bookmarks: BookmarkItem[];
    totalCount: number;
    hasMore: boolean;
    entryDetails: Record<string, RSSEntry>;
    entryMetrics: Record<string, InteractionStates>;
  } | null;
  pageSize?: number;
  isSearchResults?: boolean;
}

/**
 * Client component that displays bookmarks feed with virtualization and pagination
 * Initial data is fetched on the server, and additional data is loaded as needed
 */
export function BookmarksFeed({ userId, initialData, pageSize = 30, isSearchResults = false }: BookmarksFeedProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(
    initialData?.bookmarks || []
  );
  const [entryDetails, setEntryDetails] = useState<Record<string, RSSEntry>>(
    initialData?.entryDetails || {}
  );
  const [entryMetrics, setEntryMetrics] = useState<Record<string, InteractionStates>>(
    initialData?.entryMetrics || {}
  );
  const [hasMore, setHasMore] = useState(initialData?.hasMore || false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSkip, setCurrentSkip] = useState(initialData?.bookmarks.length || 0);
  
  // Track if this is the initial load
  const [isInitialLoad, setIsInitialLoad] = useState(!initialData?.bookmarks.length);

  // Log when initial data is received
  useEffect(() => {
    if (initialData?.bookmarks) {
      console.log('📋 Initial bookmarks data received from server:', {
        bookmarksCount: initialData.bookmarks.length,
        totalCount: initialData.totalCount,
        hasMore: initialData.hasMore,
        entryDetailsCount: Object.keys(initialData.entryDetails || {}).length,
        entryMetricsCount: Object.keys(initialData.entryMetrics || {}).length
      });
      setBookmarks(initialData.bookmarks);
      setEntryDetails(initialData.entryDetails || {});
      setEntryMetrics(initialData.entryMetrics || {});
      setHasMore(initialData.hasMore);
      setCurrentSkip(initialData.bookmarks.length);
      setIsInitialLoad(false);
    }
  }, [initialData]);

  // Function to load more bookmarks
  const loadMoreBookmarks = useCallback(async () => {
    if (isLoading || !hasMore || isSearchResults) {
      console.log(`⚠️ Not loading more: isLoading=${isLoading}, hasMore=${hasMore}, isSearchResults=${isSearchResults}`);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log(`📡 Fetching more bookmarks from API, skip=${currentSkip}, limit=${pageSize}`);
      
      // Use the API route to fetch the next page
      const result = await fetch(`/api/bookmarks?userId=${userId}&skip=${currentSkip}&limit=${pageSize}`);
      
      if (!result.ok) {
        throw new Error(`API error: ${result.status}`);
      }
      
      const data = await result.json();
      console.log(`📦 Received data from API:`, {
        bookmarksCount: data.bookmarks?.length || 0,
        hasMore: data.hasMore,
        entryDetailsCount: Object.keys(data.entryDetails || {}).length,
        entryMetricsCount: Object.keys(data.entryMetrics || {}).length
      });
      
      if (!data.bookmarks?.length) {
        console.log('⚠️ No bookmarks returned from API');
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      setBookmarks(prev => [...prev, ...data.bookmarks]);
      setEntryDetails(prev => ({...prev, ...data.entryDetails}));
      setEntryMetrics(prev => ({...prev, ...data.entryMetrics}));
      setCurrentSkip(prev => prev + data.bookmarks.length);
      setHasMore(data.hasMore);
      
      console.log(`📊 Updated state - total bookmarks: ${bookmarks.length + data.bookmarks.length}, hasMore: ${data.hasMore}`);
    } catch (error) {
      console.error('❌ Error loading more bookmarks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, currentSkip, userId, pageSize, bookmarks.length, isSearchResults]);

  // Check if we need to load more when the component is mounted
  useEffect(() => {
    const checkContentHeight = () => {
      if (!loadMoreRef.current || !hasMore || isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && bookmarks.length > 0) {
        console.log('📏 Content is shorter than viewport, loading more bookmarks');
        loadMoreBookmarks();
      }
    };
    
    // Run the check after a short delay to ensure the DOM has updated
    const timer = setTimeout(checkContentHeight, 1000);
    
    return () => clearTimeout(timer);
  }, [bookmarks.length, hasMore, isLoading, loadMoreBookmarks]);

  // Loading state - only show for initial load
  if (isLoading && isInitialLoad) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // No bookmarks state
  if (bookmarks.length === 0 && !isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>You haven&apos;t bookmarked any posts yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Virtuoso
        useWindowScroll
        data={bookmarks}
        endReached={isSearchResults ? undefined : loadMoreBookmarks}
        overscan={20}
        itemContent={(index, bookmark) => (
          <BookmarkCard 
            key={bookmark._id} 
            bookmark={bookmark} 
            entryDetails={entryDetails[bookmark.entryGuid]}
            interactions={entryMetrics[bookmark.entryGuid]}
          />
        )}
        components={{
          Footer: () => 
            isLoading && hasMore && !isSearchResults ? (
              <div ref={loadMoreRef} className="text-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : <div ref={loadMoreRef} className="h-0" />
        }}
      />
    </div>
  );
} 