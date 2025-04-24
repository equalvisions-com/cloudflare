// app/api/rss/route.tsx
import { NextRequest, NextResponse } from 'next/server';
import type { RSSItem } from "@/lib/rss";
import { getReadConnection } from '@/lib/database';

// Use Edge runtime for this API route
export const runtime = 'edge';

// Define interfaces for our data types
interface RSSEntryRow {
  guid: string;
  title: string;
  link: string;
  description: string | null;
  pub_date: string;
  content?: string;
  image: string | null;
  media_type: string | null;
  feed_title: string;
  feed_url: string;
}

interface RSSResponseData {
  entries: RSSItem[];
  hasMore: boolean;
  totalEntries: number;
  postTitles: string[];
}

// Create a connection to PlanetScale using read replica
const connection = getReadConnection();

// Simple in-memory cache for recent requests
// In a production app, you might use Redis or another caching solution
const cache = new Map<string, { data: RSSResponseData, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minute cache TTL

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const postTitlesParam = searchParams.get('postTitles');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);
    const includePostMetadata = searchParams.get('includePostMetadata') === 'true';
    const skipCache = searchParams.get('skipCache') === 'true';
    
    console.log(`📡 API: /api/rss merged feed called with page=${page}, pageSize=${pageSize}, includePostMetadata=${includePostMetadata}`);
    
    if (!postTitlesParam) {
      console.error('❌ API: Post titles are required');
      return NextResponse.json(
        { error: 'Post titles are required' },
        { status: 400 }
      );
    }

    let postTitles: string[] = [];
    try {
      postTitles = JSON.parse(decodeURIComponent(postTitlesParam));
      if (!Array.isArray(postTitles)) {
        throw new Error('Post titles must be an array');
      }
    } catch (error) {
      console.error('❌ API: Invalid post titles format', error);
      return NextResponse.json(
        { error: 'Invalid post titles format' },
        { status: 400 }
      );
    }

    console.log(`📋 API: Post titles: ${postTitles.join(', ')}`);
    
    if (postTitles.length === 0) {
      console.warn('⚠️ API: No post titles provided');
      return NextResponse.json({ entries: [], hasMore: false, totalEntries: 0, postTitles: [] });
    }

    // Create a cache key based on the request parameters
    const cacheKey = `${postTitlesParam}-${page}-${pageSize}-${includePostMetadata}`;
    
    // Check if we have a cached response
    if (!skipCache && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey)!;
      const now = Date.now();
      
      // If the cache is still fresh, return it
      if (now - cachedData.timestamp < CACHE_TTL) {
        console.log(`💾 API: Using cached response for page ${page}`);
        return NextResponse.json(cachedData.data);
      }
      
      // Otherwise, remove the stale cache entry
      cache.delete(cacheKey);
    }

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Build the SQL query to fetch entries from multiple feeds in one query
    const entriesQuery = `
      SELECT e.*, f.title as feed_title, f.feed_url
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title IN (${placeholders})
      ORDER BY e.pub_date DESC
      LIMIT ? OFFSET ?
    `;
    
    // Build the SQL query to count total entries
    const countQuery = `
      SELECT COUNT(*) as total
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title IN (${placeholders})
    `;
    
    // Execute both queries in parallel for efficiency
    const [countResult, entriesResult] = await Promise.all([
      connection.execute(countQuery, [...postTitles]),
      connection.execute(entriesQuery, [...postTitles, pageSize, offset])
    ]);
    
    const totalEntries = Number((countResult.rows[0] as { total: number }).total);
    const entries = entriesResult.rows as RSSEntryRow[];
    
    console.log(`🔢 API: Found ${totalEntries} total entries across all requested feeds`);
    console.log(`✅ API: Retrieved ${entries.length} entries for page ${page}`);
    
    // Map the entries to the expected format
    const mappedEntries: RSSItem[] = entries.map(entry => ({
      guid: entry.guid,
      title: entry.title,
      link: entry.link,
      pubDate: entry.pub_date,
      description: entry.description || '',
      content: entry.content,
      image: entry.image || undefined,
      mediaType: entry.media_type || undefined,
      feedTitle: entry.feed_title,
      feedUrl: entry.feed_url
    }));
    
    // Determine if there are more entries
    const hasMore = totalEntries > offset + entries.length;
    
    console.log(`🚀 API: Returning ${mappedEntries.length} merged entries for page ${page} (total: ${totalEntries}, hasMore: ${hasMore})`);
    
    // Prepare the response data
    const responseData = {
      entries: mappedEntries,
      hasMore,
      totalEntries,
      postTitles
    };
    
    // Cache the response
    cache.set(cacheKey, {
      data: responseData,
      timestamp: Date.now()
    });
    
    // Set cache control headers for HTTP caching as well
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
    headers.set('Vercel-CDN-Cache-Control', 'max-age=300');
    headers.set('CDN-Cache-Control', 'max-age=300');
    headers.set('Surrogate-Control', 'max-age=300');
    
    return NextResponse.json(responseData, { headers });
    
  } catch (error) {
    // Check if it's a timeout error
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error('⏱️ API: Database query timed out', error);
      return NextResponse.json(
        { error: 'Database query timed out. Please try again.' },
        { status: 504 }
      );
    }
    
    console.error('❌ API: Error fetching merged feed', error);
    return NextResponse.json(
      { error: 'Failed to fetch merged feed' },
      { status: 500 }
    );
  }
}