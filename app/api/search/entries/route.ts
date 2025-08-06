import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { validateHeaders } from '@/lib/headers';

// Use Edge runtime for this API route
export const runtime = 'edge';

const DEFAULT_ENTRIES_PER_PAGE = 30; // Changed from 10 to 30 to match other feed components

// Define the type for RSS entry rows
interface RSSEntryRow {
  feed_title: string;
  feed_url: string;
  title: string;
  description?: string;
  link: string;
  guid: string;
  pub_date: string;
  image?: string;
  media_type?: string;
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  if (!validateHeaders(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const mediaType = searchParams.get('mediaType');
    const feedUrl = searchParams.get('feedUrl'); // Optional: filter by specific feed
    const page = parseInt(searchParams.get('page') || '1');
    // Get pageSize from query params and parse as integer, default to DEFAULT_ENTRIES_PER_PAGE
    const pageSize = parseInt(searchParams.get('pageSize') || String(DEFAULT_ENTRIES_PER_PAGE));

    if (!query || !mediaType) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Get the entries with feed data from PlanetScale using read replica
    // Build query and parameters based on whether feedUrl is provided
    let sqlQuery = `SELECT e.*, f.title as feed_title, f.feed_url
       FROM rss_entries e
       JOIN rss_feeds f ON e.feed_id = f.id
       WHERE f.media_type = ?
       AND MATCH(e.title, e.description) AGAINST (? IN BOOLEAN MODE)`;
    
    let queryParams = [
      mediaType,
      query // No wildcards needed for full-text search
    ];

    // Add feedUrl filter if provided (for profile-specific search)
    if (feedUrl) {
      sqlQuery += ` AND f.feed_url = ?`;
      queryParams.push(feedUrl);
    }

    sqlQuery += ` ORDER BY e.pub_date DESC LIMIT ? OFFSET ?`;
    queryParams.push(pageSize + 1 as any, offset as any); // Get one extra to check if there are more

    const entries = await executeRead(sqlQuery, queryParams);

    // Cast the rows to the proper type
    const entryRows = entries.rows as RSSEntryRow[];

    // Get unique feed titles
    const feedTitles = [...new Set(entryRows.map(entry => entry.feed_title))];

    // Get post metadata from Convex
    const posts = feedTitles.length > 0 ? await fetchQuery(api.posts.getByTitles, { titles: feedTitles }) : [];

    // Create a map of feed titles to post metadata
    const postMetadataMap = new Map(
      posts.map(post => [post.title, post])
    );

    // Check if there are more entries
    const hasMore = entryRows.length > pageSize;

    // Map post metadata to entries
    const entriesWithMetadata = entryRows.slice(0, pageSize).map(entry => {
      const postMetadata = postMetadataMap.get(entry.feed_title);
      
      return {
        ...entry,
        post_title: postMetadata?.title || entry.feed_title,
        post_featured_img: postMetadata?.featuredImg,
        post_media_type: postMetadata?.mediaType,
        category_slug: postMetadata?.categorySlug,
        post_slug: postMetadata?.postSlug,
        verified: postMetadata?.verified
      };
    });

    // ✅ ADDED: Fetch entry metrics for immediate correct rendering (same pattern as other feeds)
    // Server provides initial metrics for fast rendering, client hook provides reactive updates
    let entryMetrics: Record<string, any> = {};
    if (entriesWithMetadata.length > 0) {
      try {
        // Get auth token for Convex query
        const token = await convexAuthNextjsToken();
        
        // Extract GUIDs for metrics query
        const guids = entriesWithMetadata.map(entry => entry.guid);
        
        console.log(`🔍 API: Fetching metrics for ${guids.length} search entries`);
        const metricsStartTime = Date.now();
        
        // Fetch metrics from Convex
        const metrics = await fetchQuery(
          api.entries.batchGetEntriesMetrics,
          { entryGuids: guids, includeCommentLikes: false },
          { token }
        );
        
        // Create a map of guid to metrics
        entryMetrics = Object.fromEntries(
          guids.map((guid, index) => [guid, metrics[index]])
        );
        
        console.log(`✅ API: Fetched search metrics in ${Date.now() - metricsStartTime}ms`);
      } catch (error) {
        console.error("⚠️ API: Error fetching search entry metrics:", error);
        // Continue without metrics
      }
    }

    // Return the entries with metadata and metrics
    return NextResponse.json({
      entries: entriesWithMetadata,
      entryMetrics,
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