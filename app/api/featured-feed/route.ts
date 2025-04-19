import { NextResponse } from 'next/server';
import { getInitialEntries } from "@/components/featured/FeaturedFeed";

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