"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

export interface TrendingTopic {
  id: string;
  title: string;
  count: number;
  slug: string;
}

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
  topics?: TrendingTopic[];
  className?: string;
}

// Placeholder trending data for fallback
const placeholderTrendingTopics: TrendingTopic[] = [
  { id: '1', title: 'Artificial Intelligence', count: 1250, slug: 'artificial-intelligence' },
  { id: '2', title: 'Web Development', count: 890, slug: 'web-development' },
  { id: '3', title: 'Blockchain', count: 745, slug: 'blockchain' },
  { id: '4', title: 'Productivity', count: 612, slug: 'productivity' },
  { id: '5', title: 'Machine Learning', count: 578, slug: 'machine-learning' },
];

export function TrendingWidget({ className = "" }: TrendingWidgetProps) {
  const [rssEntries, setRssEntries] = useState<{[feedUrl: string]: RSSEntry}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch batched widget data from Convex without timestamp cache busting
  const widgetData = useQuery(api.featured.getBatchedWidgetData, { 
    featuredLimit: 6,
    trendingLimit: 6
  });
  
  // Extract trending posts data
  const trendingPosts = widgetData?.trendingPosts || [];
  
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
  
  // If no data, show placeholder
  if (!widgetData || mergedItems.length === 0) {
    return (
      <Card className={`shadow-none rounded-xl ${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <span>Trending Topics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <TrendingItemSkeleton key={i} />
              ))}
            </div>
          ) : (
            <ul className="space-y-3">
              {placeholderTrendingTopics.map((topic) => (
                <li key={topic.id}>
                  <Link 
                    href={`/topic/${topic.slug}`} 
                    className="flex items-center justify-between group"
                  >
                    <span className="text-sm hover:text-primary group-hover:underline">
                      {topic.title}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{topic.count}</span>
                      <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className={`shadow-none rounded-xl ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <span>Trending Now</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-4">
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
                  className="text-sm font-medium p-0 h-auto hover:no-underline text-left justify-start mt-2"
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
            <Image 
              src={post.featuredImg} 
              alt={post.title}
              width={16}
              height={16}
              className="object-cover"
            />
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
          className="text-sm hover:text-primary flex items-center flex-grow"
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