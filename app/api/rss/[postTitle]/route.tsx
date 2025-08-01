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

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  let postTitle = '';
  try {
    // Properly await the params object before accessing its properties
    const params = await context.params;
    postTitle = params.postTitle;
    const decodedTitle = decodeURIComponent(postTitle);
    
    // Get parameters from request body instead of query params
    const body = await request.json();
    const {
      feedUrl,
      mediaType,
      page = 1,
      pageSize = 30,
      currentEntriesCount,
      q: searchQuery,
      totalEntries: cachedTotalEntries
    } = body;

    if (!feedUrl) {
      return NextResponse.json(
        { error: 'Feed URL is required' },
        { status: 400 }
      );
    }

    // Only check if the feed needs refreshing on the first page
    // This prevents unnecessary refresh checks during pagination
    if (page === 1) {
      await checkAndRefreshFeeds(
        [decodedTitle],
        [feedUrl],
        mediaType ? [mediaType] : undefined
      );
    } else {
      // console.log(`⏩ API: Skipping refresh check for page ${page} of ${decodedTitle}`);
    }
    
    // CRITICAL FIX: Calculate offset based on current entries count if available
    // This prevents duplication when new entries are prepended to the feed
    let offset: number;
    if (currentEntriesCount !== null && currentEntriesCount !== undefined && currentEntriesCount > 0) {
      // Use the current entries count as the offset to get the next batch
      offset = currentEntriesCount;
    } else {
      // Fallback to traditional page-based offset calculation
      offset = (page - 1) * pageSize;
    }
    
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
    
    if (cachedTotalEntries === null || searchQuery) {
      // Always perform the count query if:
      // 1. We don't have a cached value (cachedTotalEntries === null), OR
      // 2. We're doing a search (searchQuery exists) - because search results have different totals
      
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
    } else {
      // Use the cached value
      totalEntries = cachedTotalEntries;
    }
    
    // Execute entries query
    const entriesResult = await executeRead(entriesQuery, queryParams);
    
    // Log query execution time
    const queryEndTime = performance.now();
    const queryDuration = queryEndTime - queryStartTime;
    // console.log(`⏱️ API: Query execution completed in ${queryDuration.toFixed(2)}ms`);
    
    const entries = entriesResult.rows as JoinedRSSEntry[];
    
    // console.log(`✅ API: Retrieved ${entries.length} entries for page ${page} of ${Math.ceil(totalEntries / pageSize)}`);
    // console.log(`📊 API: Pagination details - page ${page}, offset ${offset}, pageSize ${pageSize}, total ${totalEntries}`);
    
    if (!entries || entries.length === 0) {
      // console.log(`⚠️ API: No entries found for ${decodedTitle}${searchQuery ? ` with search "${searchQuery}"` : ''}`);
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
    // Simple and reliable calculation: if we got a full page and there are more entries beyond current offset
    const hasMore = entries.length === pageSize && totalEntries > (offset + entries.length);
    
    // console.log('📄 API hasMore calculation:', {
    //   entriesReturned: entries.length,
    //   pageSize,
    //   totalEntries,
    //   offset,
    //   currentPosition: offset + entries.length,
    //   hasMore,
    //   calculation: `${entries.length} === ${pageSize} && ${totalEntries} > ${offset + entries.length}`
    // });
    
    // console.log(`🚀 API: Processed ${mappedEntries.length} entries for ${decodedTitle}${searchQuery ? ` with search "${searchQuery}"` : ''} (total: ${totalEntries}, hasMore: ${hasMore})`);

    // Get auth token for Convex queries
    const token = await convexAuthNextjsToken().catch(() => null);
    
    // Batch fetch entry data for all entries at once
    const guids = mappedEntries.map((entry: RSSItem) => entry.guid);
    const entryData = await fetchQuery(
      api.entries.batchGetEntriesMetrics,
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
    
    // console.log(`🚀 API: Returning ${entriesWithPublicData.length} entries for ${decodedTitle}`);
    
    const responseData = {
      entries: entriesWithPublicData,
      totalEntries: totalEntries,
      hasMore: hasMore,
      searchQuery: searchQuery || undefined
    };
    
    // console.log(`🔥 API: Final response data:`, {
    //   entriesCount: responseData.entries.length,
    //   totalEntries: responseData.totalEntries,
    //   hasMore: responseData.hasMore,
    //   searchQuery: responseData.searchQuery,
    //   hasMoreCalculation: `${entriesWithPublicData.length} === ${pageSize} && ${totalEntries} > ${offset + entriesWithPublicData.length}`
    // });
    
    return NextResponse.json(responseData, {
      headers
    });
  } catch (error) {
    // console.error(`❌ API: Error in RSS route for feed ${postTitle}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 