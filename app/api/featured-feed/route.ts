import { NextResponse } from 'next/server';
import { getInitialEntries } from "@/components/featured/FeaturedFeed";

// Force Edge runtime to prevent static generation issues
export const runtime = 'edge';

export async function GET() {
  try {
    // Fetch the featured feed data
    const featuredData = await getInitialEntries();
    
    // Return the data as JSON
    return NextResponse.json(featuredData);
  } catch (error) {
    console.error('Error fetching featured data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch featured feed data' },
      { status: 500 }
    );
  }
} 