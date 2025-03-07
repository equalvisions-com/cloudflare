'use client';

import React, { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from './skeleton';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import Image from 'next/image';
import Link from 'next/link';

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
}

interface EntriesDisplayProps {
  mediaType: string;
  searchQuery: string;
  className?: string;
}

export function EntriesDisplay({
  mediaType,
  searchQuery,
  className,
}: EntriesDisplayProps) {
  const [entries, setEntries] = useState<RSSEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  // Set up intersection observer for infinite scrolling
  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  // Search entries when query changes or tab is switched
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
      }
    };

    if (searchQuery) {
      searchEntries();
    }
  }, [searchQuery, mediaType]);

  // Load more entries when bottom is reached
  useEffect(() => {
    const loadMore = async () => {
      if (!isLoading && hasMore) {
        setIsLoading(true);
        try {
          const nextPage = page + 1;
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
      }
    };

    if (inView && hasMore) {
      loadMore();
    }
  }, [inView, hasMore, isLoading, searchQuery, mediaType, page]);

  // Loading state
  if (isLoading && entries.length === 0) {
    return (
      <div className={className}>
        {[1, 2, 3].map((i) => (
          <EntryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // No entries state
  if (entries.length === 0 && !isLoading) {
    return (
      <div className={`py-8 text-center text-muted-foreground ${className}`}>
        <p className="text-muted-foreground text-sm">No results found for &quot;{searchQuery}&quot;</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Entry cards */}
      {entries.map((entry) => (
        <EntryCard key={entry.guid} entry={entry} />
      ))}

      {/* Loading indicator and intersection observer target */}
      {hasMore && (
        <div ref={ref} className="py-4 flex justify-center">
          <EntryCardSkeleton />
        </div>
      )}
    </div>
  );
}

// Entry card component
function EntryCard({ entry }: { entry: RSSEntry }) {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-none shadow-none border-l-0 border-r-0 border-t-0 border-b-1 rounded-none">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {entry.image && (
            <div className="flex-shrink-0 w-24 h-24">
              <AspectRatio ratio={1/1} className="overflow-hidden rounded-md">
                <Image
                  src={entry.image}
                  alt={entry.title}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </AspectRatio>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link href={entry.link} target="_blank" rel="noopener noreferrer" className="block">
              <h3 className="text-lg font-semibold leading-tight line-clamp-2">{entry.title}</h3>
              {entry.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {entry.description}
                </p>
              )}
              {entry.feed_title && (
                <p className="mt-2 text-xs text-muted-foreground">
                  From {entry.feed_title}
                </p>
              )}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton loader for entry cards
function EntryCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="flex-shrink-0 w-24 h-24 rounded-md" />
          <div className="flex-1">
            <Skeleton className="w-3/4 h-6 mb-2" />
            <Skeleton className="w-full h-4 mb-1" />
            <Skeleton className="w-full h-4 mb-1" />
            <Skeleton className="w-2/3 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 