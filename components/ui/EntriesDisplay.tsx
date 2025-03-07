'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Headphones, Mail, MoreVertical } from 'lucide-react';
import { LikeButtonClient } from '@/components/like-button/LikeButtonClient';
import { CommentSectionClient } from '@/components/comment-section/CommentSectionClient';
import { RetweetButtonClientWithErrorBoundary } from '@/components/retweet-button/RetweetButtonClient';
import { ShareButtonClient } from '@/components/share-button/ShareButtonClient';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Virtuoso } from 'react-virtuoso';

// Define the shape of an RSS entry
interface RSSEntry {
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
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
}

interface EntriesDisplayProps {
  mediaType: string;
  searchQuery: string;
  className?: string;
  isVisible?: boolean;
}

// This interface is now used directly where needed
interface InteractionStates {
  likes: { isLiked: boolean; count: number };
  comments: { count: number };
  retweets: { isRetweeted: boolean; count: number };
}

// Custom hook for batch metrics
function useEntriesMetrics(entryGuids: string[], isVisible: boolean) {
  const batchMetricsQuery = useQuery(
    api.entries.batchGetEntriesMetrics,
    isVisible && entryGuids.length > 0 ? { entryGuids } : "skip"
  );

  // Create a memoized metrics map
  const metricsMap = useMemo(() => {
    if (!batchMetricsQuery) {
      return new Map<string, InteractionStates>();
    }

    return new Map(
      entryGuids.map((guid, index) => [guid, batchMetricsQuery[index]])
    );
  }, [batchMetricsQuery, entryGuids]);

  // Memoize default values
  const defaultInteractions = useMemo(() => ({
    likes: { isLiked: false, count: 0 },
    comments: { count: 0 },
    retweets: { isRetweeted: false, count: 0 }
  }), []);

  // Return a function to get metrics for a specific entry
  const getEntryMetrics = useCallback((entryGuid: string) => {
    return metricsMap.get(entryGuid) || defaultInteractions;
  }, [metricsMap, defaultInteractions]);

  return {
    getEntryMetrics,
    isLoading: isVisible && entryGuids.length > 0 && !batchMetricsQuery,
    metricsMap
  };
}

