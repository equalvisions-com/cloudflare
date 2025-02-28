// app/api/rss/route.tsx
import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import orderBy from 'lodash/orderBy';
import type { RSSItem } from "@/lib/rss";
import mysql from 'mysql2/promise';
import { getRSSEntries } from "@/lib/rss.server";

// Create a connection pool for this API route
const pool = mysql.createPool(process.env.DATABASE_URL || '');

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const postTitlesParam = searchParams.get('postTitles');
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const startPage = parseInt(searchParams.get('startPage') || '0', 10);
    const pageCount = parseInt(searchParams.get('pageCount') || '1', 10);
    
    console.log(`📡 API: /api/rss merged feed called with offset=${offset}, limit=${limit}, startPage=${startPage}, pageCount=${pageCount}`);
    
    if (!postTitlesParam) {
      console.error('❌ API: Post titles are required');
      return NextResponse.json(
        { error: 'Post titles are required' },
        { status: 400 }
      );
    }
    
    // Parse post titles
    let postTitles: string[];
    try {
      // Make sure to decode the URI component before parsing
      postTitles = JSON.parse(decodeURIComponent(postTitlesParam));
      if (!Array.isArray(postTitles)) {
        throw new Error('Post titles must be an array');
      }
      console.log(`🔍 API: Requested ${postTitles.length} feeds: ${postTitles.join(', ')}`);
    } catch (error) {
      console.error('❌ API: Invalid post titles format', error);
      return NextResponse.json(
        { error: 'Invalid post titles format' },
        { status: 400 }
      );
    }
    
    // Get auth token for Convex queries - not used in this function but kept for future use
    await convexAuthNextjsToken().catch(() => null);
    
    // Get feed URLs for each post title
    console.log(`🔄 API: Looking up feed URLs for ${postTitles.length} post titles`);
    const feedUrlsPromises = postTitles.map(async (title) => {
      // Query the database to get the feed URL for this post title
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT feed_url FROM rss_feeds WHERE title = ?',
        [title]
      );
      
      return rows.length > 0 ? rows[0].feed_url as string : null;
    });
    
    const feedUrls = await Promise.all(feedUrlsPromises);
    const validFeedUrls = feedUrls.filter(Boolean) as string[];
    
    if (validFeedUrls.length === 0) {
      console.log(`⚠️ API: No valid feed URLs found for the requested post titles`);
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false 
      });
    }
    
    console.log(`✅ API: Found ${validFeedUrls.length} valid feed URLs out of ${postTitles.length} requested`);
    
    // Fetch entries for each feed URL
    const entriesPromises = validFeedUrls.map(async (feedUrl, index) => {
      if (postTitles[index]) {
        console.log(`🔄 API: Fetching entries for ${postTitles[index]} from ${feedUrl}`);
        const entries = await getRSSEntries(postTitles[index], feedUrl);
        return entries;
      }
      return [];
    });
    
    const allEntriesArrays = await Promise.all(entriesPromises);
    const allEntries: RSSItem[] = allEntriesArrays.flat();
    
    if (allEntries.length === 0) {
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false 
      });
    }
    
    // Sort by publication date (newest first)
    const sortedEntries = orderBy(
      allEntries,
      [(entry: RSSItem) => new Date(entry.pubDate).getTime()],
      ['desc']
    );
    
    // Apply pagination based on startPage and pageCount if provided
    let paginatedEntries;
    if (startPage > 0 && pageCount > 0) {
      const startIndex = startPage * limit;
      const endIndex = startIndex + (pageCount * limit);
      paginatedEntries = sortedEntries.slice(startIndex, endIndex);
    } else {
      // Otherwise use simple offset/limit pagination
      paginatedEntries = sortedEntries.slice(offset, offset + limit);
    }
    
    // Check if there are more entries
    const hasMore = startPage > 0 
      ? sortedEntries.length > (startPage + pageCount) * limit
      : sortedEntries.length > offset + limit;
    
    // Set cache control headers
    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    
    console.log(`🚀 API: Returning ${paginatedEntries.length} merged entries (${offset}-${offset+limit} of ${sortedEntries.length})`);
    return NextResponse.json({
      entries: paginatedEntries,
      totalEntries: sortedEntries.length,
      hasMore
    }, {
      headers
    });
  } catch (error) {
    console.error('❌ API: Error in merged RSS route:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}