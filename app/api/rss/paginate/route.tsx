import { NextRequest, NextResponse } from 'next/server';
import type { RSSItem } from "@/lib/rss";
import { executeRead } from '@/lib/database';
import { refreshExistingFeeds } from '@/lib/rss.server';
import type { RSSEntryRow } from '@/lib/types';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { validateHeaders } from '@/lib/headers';

// Use Edge runtime for this API route
export const runtime = 'edge';
// Mark as dynamic to ensure fresh data for pagination
export const dynamic = 'force-dynamic';

// Define interface for the joined query result
interface JoinedRSSEntry extends Omit<RSSEntryRow, 'id' | 'feed_id' | 'created_at'> {
  feed_title: string;
  feed_url: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Get parameters from request body instead of query params
    const body = await request.json();
    const { 
      postTitles = [], 
      feedUrls = [], 
      page = 1, 
      pageSize = 30, 
      totalEntries: cachedTotalEntries = null,
      currentEntriesCount = null 
    } = body;
    
    if (!postTitles.length && !feedUrls.length) {
      console.error('❌ API: Either post titles or feed URLs are required');
      return NextResponse.json(
        { error: 'Either post titles or feed URLs are required' },
        { status: 400 }
      );
    }

    // Validate arrays
    if (!Array.isArray(postTitles) || !Array.isArray(feedUrls)) {
      console.error('❌ API: postTitles and feedUrls must be arrays');
      return NextResponse.json(
        { error: 'postTitles and feedUrls must be arrays' },
        { status: 400 }
      );
    }

    if (postTitles.length === 0 && feedUrls.length === 0) {
      return NextResponse.json({ entries: [], hasMore: false, totalEntries: 0, postTitles: [] });
    }

    // Skip refresh checks for all pages - the dedicated refresh-feeds endpoint now handles
    // creating and refreshing feeds. This makes pagination much faster and smoother.
    
    // CRITICAL FIX: Calculate offset based on current entries count if available
    // This prevents duplication when new entries are added to the top of the feed
    let offset: number;
    if (currentEntriesCount !== null && currentEntriesCount > 0) {
      // Use the current entries count as the offset to get the next batch
      offset = currentEntriesCount;
    } else {
      // Fallback to traditional page-based offset calculation
      offset = (page - 1) * pageSize;
    }
    
    // Build SQL query based on whether we have titles, URLs, or both
    // Use a two-step approach for better performance:
    // 1. First query the small feeds table to get feed IDs matching either titles or URLs
    // 2. Then use these feed IDs to efficiently query the entries table
    
    // Step 1: Build the feed IDs query
    let feedIdsQuery = '';
    let feedIdsParams = [];
    
    if (postTitles.length > 0 && feedUrls.length > 0) {
      // We have both titles and URLs, query using either
      const titlePlaceholders = postTitles.map(() => '?').join(',');
      const urlPlaceholders = feedUrls.map(() => '?').join(',');
      
      feedIdsQuery = `
        SELECT id 
        FROM rss_feeds 
        WHERE title IN (${titlePlaceholders}) OR feed_url IN (${urlPlaceholders})
      `;
      
      feedIdsParams = [...postTitles, ...feedUrls];
    } else if (postTitles.length > 0) {
      // Only have titles
      const placeholders = postTitles.map(() => '?').join(',');
      
      feedIdsQuery = `
        SELECT id 
        FROM rss_feeds 
        WHERE title IN (${placeholders})
      `;
      
      feedIdsParams = [...postTitles];
    } else {
      // Only have URLs
      const placeholders = feedUrls.map(() => '?').join(',');
      
      feedIdsQuery = `
        SELECT id 
        FROM rss_feeds 
        WHERE feed_url IN (${placeholders})
      `;
      
      feedIdsParams = [...feedUrls];
    }
    
    // Execute the feed IDs query first
    const feedIdsResult = await executeRead(feedIdsQuery, feedIdsParams);
    const feedIds = (feedIdsResult.rows as { id: number }[]).map(row => row.id);
    
    // If no feed IDs were found, return empty result early
    if (feedIds.length === 0) {
      return NextResponse.json({
        entries: [],
        hasMore: false,
        totalEntries: 0,
        postTitles,
        feedUrls
      });
    }
    
    // Step 2: Use the feed IDs to query entries efficiently
    // Create placeholders for the feed IDs
    const feedIdPlaceholders = feedIds.map(() => '?').join(',');
    
    // Build the entries query using feed IDs instead of titles/URLs
    const entriesQuery = `
      SELECT e.*, f.title as feed_title, f.feed_url
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE e.feed_id IN (${feedIdPlaceholders})
      ORDER BY e.pub_date DESC
      LIMIT ? OFFSET ?
    `;
    
