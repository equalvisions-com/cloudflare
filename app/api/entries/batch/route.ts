import { NextRequest, NextResponse } from 'next/server';
import { executeRead, executeWrite } from '@/lib/database';

// Edge Runtime configuration for Cloudflare Pages
export const runtime = 'edge';

// Lightweight API to store RSS entries from Worker
// Called by Worker after RSS parsing is complete
export async function POST(request: NextRequest) {
  try {
    const { feed, entries } = await request.json();
    
    if (!feed || !entries || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: 'Invalid feed or entries data' },
        { status: 400 }
      );
    }

    console.log(`💾 BATCH STORE: Storing ${entries.length} entries for ${feed.postTitle}`);

    // Get or create feed
    const feedId = await getOrCreateFeed(feed.feedUrl, feed.postTitle, feed.mediaType);
    
    // Store entries in transaction
    const storedCount = await storeRSSEntriesWithTransaction(feedId, entries, feed.mediaType);
    
    // Update feed last_fetched timestamp
    await executeWrite(
      'UPDATE rss_feeds SET last_fetched = ? WHERE id = ?',
      [Date.now(), feedId]
    );

    console.log(`✅ BATCH STORE: Successfully stored ${storedCount} entries for ${feed.postTitle}`);

    return NextResponse.json({
      success: true,
      feedId,
      storedCount,
      feedTitle: feed.postTitle
    });

  } catch (error) {
    console.error('❌ BATCH STORE: Error storing entries:', error);
    return NextResponse.json(
      { error: 'Failed to store entries' },
      { status: 500 }
    );
  }
}

// Get or create feed helper
async function getOrCreateFeed(feedUrl: string, title: string, mediaType?: string): Promise<number> {
  try {
    // Check if feed exists
    const existingFeedResult = await executeRead(
      'SELECT id FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );

    if (existingFeedResult.rows.length > 0) {
      return Number((existingFeedResult.rows as any)[0].id);
    }

    // Create new feed
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const insertResult = await executeWrite(
      'INSERT INTO rss_feeds (feed_url, title, media_type, last_fetched, created_at) VALUES (?, ?, ?, ?, ?)',
      [feedUrl, title, mediaType || null, Date.now(), now]
    );

    const feedId = Number(insertResult.insertId);
    console.log(`✅ BATCH STORE: Created new feed ${title} with ID ${feedId}`);
    
    return feedId;

  } catch (error) {
    console.error('❌ BATCH STORE: Error getting/creating feed:', error);
    throw error;
  }
}

// Store RSS entries with transaction
async function storeRSSEntriesWithTransaction(feedId: number, entries: any[], mediaType?: string): Promise<number> {
  let storedCount = 0;
  
  try {
    for (const entry of entries) {
      try {
        // Check if entry already exists
        const existingEntryResult = await executeRead(
          'SELECT id FROM rss_entries WHERE guid = ? AND feed_id = ?',
          [entry.guid, feedId]
        );

        if (existingEntryResult.rows.length === 0) {
          // Insert new entry with proper datetime format
          const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await executeWrite(
            `INSERT INTO rss_entries (
              feed_id, title, description, link, pub_date, guid, 
              image, media_type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              feedId,
              entry.title || '',
              entry.description || '',
              entry.link || '',
              entry.pubDate || new Date().toISOString(),
              entry.guid,
              entry.enclosure?.url || null,
              mediaType || entry.mediaType || null,
              createdAt
            ]
          );
          
          storedCount++;
        }
      } catch (entryError) {
        console.error('❌ BATCH STORE: Error storing individual entry:', entryError);
        // Continue with other entries
      }
    }

    return storedCount;

  } catch (error) {
    console.error('❌ BATCH STORE: Error in transaction:', error);
    throw error;
  }
}