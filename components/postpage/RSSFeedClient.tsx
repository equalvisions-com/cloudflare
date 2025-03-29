'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { format } from "date-fns";
import { decode } from 'html-entities';
import type { RSSItem } from "@/lib/rss";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { RetweetButtonClientWithErrorBoundary } from "@/components/retweet-button/RetweetButtonClient";
import { BookmarkButtonClient } from "@/components/bookmark-button/BookmarkButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useAudio } from '@/components/audio-player/AudioContext';
import { Podcast, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

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
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
}

interface APIRSSEntry {
  entry: RSSItem;
  initialData?: {
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
}

const RSSEntry = React.memo(({ entryWithData: { entry, initialData }, featuredImg, postTitle, mediaType }: RSSEntryProps) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  const timestamp = useMemo(() => {
    // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
    const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    let pubDate: Date;
    
    if (typeof entry.pubDate === 'string' && mysqlDateRegex.test(entry.pubDate)) {
      // Convert MySQL datetime string to UTC time
      const [datePart, timePart] = entry.pubDate.split(' ');
      pubDate = new Date(`${datePart}T${timePart}Z`); // Add 'Z' to indicate UTC
    } else {
      // Handle other formats
      pubDate = new Date(entry.pubDate);
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
  }, [entry.pubDate]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (mediaType === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image);
    }
  }, [mediaType, entry.link, entry.title, entry.image, playTrack]);

