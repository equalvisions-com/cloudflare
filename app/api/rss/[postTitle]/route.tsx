import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getRSSEntries } from "@/lib/redis";

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
    const page = parseInt(searchParams.get('page') || '0', 10);
    const startPage = parseInt(searchParams.get('startPage') || page.toString(), 10);
    const pageCount = parseInt(searchParams.get('pageCount') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const skipFirstPage = searchParams.get('skipFirstPage') === 'true';

    if (!feedUrl) {
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
    const entries = await getRSSEntries(decodedTitle, feedUrl);
    
    if (!entries || entries.length === 0) {
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false 
      });
    }
    
    // Apply pagination manually with support for skipping the first page
    const allEntries = [];
    const startIndex = skipFirstPage ? 1 : 0;
    
    // Loop through each page we need to fetch
    for (let i = startIndex; i < pageCount; i++) {
      const currentPage = startPage + i;
      const offset = currentPage * pageSize;
      
      // Make sure we don't go beyond the available entries
      if (offset >= entries.length) {
        break;
      }
      
      const paginatedEntries = entries.slice(offset, offset + pageSize);
      if (paginatedEntries.length === 0) {
        break;
      }
      
      allEntries.push(...paginatedEntries);
    }
    
    if (allEntries.length === 0) {
      return NextResponse.json({ 
        entries: [], 
        totalEntries: entries.length,
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
    const hasMore = entries.length > nextPageOffset;
    
    // Set cache control headers
    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    
    return NextResponse.json({
      entries: entriesWithPublicData,
      totalEntries: entries.length,
      hasMore
    }, {
      headers
    });
  } catch (error) {
    console.error(`Error in RSS route for feed ${postTitle}:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 