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
  
  // Get ALL entry guids for batch query
  const guids = entries.map(entry => entry.guid);
  
  // Get unique feed URLs for post metadata
  const feedUrls = [...new Set(entries.map(entry => entry.feed_url))];
  
  // Fetch ALL interaction data and post metadata in one batch query
  const token = await convexAuthNextjsToken();
  const combinedData = await fetchQuery(
    api.entries.getFeedDataWithMetrics,
    { entryGuids: guids, feedUrls },
    { token }
  );
  
  // Create maps for O(1) lookups
  const metricsMap = new Map(
    combinedData.entryMetrics.map(item => [item.guid, item.metrics])
  );
  
  const postMetadataMap = new Map(
    combinedData.postMetadata.map(item => [item.feedUrl, item.metadata])
  );

  // Combine all entries with their data and metadata
  const entriesWithPublicData = entries.map(entry => {
    // Use post metadata from the map, or create fallback metadata
    const metadata = postMetadataMap.get(entry.feed_url) || {
      title: entry.post_title || entry.title,
      featuredImg: entry.image,
      mediaType: 'article',
      postSlug: '',
      categorySlug: ''
    };
    
    // Use metrics from the map, or create fallback metrics
    const metrics = metricsMap.get(entry.guid) || {
      likes: { isLiked: false, count: 0 },
      comments: { count: 0 },
      retweets: { isRetweeted: false, count: 0 }
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