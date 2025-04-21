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
import { VerifiedBadge } from "@/components/VerifiedBadge";
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
  verified?: boolean;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
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

// Custom equality function for RSSEntry to prevent unnecessary re-renders
const arePropsEqual = (prevProps: RSSEntryProps, nextProps: RSSEntryProps) => {
  // Compare essential props for rendering decisions
  return (
    prevProps.entryWithData.entry.guid === nextProps.entryWithData.entry.guid &&
    prevProps.entryWithData.initialData.likes.count === nextProps.entryWithData.initialData.likes.count &&
    prevProps.entryWithData.initialData.likes.isLiked === nextProps.entryWithData.initialData.likes.isLiked &&
    prevProps.entryWithData.initialData.comments.count === nextProps.entryWithData.initialData.comments.count &&
    prevProps.featuredImg === nextProps.featuredImg &&
    prevProps.postTitle === nextProps.postTitle &&
    prevProps.mediaType === nextProps.mediaType &&
    prevProps.verified === nextProps.verified &&
    // For retweets and bookmarks, check if they exist and then compare
    ((!prevProps.entryWithData.initialData.retweets && !nextProps.entryWithData.initialData.retweets) ||
      (prevProps.entryWithData.initialData.retweets?.count === nextProps.entryWithData.initialData.retweets?.count &&
       prevProps.entryWithData.initialData.retweets?.isRetweeted === nextProps.entryWithData.initialData.retweets?.isRetweeted)) &&
    ((!prevProps.entryWithData.initialData.bookmarks && !nextProps.entryWithData.initialData.bookmarks) ||
      (prevProps.entryWithData.initialData.bookmarks?.isBookmarked === nextProps.entryWithData.initialData.bookmarks?.isBookmarked))
  );
};

