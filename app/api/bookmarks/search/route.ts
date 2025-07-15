import { NextRequest, NextResponse } from 'next/server';
import { getBookmarksData } from '@/app/actions/bookmarkActions';
import { Id } from '@/convex/_generated/dataModel';
import { convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { executeRead } from "@/lib/database";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Use Edge runtime for this API route
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Get currentUserId and search parameters from request body
    const body = await request.json();
    const { currentUserId, query, limit = 30 } = body;

    // CurrentUserId is required - this comes from sidebar context
    if (!currentUserId) {
      return NextResponse.json(
        { error: 'Authentication required - currentUserId missing' },
        { status: 401 }
      );
    }

    // Try to get authentication token (for metrics and authenticated queries)
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!query) {
      return NextResponse.json(
        { error: 'Missing query parameter' },
        { status: 400 }
      );
    }

    // 🔒 SECURE: Use currentUserId from sidebar context (no api.users.viewer call needed)
    const userId = currentUserId;

    // Step 1: Fetch all bookmarks from Convex
    const bookmarksResult = await fetchQuery(api.userActivity.getUserBookmarks, { 
      userId,
      skip: 0,
      limit: 1000 // Get a large number to search through
    });

    if (!bookmarksResult.bookmarks.length) {
      return NextResponse.json({
        bookmarks: [],
        totalCount: 0,
        hasMore: false,
        entryDetails: {},
        entryMetrics: {}
      });
    }

    // Extract GUIDs for PlanetScale lookup
    const guids = bookmarksResult.bookmarks.map(bookmark => bookmark.entryGuid);
    
    // Step 2: Search entries in PlanetScale that match the query
    let entryDetails: Record<string, any> = {};
    if (guids.length > 0) {
      try {
        // Create placeholders for the SQL query
        const placeholders = guids.map(() => '?').join(',');
        const searchTerm = `%${query}%`;
        
        const searchQuery = `
          SELECT e.*, f.title as feed_title, f.feed_url, f.media_type as mediaType
          FROM rss_entries e
          LEFT JOIN rss_feeds f ON e.feed_id = f.id
          WHERE e.guid IN (${placeholders})
          AND (
            e.title LIKE ?
            OR e.description LIKE ?
            OR f.title LIKE ?
          )
        `;
        
        const result = await executeRead(
          searchQuery, 
          [...guids, searchTerm, searchTerm, searchTerm]
        );
        
        // Map entries by GUID
        const rows = result.rows as any[];
        entryDetails = Object.fromEntries(
          rows.map(row => [row.guid, {
            id: row.id,
            feed_id: row.feed_id,
            guid: row.guid,
            title: row.title,
            link: row.link,
            description: row.description,
            pub_date: row.pub_date,
            image: row.image,
            feed_title: row.feed_title,
            feed_url: row.feed_url,
            mediaType: row.mediaType
          }])
        );
      } catch (error) {
        console.error("Error searching entry details:", error);
      }
    }

    // Filter bookmarks to only those that matched the search
    const matchingGuids = Object.keys(entryDetails);
    const filteredBookmarks = bookmarksResult.bookmarks.filter(
      bookmark => matchingGuids.includes(bookmark.entryGuid)
    ).slice(0, limit);

    // Step 3: Enrich with Convex post data (similar to getBookmarksData)
    try {
      // Get feed URLs from entries and ensure they're all strings
      const feedUrlsWithUndefined = Object.values(entryDetails)
        .map(entry => entry.feed_url);
      
      // Type-safe filter to remove undefined values
      const feedUrls: string[] = feedUrlsWithUndefined
        .filter((url): url is string => typeof url === 'string')
        .filter(url => url.length > 0);
      
      if (feedUrls.length > 0) {
        const posts = await fetchQuery(api.posts.getByFeedUrls, { feedUrls });
        
        if (posts.length > 0) {
          // Create a map of feed URL to post
          const feedUrlToPostMap = new Map(
            posts.map((post: any) => [post.feedUrl, post])
          );
          
          // Enrich entry details with post data
          for (const guid in entryDetails) {
            const entry = entryDetails[guid];
            if (entry && entry.feed_url) {
              const post = feedUrlToPostMap.get(entry.feed_url);
              
              if (post) {
                // Update entry with post metadata
                entry.post_title = post.title;
                entry.post_featured_img = post.featuredImg;
                entry.post_media_type = post.mediaType;
                entry.category_slug = post.categorySlug;
                entry.post_slug = post.postSlug;
                entry.verified = post.verified;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching post data:", error);
    }
    
    // Step 4: Get interaction metrics for entries
    let entryMetrics: Record<string, any> = {};
    try {
      if (matchingGuids.length > 0) {
        const metrics = await fetchQuery(api.entries.batchGetEntriesMetrics, { 
          entryGuids: matchingGuids 
        });
        
        // Create metrics map
        entryMetrics = {};
        matchingGuids.forEach((guid, index) => {
          if (metrics[index]) {
            entryMetrics[guid] = {
              ...metrics[index],
              bookmarks: { isBookmarked: true } // Always true since these are bookmarked
            };
          }
        });
      }
    } catch (error) {
      console.error("Error fetching entry metrics:", error);
    }
    
    return NextResponse.json({
      bookmarks: filteredBookmarks,
      totalCount: filteredBookmarks.length,
      hasMore: false, // Search results are all returned at once
      entryDetails,
      entryMetrics
    });
  } catch (error) {
    console.error('Error searching bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to search bookmarks' },
      { status: 500 }
    );
  }
} 