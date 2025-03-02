import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getRSSEntries } from "@/lib/rss.server";
import orderBy from 'lodash/orderBy';

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
    const page = parseInt(searchParams.get('page') || '0', 10);
    const startPage = parseInt(searchParams.get('startPage') || page.toString(), 10);
    const pageCount = parseInt(searchParams.get('pageCount') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);
    const skipFirstPage = searchParams.get('skipFirstPage') === 'true';

    console.log(`📡 API: /api/rss/${postTitle} called with feedUrl=${feedUrl}, mediaType=${mediaType}, startPage=${startPage}, pageCount=${pageCount}, pageSize=${pageSize}`);

    if (!feedUrl) {
      console.error('❌ API: Feed URL is required');
      return NextResponse.json(
        { error: 'Feed URL is required' },
        { status: 400 }
      );
    }

    // Get auth token for Convex queries
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Fetch all entries for this feed
    console.log(`🔄 API: Fetching entries for ${decodedTitle} from PlanetScale or external source`);
    const entries = await getRSSEntries(decodedTitle, feedUrl, mediaType || undefined);
    
    if (!entries || entries.length === 0) {
      console.log(`⚠️ API: No entries found for ${decodedTitle}`);
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false 
      });
    }
    
    console.log(`✅ API: Found ${entries.length} entries for ${decodedTitle}`);
    
    // Sort entries by publication date (newest first) using Lodash orderBy
    const sortedEntries = orderBy(
      entries,
      [(entry) => new Date(entry.pubDate).getTime()],
      ['desc']
    );
    
    // Apply pagination manually with support for skipping the first page
    const allEntries = [];
    const startIndex = skipFirstPage ? 1 : 0;
    
    // Loop through each page we need to fetch
    for (let i = startIndex; i < pageCount; i++) {
      const currentPage = startPage + i;
      const offset = currentPage * pageSize;
      
      // Make sure we don't go beyond the available entries
      if (offset >= sortedEntries.length) {
        break;
      }
      
      const paginatedEntries = sortedEntries.slice(offset, offset + pageSize);
      if (paginatedEntries.length === 0) {
        break;
      }
      
      allEntries.push(...paginatedEntries);
    }
    
    if (allEntries.length === 0) {
      return NextResponse.json({ 
        entries: [], 
        totalEntries: sortedEntries.length,
        hasMore: false 
      });
    }
    
    // Batch fetch entry data for all entries at once
    const guids = allEntries.map(entry => entry.guid);
    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: guids },
      { token }
    );

    // Combine all data efficiently
    const entriesWithPublicData = allEntries.map((entry, index) => ({
      entry,
      initialData: entryData[index]
    }));
    
    // Check if there are more entries available
    const nextPageOffset = (startPage + pageCount - (skipFirstPage ? 1 : 0)) * pageSize;
    const hasMore = sortedEntries.length > nextPageOffset;
    
    // Set cache control headers
    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    
    console.log(`🚀 API: Returning ${entriesWithPublicData.length} entries for ${decodedTitle}`);
    return NextResponse.json({
      entries: entriesWithPublicData,
      totalEntries: sortedEntries.length,
      hasMore
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