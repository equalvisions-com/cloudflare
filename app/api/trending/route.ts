import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';
import { validateHeaders } from '@/lib/headers';

interface RSSEntry {
  guid: string;
  title: string;
  link: string;
  description: string | null;
  pub_date: string;
  image: string | null;
  feed_id: number;
  media_type: string | null;
}

interface EntriesByFeedUrl {
  [feedUrl: string]: {
    guid: string;
    title: string;
    link: string;
    description: string | null;
    pubDate: string;
    image: string | null;
    feedUrl: string;
    mediaType: string | null;
  };
}

// Add the Edge Runtime configuration
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Parse the request body to get feedUrls
    const body = await request.json();
    const { feedUrls } = body;
    
    if (!feedUrls || !Array.isArray(feedUrls) || feedUrls.length === 0) {
      return NextResponse.json({ error: 'Invalid feedUrls provided' }, { status: 400 });
    }
    
    // Create placeholders for prepared statement
    const placeholders = feedUrls.map((_, i) => `?`).join(',');
    
    // OPTIMIZED: Query to get the latest RSS entry for each feed URL
    // Scope the GROUP BY operation to only the requested feeds for better performance
    const query = `
      SELECT e.*, f.feed_url 
      FROM rss_entries e
      INNER JOIN rss_feeds f ON e.feed_id = f.id
      INNER JOIN (
        SELECT re.feed_id, MAX(re.pub_date) as latest_pub_date
        FROM rss_entries re
        INNER JOIN rss_feeds rf ON re.feed_id = rf.id
        WHERE rf.feed_url IN (${placeholders})
        GROUP BY re.feed_id
      ) latest ON e.feed_id = latest.feed_id AND e.pub_date = latest.latest_pub_date
      WHERE f.feed_url IN (${placeholders})
      ORDER BY e.pub_date DESC
    `;
    
    // Execute the query with the feed URLs as parameters (duplicate for subquery and main query)
    const latestEntries = await executeRead(query, [...feedUrls, ...feedUrls]);
    
    // Create a map of feedUrl to entry
    const entriesByFeedUrl: EntriesByFeedUrl = {};
    
    for (const entry of latestEntries.rows as any[]) {
      const feedUrl = entry.feed_url;
      
      entriesByFeedUrl[feedUrl] = {
        guid: entry.guid,
        title: entry.title,
        link: entry.link,
        description: entry.description,
        pubDate: entry.pub_date,
        image: entry.image,
        feedUrl: feedUrl,
        mediaType: entry.media_type
      };
    }
    
    return NextResponse.json({ entries: entriesByFeedUrl });
  } catch (error) {
    console.error('Error fetching trending RSS entries:', error);
    return NextResponse.json({ error: 'Error fetching trending RSS entries' }, { status: 500 });
  }
} 