export function EntriesDisplay({
  mediaType,
  searchQuery,
  className,
  isVisible = false,
}: EntriesDisplayProps) {
  const [entries, setEntries] = useState<RSSEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Get entry guids for metrics
  const entryGuids = useMemo(() => entries.map(entry => entry.guid), [entries]);
  
  // Use our custom hook for metrics
  const { getEntryMetrics, isLoading: isMetricsLoading } = useEntriesMetrics(entryGuids, isVisible);

  // Memoize loadMore function
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || !isVisible) return;

    const nextPage = page + 1;
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/search/entries?query=${encodeURIComponent(searchQuery)}&mediaType=${encodeURIComponent(mediaType)}&page=${nextPage}`);
      const data = await response.json();
      
      setEntries(prev => [...prev, ...data.entries]);
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (error) {
      console.error('Error loading more entries:', error);
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, isVisible, page, searchQuery, mediaType]);

  // Reset state only when search query changes
  useEffect(() => {
    if (searchQuery !== lastSearchQuery) {
      setEntries([]);
      setHasMore(true);
      setPage(1);
      setLastSearchQuery(searchQuery);
      setIsInitialLoad(true);
    }
  }, [searchQuery, lastSearchQuery]);

  // Initial search effect
  useEffect(() => {
    const searchEntries = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search/entries?query=${encodeURIComponent(searchQuery)}&mediaType=${encodeURIComponent(mediaType)}&page=1`);
        const data = await response.json();
        setEntries(data.entries);
        setHasMore(data.hasMore);
        setPage(1);
      } catch (error) {
        console.error('Error searching entries:', error);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    if (searchQuery && isVisible && (searchQuery !== lastSearchQuery || entries.length === 0)) {
      searchEntries();
      setLastSearchQuery(searchQuery);
    }
  }, [searchQuery, mediaType, isVisible, lastSearchQuery, entries.length]);

  // Don't render anything if tab is not visible
  if (!isVisible) {
    return null;
  }

  // Loading state - only show for initial load and initial metrics fetch
  if ((isLoading && isInitialLoad) || (isInitialLoad && entries.length > 0 && isMetricsLoading)) {
    return (
      <div className={cn("flex justify-center items-center py-12", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No entries state
  if (entries.length === 0 && !isLoading) {
    return (
      <div className={cn("py-8 text-center", className)}>
        <p className="text-muted-foreground text-sm">No results found for &quot;{searchQuery}&quot;</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Virtuoso
        useWindowScroll
        totalCount={entries.length}
        endReached={loadMore}
        overscan={10}
        itemContent={index => {
          const entry = entries[index];
          return (
            <EntryCard 
              key={entry.guid} 
              entry={entry} 
              interactions={getEntryMetrics(entry.guid)}
            />
          );
        }}
        components={{
          Footer: () => (
            <div className="py-4 text-center">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading more entries...</span>
                </div>
              ) : hasMore ? (
                <div className="h-8" />
              ) : (
                <div className="text-muted-foreground text-sm py-2">
                  No more entries to load
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  );
}

// Modified EntryCard to accept interactions prop
const EntryCard = React.memo(({ entry, interactions }: { 
  entry: RSSEntry; 
  interactions: InteractionStates;
}) => {
  const timestamp = useMemo(() => {
    const pubDate = new Date(entry.pub_date);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - pubDate.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);

    // Format based on the time difference
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h`;
    } else if (diffInDays < 30) {
      return `${diffInDays}d`;
    } else {
      return `${diffInMonths}mo`;
    }
  }, [entry.pub_date]);

  // Generate post URL if we have category and post slugs
  const postUrl = useMemo(() => 
    entry.category_slug && entry.post_slug 
      ? `/${entry.category_slug}/${entry.post_slug}`
      : null,
    [entry.category_slug, entry.post_slug]
  );

  // Moved MoreOptionsDropdown outside of EntryCard render to prevent recreation
  return (
    <article>
      <div className="p-4">
        {/* Top Row: Featured Image and Title */}
        <div className="flex items-start gap-4 mb-4">
          {/* Featured Image */}
          {entry.post_featured_img && postUrl && (
            <Link href={postUrl} className="flex-shrink-0 w-14 h-14 relative rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
              <AspectRatio ratio={1}>
                <Image
                  src={entry.post_featured_img}
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
              {entry.post_title && postUrl && (
                <div className="flex items-center justify-between gap-2">
                  <Link href={postUrl} className="hover:opacity-80 transition-opacity">
                    <h3 className="text-base font-semibold text-primary leading-tight">
                      {entry.post_title}
                    </h3>
                  </Link>
                  <span 
                    className="text-sm leading-none text-muted-foreground flex-shrink-0"
                    title={format(new Date(entry.pub_date), 'PPP p')}
                  >
                    {timestamp}
                  </span>
                </div>
              )}
              {entry.post_media_type && (
                <span className="inline-flex items-center gap-1 text-xs bg-secondary/60 px-2 py-1 text-muted-foreground rounded-md mt-1.5">
                  {entry.post_media_type.toLowerCase() === 'podcast' && <Headphones className="h-3 w-3" />}
                  {entry.post_media_type.toLowerCase() === 'newsletter' && <Mail className="h-3 w-3" />}
                  {entry.post_media_type.charAt(0).toUpperCase() + entry.post_media_type.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Entry Content Card */}
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
                {entry.title}
              </h3>
              {entry.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {entry.description}
                </p>
              )}
            </CardContent>
          </Card>
        </a>

        {/* Horizontal Interaction Buttons */}
        <div className="flex justify-between items-center mt-4 h-[16px]">
          <div>
            <LikeButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url || ''}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={interactions.likes}
            />
          </div>
          <div>
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feed_url || ''}
              initialData={interactions.comments}
            />
          </div>
          <div>
            <RetweetButtonClientWithErrorBoundary
              entryGuid={entry.guid}
              feedUrl={entry.feed_url || ''}
              title={entry.title}
              pubDate={entry.pub_date}
              link={entry.link}
              initialData={interactions.retweets}
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
      
      <div id={`comments-${entry.guid}`} className="border-t border-border" />
    </article>
  );
});

EntryCard.displayName = 'EntryCard';

// Moved outside of EntryCard and memoized
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