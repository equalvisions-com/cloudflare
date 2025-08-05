// components/rss-feed/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSEntriesClientWithErrorBoundary } from "./RSSEntriesDisplay.client";
import { executeRead } from "@/lib/database";
import { checkAndRefreshFeeds } from "@/lib/rss.server";
import type { 
  RSSEntriesDisplayEntry, 
  RSSEntriesDisplayServerProps
} from "@/lib/types";

// Remove caching to ensure users always see fresh data including newly refreshed entries
// This prevents the issue where refreshed entries disappear on page reload due to stale cache

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
interface CountCacheEntry {
  count: number;
  timestamp: number;
  feedCount: number;
}

const COUNT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const countCache = new Map<string, CountCacheEntry>();

// Function to get cached count
function getCachedCount(postTitles: string[]): number | null {
  // Sort the titles to ensure consistent cache keys regardless of order
  const cacheKey = [...postTitles].sort().join(',');
  const cached = countCache.get(cacheKey);
  
  if (!cached) {
    devLog(`🔍 Count cache MISS for key: ${cacheKey}`);
    return null;
  }
  
  const now = Date.now();
  if (now - cached.timestamp > COUNT_CACHE_TTL) {
    // Cache expired
    devLog(`⏰ Count cache EXPIRED for key: ${cacheKey}`);
    countCache.delete(cacheKey);
    return null;
  }
  
  devLog(`✅ Count cache HIT for key: ${cacheKey}, count: ${cached.count}`);
  return cached.count;
}

// Function to set cached count
function setCachedCount(postTitles: string[], count: number): void {
  const cacheKey = [...postTitles].sort().join(',');
  // Store the number of feeds along with the count to detect changes in feed count
  countCache.set(cacheKey, {
    count,
    timestamp: Date.now(),
    feedCount: postTitles.length // Save the number of feeds used for this count
  });
  devLog(`💾 Set count cache for key: ${cacheKey}, count: ${count}, feedCount: ${postTitles.length}`);
}

// Function to invalidate cached count (useful after feed refresh)
function invalidateCountCache(postTitles: string[]): void {
  const cacheKey = [...postTitles].sort().join(',');
  countCache.delete(cacheKey);
  devLog(`🗑️ Invalidated count cache for key: ${cacheKey}`);
}

// Function to invalidate all count caches - use when user follows/unfollows feeds
function invalidateAllCountCaches(): void {
  countCache.clear();
  devLog(`🗑️ Invalidated all count caches`);
}

// Export the function for use in API routes
export { invalidateAllCountCaches };

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
    
    // 5. Query feed staleness data for client-side optimization
    const feedStalenessQuery = `
      SELECT f.title, f.feed_url, f.last_fetched
      FROM rss_feeds f
      WHERE f.title IN (${postTitles.map(() => '?').join(',')})
    `;
    
    const feedStalenessResult = await executeRead(feedStalenessQuery, postTitles, { noCache: true });
    const feedStalenessData = feedStalenessResult.rows as { title: string; feed_url: string; last_fetched: number }[];
    
    // Create staleness map for quick lookup
    const stalenessMap = new Map();
    const now = Date.now();
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    
    feedStalenessData.forEach(feed => {
      const lastFetchedMs = Number(feed.last_fetched);
      const timeSinceLastFetch = now - lastFetchedMs;
      stalenessMap.set(feed.title, {
        lastFetched: lastFetchedMs,
        isStale: timeSinceLastFetch > FOUR_HOURS_MS,
        staleness: timeSinceLastFetch
      });
    });

    // 6. Directly query PlanetScale for the first page of entries
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
    
    // Check if we have newly followed posts that require a fresh count
    // For safety, always refresh counts when the feed count has changed
    const cacheKey = [...postTitles].sort().join(',');
    const cachedData = countCache.get(cacheKey);
    
    // If the number of feeds has changed, we need to invalidate the cache
    if (cachedData && cachedData.feedCount !== postTitles.length) {
      devLog(`🔄 SERVER: Feed count changed from ${cachedData.feedCount} to ${postTitles.length}, invalidating cache`);
      invalidateCountCache(postTitles);
    }
    
    // Use cached count if available
    let totalEntries = getCachedCount(postTitles);
    let countResult;
    let entriesResult;
    
    devLog(`🔍 SERVER: Executing PlanetScale queries for page ${page}`);
    
    try {
      // If we don't have a cached count, execute the count query
      if (totalEntries === null) {
        // Optimized COUNT query using COUNT(e.id) instead of COUNT(*)
        const countQuery = `
          SELECT COUNT(e.id) as total
          FROM rss_entries e
          JOIN rss_feeds f ON e.feed_id = f.id
          WHERE f.title IN (${placeholders})
        `;
        
        // Execute both queries in parallel for efficiency using read replicas
        // Use noCache option to ensure fresh data that includes newly refreshed entries
        [countResult, entriesResult] = await Promise.all([
          executeRead(countQuery, [...postTitles], { noCache: true }),
          executeRead(entriesQuery, [...postTitles, pageSize, offset], { noCache: true })
        ]);
        
        totalEntries = Number((countResult.rows[0] as { total: number }).total);
        
        // Cache the count result
        setCachedCount(postTitles, totalEntries);
      } else {
        // Just execute the entries query if we have a cached count
        // Use noCache to ensure fresh entries that include newly refreshed content
        devLog(`📊 SERVER: Using cached count: ${totalEntries}`);
        entriesResult = await executeRead(entriesQuery, [...postTitles, pageSize, offset], { noCache: true });
      }

      const entries = entriesResult.rows as RSSEntryRow[];
      
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
      
      // Determine if there are more entries
      const hasMore = totalEntries > offset + entries.length;
      
      devLog(`🚀 SERVER: Processed ${mappedEntries.length} entries (total: ${totalEntries}, hasMore: ${hasMore})`);
      
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
      
      // Calculate overall staleness summary
      const staleFeeds = postTitles.filter(title => {
        const staleness = stalenessMap.get(title);
        return staleness?.isStale !== false;
      });
      
      const needsRefresh = staleFeeds.length > 0;
      const oldestLastFetched = Math.min(...Array.from(stalenessMap.values()).map(s => s.lastFetched));
      
      devLog(`🕐 SERVER: Staleness check - ${staleFeeds.length}/${postTitles.length} feeds need refresh`);
      
      // Make sure to include the postTitles and staleness data in the returned data
      return {
        entries: entriesWithPublicData,
        totalEntries,
        hasMore,
        postTitles,
        feedUrls,
        mediaTypes,
        // Client-side staleness optimization data
        feedStaleness: {
          needsRefresh,
          oldestLastFetched,
          staleCount: staleFeeds.length,
          totalCount: postTitles.length,
          staleFeedTitles: staleFeeds
        }
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
    totalEntries: initialData.totalEntries,
    hasMore: initialData.hasMore,
    postTitles: initialData.postTitles,
    feedUrls: initialData.feedUrls,
    mediaTypes: initialData.mediaTypes,
    feedStaleness: initialData.feedStaleness,
  };

  return <RSSEntriesClientWithErrorBoundary initialData={transformedData} />;
}