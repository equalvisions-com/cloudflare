// components/rss-feed/RSSEntriesDisplay.server.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { cache } from "react";
import { RSSEntriesClient } from "./RSSEntriesDisplay.client";

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

// Define the API response interface
interface MergedFeedResponse {
  entries: RSSItem[];
  totalEntries: number;
  hasMore: boolean;
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

    devLog(`🔍 SERVER: Fetching merged entries for ${rssKeysWithPosts.rssKeys.length} RSS keys`);

    // 2. Extract post titles from RSS keys (remove 'rss.' prefix)
    const postTitles = rssKeysWithPosts.rssKeys.map(key => key.replace(/^rss\./, '').replace(/_/g, ' '));
    
    // 3. Create a map of feed URLs to post metadata for O(1) lookups
    const postMetadataMap = new Map(
      rssKeysWithPosts.posts.map(post => [post.feedUrl, {
        title: post.title,
        featuredImg: post.featuredImg,
        mediaType: post.mediaType,
        postSlug: post.postSlug,
        categorySlug: post.categorySlug
      }])
    );
    
    // 4. Fetch entries from PlanetScale using the post titles
    const limit = 30; // Match the default pageSize in client
    
    // Create a proper URL for the API request using offset/limit pagination
    // Use the absolute URL with the origin from the environment
    const apiUrl = new URL('/api/rss', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    apiUrl.searchParams.set('postTitles', JSON.stringify(postTitles));
    apiUrl.searchParams.set('offset', '0');
    apiUrl.searchParams.set('limit', limit.toString());
    apiUrl.searchParams.set('includePostMetadata', 'true'); // Request post metadata
    
    devLog(`🌐 SERVER: Fetching from ${apiUrl.toString()}`);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(apiUrl.toString(), {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache' // Ensure fresh data
        }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        errorLog(`❌ SERVER: API request failed with status ${response.status}: ${errorText}`);
        return null;
      }
      
      const data = await response.json() as MergedFeedResponse;
      const entries = data.entries;
      
      if (!entries || entries.length === 0) {
        devLog('⚠️ SERVER: No entries found for the requested RSS keys');
        return null;
      }
      
      devLog(`✅ SERVER: Found ${entries.length} entries for the merged feed`);

      // 5. Get unique entry guids for batch query
      const guids = entries.map((entry: RSSItem) => entry.guid);
      
      // 6. Batch fetch entry data for all entries at once
      const entryData = await fetchQuery(
        api.entries.batchGetEntryData,
        { entryGuids: guids },
        { token }
      );

      // 7. Combine all data efficiently
      const entriesWithPublicData = entries.map((entry: RSSItem, index: number) => {
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

      // 8. Check if there are more entries
      // Reliably determine if there are more entries based on requested limit vs received count
      const hasMore = data.hasMore || entries.length >= limit;

      devLog(`🚀 SERVER: Returning ${entriesWithPublicData.length} initial entries for the merged feed`);
      
      return {
        entries: entriesWithPublicData,
        totalEntries: data.totalEntries || entries.length,
        hasMore,
        postTitles
      };
    } catch (fetchError: unknown) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        errorLog('⏱️ SERVER: API request timed out after 10 seconds');
      } else {
        errorLog('❌ SERVER: Error fetching from API:', fetchError);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
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

  return (
    <RSSEntriesClient
      initialData={initialData}
      pageSize={30}
    />
  );
}