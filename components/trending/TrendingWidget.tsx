"use client";

import { useEffect, useState } from "react";
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

export function TrendingWidget({ className = "" }: TrendingWidgetProps) {
  const [rssEntries, setRssEntries] = useState<{[feedUrl: string]: RSSEntry}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch batched widget data from Convex without timestamp cache busting
  const widgetData = useQuery(api.featured.getBatchedWidgetData, { 
    featuredLimit: 6,
    trendingLimit: 6
  });
  
  // Extract trending posts data and memoize to prevent dependency changes
  const trendingPosts = React.useMemo(() => widgetData?.trendingPosts || [], [widgetData?.trendingPosts]);
  
  // Extract feed URLs for fetching RSS entries
  useEffect(() => {
    const fetchRssEntries = async () => {
      if (!trendingPosts || trendingPosts.length === 0) return;
      
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
      } catch (error) {
        console.error('Error fetching RSS entries:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (trendingPosts.length > 0) {
      fetchRssEntries();
    }
  }, [trendingPosts]);
  
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
  post: any; 
  rssEntry: RSSEntry 
}) {
  return (
    <li className="flex flex-col space-y-2">
      <div className="flex items-center gap-1">
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
          href={`/${post.categorySlug}/${post.postSlug}`}
          className="text-xs font-bold hover:underline flex-grow line-clamp-1"
        >
          {post.title}
        </Link>
      </div>
      
      <div className="flex gap-2">
        {rssEntry.image ? (
          <div className="flex-shrink-0 w-10 h-10 overflow-hidden rounded-md">
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
          </div>
        ) : (
          // Use a placeholder icon or just leave empty space to maintain alignment
          <div className="flex-shrink-0 w-10 h-10 bg-muted/50 rounded-md"></div>
        )}
        <a 
          href={rssEntry.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:text-primary flex items-start font-semibold flex-grow"
        >
          <span className="line-clamp-2">{rssEntry.title}</span>
        </a>
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