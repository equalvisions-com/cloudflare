// Type definition for Cloudflare KVNamespace if not globally available
interface KVNamespace {
  get<T = string>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  getWithMetadata<T = string, Metadata = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<{ value: T | null; metadata: Metadata | null }>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown; }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string; }): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor?: string; }>;
}

import { cache } from "react";
import { memo } from "react";
import { getFeaturedEntriesKV, FeaturedEntry as KVFeaturedEntry } from "@/lib/featured_kv";
import { FeaturedFeedWrapper } from "@/components/featured/FeaturedFeedWrapper";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { 
  FeaturedFeedServerProps,
  FeaturedFeedEntryWithData,
  FeaturedFeedPostMetadata,
  FeaturedFeedEntry
} from '@/lib/types';
import 'server-only';

// Production-ready cached data fetching function
export const getInitialEntries = cache(async (kvBinding?: KVNamespace) => {
  if (!kvBinding) {
    console.error("KV binding was not provided to getInitialEntries. Serving empty.");
    return null;
  }

  try {
    // Get ALL featured entries from KV (or fetch and cache if needed)
    const entries: KVFeaturedEntry[] = await getFeaturedEntriesKV(kvBinding);

    if (!entries || entries.length === 0) {
      console.log('FeaturedFeed: No featured entries found in KV store');
      return null;
    }
    
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
    const entriesWithPublicData: FeaturedFeedEntryWithData[] = entries.map(entry => {
      // Use post metadata from the map, or create fallback metadata
      const metadata: FeaturedFeedPostMetadata = postMetadataMap.get(entry.feed_url) || {
        title: entry.post_title || entry.title,
        featuredImg: entry.image,
        mediaType: 'article',
        postSlug: '',
        categorySlug: '',
        verified: false
      };
      
      // Use metrics from the map, or create fallback metrics
      const metrics = metricsMap.get(entry.guid) || {
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 },
        bookmarks: { isBookmarked: false }
      };
      
      // Map KV FeaturedEntry to FeaturedFeedEntry format
      const featuredEntry: FeaturedFeedEntry = {
        guid: entry.guid,
        title: entry.title,
        link: entry.link,
        description: entry.description || '', // Ensure description is always a string
        pub_date: entry.pub_date,
        image: entry.image,
        feed_url: entry.feed_url,
        post_title: entry.post_title,
        mediaType: entry.category || 'article',
        isFeatured: true, // All entries from KV are featured by definition
        featuredAt: Date.now() // Use current timestamp as featured time
      };
      
      return {
        entry: featuredEntry,
        initialData: metrics,
        postMetadata: metadata
      };
    });

    console.log('FeaturedFeed: Successfully fetched and processed featured entries', {
      entriesCount: entriesWithPublicData.length,
      totalEntries: entries.length
    });

    return {
      entries: entriesWithPublicData,
      totalEntries: entries.length
    };
  } catch (error) {
    console.error('FeaturedFeed: Error fetching initial entries:', error);
    return null;
  }
});

// Production-ready Featured Feed Server Component
const FeaturedFeedComponent = async ({ 
  initialData: preloadedData, 
  kvBindingFromProps 
}: FeaturedFeedServerProps & { kvBindingFromProps?: KVNamespace }) => {
  // Use preloaded data or fetch from KV if binding is provided
  const data = preloadedData || (kvBindingFromProps ? await getInitialEntries(kvBindingFromProps) : null);
  
  // Enhanced empty state with better UX
  if (!data) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-xl font-semibold text-foreground">No featured content available</div>
        <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
          Featured content will appear here when available. Check back later for curated posts and highlights.
        </p>
      </div>
    );
  }
  
  // Log data source for debugging
  if (preloadedData) {
    console.log('FeaturedFeed: Using prefetched featured data.', {
      entriesCount: preloadedData.entries?.length || 0
    });
  } else if (kvBindingFromProps) {
    console.log('FeaturedFeed: Fetched data directly using provided KV binding.', {
      entriesCount: data.entries?.length || 0
    });
  }
  
  return (
    <FeaturedFeedWrapper
      initialData={data}
      pageSize={30}
      isActive={true}
    />
  );
};

// Export memoized version for performance optimization
// Note: Server components don't need React.memo, but we keep the pattern for consistency
export default FeaturedFeedComponent; 