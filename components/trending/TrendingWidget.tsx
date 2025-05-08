"use client";

import { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
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

// Memoized skeleton component
const TrendingItemSkeleton = memo(() => {
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
});

TrendingItemSkeleton.displayName = 'TrendingItemSkeleton';

// Memoized trending item component
const TrendingItem = memo(({ 
  post, 
  rssEntry 
}: { 
  post: any & { verified?: boolean };
  rssEntry: RSSEntry 
}) => {
  const { playTrack, currentTrack } = useAudio();
  const isCurrentlyPlaying = currentTrack?.src === rssEntry.link;
  
  // Add a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  
  // Set up the mounted ref
  useEffect(() => {
    // Set mounted flag to true
    isMountedRef.current = true;
    
    // Cleanup function to set mounted flag to false when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Check both post.mediaType and rssEntry.mediaType
  const isPodcast = useMemo(() => 
    (post.mediaType?.toLowerCase() === 'podcast') || 
    (rssEntry.mediaType?.toLowerCase() === 'podcast'),
  [post.mediaType, rssEntry.mediaType]);
  
  // Handle podcast playback
  const handlePodcastClick = useCallback((e: React.MouseEvent) => {
    if (!isMountedRef.current) return;
    
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
                    sizes="40px"
                    priority={false}
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
                    sizes="40px"
                    priority={false}
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
});

TrendingItem.displayName = 'TrendingItem';

const TrendingWidgetComponent = ({ className = "" }: TrendingWidgetProps) => {
  const [rssEntries, setRssEntries] = useState<{[feedUrl: string]: RSSEntry}>({});
  const [isLoadingRss, setIsLoadingRss] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'unchecked' | 'valid' | 'invalid'>('unchecked');
  
  // Fetch the list of posts using the new public query
  const trendingPostsSource = useQuery(api.widgets.getPublicWidgetPosts, { 
    limit: 6 
  });
  
  // Handle loading state for the Convex query
  const isLoadingPosts = trendingPostsSource === undefined;
  
  // Memoized handler for collapsible state
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);
  
  // Check cache on component mount (only once)
  useEffect(() => {
    if (cacheStatus !== 'unchecked') return;
    try {
      const isNavigation = sessionStorage.getItem('app_is_navigation') === 'true';
      if (isNavigation) {
        sessionStorage.removeItem('app_is_navigation');
      }
      if (hasValidCache()) {
        const cachedData = localStorage.getItem('trending_rss_cache');
        setRssEntries(JSON.parse(cachedData!));
        setIsLoadingRss(false);
        setCacheStatus('valid');
      } else {
        setCacheStatus('invalid');
      }
    } catch (error) {
      console.error('Error checking RSS cache:', error);
      setCacheStatus('invalid');
    }
  }, [cacheStatus]);
  
  // Extract feed URLs for fetching RSS entries - depends on trendingPostsSource
  useEffect(() => {
    if (cacheStatus === 'valid' || cacheStatus === 'unchecked' || isLoadingPosts || !trendingPostsSource || trendingPostsSource.length === 0) {
      return;
    }
    
    const fetchRssEntries = async () => {
      setIsLoadingRss(true);
      try {
        // Use feedUrls from the new query result
        const feedUrls = trendingPostsSource.map(post => post.feedUrl).filter(Boolean) as string[];
        
        if (feedUrls.length === 0) {
          setIsLoadingRss(false);
          return;
        }

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
        
        try {
          localStorage.setItem('trending_rss_cache', JSON.stringify(data.entries));
          localStorage.setItem('trending_rss_timestamp', Date.now().toString());
        } catch (error) {
          console.error('Error caching RSS entries:', error);
        }
      } catch (error) {
        console.error('Error fetching RSS entries:', error);
      } finally {
        setIsLoadingRss(false);
      }
    };
    
    fetchRssEntries();
    // Depend on the source posts list and cache status
  }, [trendingPostsSource, isLoadingPosts, cacheStatus]);
  
  // Combine post data with RSS entries - memoized
  const mergedItems = useMemo(() => {
    // Guard against undefined source posts during initial load
    if (!trendingPostsSource) return [];
    
    return trendingPostsSource
      .map(post => {
        const rssEntry = rssEntries[post.feedUrl];
        return {
          ...post,
          rssEntry
        };
      })
      .filter(item => item.rssEntry); // Only show items that have an RSS entry
  }, [trendingPostsSource, rssEntries]);
  
  // Show first 3 posts initially - memoized
  const initialPosts = useMemo(() => mergedItems.slice(0, 3), [mergedItems]);
  const additionalPosts = useMemo(() => mergedItems.slice(3, 6), [mergedItems]);
  const hasMorePosts = useMemo(() => additionalPosts.length > 0, [additionalPosts]);
  
  // Determine overall loading state
  const isLoading = isLoadingPosts || (cacheStatus === 'invalid' && isLoadingRss);

  // If loading or no data, show skeleton loader
  if (isLoading) {
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
  
  // If finished loading but no items merged (e.g., RSS fetch failed or returned empty)
  if (!isLoading && mergedItems.length === 0) {
    return (
       <Card className={`shadow-none rounded-xl ${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-extrabold flex items-center leading-none tracking-tight">
            <span>What&apos;s trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-sm text-muted-foreground">Nothing trending right now.</p>
        </CardContent>
      </Card>
    );
  }

  // Render the actual content
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
          onOpenChange={handleOpenChange}
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
};

// Export the memoized version of the component
export const TrendingWidget = memo(TrendingWidgetComponent); 