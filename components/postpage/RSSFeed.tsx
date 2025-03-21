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
  total_count?: number;
}

export const getInitialEntries = cache(async (postTitle: string, feedUrl: string, mediaType?: string) => {
  try {
    console.log(`🔍 SERVER: Fetching entries for feed: ${feedUrl}`);
    
    // First, check if feeds need refreshing and create if doesn't exist
    try {
      await checkAndRefreshFeeds(
        [postTitle], 
        [feedUrl], 
        mediaType ? [mediaType] : undefined
      );
      console.log('✅ Feed refresh/creation check completed');
    } catch (refreshError) {
      // Log but don't fail if refresh check fails
      console.error('Warning: Feed refresh check failed:', refreshError);
    }

    // Query feed ID and entries in an optimized way with CTE and window function
    console.log(`📊 SERVER: Executing optimized query for ${postTitle} with CTE and window function`);
    
    // Measure query execution time
    const queryStartTime = performance.now();
    
    // Build the optimized query using CTE and window function
    const combinedQuery = `
      WITH feed_cte AS (
        SELECT id FROM rss_feeds WHERE feed_url = ?
      ),
      filtered_entries AS (
        SELECT 
          e.guid,
          e.title,
          e.link,
          e.description,
          e.pub_date,
          e.image,
          e.media_type,
          e.feed_id
        FROM rss_entries e
        JOIN feed_cte f ON e.feed_id = f.id
      )
      SELECT 
        fe.*,
        COUNT(*) OVER () AS total_count
      FROM filtered_entries fe
      ORDER BY fe.pub_date DESC
      LIMIT 30
    `;
    
    // Execute the optimized query
    const result = await executeRead(combinedQuery, [feedUrl]);
    
    // Log query execution time
    const queryEndTime = performance.now();
    const queryDuration = queryEndTime - queryStartTime;
    console.log(`⏱️ SERVER: Query execution completed in ${queryDuration.toFixed(2)}ms`);
    
    // Process the query results
    const entries = result.rows as RSSEntryRow[];
    
    if (!entries.length) {
      console.log('⚠️ Feed not found or no entries after refresh attempt');
      return null;
    }
    
    // Get total count from the first row
    const totalCount = entries.length > 0 ? Number(entries[0].total_count) : 0;
    
    // If no entries found after refresh, something is wrong with the feed
    if (!entries.length) {
      console.log('⚠️ No entries found for feed after refresh attempt');
      return null;
    }

    // Type assertion for database rows
    const mappedEntries = entries.map(row => ({
      guid: row.guid,
      title: row.title,
      link: row.link,
      description: row.description || '',
      pubDate: row.pub_date,
      image: row.image || undefined,
      mediaType: row.media_type || mediaType,
      feedUrl
    }));

    // Get metrics data with proper error handling
    const token = await convexAuthNextjsToken().catch((error) => {
      console.error('Failed to get auth token:', error);
      return null;
    });

    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: mappedEntries.map(e => e.guid) },
      token ? { token } : undefined
    ).catch(error => {
      console.error('⚠️ Failed to fetch metrics, using default values:', error);
      return mappedEntries.map(() => ({
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 }
      }));
    });

    // Combine entries with metrics and metadata
    const entriesWithPublicData = mappedEntries.map((entry, index) => ({
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

    console.log(`🚀 SERVER: Returning ${entriesWithPublicData.length} initial entries (total: ${totalCount})`);

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
      pageSize={30}
      featuredImg={featuredImg}
      mediaType={mediaType}
    />
  );
}