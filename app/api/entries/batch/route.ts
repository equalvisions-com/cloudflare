import { NextRequest, NextResponse } from "next/server";
import { executeRead } from "@/lib/database";

export const runtime = 'edge';


/**
 * API route to fetch entry details from PlanetScale by GUIDs
 * This allows us to get the complete entry data for activity items
 */
export async function POST(request: NextRequest) {
  try {
    const { guids } = await request.json();
    
    if (!guids || !Array.isArray(guids) || guids.length === 0) {
      console.error("❌ Missing or invalid guids parameter:", guids);
      return NextResponse.json(
        { error: "Missing or invalid guids parameter" },
        { status: 400 }
      );
    }

    // Limit the number of GUIDs to prevent abuse
    const limitedGuids = guids.slice(0, 100);
    
    console.log(`🔍 Fetching ${limitedGuids.length} entries from PlanetScale by GUIDs`);
    console.log(`🔍 Sample GUIDs: ${limitedGuids.slice(0, 3).join(', ')}`);
    
    // Query PlanetScale for entries by GUIDs
    const query = `
      SELECT 
        e.id, 
        e.feed_id, 
        e.guid, 
        e.title, 
        e.link, 
        e.description, 
        e.pub_date, 
        e.image,
        e.media_type as mediaType,
        f.title as feed_title,
        f.feed_url
      FROM 
        rss_entries e
      LEFT JOIN 
        rss_feeds f ON e.feed_id = f.id
      WHERE 
        e.guid IN (${limitedGuids.map(() => '?').join(',')})
    `;
    
    try {
      const entries = await executeRead(query, limitedGuids);
      
      // Create a map of guid to entry for easy lookup
      const entryMap = new Map();
      
      // Add type assertion to fix TypeScript error
      interface EntryRow {
        guid: string;
        title: string;
        link: string;
        description?: string;
        pub_date: string;
        [key: string]: any;
      }
      
      for (const entry of entries.rows as EntryRow[]) {
        entryMap.set(entry.guid, entry);
      }
      
      // Return entries in the same order as the input guids
      const orderedEntries = limitedGuids.map(guid => entryMap.get(guid) || null).filter(Boolean);
      
      console.log(`✅ Returning ${orderedEntries.length} entries out of ${limitedGuids.length} requested`);
      
      if (orderedEntries.length < limitedGuids.length) {
        console.warn(`⚠️ Could not find all requested entries - missing ${limitedGuids.length - orderedEntries.length} entries`);
        console.warn(`⚠️ Missing GUIDs: ${limitedGuids.filter(guid => !entryMap.has(guid)).join(', ')}`);
      }
      
      return NextResponse.json({ entries: orderedEntries });
    } catch (dbError: unknown) {
      console.error("Error executing database query:", dbError);
      return NextResponse.json(
        { error: "Database query failed", details: dbError instanceof Error ? dbError.message : String(dbError) },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to fetch entries", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 