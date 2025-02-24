'use client';

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Image from "next/image";
import { formatDistanceToNow, format } from "date-fns";
import { decode } from 'html-entities';
import { useEffect, useRef, useState, useMemo, useTransition } from 'react';
import useSWR from 'swr';
import type { RSSItem } from "@/lib/redis";
import { LikeButtonClient } from "@/components/like-button/LikeButtonClient";
import { CommentSectionClient } from "@/components/comment-section/CommentSectionClient";
import { ShareButtonClient } from "@/components/share-button/ShareButtonClient";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Link from "next/link";
import { useAudio } from '@/components/audio-player/AudioContext';

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
  };
  postMetadata: {
    title: string;
    featuredImg?: string;
    mediaType?: string;
    categorySlug?: string;
    postSlug?: string;
  };
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
}

const RSSEntry = ({ entryWithData: { entry, initialData, postMetadata } }: RSSEntryProps) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === entry.link;

  // Format the timestamp based on age
  const timestamp = useMemo(() => {
    const pubDate = new Date(entry.pubDate);
    const now = new Date();
    const diffInHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return formatDistanceToNow(pubDate, { addSuffix: true });
    } else {
      return format(pubDate, 'MMM d');
    }
  }, [entry.pubDate]);

  // Generate post URL
  const postUrl = postMetadata.categorySlug && postMetadata.postSlug 
    ? `/${postMetadata.categorySlug}/${postMetadata.postSlug}`
    : null;

  const handleCardClick = (e: React.MouseEvent) => {
    if (postMetadata.mediaType === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title), entry.image);
    }
  };

  return (
    <article>
      <div className="flex gap-6 p-6">
        {/* Featured Image */}
        {postMetadata.featuredImg && postUrl && (
          <Link href={postUrl} className="flex-shrink-0 w-16 h-16 relative rounded-xl overflow-hidden border border-border hover:opacity-80 transition-opacity">
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
        <div className="flex-grow">
          {/* Post Title and Timestamp */}
          <div className="flex items-center justify-between mb-2">
            <div>
              {postMetadata.title && postUrl && (
                <Link href={postUrl} className="hover:opacity-80 transition-opacity">
                  <h3 className="text-base font-semibold text-primary">
                    {postMetadata.title}
                  </h3>
                </Link>
              )}
            </div>
            <time 
              dateTime={entry.pubDate}
              title={format(new Date(entry.pubDate), 'PPP p')}
              className="text-sm text-muted-foreground"
            >
              {timestamp}
            </time>
          </div>
          
          {postMetadata.mediaType === 'podcast' ? (
            <div className="mb-4">
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
                  <CardContent className="p-6 bg-secondary/60 border-t">
                    <h3 className="text-lg font-semibold">
                      {decode(entry.title)}
                    </h3>
                    {entry.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
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
                <CardContent className="p-6 bg-secondary/60 border-t">
                  <h3 className="text-lg font-semibold">
                    {decode(entry.title)}
                  </h3>
                  {entry.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                      {decode(entry.description)}
                    </p>
                  )}
                </CardContent>
              </Card>
            </a>
          )}

          {/* Interaction Buttons */}
          <div className="flex items-center gap-6 mt-4">
            <LikeButtonClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              title={entry.title}
              pubDate={entry.pubDate}
              link={entry.link}
              initialData={initialData.likes}
            />
            <CommentSectionClient
              entryGuid={entry.guid}
              feedUrl={entry.feedUrl}
              initialData={initialData.comments}
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
};

interface RSSEntriesClientProps {
  initialData: {
    entries: RSSEntryWithData[];
  };
  pageSize?: number;
}

export function RSSEntriesClientWithErrorBoundary(props: RSSEntriesClientProps) {
  return (
    <ErrorBoundary>
      <RSSEntriesClient {...props} />
    </ErrorBoundary>
  );
}

export function RSSEntriesClient({ initialData, pageSize = 10 }: RSSEntriesClientProps) {
  const [isPending, startTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(1);
  
  const { data } = useSWR<{
    entries: RSSEntryWithData[];
    totalEntries: number;
  }>(
    '/api/rss',
    async (url: string) => {
      const res = await fetch(url, {
        next: {
          revalidate: 300 // Revalidate every 5 minutes
        }
      });
      if (!res.ok) throw new Error('Failed to fetch RSS entries');
      return res.json();
    },
    {
      fallbackData: { entries: initialData.entries, totalEntries: initialData.entries.length },
      revalidateOnFocus: false,    // Don't revalidate on focus
      revalidateOnReconnect: true, // Keep revalidating on reconnect to catch new entries
      dedupingInterval: 300 * 1000, // Cache for 5 minutes
      revalidateOnMount: false,    // Don't revalidate immediately on mount
      refreshInterval: 300 * 1000,  // Only refresh every 5 minutes
    }
  );

  // Handle pagination locally with transition
  const paginatedEntries = useMemo(() => {
    const entries = data?.entries || initialData.entries;
    return entries.slice(0, size * pageSize);
  }, [data?.entries, initialData.entries, size, pageSize]);

  const hasMore = data?.entries && paginatedEntries.length < data.entries.length;

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startTransition(() => {
            setSize(s => s + 1);
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [hasMore]);

  if (!paginatedEntries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in your RSS feeds.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {paginatedEntries.map((entryWithData) => (
        <RSSEntry
          key={entryWithData.entry.guid}
          entryWithData={entryWithData}
        />
      ))}
      <div ref={loadMoreRef} className="h-10">
        {isPending && hasMore && (
          <div className="text-center py-4">Loading more entries...</div>
        )}
      </div>
    </div>
  );
} 