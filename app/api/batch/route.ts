import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getRSSEntries } from "@/lib/rss.server";

export const runtime = 'edge';


export async function POST(request: NextRequest) {
  try {
    const { feedUrl, postTitle, mediaType } = await request.json();

    // Use a try-catch block to handle any errors with Edge compatibility
    let result;
    try {
      // Get entries from PlanetScale
      result = await getRSSEntries(postTitle, feedUrl, mediaType);
    } catch (err) {
      console.error('Error fetching RSS entries:', err);
      return NextResponse.json({ 
        error: 'Failed to fetch RSS entries', 
        entries: [] 
      });
    }

    if (!result || result.entries.length === 0) {
      return NextResponse.json({ entries: [] });
    }

    try {
      // Get auth token for Convex queries
      const token = await convexAuthNextjsToken();
      
      // Extract all entry GUIDs
      const guids = result.entries.map(entry => entry.guid);

      // Fetch all entry data in a single batch query
      const entryData = await fetchQuery(
        api.entries.batchGetEntryData,
        { entryGuids: guids },
        { token }
      );

      // Map the results back to individual entries
      const entriesWithData = result.entries.map((entry, index) => ({
        entry,
        initialData: entryData[index]
      }));

      return NextResponse.json({
        entries: entriesWithData
      });
    } catch (err) {
      console.error('Error fetching data from Convex:', err);
      // Return only the RSS entries if Convex fails
      return NextResponse.json({
        entries: result.entries.map(entry => ({ entry, initialData: null }))
      });
    }
  } catch (error) {
    console.error('Error in batch route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 