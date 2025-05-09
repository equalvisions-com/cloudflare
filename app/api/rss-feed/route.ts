import { NextResponse } from 'next/server';
import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";

// Use Edge runtime
export const runtime = 'edge';
// Force dynamic to ensure fresh data
export const dynamic = 'force-dynamic';
// Disable caching
export const revalidate = 0;

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

export async function GET() {
  try {
    // Get initial entries with mediaTypes
    const initialRSSData = await getInitialEntries();
    
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
      mediaTypes: initialRSSData.mediaTypes
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