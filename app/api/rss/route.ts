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
      
      // If we got no entries with skip-refresh, try again with refresh enabled
      // This handles the case where a user has no entries yet (first-time or new feeds)
      if (data && data.entries && data.entries.length === 0 && data.feedUrls && data.feedUrls.length > 0) {
        // Call the refresh endpoint directly to create the feeds
        try {
          const refreshResponse = await fetch(`${url.origin}/api/refresh-feeds`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              postTitles: data.postTitles || [],
              feedUrls: data.feedUrls || [],
              mediaTypes: data.mediaTypes || [],
              existingGuids: []
            }),
          });
          
          if (refreshResponse.ok) {
            // Now try again to get entries
            data = await getInitialEntriesWithoutRefresh();
          }
        } catch (refreshError) {
          console.error('❌ Error calling refresh endpoint:', refreshError);
        }
      }
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