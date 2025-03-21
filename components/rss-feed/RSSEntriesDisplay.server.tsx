// components/rss-feed/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSEntriesClient } from "./RSSEntriesDisplay.client";
import { executeRead } from "@/lib/database";
import { checkAndRefreshFeeds } from "@/lib/rss.server";

// Add caching configuration with 5-minute revalidation
// This ensures the server component is cached for 5 minutes before revalidating
// It applies to the entire component, including all data fetching operations
export const revalidate = 300; // 5 minutes in seconds

// Define the RSSItem interface to match what's returned from the API
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

// Define database row type for type safety
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

export const getInitialEntries = cache(async () => {
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
    const postTitles = rssKeysWithPosts.posts.map(post => post.title);
    const feedUrls = rssKeysWithPosts.posts.map(post => post.feedUrl);
    const mediaTypes = rssKeysWithPosts.posts.map(post => post.mediaType);
    
    devLog(`📋 SERVER: Found ${postTitles.length} post titles to refresh:`, postTitles);
    devLog(`🔗 SERVER: Associated feed URLs:`, feedUrls);
    devLog(`🎯 SERVER: Associated media types:`, mediaTypes);
    
    // 3. Check if any feeds need refreshing (4-hour revalidation) and create new feeds if needed
    // Only check feeds that would appear on the first page to avoid unnecessary refreshes
    devLog(`🔄 SERVER: Checking if feeds need refreshing only for first page titles`);
    
    const pageSize = 30; // Match the default pageSize in client
    const page = 1; // First page only
    
    try {
      await checkAndRefreshFeeds(postTitles, feedUrls, mediaTypes);
      devLog('✅ SERVER: Feed refresh check completed');
    } catch (refreshError) {
      errorLog('⚠️ SERVER: Feed refresh check failed:', refreshError);
      // Continue execution even if refresh fails
    }
    
    // 4. Create a map of feed URLs to post metadata for O(1) lookups
    const postMetadataMap = new Map(
      rssKeysWithPosts.posts.map(post => [post.feedUrl, {
        title: post.title,
        featuredImg: post.featuredImg,
        mediaType: post.mediaType,
        postSlug: post.postSlug,
        categorySlug: post.categorySlug
      }])
    );
    
    // 5. Directly query PlanetScale for the first page of entries with combined count query
    const offset = (page - 1) * pageSize;
    
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Build the combined SQL query to fetch entries and count in a single query
    const combinedQuery = `
      SELECT 
        e.*, 
        f.title as feed_title, 
        f.feed_url,
        (SELECT COUNT(*) FROM rss_entries e2 JOIN rss_feeds f2 ON e2.feed_id = f2.id WHERE f2.title IN (${placeholders})) as total_count
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE f.title IN (${placeholders})
      ORDER BY e.pub_date DESC
      LIMIT ? OFFSET ?
    `;
    
    devLog(`🔍 SERVER: Executing optimized PlanetScale query with combined count for page ${page}`);
    
    try {
      // Execute single query with combined count using read replicas
      const entriesResult = await executeRead(
        combinedQuery, 
        [
          ...postTitles,  // For the COUNT subquery
          ...postTitles,  // For the main query
          pageSize, 
          offset
        ]
      );
      
      const entries = entriesResult.rows as RSSEntryRow[];
      
      // Get total count from the first row
      const totalEntries = entries.length > 0 ? Number(entries[0].total_count) : 0;
      
      devLog(`🔢 SERVER: Found ${totalEntries} total entries across all requested feeds`);
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
        api.entries.batchGetEntryData,
        { entryGuids: guids },
        { token }
      );

      // 8. Combine all data efficiently
      const entriesWithPublicData = mappedEntries.map((entry: RSSItem, index: number) => {
        // Create a safe fallback for post metadata
        const feedUrl = entry.feedUrl;
        const fallbackMetadata = {
          title: entry.feedTitle || entry.title || '',
          featuredImg: entry.image as string || '',
          mediaType: 'article',
          postSlug: '',
          categorySlug: ''
        };
        
        return {
          entry,
          initialData: entryData[index] || {
            likes: { isLiked: false, count: 0 },
            comments: { count: 0 },
            retweets: { isRetweeted: false, count: 0 }
          },
          postMetadata: postMetadataMap.get(feedUrl) || fallbackMetadata
        };
      });

      devLog(`🚀 SERVER: Returning ${entriesWithPublicData.length} initial entries for the merged feed`);
      
      // Make sure to include the postTitles in the returned data
      return {
        entries: entriesWithPublicData,
        totalEntries,
        hasMore,
        postTitles,
        feedUrls
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

export default async function RSSEntriesDisplay() {
  const initialData = await getInitialEntries();
  
  if (!initialData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No entries found. Please sign in and add some RSS feeds to get started.</p>
        <p className="text-sm mt-2">If you&apos;ve already added feeds, try refreshing the page.</p>
      </div>
    );
  }

  // Log the post titles being passed to the client
  console.log(`SERVER: Passing ${initialData.postTitles?.length || 0} post titles to client`);

  return (
    <RSSEntriesClient
      initialData={initialData}
      pageSize={30}
    />
  );
}