  return (
    <article>
      <div className="p-4">
        <div className="flex items-start gap-4 mb-4">
          {featuredImg && (
            <div className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={featuredImg}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                  loading="lazy"
                  priority={false}
                />
              </AspectRatio>
            </div>
          )}
          
          <div className="flex-grow">
            <div className="w-full mt-[-3px]">
              {postTitle && (
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-primary leading-tight">
                    {postTitle}
                  </h3>
                  <span className="text-sm leading-none text-muted-foreground flex-shrink-0"
                    title={format(new Date(entry.pubDate), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {mediaType && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg mt-[4px]">
                  {mediaType.toLowerCase() === 'podcast' && <Podcast className="h-3 w-3" />}
                  {mediaType.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" strokeWidth={2.5} />}
                  {mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {mediaType === 'podcast' ? (
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
                        loading="lazy"
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
                      loading="lazy"
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
        
        <div className="flex justify-between items-center mt-4 h-[16px]">
          <div>
            <LikeButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={initialData.likes}
            />
          </div>
          <div>
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              initialData={initialData.comments}
            />
          </div>
          <div>
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={initialData.retweets || { isRetweeted: false, count: 0 }}
            />
          </div>
          <div className="flex items-center gap-4">
            <BookmarkButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
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
      
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
});
RSSEntry.displayName = 'RSSEntry';

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

// Define the FeedContent component interface
interface FeedContentProps {
  entries: RSSEntryWithData[];
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  isPending: boolean;
  loadMore: () => Promise<void>;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
}

// Memoize the FeedContent component to prevent unnecessary re-renders
const FeedContent = React.memo(function FeedContent({
  entries,
  hasMore,
  loadMoreRef,
  isPending,
  loadMore,
  featuredImg,
  postTitle,
  mediaType
}: FeedContentProps) {
  // Render each entry
  const renderItem = useCallback((index: number) => {
    if (!entries || index >= entries.length) {
      return null;
    }
    return (
      <RSSEntry 
        key={entries[index].entry.guid} 
        entryWithData={entries[index]} 
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
      />
    );
  }, [entries, featuredImg, postTitle, mediaType]);

  return (
    <div className="space-y-0">
      {entries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No entries found for this feed.
        </div>
      ) : (
        <Virtuoso
          useWindowScroll
          totalCount={entries.length}
          overscan={20}
          endReached={() => {
            console.log(`🏁 End reached, hasMore: ${hasMore}, isPending: ${isPending}`);
            if (hasMore && !isPending) {
              console.log('🔄 Loading more entries...');
              loadMore();
            }
          }}
          initialTopMostItemIndex={0}
          itemContent={renderItem}
          components={{
            Footer: () => 
              isPending && hasMore ? (
                <div ref={loadMoreRef} className="text-center py-4">Loading more entries...</div>
              ) : <div ref={loadMoreRef} className="h-0" />
          }}
        />
      )}
    </div>
  );
});

// Add displayName for easier debugging
FeedContent.displayName = 'FeedContent';

interface RSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
  };
  pageSize?: number;
  featuredImg?: string;
  mediaType?: string;
}

export function RSSFeedClient({ postTitle, feedUrl, initialData, pageSize = 30, featuredImg, mediaType }: RSSFeedClientProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const ITEMS_PER_REQUEST = pageSize;
  
  // Track all entries manually
  const [allEntriesState, setAllEntriesState] = useState<RSSEntryWithData[]>(initialData.entries || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreState, setHasMoreState] = useState(initialData.hasMore || false);
  
  // Debug log the initial data
  useEffect(() => {
    if (initialData) {
      console.log('📋 Initial data received in client:', {
        entriesCount: initialData.entries?.length || 0,
        hasMore: initialData.hasMore,
        totalEntries: initialData.totalEntries
      });
      
      // Initialize state with initial data
      setAllEntriesState(initialData.entries || []);
      setHasMoreState(initialData.hasMore || false);
    }
  }, [initialData]);
  
  const loadMoreEntries = useCallback(async () => {
    if (isLoading || !hasMoreState) {
      console.log(`⚠️ Not loading more: isLoading=${isLoading}, hasMoreState=${hasMoreState}`);
      return;
    }
    
    setIsLoading(true);
    const nextPage = currentPage + 1;
    
    try {
      const baseUrl = new URL(`/api/rss/${encodeURIComponent(postTitle)}`, window.location.origin);
      baseUrl.searchParams.set('feedUrl', encodeURIComponent(feedUrl));
      baseUrl.searchParams.set('page', nextPage.toString());
      baseUrl.searchParams.set('pageSize', ITEMS_PER_REQUEST.toString());
      
      // Pass the cached total entries to avoid unnecessary COUNT queries
      if (initialData.totalEntries) {
        baseUrl.searchParams.set('totalEntries', initialData.totalEntries.toString());
        console.log(`📊 Passing cached totalEntries: ${initialData.totalEntries}`);
      }
      
      if (mediaType) {
        baseUrl.searchParams.set('mediaType', encodeURIComponent(mediaType));
      }
      
      console.log(`📡 Fetching page ${nextPage} from API`);
      
      const response = await fetch(baseUrl.toString());
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      console.log(`📦 Received data from API - entries: ${data.entries?.length || 0}, hasMore: ${data.hasMore}, total: ${data.totalEntries}`);
      
      if (!data.entries?.length) {
        console.log('⚠️ No entries returned from API');
        setIsLoading(false);
        return;
      }
      
      const transformedEntries = data.entries
        .filter(Boolean)
        .map((entry: APIRSSEntry) => ({
          entry: entry.entry,
          initialData: entry.initialData || {
            likes: { isLiked: false, count: 0 },
            comments: { count: 0 },
            retweets: { isRetweeted: false, count: 0 }
          },
          postMetadata: {
            title: postTitle,
            featuredImg: featuredImg || entry.entry.image || '',
            mediaType: mediaType || 'article'
          }
        }));
      
      console.log(`✅ Transformed ${transformedEntries.length} entries`);
      
      setAllEntriesState(prev => [...prev, ...transformedEntries]);
      setCurrentPage(nextPage);
      setHasMoreState(data.hasMore);
      
      console.log(`📊 Updated state - total entries: ${allEntriesState.length + transformedEntries.length}, hasMore: ${data.hasMore}`);
      
    } catch (error) {
      console.error('❌ Error loading more entries:', error);
      setFetchError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMoreState, currentPage, postTitle, feedUrl, ITEMS_PER_REQUEST, mediaType, featuredImg, allEntriesState.length, initialData]);
  
  // Extract all entry GUIDs for metrics query
  const entryGuids = useMemo(() => 
    allEntriesState.map(entry => entry.entry.guid),
    [allEntriesState]
  );
  
  const combinedData = useQuery(
    api.entries.getFeedDataWithMetrics,
    entryGuids.length > 0 
      ? { entryGuids, feedUrls: [feedUrl] } 
      : "skip"
  );
  
  // Extract metrics from combined data
  const entryMetricsMap = useMemo(() => {
    if (!combinedData?.entryMetrics) return null;
    return Object.fromEntries(
      combinedData.entryMetrics.map(item => [item.guid, item.metrics])
    );
  }, [combinedData]);
  
  // Extract post metadata from combined data
  const postMetadata = useMemo(() => {
    if (!combinedData?.postMetadata || combinedData.postMetadata.length === 0) return null;
    
    // The feedUrl is unique in this context, so we can safely use the first item
    const metadataItem = combinedData.postMetadata.find(item => item.feedUrl === feedUrl);
    return metadataItem?.metadata || null;
  }, [combinedData, feedUrl]);
  
  // Apply metrics to entries
  const enhancedEntries = useMemo(() => {
    if (!allEntriesState.length) return allEntriesState;
    
    return allEntriesState.map(entryWithData => {
      const enhanced = { ...entryWithData };
      
      // Apply metrics if available
      if (entryMetricsMap && enhanced.entry.guid in entryMetricsMap) {
        enhanced.initialData = {
          ...enhanced.initialData,
          ...entryMetricsMap[enhanced.entry.guid]
        };
      }
      
      return enhanced;
    });
  }, [allEntriesState, entryMetricsMap]);
  
  // Add a useEffect to check if we need to load more when the component is mounted
  useEffect(() => {
    const checkContentHeight = () => {
      if (!loadMoreRef.current || !hasMoreState || isLoading) return;
      
      const viewportHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // If the document is shorter than the viewport, load more
      if (documentHeight <= viewportHeight && allEntriesState.length > 0) {
        console.log('📏 Content is shorter than viewport, loading more entries');
        loadMoreEntries();
      }
    };
    
    // Run the check after a short delay to ensure the DOM has updated
    const timer = setTimeout(checkContentHeight, 1000);
    
    return () => clearTimeout(timer);
  }, [allEntriesState.length, hasMoreState, isLoading, loadMoreEntries]);
  
  if (fetchError) {
    return (
      <div className="text-center py-8 text-destructive">
        <p className="mb-4">Error loading feed entries</p>
        <Button 
          variant="outline" 
          onClick={() => {
            setFetchError(null);
            setAllEntriesState(initialData.entries || []);
            setCurrentPage(1);
            setHasMoreState(initialData.hasMore || false);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <FeedContent
        entries={enhancedEntries}
        hasMore={hasMoreState}
        loadMoreRef={loadMoreRef}
        isPending={isLoading}
        loadMore={loadMoreEntries}
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
      />
    </div>
  );
}

export function RSSFeedClientWithErrorBoundary(props: RSSFeedClientProps) {
  return (
    <ErrorBoundary>
      <RSSFeedClient {...props} />
    </ErrorBoundary>
  );
}