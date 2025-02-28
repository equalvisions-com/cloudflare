import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getRSSEntries } from "@/lib/planetscale";

export async function POST(request: NextRequest) {
  try {
    const { feedUrl, postTitle } = await request.json();

    // Get entries from PlanetScale
    const entries = await getRSSEntries(postTitle, feedUrl);
    if (!entries || entries.length === 0) {
      return NextResponse.json({ entries: [] });
    }

    // Get auth token for Convex queries
    const token = await convexAuthNextjsToken();
    
    // Extract all entry GUIDs
    const guids = entries.map(entry => entry.guid);

    // Fetch all entry data in a single batch query
    const entryData = await fetchQuery(
      api.entries.batchGetEntryData,
      { entryGuids: guids },
      { token }
    );

    // Map the results back to individual entries
    const entriesWithData = entries.map((entry, index) => ({
      entry,
      initialData: entryData[index]
    }));

    return NextResponse.json({
      entries: entriesWithData
    });

  } catch (error) {
    console.error('Error in batch route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 