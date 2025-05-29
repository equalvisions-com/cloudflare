// components/postpage/RSSFeed.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSFeedClient } from "./RSSFeedClient";
import { checkAndRefreshFeeds } from '@/lib/rss.server';
import { executeRead } from '@/lib/database';
import 'server-only';

// Add caching configuration with 5-minute revalidation
export const revalidate = 300; // 5 minutes in seconds

interface RSSEntryRow {
  guid: string;
  title: string;
  link: string;
  description: string | null;
  pub_date: string;
  image: string | null;
  media_type: string | null;
  feed_id: number;
}

// Server-side in-memory cache for COUNT queries
// This is a module-level variable that persists between requests
interface CountCacheEntry {
  count: number;
  timestamp: number;
}

const COUNT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const countCache = new Map<string, CountCacheEntry>();
const PAGE_SIZE = 30; // Initial page size for loading

// Function to get cached count
function getCachedCount(feedUrl: string): number | null {
  const cached = countCache.get(feedUrl);
  
  if (!cached) {
    return null;
  }
  
  const now = Date.now();
  if (now - cached.timestamp > COUNT_CACHE_TTL) {
    // Cache expired
    countCache.delete(feedUrl);
    return null;
  }
  
  return cached.count;
}

// Function to set cached count
function setCachedCount(feedUrl: string, count: number): void {
  countCache.set(feedUrl, {
    count,
    timestamp: Date.now()
  });
}

// Function to invalidate cached count (useful after feed refresh)
function invalidateCountCache(feedUrl: string): void {
  countCache.delete(feedUrl);
}

export const getInitialEntries = cache(async (postTitle: string, feedUrl: string, mediaType?: string) => {
  try {
    // First, check if feeds need refreshing and create if doesn't exist
    let feedRefreshed = false;
    try {
      await checkAndRefreshFeeds(
        [postTitle], 
        [feedUrl], 
        mediaType ? [mediaType] : undefined
      );
      
      // Invalidate cache after refresh
      invalidateCountCache(feedUrl);
    } catch (refreshError) {
      // Log but don't fail if refresh check fails
      console.error('Warning: Feed refresh check failed:', refreshError);
    }

    // Get feed ID from PlanetScale with type safety
    const feedResult = await executeRead(
      'SELECT id FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );

    const feedRows = feedResult.rows as Array<{ id: number }>;
    if (!feedRows.length) {
      return null;
    }

    const feedId = feedRows[0].id;
    if (typeof feedId !== 'number' || isNaN(feedId)) {
      throw new Error('Invalid feed ID returned from database');
    }

    // Get entries from PlanetScale with proper typing
    const entriesResult = await executeRead(
      'SELECT guid, title, link, description, pub_date, image, media_type FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC LIMIT ?',
      [feedId, PAGE_SIZE]
    );

    const entryRows = entriesResult.rows as RSSEntryRow[];
    
    // If no entries found after refresh, something is wrong with the feed
    if (!entryRows.length) {
      return null;
    }

    // Type assertion for database rows
    const entries = entryRows.map(row => ({
      guid: row.guid,
      title: row.title,
      link: row.link,
      description: row.description || '',
      pubDate: row.pub_date,
      image: row.image || undefined,
      mediaType: row.media_type || mediaType,
      feedUrl
    }));

    // Get total count with proper handling
    let totalCount: number;
    
    // Check for cached count first
    const cachedCount = getCachedCount(feedUrl);
    
    if (cachedCount === null) {
      // Get total count with error handling - use optimized COUNT(e.id) query
      const countResult = await executeRead(
        'SELECT COUNT(e.id) as total FROM rss_entries e WHERE e.feed_id = ?',
        [feedId]
      );

      const countRows = countResult.rows as Array<{ total: string | number }>;
      // Convert string to number if needed and provide fallback
      const rawTotal = countRows[0]?.total;
      totalCount = typeof rawTotal === 'string' ? parseInt(rawTotal, 10) : Number(rawTotal ?? 0);

      // Only check if it's NaN, since we've already handled the conversion
      if (isNaN(totalCount)) {
        console.error('Invalid count value:', rawTotal);
        totalCount = 0;
      }
      
      // Cache the count
      setCachedCount(feedUrl, totalCount);
    } else {
      totalCount = cachedCount;
    }

    // Get metrics data with proper error handling
    const token = await convexAuthNextjsToken().catch((error) => {
      console.error('Failed to get auth token:', error);
      return null;
    });

    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: entries.map(e => e.guid) },
      token ? { token } : undefined
    ).catch(error => {
      console.error('⚠️ Failed to fetch metrics, using default values:', error);
      return entries.map(() => ({
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 }
      }));
    });

    // Combine entries with metrics and metadata
    const entriesWithPublicData = entries.map((entry, index) => ({
      entry,
      initialData: entryData[index] || {
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 }
      },
      postMetadata: {
        title: postTitle,
        featuredImg: entry.image || '',
        mediaType: mediaType || 'article'
      }
    }));

    return {
      entries: entriesWithPublicData,
      totalEntries: totalCount,
      hasMore: entriesWithPublicData.length < totalCount,
      postTitles: [postTitle],
      feedUrls: [feedUrl]
    };

  } catch (error) {
    // Enhanced error logging
    console.error('❌ SERVER: Error fetching initial entries:', {
      error,
      feedUrl,
      postTitle,
      timestamp: new Date().toISOString(),
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
});

interface RSSFeedProps {
  postTitle: string;
  feedUrl: string;
  initialData: NonNullable<Awaited<ReturnType<typeof getInitialEntries>>>;
  featuredImg?: string;
  mediaType?: string;
}

export default function RSSFeed({ postTitle, feedUrl, initialData, featuredImg, mediaType }: RSSFeedProps) {
  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No entries found in this feed.</p>
        <p className="text-sm mt-2">Please try refreshing the page.</p>
      </div>
    );
  }

  return (
    <RSSFeedClient
      postTitle={postTitle}
      feedUrl={feedUrl}
      initialData={initialData}
      pageSize={PAGE_SIZE}
      featuredImg={featuredImg}
      mediaType={mediaType}
    />
  );
}