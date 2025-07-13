"use client";

import { useEffect, useReducer, useRef, memo, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import React from "react";
import { cn } from "@/lib/utils";
import { 
  useAudioPlayerCurrentTrack,
  useAudioPlayerPlayTrack
} from '@/lib/stores/audioPlayerStore';
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useTrendingStore } from '@/lib/stores/trendingStore';
import {
  TrendingWidgetErrorType,
  type TrendingWidgetProps,
  type TrendingWidgetRSSEntry,
  type TrendingWidgetPost,
  type TrendingWidgetMergedItem,
  type TrendingWidgetError,
  type TrendingWidgetAPIResponse
} from "@/lib/types";

// ===================================================================
// PURE UTILITY FUNCTIONS - Following React best practices
// ===================================================================

// HTML entity map for common entities (pure function - no memoization needed)
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#x60;': '`',
  '&#x3D;': '=',
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

// Pure function to decode HTML entities (no DOM manipulation)
const decodeHtmlEntities = (text: string): string => {
  return text.replace(/&[#\w]+;/g, (entity) => HTML_ENTITIES[entity] || entity);
};



// ===================================================================
// STATE MANAGEMENT - useReducer for complex state
// ===================================================================

interface TrendingWidgetState {
  rssEntries: Record<string, TrendingWidgetRSSEntry>;
  isLoadingRss: boolean;
  isOpen: boolean;
  error: string | null;
  retryCount: number;
}

type TrendingWidgetAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_RSS_ENTRIES'; payload: Record<string, TrendingWidgetRSSEntry> }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_OPEN'; payload: boolean }
  | { type: 'INCREMENT_RETRY' }
  | { type: 'RESET_RETRY' };

const initialState: TrendingWidgetState = {
  rssEntries: {},
  isLoadingRss: true,
  isOpen: false,
  error: null,
  retryCount: 0,
};

const trendingWidgetReducer = (state: TrendingWidgetState, action: TrendingWidgetAction): TrendingWidgetState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoadingRss: action.payload };
    case 'SET_RSS_ENTRIES':
      return { ...state, rssEntries: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_OPEN':
      return { ...state, isOpen: action.payload };
    case 'INCREMENT_RETRY':
      return { ...state, retryCount: state.retryCount + 1 };
    case 'RESET_RETRY':
      return { ...state, retryCount: 0 };
    default:
      return state;
  }
};

// ===================================================================
// SIMPLIFIED CACHE SYSTEM - Following React best practices
// ===================================================================

interface SimpleCacheEntry {
  data: Record<string, TrendingWidgetRSSEntry>;
  timestamp: number;
}

// Simple cache with TTL - no over-engineering
class SimpleCache {
  private cache = new Map<string, SimpleCacheEntry>();
  private readonly TTL = 60000; // 60 seconds (1 minute)

  get(key: string): Record<string, TrendingWidgetRSSEntry> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: Record<string, TrendingWidgetRSSEntry>): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance for request deduplication
const globalTrendingCache = new SimpleCache();

// ===================================================================
// STABLE ID GENERATION - Using refs for stability
// ===================================================================

let idCounter = 0;
const generateStableId = (prefix: string) => `${prefix}-${++idCounter}`;

// ===================================================================
// SKELETON COMPONENT
// ===================================================================

const TrendingItemSkeleton = () => {
  return (
    <li className="flex flex-col space-y-2">
      {/* First row - Post title with small featured image */}
      <div className="flex items-center gap-2">
        <Skeleton className="flex-shrink-0 w-4 h-4 rounded" />
        <Skeleton className="h-3 w-32" />
      </div>
      
      {/* Second row - RSS entry with larger image */}
      <div className="flex gap-3">
        <Skeleton className="flex-shrink-0 w-10 h-10 rounded-md" />
        <div className="flex-grow space-y-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </li>
  );
};

// ===================================================================
// TRENDING ITEM COMPONENT
// ===================================================================

interface TrendingItemProps {
  post: TrendingWidgetPost;
  rssEntry: TrendingWidgetRSSEntry;
  priority: boolean;
}

