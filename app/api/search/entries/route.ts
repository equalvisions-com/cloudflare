import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/planetscale';

const ENTRIES_PER_PAGE = 10;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const mediaType = searchParams.get('mediaType');
    const page = parseInt(searchParams.get('page') || '1');

    if (!query || !mediaType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Calculate offset for pagination
    const offset = (page - 1) * ENTRIES_PER_PAGE;

    // Join rss_entries with rss_feeds to get feed titles
    const entries = await db.execute(
      `SELECT e.*, f.title as feed_title, f.feed_url
       FROM rss_entries e
       JOIN rss_feeds f ON e.feed_id = f.id
       WHERE f.media_type = ?
       AND (e.title LIKE ? OR e.description LIKE ?)
       ORDER BY e.pub_date DESC
       LIMIT ? OFFSET ?`,
      [
        mediaType,
        `%${query}%`,
        `%${query}%`,
        ENTRIES_PER_PAGE + 1, // Get one extra to check if there are more
        offset,
      ]
    );

    // Check if there are more entries
    const hasMore = entries.rows.length > ENTRIES_PER_PAGE;

    // Return only the requested number of entries
    return NextResponse.json({
      entries: entries.rows.slice(0, ENTRIES_PER_PAGE),
      hasMore,
    });

  } catch (error) {
    console.error('Error searching entries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 