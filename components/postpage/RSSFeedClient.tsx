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
}

interface RSSEntryProps {
  entryWithData: RSSEntryWithData;
  featuredImg?: string;
  postTitle?: string;
  mediaType?: string;
}

const RSSEntry = ({ entryWithData: { entry, initialData }, featuredImg, postTitle, mediaType }: RSSEntryProps) => {
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

  const handleCardClick = (e: React.MouseEvent) => {
    if (mediaType === 'podcast') {
      e.preventDefault();
      playTrack(entry.link, decode(entry.title));
    }
  };

  return (
    <article>
      <div className="flex gap-6 p-6">
        {/* Featured Image */}
        {featuredImg && (
          <div className="flex-shrink-0 w-16 h-16 relative rounded-xl overflow-hidden border border-border">
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
          {/* Post Title and Timestamp */}
          {postTitle && (
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-primary">
                {postTitle}
              </h3>
              <time 
                dateTime={entry.pubDate}
                title={format(new Date(entry.pubDate), 'PPP p')}
                className="text-sm text-muted-foreground"
              >
                {timestamp}
              </time>
            </div>
          )}
          
          {/* Entry Content - Different handling for podcasts */}
          {mediaType === 'podcast' ? (
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

interface RSSFeedClientProps {
  postTitle: string;
  feedUrl: string;
  initialData: {
    entries: RSSEntryWithData[];
  };
  pageSize?: number;
  featuredImg?: string;
  mediaType?: string;
}

export function RSSFeedClientWithErrorBoundary(props: RSSFeedClientProps) {
  return (
    <ErrorBoundary>
      <RSSFeedClient {...props} />
    </ErrorBoundary>
  );
}

export function RSSFeedClient({ postTitle, feedUrl, initialData, pageSize = 10, featuredImg, mediaType }: RSSFeedClientProps) {
  const [isPending, startTransition] = useTransition();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(1);
  
  const { data: allEntries } = useSWR<{
    entries: RSSEntryWithData[];
    totalEntries: number;
  }>(
    `/api/rss/${encodeURIComponent(postTitle)}`,
    async (url: string) => {
      const res = await fetch(`${url}?feedUrl=${encodeURIComponent(feedUrl)}`, {
        next: {
          revalidate: 300 // Revalidate every 5 minutes
        }
      });
      if (!res.ok) throw new Error('Failed to fetch RSS entries');
      const data = await res.json();
      return {
        entries: data.entries,
        totalEntries: data.entries.length
      };
    },
    {
      fallbackData: {
        entries: initialData.entries,
        totalEntries: initialData.entries.length
      },
      revalidateOnFocus: false,    // Don't revalidate on focus
      revalidateOnReconnect: true, // Keep revalidating on reconnect to catch new entries
      dedupingInterval: 300 * 1000, // Cache for 5 minutes
      revalidateOnMount: false,    // Don't revalidate immediately on mount
      refreshInterval: 300 * 1000,  // Only refresh every 5 minutes
    }
  );

  // Handle pagination locally with transition
  const paginatedEntries = useMemo(() => {
    const entries = allEntries?.entries || [];
    return entries.slice(0, size * pageSize);
  }, [allEntries?.entries, size, pageSize]);

  const hasMore = allEntries?.entries && paginatedEntries.length < allEntries.entries.length;

  // Reset size when feed changes
  useEffect(() => {
    setSize(1);
  }, [feedUrl]);

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
      { threshold: 0.1 } // Lower threshold for earlier loading
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [hasMore]);

  if (!paginatedEntries.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No entries found in this feed.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {paginatedEntries.map((entryWithData) => (
        <RSSEntry
          key={entryWithData.entry.guid}
          entryWithData={entryWithData}
          featuredImg={featuredImg}
          postTitle={postTitle}
          mediaType={mediaType}
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