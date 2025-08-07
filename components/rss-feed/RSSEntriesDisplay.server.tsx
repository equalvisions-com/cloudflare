// components/rss-feed/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSEntriesClientWithErrorBoundary } from "./RSSEntriesDisplay.client";
import { executeRead } from "@/lib/database";
import type { 
  RSSEntriesDisplayEntry, 
  RSSEntriesDisplayServerProps
} from "@/lib/types";

// Strategic caching: Server-side rendering bypasses cache to ensure fresh data after refreshes,
// while client-side fetches can use cache since state persists across tab switches

// Component-specific interface for RSS items with additional properties
interface RSSItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  feedUrl: string;
  feedTitle?: string;
  [key: string]: unknown; // For any additional properties
}

// Component-specific database row type with additional fields
interface RSSEntryRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string;
  description: string;
  content: string;
  image: string | null;
  media_type: string | null;
  feed_title: string;
  feed_url: string;
  total_count?: number;
}

// Helper function to log only in development
const devLog = (message: string, data?: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

// Helper function to log errors in both environments
const errorLog = (message: string, error?: unknown) => {
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }
};

// Server-side in-memory cache for COUNT queries
// This is a module-level variable that persists between requests
// but is isolated to each server instance
// Count cache removed - using limit+1 pagination instead

export const getInitialEntries = cache(async (skipRefresh = false) => {
  try {
    const token = await convexAuthNextjsToken();
    if (!token) {
      devLog('🔒 SERVER: No auth token available');
      return null;
    }

    // 1. Get the user's RSS keys and post data in a single query
    const rssKeysWithPosts = await fetchQuery(api.rssKeys.getUserRSSKeysWithPosts, {}, { token });
    
    if (!rssKeysWithPosts.rssKeys || rssKeysWithPosts.rssKeys.length === 0) {
      devLog('⚠️ SERVER: No RSS keys found for user');
      return null;
    }

    // 2. Extract post titles and feed URLs correctly from the posts array
    // CRITICAL: We extract ALL followed post titles here, regardless of pagination
    // This ensures the client has the complete list for pagination requests
    const postTitles = rssKeysWithPosts.posts.map(post => post.title);
    const feedUrls = rssKeysWithPosts.posts.map(post => post.feedUrl);
    const mediaTypes = rssKeysWithPosts.posts.map(post => post.mediaType);
    
    devLog(`📋 SERVER: Found ${postTitles.length} post titles to refresh:`, postTitles);
    devLog(`🔗 SERVER: Associated feed URLs:`, feedUrls);
    devLog(`🎯 SERVER: Associated media types:`, mediaTypes);
    
    // Define pageSize and page outside the conditional for use throughout the function
    const pageSize = 30; // Match the default pageSize in client
    const page = 1; // First page only
    
    // IMPORTANT: Always skip feed refresh/creation in the server component
    // This ensures fast loading of existing content
    // The refresh endpoint will handle creating and refreshing feeds
    devLog(`⏩ SERVER: Skipping feed refresh - refresh endpoint will handle this`);

    // 4. Create a map of feed URLs to post metadata for O(1) lookups
    const postMetadataMap = new Map(
      rssKeysWithPosts.posts.map(post => [post.feedUrl, {
        title: post.title,
        featuredImg: post.featuredImg,
        mediaType: post.mediaType,
        postSlug: post.postSlug,
        categorySlug: post.categorySlug,
        verified: post.verified
      }])
    );
    
    // 5. Get last_fetched timestamps for client-side staleness calculation
    // Move staleness calculation to client to avoid render-blocking
    const feedStalenessQuery = `
      SELECT f.title, f.feed_url, f.last_fetched
      FROM rss_feeds f
      WHERE f.title IN (${postTitles.map(() => '?').join(',')})
    `;
    
    const feedStalenessResult = await executeRead(feedStalenessQuery, postTitles, { noCache: true });
    const feedStalenessData = feedStalenessResult.rows as { title: string; feed_url: string; last_fetched: number }[];
    
    // Just pass the raw timestamp data to client - no server-side staleness calculation
    const feedTimestamps = new Map();
    feedStalenessData.forEach(feed => {
      feedTimestamps.set(feed.title, {
        lastFetched: Number(feed.last_fetched),
        feedUrl: feed.feed_url
      });
    });

    // 6. Directly query PlanetScale for the first page of entries
    const offset = (page - 1) * pageSize;
    
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Build the SQL query using limit+1 for hasMore detection (no COUNT needed!)
    const entriesQuery = `
      SELECT e.*, f.title as feed_title, f.feed_url
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title IN (${placeholders})
      ORDER BY e.pub_date DESC, e.id DESC
      LIMIT ? OFFSET ?
    `;
    
    devLog(`🔍 SERVER: Executing optimized PlanetScale query (limit+1) for page ${page}`);
    
    try {
      // Execute single query with limit+1 for hasMore detection
      // Use noCache for server-side rendering to ensure fresh data that includes newly refreshed entries
      // This prevents cached data from hiding entries that were added via refresh before browser reload
      const entriesResult = await executeRead(entriesQuery, [...postTitles, pageSize + 1, offset], { noCache: true });
      
      const allEntries = entriesResult.rows as RSSEntryRow[];
      
      // Limit+1 pagination: Check if we got more than pageSize (means there are more pages)
      const hasMore = allEntries.length > pageSize;
      
      // Keep only the requested pageSize (drop the extra row if it exists)
      const entries = hasMore ? allEntries.slice(0, pageSize) : allEntries;
      
      devLog(`✅ SERVER: Retrieved ${entries.length} entries for page ${page}`);
      
      // Map the entries to the expected format
      const mappedEntries: RSSItem[] = entries.map(entry => ({
        guid: entry.guid,
        title: entry.title,
        link: entry.link,
        pubDate: entry.pub_date,
        description: entry.description,
        content: entry.content,
        image: entry.image,
        mediaType: entry.media_type,
        feedTitle: entry.feed_title,
        feedUrl: entry.feed_url
      }));
      
      devLog(`🚀 SERVER: Processed ${mappedEntries.length} entries (hasMore: ${hasMore})`);
      
      // 6. Get unique entry guids for batch query
      const guids = mappedEntries.map((entry: RSSItem) => entry.guid);
      
      // 7. Batch fetch entry data for all entries at once
      const entryData = await fetchQuery(
        api.entries.batchGetEntriesMetrics,
        { entryGuids: guids },
        { token }
      );

      // 8. Combine all data efficiently
      const entriesWithPublicData = mappedEntries.map((entry: RSSItem, index: number) => {
        // Create a safe fallback for post metadata
        const feedUrl = entry.feedUrl;
        // Retrieve the full metadata including verified status
        const postMetadata = postMetadataMap.get(feedUrl);
        
        const fallbackMetadata = {
          title: entry.feedTitle || entry.title || '',
          featuredImg: entry.image as string || '',
          mediaType: entry.mediaType || entry.media_type || null,
          postSlug: '',
          categorySlug: '',
          verified: false // Default verified to false in fallback
        };
        
        return {
          entry,
          initialData: entryData[index] || {
            likes: { isLiked: false, count: 0 },
            comments: { count: 0 },
            retweets: { isRetweeted: false, count: 0 }
          },
          // Use the retrieved metadata or the fallback
          postMetadata: postMetadata || fallbackMetadata 
        };
      });

      devLog(`🚀 SERVER: Returning ${entriesWithPublicData.length} initial entries for the merged feed`);
      
      devLog(`⚡ SERVER: Skipping staleness calculation - client will handle this`);
      
      // Make sure to include the postTitles and feed timestamps for client-side staleness calculation
      return {
        entries: entriesWithPublicData,
        hasMore,
        postTitles,
        feedUrls,
        mediaTypes,
        // Raw timestamp data for client-side staleness calculation
        feedTimestamps: Object.fromEntries(feedTimestamps)
      };
    } catch (dbError: unknown) {
      errorLog('❌ SERVER: Error querying PlanetScale:', dbError);
      return null;
    }
  } catch (error) {
    errorLog('❌ SERVER: Error fetching initial entries:', error);
    return null;
  }
});

