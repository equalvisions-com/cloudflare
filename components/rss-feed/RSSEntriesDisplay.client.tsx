'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';
import { Podcast, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Virtuoso } from 'react-virtuoso';
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";

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

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
}

// Memoize the RSSEntry component to prevent unnecessary re-renders
const RSSEntry = React.memo(({ entryWithData: { entry, initialData, postMetadata }, onOpenCommentDrawer }: RSSEntryProps & { onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void }) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Format the timestamp based on age
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
  }, [entry.pubDate]);

  // Ensure we have valid postMetadata
  const safePostMetadata = useMemo(() => {
    // Use type assertion to access feedTitle
    const feedTitle = entry.feedTitle || '';
    
    return {
      title: postMetadata?.title || feedTitle,
      featuredImg: postMetadata?.featuredImg || entry.image || '',
      mediaType: postMetadata?.mediaType || 'article',
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

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (safePostMetadata.mediaType === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image || undefined);
    }
  }, [safePostMetadata.mediaType, entry.link, entry.title, entry.image, playTrack]);

  return (
    <article>
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-center gap-4 mb-4">
          {/* Featured Image */}
          {safePostMetadata.featuredImg && postUrl && (
            <Link href={postUrl} className="flex-shrink-0 w-12 h-12 relative rounded-md overflow-hidden hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={safePostMetadata.featuredImg}
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
              {safePostMetadata.title && (
                <div className="flex items-start justify-between gap-2">
                  {postUrl ? (
                    <Link href={postUrl} className="hover:opacity-80 transition-opacity">
                      <h3 className="text-[15px] font-bold text-primary leading-tight line-clamp-1 mt-[2.5px]">
                        {safePostMetadata.title}
                        {safePostMetadata.verified && <VerifiedBadge className="inline-block align-middle ml-1" />}
                      </h3>
                    </Link>
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
        
        {/* Horizontal Interaction Buttons */}
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
          <div onClick={() => onOpenCommentDrawer(entry.guid, entry.feedUrl, initialData.comments)}>
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              initialData={initialData.comments}
              buttonOnly={true}
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
      
      {/* Comments Section */}
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
});
RSSEntry.displayName = 'RSSEntry';

interface RSSEntriesClientProps {
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
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
  postMetadata?: Map<string, any>;
  initialData: {
    entries: RSSEntryWithData[];
    totalEntries?: number;
    hasMore?: boolean;
    postTitles?: string[];
  };
  onOpenCommentDrawer: (entryGuid: string, feedUrl: string, initialData?: { count: number }) => void;
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
  onOpenCommentDrawer
}: EntriesContentProps) {
  // Debug logging for pagination
  useEffect(() => {
    logger.debug(`📊 EntriesContent rendered with ${paginatedEntries.length} entries, hasMore: ${hasMore}, isPending: ${isPending}`);
  }, [paginatedEntries.length, hasMore, isPending]);
  
  // Define the renderItem callback outside of any conditionals
  const renderItem = useCallback((index: number) => {
    if (!paginatedEntries || index >= paginatedEntries.length) {
      return null;
    }

    const entryWithData = paginatedEntries[index];
    
    // Use metrics from Convex query if available
    if (entryMetrics && entryWithData.entry.guid in entryMetrics) {
      entryWithData.initialData = entryMetrics[entryWithData.entry.guid];
    }
    
    // Use metadata from Convex query if available
    if (postMetadata && postMetadata.has(entryWithData.entry.feedUrl)) {
      const metadata = postMetadata.get(entryWithData.entry.feedUrl);
      if (metadata) {
        entryWithData.postMetadata = {
          ...entryWithData.postMetadata,
          ...metadata
        };
      }
    }
    
    return (
      <RSSEntry key={entryWithData.entry.guid} entryWithData={entryWithData} onOpenCommentDrawer={onOpenCommentDrawer} />
    );
  }, [paginatedEntries, entryMetrics, postMetadata, onOpenCommentDrawer]);
  
  if (paginatedEntries.length === 0) {
    return (
      <div className="flex justify-center items-center py-10">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
    );
  }

  return (
    <div className="space-y-0">
      <Virtuoso
        useWindowScroll
        totalCount={paginatedEntries.length}
        endReached={() => {
          logger.debug(`🏁 Virtuoso endReached called, hasMore: ${hasMore}, isPending: ${isPending}, entries: ${paginatedEntries.length}`);
          if (hasMore && !isPending) {
            logger.debug('📥 Virtuoso end reached, loading more entries');
            loadMore();
          } else {
            logger.debug(`⚠️ Not loading more from Virtuoso endReached: hasMore=${hasMore}, isPending=${isPending}`);
          }
        }}
        overscan={20}
        initialTopMostItemIndex={0}
        itemContent={renderItem}
        components={{
          Footer: () => 
            isPending && hasMore ? (
              <div ref={loadMoreRef} className="text-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : <div ref={loadMoreRef} className="h-0" />
        }}
      />
    </div>
  );
}

// Then apply React.memo with correct typing
const EntriesContent = React.memo<EntriesContentProps>(EntriesContentComponent);

// Add displayName to avoid React DevTools issues
EntriesContent.displayName = 'EntriesContent';

export function RSSEntriesClientWithErrorBoundary(props: RSSEntriesClientProps) {
  return (
    <ErrorBoundary>
      <RSSEntriesClient {...props} />
    </ErrorBoundary>
  );
}

export function RSSEntriesClient({ 
  initialData, 
  pageSize = 30, 
  isActive = true
}: RSSEntriesClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Track errors for better error handling
  const [fetchError, setFetchError] = useState<Error | null>(null);
  
  // Use a fixed number of items per request for consistency
  const ITEMS_PER_REQUEST = pageSize;
  
  // Track all entries manually
  const [allEntriesState, setAllEntriesState] = useState<RSSEntryWithData[]>(initialData?.entries || []);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreState, setHasMoreState] = useState(initialData?.hasMore || false);
  
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
    logger.debug('Initial data received in client:', {
      entriesCount: initialData?.entries?.length || 0,
      postTitles: initialData?.postTitles || [],
      hasMore: initialData?.hasMore,
      totalEntries: initialData?.totalEntries
    });
    
    // Log to confirm we're using prefetched data from LayoutManager
    console.log('RSSEntriesClient: Using prefetched data from LayoutManager', {
      entriesCount: initialData?.entries?.length || 0
    });
    
    // Initialize state with initial data, using fallbacks for null/undefined
    setAllEntriesState(initialData?.entries || []);
    setHasMoreState(initialData?.hasMore || false);
    // Reset page number if initialData changes (e.g., on error recovery)
    if (initialData) { // Only reset page if we actually get new initial data
        setCurrentPage(1);
    }
  }, [initialData]);
  
  // Function to load more entries directly
  const loadMoreEntries = useCallback(async () => {
    // Only load more if the tab is active and not already loading/no more data
    if (!isActive || isLoading || !hasMoreState) { 
      logger.debug(`⚠️ Not loading more: isLoading=${isLoading}, hasMoreState=${hasMoreState}`);
      return;
    }
    
    setIsLoading(true);
    logger.debug(`📥 Loading more entries, current page: ${currentPage}, next page: ${currentPage + 1}`);
    
    try {
      // Extract post titles from the initial data
      let postTitlesParam = '';
      if (initialData?.postTitles && initialData.postTitles.length > 0) {
        postTitlesParam = JSON.stringify(initialData.postTitles);
      } else if (initialData?.entries && initialData.entries.length > 0) {
        // Extract unique post titles from entries
        const feedTitles = [...new Set(
          initialData.entries
            .filter((entry: RSSEntryWithData) => entry && entry.postMetadata && entry.postMetadata.title)
            .map((entry: RSSEntryWithData) => entry.postMetadata.title)
        )];
        
        if (feedTitles.length > 0) {
          postTitlesParam = JSON.stringify(feedTitles);
        }
      }
      
      // Make a direct fetch to the API
      const baseUrl = new URL('/api/rss/paginate', window.location.origin);
      const nextPage = currentPage + 1;
      baseUrl.searchParams.set('page', nextPage.toString());
      baseUrl.searchParams.set('pageSize', ITEMS_PER_REQUEST.toString());
      baseUrl.searchParams.set('postTitles', postTitlesParam);
      
      // Pass the total entries to avoid unnecessary COUNT queries on the server
      if (initialData?.totalEntries) {
        baseUrl.searchParams.set('totalEntries', initialData.totalEntries.toString());
        logger.debug(`📊 Passing cached totalEntries: ${initialData.totalEntries}`);
      }
      
      logger.debug(`📡 Fetching page ${nextPage} from API: ${baseUrl.toString()}`);
      
      const response = await fetch(baseUrl.toString());
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      logger.debug(`📦 Received data from API:`, {
        entriesCount: data.entries?.length || 0,
        hasMore: data.hasMore,
        totalEntries: data.totalEntries
      });
      
      // Transform the entries to match the expected format
      const transformedEntries = data.entries
        .filter(Boolean)
        .map((entry: RSSItem) => {
          // Helper function to find post metadata from initialData based on feedUrl
          const findPostMetadataFromInitialData = (feedUrl: string) => {
            if (!initialData || !initialData.entries || initialData.entries.length === 0) {
              return null;
            }
            
            // Find an entry with the same feedUrl in initialData
            const matchingEntry = initialData.entries.find(
              entry => entry && entry.entry && entry.entry.feedUrl === feedUrl
            );
            
            if (matchingEntry && matchingEntry.postMetadata) {
              return matchingEntry.postMetadata;
            }
            
            return null;
          };
          
          // If it's a direct RSS item, wrap it with proper metadata
          if (entry && 'guid' in entry && entry.guid) {
            // Try to find post metadata from initialData based on feedUrl
            const feedUrl = 'feedUrl' in entry ? entry.feedUrl : '';
            const existingMetadata = feedUrl ? findPostMetadataFromInitialData(feedUrl) : null;
            
            // Get title directly
            const entryTitle = entry.title || '';
            // Get feed title if available
            const feedTitle = entry.feedTitle || '';
            
            return {
              entry: entry,
              initialData: {
                likes: { isLiked: false, count: 0 },
                comments: { count: 0 },
                retweets: { isRetweeted: false, count: 0 },
                bookmarks: { isBookmarked: false }
              },
              postMetadata: existingMetadata || {
                title: feedTitle || entryTitle || '',
                featuredImg: entry.image || '',
                mediaType: entry.mediaType || 'article',
                categorySlug: '',
                postSlug: '',
                verified: false // Default verified to false
              }
            } as RSSEntryWithData;
          }
          
          return null;
        })
        .filter(Boolean) as RSSEntryWithData[];
      
      logger.debug(`✅ Transformed ${transformedEntries.length} entries`);
      
      // Update state with new entries
      setAllEntriesState(prevEntries => [...prevEntries, ...transformedEntries]);
      setCurrentPage(nextPage);
      setHasMoreState(data.hasMore);
      
    } catch (error) {
      logger.error('❌ Error loading more entries:', error);
      setFetchError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, hasMoreState, initialData, isLoading, ITEMS_PER_REQUEST, isActive]);
  
  // Extract all entry GUIDs for metrics query
  const entryGuids = useMemo(() => {
    return allEntriesState
      .filter((entry: RSSEntryWithData) => entry && entry.entry && entry.entry.guid)
      .map((entry: RSSEntryWithData) => entry.entry.guid);
  }, [allEntriesState]);
  
  // Extract unique feed URLs for metadata query
  const feedUrls = useMemo(() => {
    return [...new Set(
      allEntriesState
        .filter((entry: RSSEntryWithData) => entry && entry.entry && entry.entry.feedUrl)
        .map((entry: RSSEntryWithData) => entry.entry.feedUrl)
    )];
  }, [allEntriesState]);
  
  // Use the combined query to fetch entry metrics - ONLY IF ACTIVE
  const combinedData = useQuery(
    api.entries.getFeedDataWithMetrics,
    isActive && entryGuids.length > 0 ? { entryGuids, feedUrls } : "skip"
  );
  
  // Create a map for metrics lookups
  const metricsMap = useMemo(() => {
    if (!combinedData) return new Map();
    
    return new Map(
      combinedData.entryMetrics.map(item => [item.guid, item.metrics])
    );
  }, [combinedData]);
  
  // Create a map for post metadata lookups
  const postMetadataMap = useMemo(() => {
    if (!combinedData || !combinedData.postMetadata) return new Map<string, InternalPostMetadata>();

    return new Map<string, InternalPostMetadata>(
      combinedData.postMetadata.map(item => [item.feedUrl, item.metadata])
    );
  }, [combinedData]);
  
  // Get entry metrics map for use in rendering
  const entryMetricsMap = useMemo(() => {
    if (metricsMap.size === 0) return null;
    
    // Convert the map to a simple object for easier use in components
    const metricsObject: Record<string, EntryMetrics> = {};
    metricsMap.forEach((metrics, guid) => {
      metricsObject[guid] = metrics;
    });
    
    return metricsObject;
  }, [metricsMap]);
  
  // Display error message if there's an error
  if (fetchError) {
    const errorMessage = fetchError.message || 'Error loading entries';
    logger.error('Feed loading error', { message: errorMessage });
    
    return (
      <div className="text-center py-8 text-destructive">
        <p className="mb-4">{errorMessage}</p>
        <Button 
          variant="outline" 
          onClick={() => {
            setFetchError(null);
            setAllEntriesState(initialData?.entries || []);
            setCurrentPage(1);
            setHasMoreState(initialData?.hasMore || false);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }
  
  // Return the EntriesContent directly
  return (
    <div className="w-full">
      <EntriesContent
        paginatedEntries={allEntriesState}
        hasMore={hasMoreState}
        loadMoreRef={loadMoreRef}
        isPending={isLoading}
        loadMore={loadMoreEntries}
        entryMetrics={entryMetricsMap}
        postMetadata={postMetadataMap}
        initialData={initialData}
        onOpenCommentDrawer={handleOpenCommentDrawer}
      />
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

// Interface for post metadata used within the component
interface InternalPostMetadata {
  title: string;
  featuredImg?: string;
  mediaType?: string;
  categorySlug?: string;
  postSlug?: string;
  verified?: boolean;
} 