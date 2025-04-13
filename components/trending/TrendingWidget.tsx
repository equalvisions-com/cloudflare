"use client";

import { useEffect, useState, useCallback } from "react";
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
import { useAudio } from '@/components/audio-player/AudioContext';
import { decode } from 'html-entities';
import { VerifiedBadge } from "@/components/VerifiedBadge";

// Add a cache duration constant - 5 minutes
const RSS_CACHE_DURATION = 5 * 60 * 1000;

interface RSSEntry {
  guid: string;
  title: string;
  link: string;
  description: string | null;
  pubDate: string;
  image: string | null;
  feedUrl: string;
  mediaType: string | null;
}

interface TrendingWidgetProps {
  className?: string;
}

// Function to check if we have a valid cache
const hasValidCache = () => {
  const cachedData = localStorage.getItem('trending_rss_cache');
  const cachedTimestamp = localStorage.getItem('trending_rss_timestamp');
  
  if (!cachedData || !cachedTimestamp) return false;
  
  const timestamp = parseInt(cachedTimestamp, 10);
  const now = Date.now();
  
  // Cache is valid if less than RSS_CACHE_DURATION old
  return (now - timestamp) < RSS_CACHE_DURATION;
};

export function TrendingWidget({ className = "" }: TrendingWidgetProps) {
  const [rssEntries, setRssEntries] = useState<{[feedUrl: string]: RSSEntry}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'unchecked' | 'valid' | 'invalid'>('unchecked');
  
  // Fetch batched widget data from Convex without timestamp cache busting
  const widgetData = useQuery(api.featured.getBatchedWidgetData, { 
    featuredLimit: 6,
    trendingLimit: 6
  });
  
  // Extract trending posts data and memoize to prevent dependency changes
  const trendingPosts = React.useMemo(() => widgetData?.trendingPosts || [], [widgetData?.trendingPosts]);
  
  // Check cache on component mount (only once)
  useEffect(() => {
    // Only run this once on mount
    if (cacheStatus !== 'unchecked') return;
    
    try {
      // Check if we're navigating between pages
      const isNavigation = sessionStorage.getItem('app_is_navigation') === 'true';
      
      // If we're navigating, clear the flag and rely on cache
      if (isNavigation) {
        sessionStorage.removeItem('app_is_navigation');
      }
      
      // Check if we have a valid cache
      if (hasValidCache()) {
        const cachedData = localStorage.getItem('trending_rss_cache');
        setRssEntries(JSON.parse(cachedData!));
        setIsLoading(false);
        setCacheStatus('valid');
      } else {
        setCacheStatus('invalid');
      }
    } catch (error) {
      console.error('Error checking RSS cache:', error);
      setCacheStatus('invalid');
    }
  }, [cacheStatus]);
  
  // Extract feed URLs for fetching RSS entries
  useEffect(() => {
    // Don't fetch if we have a valid cache or no posts
    if (cacheStatus === 'valid' || cacheStatus === 'unchecked' || !trendingPosts || trendingPosts.length === 0) {
      return;
    }
    
    const fetchRssEntries = async () => {
      setIsLoading(true);
      try {
        const feedUrls = trendingPosts.map(post => post.feedUrl);
        
        const response = await fetch('/api/trending', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ feedUrls }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch RSS entries');
        }
        
        const data = await response.json();
        setRssEntries(data.entries);
        
        // Store in cache
        try {
          localStorage.setItem('trending_rss_cache', JSON.stringify(data.entries));
          localStorage.setItem('trending_rss_timestamp', Date.now().toString());
        } catch (error) {
          console.error('Error caching RSS entries:', error);
        }
      } catch (error) {
        console.error('Error fetching RSS entries:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRssEntries();
  }, [trendingPosts, cacheStatus]);
  
  // Combine post data with RSS entries
  const mergedItems = trendingPosts.map(post => {
    const rssEntry = rssEntries[post.feedUrl];
    return {
      ...post,
      rssEntry
    };
  }).filter(item => item.rssEntry); // Only show items that have an RSS entry
  
  // Show first 3 posts initially
  const initialPosts = mergedItems.slice(0, 3);
  const additionalPosts = mergedItems.slice(3, 6);
  const hasMorePosts = additionalPosts.length > 0;
  
  // If no data, show empty state with skeleton loader
  if (!widgetData || mergedItems.length === 0) {
    return (
      <Card className={`shadow-none rounded-xl ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold flex items-center leading-none tracking-tight">
            <span>What&apos;s trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <TrendingItemSkeleton key={i} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-extrabold flex items-center leading-none tracking-tight">
          <span>What&apos;s trending</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="space-y-4"
        >
          <ul className="space-y-4">
            {initialPosts.map((item) => (
              <TrendingItem 
                key={item._id}
                post={item}
                rssEntry={item.rssEntry}
              />
            ))}
          </ul>
          
          {hasMorePosts && (
            <>
              <CollapsibleContent className="space-y-4 mt-4">
                <ul className="space-y-4">
                  {additionalPosts.map((item) => (
                    <TrendingItem 
                      key={item._id}
                      post={item}
                      rssEntry={item.rssEntry}
                    />
                  ))}
                </ul>
              </CollapsibleContent>
              
              <CollapsibleTrigger asChild>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-sm font-semibold p-0 h-auto hover:no-underline text-left justify-start mt-0 leading-none tracking-tight"
                >
                  {isOpen ? "Show less" : "Show more"}
                </Button>
              </CollapsibleTrigger>
            </>
          )}
        </Collapsible>
      </CardContent>
    </Card>
  );
}

function TrendingItem({ 
  post, 
  rssEntry 
}: { 
  post: any & { verified?: boolean };
  rssEntry: RSSEntry 
}) {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === rssEntry.link;
  
  // Check both post.mediaType and rssEntry.mediaType
  const isPodcast = 
    (post.mediaType?.toLowerCase() === 'podcast') || 
    (rssEntry.mediaType?.toLowerCase() === 'podcast');
  
  // Handle podcast playback
  const handlePodcastClick = useCallback((e: React.MouseEvent) => {
    if (isPodcast) {
      e.preventDefault();
      playTrack(rssEntry.link, decode(rssEntry.title), rssEntry.image || undefined);
    }
  }, [isPodcast, rssEntry.link, rssEntry.title, rssEntry.image, playTrack]);
  
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
              />
            </AspectRatio>
          </div>
        )}
        <Link 
          href={`/${post.mediaType === 'newsletter' ? 'newsletters' : post.mediaType === 'podcast' ? 'podcasts' : post.categorySlug}/${post.postSlug}`}
          className="text-xs font-bold hover:underline flex-grow line-clamp-1"
        >
          {post.title}
          {post.verified && <VerifiedBadge className="inline-block align-middle ml-1 h-3 w-3" />}
        </Link>
      </div>
      
      <div className="flex gap-3">
        {rssEntry.image ? (
          <div className="flex-shrink-0 w-10 h-10 overflow-hidden rounded-md">
            {isPodcast ? (
              <div 
                onClick={handlePodcastClick}
                className={`block h-full cursor-pointer ${isCurrentlyPlaying ? 'ring-2 ring-primary' : ''}`}
              >
                <AspectRatio ratio={1/1} className="bg-muted">
                  <Image 
                    src={rssEntry.image} 
                    alt={rssEntry.title}
                    fill
                    className="object-cover hover:opacity-90 transition-opacity"
                    sizes="(max-width: 768px) 100vw, 40px"
                  />
                </AspectRatio>
              </div>
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
                    alt={rssEntry.title}
                    fill
                    className="object-cover hover:opacity-90 transition-opacity"
                    sizes="(max-width: 768px) 100vw, 40px"
                  />
                </AspectRatio>
              </a>
            )}
          </div>
        ) : (
          // Use a placeholder icon or just leave empty space to maintain alignment
          <div className="flex-shrink-0 w-10 h-10 bg-muted/50 rounded-md"></div>
        )}
        {isPodcast ? (
          <div 
            onClick={handlePodcastClick}
            className={`text-sm hover:text-primary flex items-center font-semibold flex-grow cursor-pointer ${isCurrentlyPlaying ? 'text-primary' : ''}`}
          >
            <span className="line-clamp-2">{rssEntry.title}</span>
          </div>
        ) : (
          <a 
            href={rssEntry.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:text-primary flex items-center font-semibold flex-grow"
          >
            <span className="line-clamp-2">{rssEntry.title}</span>
          </a>
        )}
      </div>
    </li>
  );
}

function TrendingItemSkeleton() {
  return (
    <div className="flex flex-col space-y-2">
      <div>
        <Skeleton className="h-4 w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-10 rounded-md flex-shrink-0" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
} 