// Add a new export to get entries without refreshing
export const getInitialEntriesWithoutRefresh = cache(async () => {
  return getInitialEntries(true); // Skip refresh
});

// Main server component with production-ready types
export default async function RSSEntriesDisplayServer({ 
  skipRefresh = false 
}: RSSEntriesDisplayServerProps = {}) {
  const initialData = await getInitialEntries(skipRefresh);
  
  if (!initialData) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-gray-500">No RSS entries available</p>
      </div>
    );
  }

  // Transform the data to match the client component's expected interface
  const transformedData = {
    entries: initialData.entries.map((entry) => ({
      entry: entry.entry,
      initialData: entry.initialData,
      postMetadata: {
        title: entry.postMetadata.title,
        featuredImg: typeof entry.postMetadata.featuredImg === 'string' ? entry.postMetadata.featuredImg : undefined,
        mediaType: typeof entry.postMetadata.mediaType === 'string' ? entry.postMetadata.mediaType : undefined,
        categorySlug: typeof entry.postMetadata.categorySlug === 'string' ? entry.postMetadata.categorySlug : undefined,
        postSlug: typeof entry.postMetadata.postSlug === 'string' ? entry.postMetadata.postSlug : undefined,
        verified: typeof entry.postMetadata.verified === 'boolean' ? entry.postMetadata.verified : undefined,
      }
    })),
    hasMore: initialData.hasMore,
    postTitles: initialData.postTitles,
    feedUrls: initialData.feedUrls,
    mediaTypes: initialData.mediaTypes,
    feedTimestamps: initialData.feedTimestamps,
  };

  return <RSSEntriesClientWithErrorBoundary initialData={transformedData} />;
}