// app/api/rss/route.tsx
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getInitialEntries, getInitialEntriesWithoutRefresh, invalidateAllCountCaches } from "@/components/rss-feed/RSSEntriesDisplay.server";
import { validateHeaders } from '@/lib/headers';

// Mark as dynamic to ensure fresh data on follow/unfollow actions
export const dynamic = 'force-dynamic';
// Use Edge runtime for this API route
export const runtime = 'edge';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const url = new URL(request.url);
    
    // Check for refresh flag - when true, use getInitialEntries with refresh enabled
    const refreshFlag = url.searchParams.get('refresh') === 'true';
    
    let data;
    if (refreshFlag) {
      // When refreshing (e.g., after follow/unfollow), invalidate all count caches
      // to ensure fresh counts are calculated
      invalidateAllCountCaches();
      
      // Use getInitialEntries with refresh enabled
      data = await getInitialEntries(false); // false = do not skip refresh
    } else {
      // Use getInitialEntriesWithoutRefresh to skip refresh
      data = await getInitialEntriesWithoutRefresh();
      
      // Feed creation and refresh now handled by queue/worker system
      // If no entries found, the client-side components will trigger queue refresh
      // This eliminates server-side blocking and improves page load performance
    }
    
    if (!data) {
      // If no data is available, return empty array
      console.warn('⚠️ API: No RSS data available');
      return NextResponse.json({
        entries: [],
        totalEntries: 0,
        hasMore: false,
        postTitles: [],
        feedUrls: []
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    // Handle errors
    console.error('❌ Error in RSS API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS data' },
      { status: 500 }
    );
  }
}