import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { checkAndRefreshFeeds } from "@/lib/rss.server";
import type { RSSItem } from "@/lib/rss";
import { executeRead } from '@/lib/database';
import type { RSSEntryRow } from '@/lib/types';

// Use Edge runtime for this API route
export const runtime = 'edge';

// Define interface for the joined query result
interface JoinedRSSEntry extends Omit<RSSEntryRow, 'id' | 'feed_id' | 'created_at'> {
  feed_title: string;
  feed_url: string;
}

// Define the route context type with async params
interface RouteContext {
  params: Promise<{ postTitle: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  let postTitle = '';
  try {
    // Properly await the params object before accessing its properties
    const params = await context.params;
    postTitle = params.postTitle;
    const decodedTitle = decodeURIComponent(postTitle);
    
    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const feedUrl = searchParams.get('feedUrl');
    const mediaType = searchParams.get('mediaType');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);
    // Get search query if it exists
    const searchQuery = searchParams.get('q');
    // Get cached total entries from query params if available
    const cachedTotalEntries = searchParams.get('totalEntries')
      ? parseInt(searchParams.get('totalEntries') || '0', 10)
      : null;

    console.log(`📡 API: /api/rss/${postTitle} called with feedUrl=${feedUrl}, mediaType=${mediaType}, page=${page}, pageSize=${pageSize}${searchQuery ? `, search="${searchQuery}"` : ''}`);

    if (!feedUrl) {
      console.error('❌ API: Feed URL is required');
      return NextResponse.json(
        { error: 'Feed URL is required' },
        { status: 400 }
      );
    }

    // Only check if the feed needs refreshing on the first page
    // This prevents unnecessary refresh checks during pagination
    if (page === 1) {
      console.log(`🔄 API: Checking if feed needs refreshing (first page only): ${decodedTitle}`);
      await checkAndRefreshFeeds(
        [decodedTitle],
        [feedUrl],
        mediaType ? [mediaType] : undefined
      );
    } else {
      console.log(`⏩ API: Skipping refresh check for page ${page} of ${decodedTitle}`);
    }
    
    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
    // Build the SQL query to fetch entries for this specific feed
    let entriesQuery: string;
    let queryParams: any[];
    
    if (searchQuery) {
      // Query with search filter
      entriesQuery = `
        SELECT e.*, f.title as feed_title, f.feed_url
        FROM rss_entries e
        JOIN rss_feeds f ON e.feed_id = f.id
        WHERE f.title = ? AND (e.title LIKE ? OR e.description LIKE ?)
        ORDER BY e.pub_date DESC
        LIMIT ? OFFSET ?
      `;
      queryParams = [decodedTitle, `%${searchQuery}%`, `%${searchQuery}%`, pageSize, offset];
    } else {
      // Regular query without search
      entriesQuery = `
        SELECT e.*, f.title as feed_title, f.feed_url
        FROM rss_entries e
        JOIN rss_feeds f ON e.feed_id = f.id
        WHERE f.title = ?
        ORDER BY e.pub_date DESC
        LIMIT ? OFFSET ?
      `;
      queryParams = [decodedTitle, pageSize, offset];
    }
    
    // Measure query execution time
    const queryStartTime = performance.now();
    
    // Get total entries count if needed
    let totalEntries: number;
    
    if (cachedTotalEntries === null) {
      // Only perform the count query if we don't have a cached value
      console.log(`🔢 API: Fetching total entries count for ${decodedTitle}${searchQuery ? ` with search "${searchQuery}"` : ''}`);
      
      let countQuery: string;
      let countParams: any[];
      
      if (searchQuery) {
        countQuery = `
          SELECT COUNT(e.id) as total
          FROM rss_entries e
          JOIN rss_feeds f ON e.feed_id = f.id
          WHERE f.title = ? AND (e.title LIKE ? OR e.description LIKE ?)
        `;
        countParams = [decodedTitle, `%${searchQuery}%`, `%${searchQuery}%`];
      } else {
        countQuery = `
          SELECT COUNT(e.id) as total
          FROM rss_entries e
          JOIN rss_feeds f ON e.feed_id = f.id
          WHERE f.title = ?
        `;
        countParams = [decodedTitle];
      }
      
      const countResult = await executeRead(countQuery, countParams);
      totalEntries = Number((countResult.rows[0] as { total: number }).total);
      console.log(`🔢 API: Found ${totalEntries} total entries for ${decodedTitle}${searchQuery ? ` with search "${searchQuery}"` : ''} (from database)`);
    } else {
      // Use the cached value
      totalEntries = cachedTotalEntries;
      console.log(`🔢 API: Using cached total count: ${totalEntries} entries for ${decodedTitle}`);
    }
    
    // Execute entries query
    const entriesResult = await executeRead(entriesQuery, queryParams);
    
    // Log query execution time
    const queryEndTime = performance.now();
    const queryDuration = queryEndTime - queryStartTime;
    console.log(`⏱️ API: Query execution completed in ${queryDuration.toFixed(2)}ms`);
    
    const entries = entriesResult.rows as JoinedRSSEntry[];
    
    console.log(`✅ API: Retrieved ${entries.length} entries for page ${page} of ${Math.ceil(totalEntries / pageSize)}`);
    console.log(`📊 API: Pagination details - page ${page}, offset ${offset}, pageSize ${pageSize}, total ${totalEntries}`);
    
    if (!entries || entries.length === 0) {
      console.log(`⚠️ API: No entries found for ${decodedTitle}${searchQuery ? ` with search "${searchQuery}"` : ''}`);
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false,
        searchQuery: searchQuery || undefined
      });
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
    
    // Determine if there are more entries
    // Add a small buffer (2) to account for potential inconsistencies in cached counts
    const hasMore = cachedTotalEntries !== null 
      ? totalEntries > (offset + entries.length + 2) 
      : totalEntries > (offset + entries.length);
    
    console.log(`🚀 API: Processed ${mappedEntries.length} entries for ${decodedTitle}${searchQuery ? ` with search "${searchQuery}"` : ''} (total: ${totalEntries}, hasMore: ${hasMore})`);

    // Get auth token for Convex queries
    const token = await convexAuthNextjsToken().catch(() => null);
    
    // Batch fetch entry data for all entries at once
    const guids = mappedEntries.map((entry: RSSItem) => entry.guid);
    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: guids },
      token ? { token } : undefined
    );

    // Combine all data efficiently
    const entriesWithPublicData = mappedEntries.map((entry: RSSItem, index: number) => ({
      entry,
      initialData: entryData[index]
    }));
    
    // Set cache control headers
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
    headers.set('Vercel-CDN-Cache-Control', 'max-age=300');
    headers.set('CDN-Cache-Control', 'max-age=300');
    headers.set('Surrogate-Control', 'max-age=300');
    
    console.log(`🚀 API: Returning ${entriesWithPublicData.length} entries for ${decodedTitle}`);
    return NextResponse.json({
      entries: entriesWithPublicData,
      totalEntries: totalEntries,
      hasMore: hasMore,
      searchQuery: searchQuery || undefined
    }, {
      headers
    });
  } catch (error) {
    console.error(`❌ API: Error in RSS route for feed ${postTitle}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 