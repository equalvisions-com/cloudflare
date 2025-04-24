import { NextResponse } from 'next/server';
import { getInitialEntries } from "@/components/rss-feed/RSSEntriesDisplay.server";

// Use Edge runtime for this API route
export const runtime = 'edge';

export async function GET() {
  try {
    // Fetch the RSS feed data
    const rssData = await getInitialEntries();
    
    // Return the data as JSON
    return NextResponse.json(rssData);
  } catch (error) {
    console.error('Error fetching RSS data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS feed data' },
      { status: 500 }
    );
  }
} 