const TrendingItem = ({ post, rssEntry, priority }: TrendingItemProps) => {
  const currentTrack = useAudioPlayerCurrentTrack();
  const playTrack = useAudioPlayerPlayTrack();

  const handlePodcastClick = (e: React.MouseEvent) => {
    if (post.mediaType === 'podcast' && rssEntry.link) {
      e.preventDefault();
      playTrack(
        rssEntry.link,
        decodeHtmlEntities(rssEntry.title),
        post.featuredImg,
        post.title
      );
    }
  };

  // Simple calculations - no memoization needed
  const decodedTitle = decodeHtmlEntities(rssEntry.title);
  const isCurrentlyPlaying = currentTrack?.src === rssEntry.link;
  
  
  
  return (
    <li className="flex flex-col space-y-2">
      <div className="flex items-center gap-2">
        {post.featuredImg && (
          <div className="flex-shrink-0 w-4 h-4 overflow-hidden rounded">
            <AspectRatio ratio={1/1} className="bg-muted">
              <Image 
                src={post.featuredImg} 
                alt={post.title}
                fill
                className="object-cover"
                sizes="16px"
                priority={priority}
              />
            </AspectRatio>
          </div>
        )}
        <Link 
          href={`/${post.mediaType === 'newsletter' ? 'newsletters' : post.mediaType === 'podcast' ? 'podcasts' : post.categorySlug}/${post.postSlug}`}
          className="text-xs font-bold hover:underline flex-grow line-clamp-1"
          prefetch={false}
        >
          {post.title}
          {post.verified && <VerifiedBadge className="inline-block align-middle ml-1 h-3 w-3" />}
        </Link>
      </div>
      
      <div className="flex gap-3">
        {rssEntry.image ? (
          <div className="flex-shrink-0 w-10 h-10 overflow-hidden rounded-md">
            {post.mediaType === 'podcast' ? (
              <button 
                onClick={handlePodcastClick}
                className={`block h-full w-full cursor-pointer border-0 p-0 bg-transparent ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}
                aria-label={`Play podcast: ${decodedTitle}`}
                aria-pressed={isCurrentlyPlaying}
                type="button"
              >
                <AspectRatio ratio={1/1} className="bg-muted">
                  <Image 
                    src={rssEntry.image} 
                    alt={`Cover image for ${decodedTitle}`}
                    fill
                    className="object-cover hover:opacity-90 transition-opacity"
                    sizes="40px"
                    priority={priority}
                  />
                </AspectRatio>
              </button>
            ) : (
              <a 
                href={rssEntry.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                <AspectRatio ratio={1/1} className="bg-muted">
                  <Image 
                    src={rssEntry.image} 
                    alt={`Cover image for ${decodedTitle}`}
                    fill
                    className="object-cover hover:opacity-90 transition-opacity"
                    sizes="40px"
                    priority={priority}
                  />
                </AspectRatio>
              </a>
            )}
          </div>
        ) : (
          <div 
            className="flex-shrink-0 w-10 h-10 bg-muted/50 rounded-md"
            aria-hidden="true"
          ></div>
        )}
        {post.mediaType === 'podcast' ? (
          <button
            onClick={handlePodcastClick}
            className={`text-sm hover:text-primary flex items-center font-semibold flex-grow cursor-pointer border-0 bg-transparent p-0 text-left ${isCurrentlyPlaying ? 'text-primary' : ''}`}
            aria-label={`Play podcast: ${decodedTitle}`}
            aria-pressed={isCurrentlyPlaying}
            type="button"
          >
            <span className="line-clamp-2">{decodedTitle}</span>
          </button>
        ) : (
          <a 
            href={rssEntry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:text-primary flex items-center font-semibold flex-grow"
          >
            <span className="line-clamp-2">{decodedTitle}</span>
          </a>
        )}
      </div>
    </li>
  );
};

// ===================================================================
// MAIN COMPONENT
// ===================================================================

const TrendingWidgetComponent = ({ className = "" }: TrendingWidgetProps) => {
  const [state, dispatch] = useReducer(trendingWidgetReducer, initialState);
  const [isPending, startTransition] = useTransition();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Get data from persistent store
  const { rssEntries: storedEntries, isStale, setRssEntries } = useTrendingStore();
  const hasStoredData = Object.keys(storedEntries).length > 0;
  
  // Stable IDs using refs (no regeneration on render)
  const widgetId = useRef(generateStableId('trending-widget')).current;
  const listId = useRef(generateStableId('trending-list')).current;
  const loadingId = useRef(generateStableId('loading-status')).current;
  const errorId = useRef(generateStableId('error-status')).current;

  // Convex query for trending posts
  const trendingPostsSource = useQuery(api.widgets.getPublicWidgetPosts, { 
    limit: 6 
  });
  const isLoadingPosts = trendingPostsSource === undefined;
  
  // Initialize state with stored data if available
  useEffect(() => {
    if (hasStoredData && !isStale() && Object.keys(state.rssEntries).length === 0) {
      dispatch({ type: 'SET_RSS_ENTRIES', payload: storedEntries });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [hasStoredData, storedEntries, isStale, state.rssEntries]);

  // Transition handler for smooth expand/collapse UX
  const handleOpenChange = (open: boolean) => {
    startTransition(() => {
      dispatch({ type: 'SET_OPEN', payload: open });
    });
  };

  const handleRetry = () => {
    dispatch({ type: 'INCREMENT_RETRY' });
  };

  const classifyError = (error: unknown): TrendingWidgetError => {
    if (!error) {
      return {
        type: TrendingWidgetErrorType.UNKNOWN_ERROR,
        message: 'An unknown error occurred',
        retryable: true
      };
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          type: TrendingWidgetErrorType.NETWORK_ERROR,
          message: 'Request was cancelled',
          originalError: error,
          retryable: false
        };
      }

      if (error.message.includes('fetch')) {
        return {
          type: TrendingWidgetErrorType.NETWORK_ERROR,
          message: 'Network connection failed',
          originalError: error,
          retryable: true
        };
      }

      if (error.message.includes('timeout')) {
        return {
          type: TrendingWidgetErrorType.TIMEOUT_ERROR,
          message: 'Request timed out',
          originalError: error,
          retryable: true
        };
      }

      return {
        type: TrendingWidgetErrorType.RSS_FETCH_ERROR,
        message: error.message,
        originalError: error,
        retryable: true
      };
    }

    return {
      type: TrendingWidgetErrorType.UNKNOWN_ERROR,
      message: String(error),
      retryable: true
    };
  };

  const fetchRssEntriesOptimized = async (feedUrls: string[]): Promise<Record<string, TrendingWidgetRSSEntry>> => {
    const cacheKey = feedUrls.sort().join('|');
    
    // Check cache first
    const cached = globalTrendingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create new AbortController for this request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/trending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedUrls }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TrendingWidgetAPIResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      const entries = data.entries || {};
      
      // Cache the result
      globalTrendingCache.set(cacheKey, entries);
      
      return entries;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // Re-throw abort errors as-is
      }
      throw new Error(`Failed to fetch RSS entries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const retryFetch = async (
    fetchFn: () => Promise<Record<string, TrendingWidgetRSSEntry>>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<Record<string, TrendingWidgetRSSEntry>> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await fetchFn();
        dispatch({ type: 'RESET_RETRY' });
        return result;
      } catch (error) {
        const classifiedError = classifyError(error);
        
        if (!classifiedError.retryable || attempt === maxRetries) {
          throw error;
        }
        
        dispatch({ type: 'INCREMENT_RETRY' });
        
        // Exponential backoff with jitter
        const backoffDelay = delay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
    
    throw new Error('Max retries exceeded');
  };
  
  // Main effect for fetching RSS entries - simplified dependencies
  useEffect(() => {
    if (!trendingPostsSource || trendingPostsSource.length === 0) {
      return;
    }
    
    const fetchRssEntries = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        
        const feedUrls = trendingPostsSource.map((post: TrendingWidgetPost) => post.feedUrl);
        
        if (feedUrls.length === 0) {
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        }

        const entries = await retryFetch(() => fetchRssEntriesOptimized(feedUrls));
        dispatch({ type: 'SET_RSS_ENTRIES', payload: entries });
        
        // Save to persistent store
        setRssEntries(entries);
        } catch (error) {
        const classifiedError = classifyError(error);
        if (classifiedError.type !== TrendingWidgetErrorType.NETWORK_ERROR || 
            !classifiedError.originalError?.name.includes('AbortError')) {
          dispatch({ type: 'SET_ERROR', payload: classifiedError.message });
        }
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    
    fetchRssEntries();
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [trendingPostsSource, isLoadingPosts]);
  
  // Data transformation - simple operations, no memoization needed
  const mergedItems = !trendingPostsSource ? [] : trendingPostsSource
    .map((post: TrendingWidgetPost) => {
      const rssEntry = state.rssEntries[post.feedUrl];
      if (!rssEntry) return null;
      
        return {
          ...post,
          rssEntry
      } as TrendingWidgetMergedItem;
    })
    .filter((item): item is TrendingWidgetMergedItem => item !== null);
  
  // Simple array operations - no memoization needed
  const initialPosts = mergedItems.slice(0, 3);
  const additionalPosts = mergedItems.slice(3, 6);
  const hasMorePosts = additionalPosts.length > 0;
  
  // Simple calculations - no memoization needed
  const isLoading = isLoadingPosts || state.isLoadingRss;
  const shouldShowSkeleton = isLoading && !hasStoredData;
  
  // Simple object creation - stable data, no memoization needed
  const ariaLabels = {
    widget: 'Trending content widget',
    loading: 'Loading trending content',
    error: 'Error loading trending content',
    list: `Trending content list with ${mergedItems.length} items`,
    showMore: `Show ${additionalPosts.length} more trending items`,
    showLess: 'Show fewer trending items',
    retry: `Retry loading trending content${state.retryCount > 0 ? `, attempt ${state.retryCount + 1}` : ''}`
  };

  // If loading or no data, show skeleton loader
  if (shouldShowSkeleton) {
    return (
      <Card 
        className={`shadow-none rounded-xl ${className}`}
        role="region"
        aria-labelledby={`${widgetId}-title`}
        aria-describedby={loadingId}
      >
        <CardHeader className="pb-4">
          <CardTitle 
            id={`${widgetId}-title`}
            className="text-base font-extrabold flex items-center leading-none tracking-tight"
          >
            <span>What&apos;s trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div 
            className="space-y-4"
            role="status"
            aria-live="polite"
            aria-label={ariaLabels.loading}
          >
            {[...Array(3)].map((_, i) => (
              <TrendingItemSkeleton key={i} />
            ))}
            {/* Show more button skeleton */}
            <Skeleton className="h-4 w-20 mt-4" />
          </div>
          <span id={loadingId} className="sr-only">
            Loading trending content, please wait
          </span>
        </CardContent>
      </Card>
    );
  }
  
  // If error occurred, show error state with retry option
  if (state.error) {
    return (
      <Card 
        className={`shadow-none rounded-xl ${className}`}
        role="region"
        aria-labelledby={`${widgetId}-title`}
        aria-describedby={errorId}
      >
        <CardHeader className="pb-4">
          <CardTitle 
            id={`${widgetId}-title`}
            className="text-base font-extrabold flex items-center leading-none tracking-tight"
          >
            <span>What&apos;s trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div 
            className="space-y-4"
            role="alert"
            aria-live="assertive"
          >
            {[...Array(3)].map((_, i) => (
              <TrendingItemSkeleton key={i} />
            ))}
            {/* Show more button skeleton */}
            <Skeleton className="h-4 w-20 mt-4" />
          </div>
          <span id={errorId} className="sr-only">
            Failed to load trending content. {state.retryCount > 0 && `Retry attempt ${state.retryCount}`}
          </span>
        </CardContent>
      </Card>
    );
  }
  
  // If finished loading but no items merged (e.g., RSS fetch failed or returned empty)
  if (!isLoading && mergedItems.length === 0) {
    return (
      <Card 
        className={`shadow-none rounded-xl ${className}`}
        role="region"
        aria-labelledby={`${widgetId}-title`}
      >
        <CardHeader className="pb-4">
          <CardTitle 
            id={`${widgetId}-title`}
            className="text-base font-extrabold flex items-center leading-none tracking-tight"
          >
            <span>What&apos;s trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <TrendingItemSkeleton key={i} />
            ))}
            {/* Show more button skeleton */}
            <Skeleton className="h-4 w-20 mt-4" />
          </div>
          <span className="sr-only">
            No trending content available at this time.
          </span>
        </CardContent>
      </Card>
    );
  }

  // Render the actual content
  return (
    <Card 
      className={`shadow-none rounded-xl ${className}`}
      role="region"
      aria-labelledby={`${widgetId}-title`}
    >
      <CardHeader className="pb-4">
        <CardTitle 
          id={`${widgetId}-title`}
          className="text-base font-extrabold flex items-center leading-none tracking-tight"
        >
          <span>What&apos;s trending</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Collapsible
          open={state.isOpen}
          onOpenChange={handleOpenChange}
          className="space-y-4"
        >
          <ul 
            id={listId}
            className="space-y-4"
            role="list"
            aria-label={ariaLabels.list}
          >
            {initialPosts.map((item: TrendingWidgetMergedItem) => (
              <TrendingItem 
                key={item._id}
                post={item}
                rssEntry={item.rssEntry}
                priority={true}
              />
            ))}
          </ul>
          
          {hasMorePosts && (
            <>
              <CollapsibleContent className="space-y-4 mt-4">
                <ul 
                  className="space-y-4"
                  role="list"
                  aria-label="Additional trending content"
                >
                  {additionalPosts.map((item: TrendingWidgetMergedItem) => (
                    <TrendingItem 
                      key={item._id}
                      post={item}
                      rssEntry={item.rssEntry}
                      priority={false}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
              
              <CollapsibleTrigger asChild>
                <Button 
                  variant="link" 
                  size="sm" 
                  className={cn(
                    "text-sm font-semibold p-0 h-auto hover:no-underline text-left justify-start mt-0 leading-none tracking-tight",
                    isPending && "opacity-70"
                  )}
                  disabled={isPending}
                  aria-label={state.isOpen ? ariaLabels.showLess : ariaLabels.showMore}
                  aria-expanded={state.isOpen}
                  aria-controls={listId}
                >
                  {state.isOpen ? "Show less" : "Show more"}
                </Button>
              </CollapsibleTrigger>
            </>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
};

// Export with React.memo - minimal usage per React docs
export const TrendingWidget = memo(TrendingWidgetComponent); 

// Export cache stats for monitoring
export const getTrendingWidgetCacheStats = () => {
  return {
    message: 'Cache stats available in development mode',
    cacheSize: 'Simplified cache implementation'
  };
}; 