    const entriesParams = [...feedIds, pageSize, offset];
    
    // Measure query execution time
    const queryStartTime = performance.now();
    
    let totalEntries: number;
    
    // Only fetch count if we don't have the cached value and it's the first page or cached value is null
    if (cachedTotalEntries === null) {
      // Build the count query using feed IDs for better performance
      const countQuery = `
        SELECT COUNT(e.id) as total
        FROM rss_entries e
        WHERE e.feed_id IN (${feedIdPlaceholders})
      `;
      
      // Execute count query with feed IDs
      const countResult = await executeRead(countQuery, feedIds);
      totalEntries = Number((countResult.rows[0] as { total: number }).total);
    } else {
      // Use the cached total entries value
      totalEntries = cachedTotalEntries;
    }
    
    // Execute entries query with feed IDs
    const entriesResult = await executeRead(entriesQuery, entriesParams);
    
    // Log query execution time
    const queryEndTime = performance.now();
    const queryDuration = queryEndTime - queryStartTime;
    
    const entries = entriesResult.rows as JoinedRSSEntry[];
    
    // CRITICAL FIX: If we retrieve entries but our cached count says we shouldn't have any,
    // or if we have more entries than expected, the cached count is wrong and needs recalculation
    if (cachedTotalEntries !== null && 
        ((offset >= totalEntries && entries.length > 0) || 
         (totalEntries <= offset + entries.length && entries.length === pageSize))) {
      
      // Force recalculation of the total count using feed IDs
      const recountQuery = `
        SELECT COUNT(e.id) as total
        FROM rss_entries e
        WHERE e.feed_id IN (${feedIdPlaceholders})
      `;
      
      const countResult = await executeRead(recountQuery, feedIds);
      const recalculatedTotal = Number((countResult.rows[0] as { total: number }).total);
      
      totalEntries = recalculatedTotal;
    }
    
    // Map the entries to the expected format
    const mappedEntries: RSSItem[] = entries.map(entry => ({
      guid: entry.guid,
      title: entry.title,
      link: entry.link,
      pubDate: entry.pub_date,
      description: entry.description || undefined,
      image: entry.image || undefined,
      mediaType: entry.media_type || undefined,
      feedTitle: entry.feed_title,
      feedUrl: entry.feed_url
    }));
    
    // Determine if there are more entries - IMPROVED CALCULATION
    // If we have a full page of results (pageSize), and our total suggests there are more,
    // then we definitely have more entries
    const hasMore = entries.length === pageSize && 
                    totalEntries > (offset + entries.length);
    
    // Prepare the response data
    const responseData = {
      entries: mappedEntries,
      hasMore,
      totalEntries,
      postTitles,
      feedUrls: feedUrls.length > 0 ? feedUrls : 
                entries.length > 0 ? [...new Set(entries.map(e => e.feed_url))] : []
    };
    
    // ✅ ADDED: Fetch entry metrics for pagination (same pattern as other feeds)
    // Server provides initial metrics for fast rendering, client hook provides reactive updates
    let entryMetrics: Record<string, any> = {};
    if (mappedEntries.length > 0) {
      try {
        // Get auth token for Convex query
        const token = await convexAuthNextjsToken();
        
        // Extract GUIDs for metrics query
        const guids = mappedEntries.map(entry => entry.guid);
        
        const metricsStartTime = Date.now();
        
        // Fetch metrics from Convex
        const metrics = await fetchQuery(
          api.entries.batchGetEntriesMetrics,
          { entryGuids: guids, includeCommentLikes: false },
          { token }
        );
        
        // Create a map of guid to metrics
        entryMetrics = Object.fromEntries(
          guids.map((guid, index) => [guid, metrics[index]])
        );
      } catch (error) {
        console.error("⚠️ API: Error fetching pagination entry metrics:", error);
        // Continue without metrics
      }
    }

    // Return entries with both data and metrics
    const entriesWithData = mappedEntries.map((entry, index) => ({
      entry,
      initialData: entryMetrics[entry.guid] || {
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 },
        bookmarks: { isBookmarked: false }
      }
    }));

    const finalResponseData = {
      entries: entriesWithData,
      hasMore,
      totalEntries,
      postTitles,
      feedUrls: feedUrls.length > 0 ? feedUrls : 
                entries.length > 0 ? [...new Set(entries.map(e => e.feed_url))] : []
    };
    
    return NextResponse.json(finalResponseData);
    
  } catch (error) {
    console.error('❌ API: Error fetching merged feed', error);
    return NextResponse.json(
      { error: 'Failed to fetch merged feed' },
      { status: 500 }
    );
  }
}