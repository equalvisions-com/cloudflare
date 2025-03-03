import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { checkAndRefreshFeeds } from "@/lib/rss.server";
import type { RSSItem } from "@/lib/rss";
import { db } from '@/lib/planetscale';
import type { RSSEntryRow } from '@/lib/types';

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

    console.log(`📡 API: /api/rss/${postTitle} called with feedUrl=${feedUrl}, mediaType=${mediaType}, page=${page}, pageSize=${pageSize}`);

    if (!feedUrl) {
      console.error('❌ API: Feed URL is required');
      return NextResponse.json(
        { error: 'Feed URL is required' },
        { status: 400 }
      );
    }

    // Check if the feed needs refreshing (4-hour revalidation)
    console.log(`🔄 API: Checking if feed needs refreshing (4-hour revalidation): ${decodedTitle}`);
    await checkAndRefreshFeeds([decodedTitle]);
    
    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
    // Build the SQL query to fetch entries for this specific feed
    const entriesQuery = `
      SELECT e.*, f.title as feed_title, f.feed_url
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title = ?
      ORDER BY e.pub_date DESC
      LIMIT ? OFFSET ?
    `;
    
    // Build the SQL query to count total entries
    const countQuery = `
      SELECT COUNT(*) as total
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title = ?
    `;
    
    console.log(`🔍 API: Executing direct PlanetScale queries for ${decodedTitle}, page ${page}`);
    
    // Execute both queries in parallel for efficiency
    const [countResult, entriesResult] = await Promise.all([
      db.execute(countQuery, [decodedTitle]),
      db.execute(entriesQuery, [decodedTitle, pageSize, offset])
    ]);
    
    const totalEntries = Number((countResult.rows[0] as { total: number }).total);
    const entries = entriesResult.rows as JoinedRSSEntry[];
    
    console.log(`🔢 API: Found ${totalEntries} total entries for ${decodedTitle}`);
    console.log(`✅ API: Retrieved ${entries.length} entries for page ${page}`);
    
    if (!entries || entries.length === 0) {
      console.log(`⚠️ API: No entries found for ${decodedTitle}`);
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false 
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
    const hasMore = totalEntries > offset + entries.length;
    
    console.log(`🚀 API: Processed ${mappedEntries.length} entries for ${decodedTitle} (total: ${totalEntries}, hasMore: ${hasMore})`);

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
      hasMore: hasMore
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