const RSSEntry = React.memo(({ entryWithData: { entry, initialData }, featuredImg, postTitle, mediaType, verified, onOpenCommentDrawer }: RSSEntryProps): JSX.Element => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Memoize the timestamp calculation as it's a complex operation
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
  }, [entry.pubDate]); // Only recalculate when pubDate changes

  // Memoize handlers to prevent recreating them on every render
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (mediaType === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image);
    }
  }, [mediaType, entry.link, entry.title, entry.image, playTrack]);

  const handleOpenCommentDrawer = useCallback(() => {
    onOpenCommentDrawer(entry.guid, entry.feedUrl, initialData.comments);
  }, [entry.guid, entry.feedUrl, initialData.comments, onOpenCommentDrawer]);

  // Memoize the formatted date to prevent recalculation
  const formattedDate = useMemo(() => {
    try {
      return format(new Date(entry.pubDate), 'PPP p');
    } catch (e) {
      return '';
    }
  }, [entry.pubDate]);

  return (
    <article>
      <div className="p-4">
        <div className="flex items-center gap-4 mb-4">
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
            <div className="w-full">
              {postTitle && (
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-2 mt-[2.5px]">
                    {postTitle}
                    {verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                  </h3>
                  <span 
                    className="text-[15px] leading-none text-muted-foreground flex-shrink-0 mt-[5px]"
                    title={formattedDate}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {mediaType && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium rounded-lg">
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
          <div onClick={handleOpenCommentDrawer}>
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              initialData={initialData.comments}
              buttonOnly={true}
              setIsOpen={undefined}
              isOpen={undefined}
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
}, arePropsEqual); // Apply custom equality function

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
  verified?: boolean;
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
}

// Custom equality function for FeedContent
const areFeedContentPropsEqual = (prevProps: FeedContentProps, nextProps: FeedContentProps) => {
  // Simple length check 
  if (prevProps.entries.length !== nextProps.entries.length) {
    return false;
  }
  
  // Check if hasMore or isPending changed
  if (prevProps.hasMore !== nextProps.hasMore || 
      prevProps.isPending !== nextProps.isPending ||
      prevProps.featuredImg !== nextProps.featuredImg ||
      prevProps.postTitle !== nextProps.postTitle ||
      prevProps.mediaType !== nextProps.mediaType ||
      prevProps.verified !== nextProps.verified) {
    return false;
  }
  
  // Deep comparison not needed for most cases since entries are typically just appended
  // and we already checked the length
  
  return true;
};

// Extract EmptyState as a separate component instead of inline JSX in useMemo
const EmptyState = () => (
  <div className="text-center py-8 text-muted-foreground">
    No entries found for this feed.
  </div>
);
EmptyState.displayName = 'EmptyState';

// Create a separate Footer component
const LoadingFooter = ({ loadMoreRef, isPending, hasMore }: { 
  loadMoreRef: React.RefObject<HTMLDivElement>, 
  isPending: boolean, 
  hasMore: boolean 
}) => {
  if (isPending && hasMore) {
    return (
      <div ref={loadMoreRef} className="text-center py-10">
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      </div>
    );
  }
  return <div ref={loadMoreRef} className="h-0" />;
};
LoadingFooter.displayName = 'LoadingFooter';

// Memoize the FeedContent component to prevent unnecessary re-renders
const FeedContent = React.memo(function FeedContent({
  entries,
  hasMore,
  loadMoreRef,
  isPending,
  loadMore,
  featuredImg,
  postTitle,
  mediaType,
  verified,
  onOpenCommentDrawer
}: FeedContentProps) {
  // Memoize the endReached callback
  const handleEndReached = useCallback(() => {
    if (hasMore && !isPending) {
      console.log('🔄 Loading more entries...');
      loadMore();
    }
  }, [hasMore, isPending, loadMore]);
  
  // Memoize the renderItem function to prevent recreation on every render
  const renderItem = useCallback((index: number) => {
    if (!entries || index >= entries.length) {
      return null;
    }
    const entryData = entries[index];
    return (
      <RSSEntry 
        key={entryData.entry.guid} 
        entryWithData={entryData} 
        featuredImg={featuredImg}
        postTitle={postTitle}
        mediaType={mediaType}
        verified={verified}
        onOpenCommentDrawer={onOpenCommentDrawer}
      />
    );
  }, [entries, featuredImg, postTitle, mediaType, verified, onOpenCommentDrawer]);

  // Create a stable reference to the footer component props
  const footerProps = useMemo(() => ({
    loadMoreRef,
    isPending,
    hasMore
  }), [loadMoreRef, isPending, hasMore]);

  return (
    <div className="space-y-0">
      {entries.length === 0 ? <EmptyState /> : (
        <Virtuoso
          useWindowScroll
          totalCount={entries.length}
          overscan={20}
          endReached={handleEndReached}
          initialTopMostItemIndex={0}
          itemContent={renderItem}
          components={{
            Footer: () => <LoadingFooter {...footerProps} />
          }}
        />
      )}
    </div>
  );
}, areFeedContentPropsEqual); // Apply custom equality function

// Add displayName for easier debugging
FeedContent.displayName = 'FeedContent';

interface RSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries: number;
    hasMore: boolean;
    searchQuery?: string;
  };
  pageSize?: number;
  featuredImg?: string;
  mediaType?: string;
  isActive?: boolean;
  verified?: boolean;
}

