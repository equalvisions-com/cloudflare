import { NextRequest, NextResponse } from 'next/server';
import type { RSSItem } from "@/lib/rss";
import { executeRead } from '@/lib/database';
import { refreshExistingFeeds } from '@/lib/rss.server';
import type { RSSEntryRow } from '@/lib/types';

// Use Edge runtime for this API route
export const runtime = 'edge';
// Mark as dynamic to ensure fresh data for pagination
export const dynamic = 'force-dynamic';
// Disable revalidation
export const revalidate = 0;

// Define interface for the joined query result
interface JoinedRSSEntry extends Omit<RSSEntryRow, 'id' | 'feed_id' | 'created_at'> {
  feed_title: string;
  feed_url: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const postTitlesParam = searchParams.get('postTitles');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);
    // Get total entries from query params if available (passed from client during pagination)
    const cachedTotalEntries = searchParams.get('totalEntries') 
      ? parseInt(searchParams.get('totalEntries') || '0', 10) 
      : null;
    
    // Get feed URLs from query params, if available
    const feedUrlsParam = searchParams.get('feedUrls');
    
    console.log(`📡 API: /api/rss/paginate called with page=${page}, pageSize=${pageSize}`);
    
    if (!postTitlesParam && !feedUrlsParam) {
      console.error('❌ API: Either post titles or feed URLs are required');
      return NextResponse.json(
        { error: 'Either post titles or feed URLs are required' },
        { status: 400 }
      );
    }

    let postTitles: string[] = [];
    if (postTitlesParam) {
      try {
        postTitles = JSON.parse(decodeURIComponent(postTitlesParam));
        if (!Array.isArray(postTitles)) {
          throw new Error('Post titles must be an array');
        }
      } catch (error) {
        console.error('❌ API: Invalid post titles format', error);
        return NextResponse.json(
          { error: 'Invalid post titles format' },
          { status: 400 }
        );
      }
      console.log(`📋 API: Post titles: ${postTitles.join(', ')}`);
    }
    
    // Parse feed URLs if provided
    let feedUrls: string[] = [];
    if (feedUrlsParam) {
      try {
        feedUrls = JSON.parse(decodeURIComponent(feedUrlsParam));
        if (!Array.isArray(feedUrls)) {
          throw new Error('Feed URLs must be an array');
        }
      } catch (error) {
        console.error('❌ API: Invalid feed URLs format', error);
        return NextResponse.json(
          { error: 'Invalid feed URLs format' },
          { status: 400 }
        );
      }
      console.log(`🔗 API: Feed URLs: ${feedUrls.length} URLs provided`);
    }
    
    if (postTitles.length === 0 && feedUrls.length === 0) {
      console.warn('⚠️ API: No post titles or feed URLs provided');
      return NextResponse.json({ entries: [], hasMore: false, totalEntries: 0, postTitles: [] });
    }

    // Skip refresh checks for all pages - the dedicated refresh-feeds endpoint now handles
    // creating and refreshing feeds. This makes pagination much faster and smoother.
    console.log(`⏩ API: Skipping feed refresh check - the refresh-feeds endpoint handles refreshing`);
    
    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
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
      console.log('No matching feeds found for the provided titles or URLs');
      return NextResponse.json({
        entries: [],
        hasMore: false,
        totalEntries: 0,
        postTitles,
        feedUrls
      });
    }
    
    console.log(`🔍 API: Found ${feedIds.length} matching feeds`);
    
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
      console.log('🔢 API: Fetching total count of entries');
      
      // Build the count query using feed IDs for better performance
      const countQuery = `
        SELECT COUNT(e.id) as total
        FROM rss_entries e
        WHERE e.feed_id IN (${feedIdPlaceholders})
      `;
      
      // Execute count query with feed IDs
      const countResult = await executeRead(countQuery, feedIds);
      totalEntries = Number((countResult.rows[0] as { total: number }).total);
      console.log(`🔢 API: Found ${totalEntries} total entries across ${feedIds.length} feeds (from database)`);
    } else {
      // Use the cached total entries value
      totalEntries = cachedTotalEntries;
      console.log(`🔢 API: Using cached total count: ${totalEntries} entries`);
    }
    
    // Execute entries query with feed IDs
    const entriesResult = await executeRead(entriesQuery, entriesParams);
    
    // Log query execution time
    const queryEndTime = performance.now();
    const queryDuration = queryEndTime - queryStartTime;
    console.log(`⏱️ API: Query execution completed in ${queryDuration.toFixed(2)}ms`);
    
    const entries = entriesResult.rows as JoinedRSSEntry[];
    
    // CRITICAL FIX: If we retrieve entries but our cached count says we shouldn't have any,
    // or if we have more entries than expected, the cached count is wrong and needs recalculation
    if (cachedTotalEntries !== null && 
        ((offset >= totalEntries && entries.length > 0) || 
         (totalEntries <= offset + entries.length && entries.length === pageSize))) {
      
      console.log(`⚠️ API: Count inconsistency detected! Cached count (${totalEntries}) but found ${entries.length} entries at offset ${offset}`);
      
      // Force recalculation of the total count using feed IDs
      const recountQuery = `
        SELECT COUNT(e.id) as total
        FROM rss_entries e
        WHERE e.feed_id IN (${feedIdPlaceholders})
      `;
      
      const countResult = await executeRead(recountQuery, feedIds);
      const recalculatedTotal = Number((countResult.rows[0] as { total: number }).total);
      
      console.log(`🔄 API: Recalculated total entries: ${recalculatedTotal} (was ${totalEntries})`);
      totalEntries = recalculatedTotal;
    }
    
    console.log(`✅ API: Retrieved ${entries.length} entries for page ${page} of ${Math.ceil(totalEntries / pageSize)}`);
    console.log(`📊 API: Pagination details - page ${page}, offset ${offset}, pageSize ${pageSize}, total ${totalEntries}`);
    
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
    
    console.log(`🚀 API: Returning ${mappedEntries.length} merged entries for page ${page} (total: ${totalEntries}, hasMore: ${hasMore})`);
    
    // Prepare the response data
    const responseData = {
      entries: mappedEntries,
      hasMore,
      totalEntries,
      postTitles,
      feedUrls: feedUrls.length > 0 ? feedUrls : 
                entries.length > 0 ? [...new Set(entries.map(e => e.feed_url))] : []
    };
    
    // Set no-cache headers to ensure fresh results with every request
    const headers = new Headers();
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    
    return NextResponse.json(responseData, { headers });
    
  } catch (error) {
    console.error('❌ API: Error fetching merged feed', error);
    return NextResponse.json(
      { error: 'Failed to fetch merged feed' },
      { status: 500 }
    );
  }
} 