import { getInitialEntriesWithoutRefresh } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET() {
  try {
    // Fetch fresh RSS entries from the server
    // Always forcing a fresh fetch with no cache
    const data = await getInitialEntriesWithoutRefresh();
    
    // If no data is available, return empty array
    if (!data) {
      return NextResponse.json({ 
        entries: [], 
        totalEntries: 0,
        hasMore: false
      });
    }
    
    // Return the data in a format the client component can use
    return NextResponse.json({ 
      entries: data.entries,
      totalEntries: data.totalEntries,
      hasMore: data.hasMore,
      postTitles: data.postTitles,
      feedUrls: data.feedUrls
    });
  } catch (error) {
    console.error('Error in RSS feed API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed entries' },
      { status: 500 }
    );
  }
} 