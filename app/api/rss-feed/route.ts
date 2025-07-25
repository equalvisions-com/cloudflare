import { NextRequest, NextResponse } from 'next/server';
import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { validateHeaders } from '@/lib/headers';

// Use Edge runtime
export const runtime = 'edge';
// Force dynamic to ensure fresh data
export const dynamic = 'force-dynamic';

// Helper function to log only in development
const devLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

export async function GET(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Check for noCache parameter to bypass Hyperdrive cache
    const url = new URL(request.url);
    const noCache = url.searchParams.get('noCache') === 'true';
    
    // Get initial entries - the function already uses noCache: true for database queries
    // so we don't need to pass skipRefresh=true to get fresh data
    const initialRSSData = await getInitialEntries(false);
    
    // If no data returned (user not authenticated or no RSS feeds)
    if (!initialRSSData) {
      return NextResponse.json(
        { 
          entries: [], 
          totalEntries: 0, 
          hasMore: false,
          postTitles: [],
          feedUrls: [],
          mediaTypes: []
        }
      );
    }
    
    // Log the mediaTypes to verify they're being included
    devLog('Returning RSS data with mediaTypes:', {
      entriesCount: initialRSSData.entries.length,
      mediaTypesCount: initialRSSData.mediaTypes?.length || 0,
      mediaTypes: initialRSSData.mediaTypes,
      cacheBypass: noCache
    });
    
    // Return the full data from the server component
    return NextResponse.json(initialRSSData);
  } catch (error) {
    console.error('Error in RSS feed API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed data' }, 
      { status: 500 }
    );
  }
} 