// app/api/rss/route.tsx
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getInitialEntries, getInitialEntriesWithoutRefresh, invalidateAllCountCaches } from "@/components/rss-feed/RSSEntriesDisplay.server";

// Mark as dynamic to ensure fresh data on follow/unfollow actions
export const dynamic = 'force-dynamic';
// Use Edge runtime for this API route
export const runtime = 'edge';
// Disable revalidation
export const revalidate = 0;

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    
    // Check for refresh flag - when true, use getInitialEntries with refresh enabled
    const refreshFlag = url.searchParams.get('refresh') === 'true';
    
    console.log(`🔄 API: RSS feed requested with refresh=${refreshFlag}`);
    
    let data;
    if (refreshFlag) {
      // When refreshing (e.g., after follow/unfollow), invalidate all count caches
      // to ensure fresh counts are calculated
      console.log('🗑️ API: Invalidating count caches due to refresh request');
      invalidateAllCountCaches();
      
      // Use getInitialEntries with refresh enabled
      console.log('🔄 Forced refresh requested, using getInitialEntries with refresh enabled');
      data = await getInitialEntries(false); // false = do not skip refresh
    } else {
      // Use getInitialEntriesWithoutRefresh to skip refresh
      console.log('⏩ Using getInitialEntriesWithoutRefresh - skipping refresh');
      data = await getInitialEntriesWithoutRefresh();
      
      // If we got no entries with skip-refresh, try again with refresh enabled
      // This handles the case where a user has no entries yet (first-time or new feeds)
      if (data && data.entries && data.entries.length === 0 && data.feedUrls && data.feedUrls.length > 0) {
        console.log('⚠️ No entries found with skip-refresh, retrying with refresh enabled');
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
            console.log('✅ Successfully created feeds via refresh endpoint');
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
    
    console.log(`✅ API: Returning ${data.entries.length} RSS entries`);
    
    // Set no-cache headers to ensure fresh results with every request
    const headers = new Headers();
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    
    return NextResponse.json(data, { headers });
  } catch (error) {
    // Handle errors
    console.error('❌ Error in RSS API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RSS data' },
      { status: 500 }
    );
  }
}