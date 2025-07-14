// Type definition for Cloudflare KVNamespace if not globally available
interface KVNamespace {
  get<T = string>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  getWithMetadata<T = string, Metadata = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<{ value: T | null; metadata: Metadata | null }>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown; }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string; }): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor?: string; }>;
}

import { cache } from "react";
import { getFeaturedEntriesKV } from "@/lib/featured_kv";
import { FeaturedFeedClient } from "@/components/featured/FeaturedFeedClient";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { 
  FeaturedFeedEntry, 
  FeaturedFeedEntryWithData, 
  FeaturedFeedProps 
} from "@/lib/types";
import 'server-only';

// Remove local interface - using centralized type from @/lib/types

export const getInitialEntries = cache(async (kvBinding?: KVNamespace) => {
  if (!kvBinding) {
    return null;
  }

  // Get ALL featured entries from KV (or fetch and cache if needed)
  const entries: FeaturedFeedEntry[] = await getFeaturedEntriesKV(kvBinding);

  if (!entries || entries.length === 0) return null;
  
  // Get ALL entry guids for batch metrics query
  const guids = entries.map(entry => entry.guid);
  
  // Get unique feed URLs for post metadata query
  const feedUrls = [...new Set(entries.map(entry => entry.feed_url))];
  
  // Fetch both interaction data and post metadata in parallel - same pattern as RSSFeed
  const token = await convexAuthNextjsToken();
  const [metricsData, postsData] = await Promise.all([
    fetchQuery(
      api.entries.batchGetEntriesMetrics,
      { entryGuids: guids },
      { token }
    ).catch(() => {
      // Use default metrics if fetch fails - same pattern as RSSFeed
      return entries.map(() => ({
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 },
        bookmarks: { isBookmarked: false }
      }));
    }),
    fetchQuery(
      api.posts.getPostsByFeedUrls,
      { feedUrls },
      { token }
    )
  ]);

  // Create a map of feedUrl to post data for fast lookup
  const postsMap = new Map();
  postsData.forEach(post => {
    postsMap.set(post.feedUrl, post);
  });

  // Combine all entries with their data and metadata - same pattern as RSSFeed
  const entriesWithPublicData = entries.map((entry, index) => {
    // Get post metadata from database
    const postData = postsMap.get(entry.feed_url);
    
    // Create metadata from database post data (primary source) with KV fallback
    const metadata = {
      title: postData?.title || entry.post_title || entry.title,
      featuredImg: postData?.featuredImg || entry.image,
      mediaType: postData?.mediaType || 'article',
      postSlug: postData?.postSlug || '',
      categorySlug: postData?.categorySlug || '',
      verified: postData?.verified || false
    };
    
    // Use metrics from batch query, or create fallback metrics - same pattern as RSSFeed
    const metrics = metricsData[index] || {
      likes: { isLiked: false, count: 0 },
      comments: { count: 0 },
      retweets: { isRetweeted: false, count: 0 },
      bookmarks: { isBookmarked: false }
    };
    
    return {
      entry,
      initialData: metrics,
      postMetadata: metadata
    };
  });

  return {
    entries: entriesWithPublicData,
    totalEntries: entries.length
  };
});

export default async function FeaturedFeed({ initialData: preloadedData, kvBindingFromProps }: FeaturedFeedProps & { kvBindingFromProps?: KVNamespace }) {
  const data = preloadedData || (kvBindingFromProps ? await getInitialEntries(kvBindingFromProps) : null);
  
  if (!data) {
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-semibold">No featured content available</h2>
        <p className="text-muted-foreground mt-2">Check back later for featured content</p>
      </div>
    );
  }
  
  // Data source tracking removed
  
  return (
    <FeaturedFeedClient
      initialData={data}
      pageSize={30}
    />
  );
} 