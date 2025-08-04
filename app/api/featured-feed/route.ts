import { NextRequest, NextResponse } from 'next/server';
import { getInitialEntries } from "@/components/featured/FeaturedFeed";
import { validateHeaders } from '@/lib/headers';

// Force Edge runtime to prevent static generation issues
export const runtime = 'edge';

export async function GET(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
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