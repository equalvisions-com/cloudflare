'use server';

import { executeRead } from "@/lib/database";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Type for bookmarks from Convex
export type BookmarkItem = {
  _id: string;
  entryGuid: string;
  feedUrl: string;
  title: string;
  link: string;
  pubDate: string;
  bookmarkedAt: number;
};

// Type for RSS entries from PlanetScale
export type RSSEntry = {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description: string;
  pub_date: string;
  image?: string;
  feed_title?: string;
  feed_url?: string;
  mediaType?: string;
  // Post metadata from Convex
  post_title?: string;
  post_featured_img?: string;
  post_media_type?: string;
  category_slug?: string;
  post_slug?: string;
  verified?: boolean;
};

// Type for entry metrics from Convex
export type EntryMetrics = {
  likes: { count: number; isLiked: boolean };
  comments: { count: number };
  retweets: { count: number; isRetweeted: boolean };
  bookmarks: { isBookmarked: boolean };
};

// Type for the complete bookmarks data response
export type BookmarksData = {
  bookmarks: BookmarkItem[];
  totalCount: number;
  hasMore: boolean;
  entryDetails: Record<string, RSSEntry>;
  entryMetrics: Record<string, EntryMetrics>;
};

/**
 * Fetch bookmarks with full entry details and post metadata
 */
export async function getBookmarksData(userId: Id<"users">, skip: number = 0, limit: number = 30) {
  try {
    // Step 1: Fetch bookmarks from Convex
    const bookmarksResult = await fetchQuery(api.userActivity.getUserBookmarks, { 
      userId,
      skip,
      limit
    });
    
    if (!bookmarksResult.bookmarks.length) {
      return {
        bookmarks: [],
        totalCount: 0,
        hasMore: false,
        entryDetails: {},
        entryMetrics: {}
      };
    }
    
    // Extract GUIDs for PlanetScale lookup
    const guids = bookmarksResult.bookmarks.map(bookmark => bookmark.entryGuid);
    
    // Step 2: Fetch entry details from PlanetScale
    let entryDetails: Record<string, RSSEntry> = {};
    if (guids.length > 0) {
      try {
        // Create placeholders for the SQL query
        const placeholders = guids.map(() => '?').join(',');
        
        const query = `
          SELECT e.*, f.title as feed_title, f.feed_url, f.media_type as mediaType
          FROM rss_entries e
          LEFT JOIN rss_feeds f ON e.feed_id = f.id
          WHERE e.guid IN (${placeholders})
        `;
        
        const result = await executeRead(query, guids);
        
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
        // Error handled silently for production
      }
    }
    
    // Step 3: Enrich with Convex post data
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
      // Error handled silently for production
    }
    
    // Step 4: Get interaction metrics for entries
    let entryMetrics: Record<string, EntryMetrics> = {};
    try {
      if (guids.length > 0) {
        const metrics = await fetchQuery(api.entries.batchGetEntriesMetrics, { entryGuids: guids });
        
        // Create metrics map
        entryMetrics = {};
        guids.forEach((guid, index) => {
          if (metrics[index]) {
            entryMetrics[guid] = {
              ...metrics[index],
              bookmarks: { isBookmarked: true } // Always true since these are bookmarked
            };
          }
        });
      }
    } catch (error) {
      // Error handled silently for production
    }
    
    return {
      bookmarks: bookmarksResult.bookmarks,
      totalCount: bookmarksResult.totalCount,
      hasMore: bookmarksResult.hasMore,
      entryDetails,
      entryMetrics
    };
  } catch (error) {
    return {
      bookmarks: [],
      totalCount: 0,
      hasMore: false,
      entryDetails: {},
      entryMetrics: {}
    };
  }
} 