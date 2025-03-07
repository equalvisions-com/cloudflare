import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/planetscale';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";

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

    // Get the entries with feed data from PlanetScale
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

    // Get unique feed titles
    const feedTitles = [...new Set(entries.rows.map(entry => entry.feed_title))];

    // Get post metadata from Convex
    const posts = feedTitles.length > 0 ? await fetchQuery(api.posts.getByTitles, { titles: feedTitles }) : [];

    // Create a map of feed titles to post metadata
    const postMetadataMap = new Map(
      posts.map((post: Doc<"posts">) => [post.title, post])
    );

    // Check if there are more entries
    const hasMore = entries.rows.length > ENTRIES_PER_PAGE;

    // Map post metadata to entries
    const entriesWithMetadata = entries.rows.slice(0, ENTRIES_PER_PAGE).map(entry => {
      const postMetadata = postMetadataMap.get(entry.feed_title) || {
        title: entry.feed_title,
        featuredImg: undefined,
        mediaType: undefined,
        categorySlug: undefined,
        postSlug: undefined
      };
      
      return {
        ...entry,
        post_title: postMetadata.title,
        post_featured_img: postMetadata.featuredImg,
        post_media_type: postMetadata.mediaType,
        category_slug: postMetadata.categorySlug,
        post_slug: postMetadata.postSlug
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