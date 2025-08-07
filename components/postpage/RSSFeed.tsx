// components/postpage/RSSFeed.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSFeedClient } from "./RSSFeedClient";
import { executeRead } from '@/lib/database';
import type { RSSEntryRow } from "@/lib/types";
import 'server-only';

// Add caching configuration with 5-minute revalidation
export const revalidate = 300; // 5 minutes in seconds

// Count cache removed - using limit+1 pagination instead
const PAGE_SIZE = 30; // Initial page size for loading

// Count cache functions removed - using limit+1 pagination instead

export const getInitialEntries = cache(async (postTitle: string, feedUrl: string, mediaType?: string) => {
  try {
    // MIGRATED: RSS refresh now handled by queue/worker architecture
    // Server-side blocking refresh removed for instant page loads
    // Real-time updates delivered via SSE from workers

    // Get feed ID and staleness data from PlanetScale with type safety
    const feedResult = await executeRead(
      'SELECT id, last_fetched FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );

    const feedRows = feedResult.rows as Array<{ id: number; last_fetched: number }>;
    if (!feedRows.length) {
      return null;
    }

    const feedId = feedRows[0].id;
    const lastFetched = Number(feedRows[0].last_fetched);
    
    if (typeof feedId !== 'number' || isNaN(feedId)) {
      throw new Error('Invalid feed ID returned from database');
    }

    // Pass raw timestamp to client for non-blocking staleness calculation
    // Remove server-side staleness calculation to avoid render blocking

    // Get entries using limit+1 for hasMore detection (no COUNT needed!)
    const entriesResult = await executeRead(
      'SELECT guid, title, link, description, pub_date, image, media_type FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC, id DESC LIMIT ?',
      [feedId, PAGE_SIZE + 1] // +1 for hasMore detection
    );

    const allEntryRows = entriesResult.rows as RSSEntryRow[];
    
    // Limit+1 pagination: Check if we got more than PAGE_SIZE (means there are more pages)
    const hasMore = allEntryRows.length > PAGE_SIZE;
    
    // Keep only the requested PAGE_SIZE (drop the extra row if it exists)
    const entryRows = hasMore ? allEntryRows.slice(0, PAGE_SIZE) : allEntryRows;
    
    // If no entries found, something is wrong with the feed
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

    // Get metrics data with proper error handling using the more efficient batchGetEntriesMetrics
    const token = await convexAuthNextjsToken().catch(() => {
      // Handle auth token failure gracefully
      return null;
    });

    const metricsData = await fetchQuery(
      api.entries.batchGetEntriesMetrics,
      { 
        entryGuids: entries.map(e => e.guid)
      },
      token ? { token } : undefined
    ).catch(() => {
      // Use default metrics if fetch fails
      return entries.map(() => ({
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 },
        bookmarks: { isBookmarked: false }
      }));
    });

    // Combine entries with metrics and metadata
    const entriesWithPublicData = entries.map((entry, index) => ({
      entry,
      initialData: metricsData[index] || {
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 },
        bookmarks: { isBookmarked: false }
      },
      postMetadata: {
        title: postTitle,
        featuredImg: entry.image || '',
        mediaType: mediaType || 'article'
      }
    }));

    return {
      entries: entriesWithPublicData,
      hasMore: hasMore,
      postTitles: [postTitle],
      feedUrls: [feedUrl],
      // Raw timestamp data for client-side staleness calculation
      feedTimestamp: {
        lastFetched,
        feedUrl
      }
    };

  } catch (error) {
    // Handle server errors gracefully
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