export function RSSFeedClient({ postTitle, feedUrl, initialData, pageSize = 30, featuredImg, mediaType, isActive = true, verified }: RSSFeedClientProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  
  // Don't memoize simple values
  const ITEMS_PER_REQUEST = pageSize;
  
  // Track all entries manually
  const [allEntriesState, setAllEntriesState] = useState<RSSEntryWithData[]>(initialData.entries || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreState, setHasMoreState] = useState(initialData.hasMore || false);
  
  // --- Drawer state for comments ---
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCommentEntry, setSelectedCommentEntry] = useState<{
    entryGuid: string;
    feedUrl: string;
    initialData?: { count: number };
  } | null>(null);

  // Callback to open the comment drawer for a given entry
  const handleOpenCommentDrawer = useCallback((entryGuid: string, feedUrl: string, initialData?: { count: number }) => {
    setSelectedCommentEntry({ entryGuid, feedUrl, initialData });
    setCommentDrawerOpen(true);
  }, []);
  
  // Debug log the initial data
  useEffect(() => {
    if (initialData) {
      console.log('📋 Initial data received in client:', {
        entriesCount: initialData.entries?.length || 0,
        hasMore: initialData.hasMore,
        totalEntries: initialData.totalEntries,
        searchQuery: initialData.searchQuery
      });
      
      // Always reset state completely when initialData changes (including when search changes)
      // This ensures pagination works correctly after search state changes
      setAllEntriesState(initialData.entries || []);
      setCurrentPage(1);
      setHasMoreState(initialData.hasMore || false);
      setIsLoading(false);
    }
  }, [initialData]);
  
  // Create stable reference for URL parameters using useMemo
  const urlParams = useMemo(() => ({
    postTitle,
    feedUrl,
    pageSize: ITEMS_PER_REQUEST,
    totalEntries: initialData.totalEntries,
    searchQuery: initialData.searchQuery,
    mediaType
  }), [postTitle, feedUrl, ITEMS_PER_REQUEST, initialData.totalEntries, initialData.searchQuery, mediaType]);
  
  // Memoize URL creation for API requests with stable params reference
  const createApiUrl = useCallback((nextPage: number) => {
    const { postTitle, feedUrl, pageSize, totalEntries, searchQuery, mediaType } = urlParams;
    
    const baseUrl = new URL(`/api/rss/${encodeURIComponent(postTitle)}`, window.location.origin);
    baseUrl.searchParams.set('feedUrl', encodeURIComponent(feedUrl));
    baseUrl.searchParams.set('page', nextPage.toString());
    baseUrl.searchParams.set('pageSize', pageSize.toString());
    
    // Pass the cached total entries to avoid unnecessary COUNT queries
    if (totalEntries) {
      baseUrl.searchParams.set('totalEntries', totalEntries.toString());
    }
    
    if (mediaType) {
      baseUrl.searchParams.set('mediaType', encodeURIComponent(mediaType));
    }
    
    // Pass search query if it exists
    if (searchQuery) {
      baseUrl.searchParams.set('q', encodeURIComponent(searchQuery));
    }
    
    return baseUrl.toString();
  }, [urlParams]);
  
  // Create stable reference for entry transformation parameters
  const transformParams = useMemo(() => ({
    postTitle,
    featuredImg,
    mediaType
  }), [postTitle, featuredImg, mediaType]);
  
  // Memoize the transform function for API entries with stable params
  const transformApiEntries = useCallback((apiEntries: APIRSSEntry[]) => {
    const { postTitle, featuredImg, mediaType } = transformParams;
    
    return apiEntries
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
  }, [transformParams]);
  
  // Create stable reference for loading dependencies
  const loadingDeps = useMemo(() => ({
    isActive,
    isLoading, 
    hasMoreState,
    currentPage,
    createApiUrl,
    transformApiEntries
  }), [isActive, isLoading, hasMoreState, currentPage, createApiUrl, transformApiEntries]);
  
  const loadMoreEntries = useCallback(async () => {
    const { isActive, isLoading, hasMoreState, currentPage, createApiUrl, transformApiEntries } = loadingDeps;
    
    if (!isActive || isLoading || !hasMoreState) {
      console.log(`⚠️ Not loading more: isLoading=${isLoading}, hasMoreState=${hasMoreState}`);
      return;
    }
    
    setIsLoading(true);
    const nextPage = currentPage + 1;
    
    try {
      const apiUrl = createApiUrl(nextPage);
      console.log(`📡 Fetching page ${nextPage} from API`);
      
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      console.log(`📦 Received data from API - entries: ${data.entries?.length || 0}, hasMore: ${data.hasMore}, total: ${data.totalEntries}`);
      
      if (!data.entries?.length) {
        console.log('⚠️ No entries returned from API');
        setIsLoading(false);
        return;
      }
      
      const transformedEntries = transformApiEntries(data.entries);
      console.log(`✅ Transformed ${transformedEntries.length} entries`);
      
      setAllEntriesState(prev => [...prev, ...transformedEntries]);
      setCurrentPage(nextPage);
      setHasMoreState(data.hasMore);
      
    } catch (error) {
      console.error('❌ Error loading more entries:', error);
      setFetchError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [loadingDeps]);
  
  // Extract all entry GUIDs for metrics query
  const entryGuids = useMemo(() => 
    allEntriesState.map(entry => entry.entry.guid),
    [allEntriesState]
  );
  
  // Create stable feedUrlArray for query
  const feedUrlArray = useMemo(() => [feedUrl], [feedUrl]);
  
  // Use the combined query to fetch data, avoiding object literal in conditional
  const queryEnabled = entryGuids.length > 0;
  const queryArgs = useMemo(() => 
    queryEnabled ? { entryGuids, feedUrls: feedUrlArray } : "skip",
    [queryEnabled, entryGuids, feedUrlArray]
  );
  
  // Query data with proper memoization and stable arguments
  const combinedData = useQuery(api.entries.getFeedDataWithMetrics, queryArgs);
  
  // Extract metrics from combined data with memoization
  const entryMetricsMap = useMemo(() => {
    if (!combinedData?.entryMetrics) return null;
    return Object.fromEntries(
      combinedData.entryMetrics.map(item => [item.guid, item.metrics])
    );
  }, [combinedData]);
  
  // Extract post metadata from combined data with memoization
  const postMetadata = useMemo(() => {
    if (!combinedData?.postMetadata || combinedData.postMetadata.length === 0) return null;
    
    // The feedUrl is unique in this context, so we can safely use the first item
    const metadataItem = combinedData.postMetadata.find(item => item.feedUrl === feedUrl);
    return metadataItem?.metadata || null;
  }, [combinedData, feedUrl]);
  
  // Apply metrics to entries with memoization
  const enhancedEntries = useMemo(() => {
    if (!allEntriesState.length) return allEntriesState;
    
    if (!entryMetricsMap) return allEntriesState;
    
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
  
  // Create stable reference for height check dependencies
  const heightCheckDeps = useMemo(() => ({
    hasMoreState,
    isLoading,
    allEntriesCount: allEntriesState.length,
    loadMoreEntries
  }), [hasMoreState, isLoading, allEntriesState.length, loadMoreEntries]);
  
  // Memoize the content height check function with stable dependencies
  const checkContentHeight = useCallback(() => {
    const { hasMoreState, isLoading, allEntriesCount, loadMoreEntries } = heightCheckDeps;
    
    if (!loadMoreRef.current || !hasMoreState || isLoading) return;
    
    const viewportHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    
    // If the document is shorter than the viewport, load more
    if (documentHeight <= viewportHeight && allEntriesCount > 0) {
      console.log('📏 Content is shorter than viewport, loading more entries');
      loadMoreEntries();
    }
  }, [heightCheckDeps, loadMoreRef]);
  
  // Add a useEffect to check if we need to load more when the component is mounted
  useEffect(() => {
    // Run the check after a short delay to ensure the DOM has updated
    const timer = setTimeout(checkContentHeight, 1000);
    return () => clearTimeout(timer);
  }, [checkContentHeight]);
  
  // Create error UI as a separate component function rather than using useMemo
  const ErrorUI = () => (
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
  
  if (fetchError) {
    return <ErrorUI />;
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
        verified={verified}
        onOpenCommentDrawer={handleOpenCommentDrawer}
      />
      {/* Single global comment drawer */}
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
}

// Memoize the RSSFeedClient component for better performance when used in parent components
const MemoizedRSSFeedClient = React.memo(RSSFeedClient);
MemoizedRSSFeedClient.displayName = "MemoizedRSSFeedClient";

// Export the memoized component with error boundary
export function RSSFeedClientWithErrorBoundary(props: RSSFeedClientProps) {
  return (
    <ErrorBoundary>
      <MemoizedRSSFeedClient {...props} />
    </ErrorBoundary>
  );
}