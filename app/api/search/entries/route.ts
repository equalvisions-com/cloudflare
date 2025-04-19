import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

const ENTRIES_PER_PAGE = 10;

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

    // Get the entries with feed data from PlanetScale using read replica
    const entries = await executeRead(
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
    const hasMore = entryRows.length > ENTRIES_PER_PAGE;

    // Map post metadata to entries
    const entriesWithMetadata = entryRows.slice(0, ENTRIES_PER_PAGE).map(entry => {
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

    // Return the entries with metadata
    return NextResponse.json({
      entries: entriesWithMetadata,
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