// Type definition for Cloudflare KVNamespace if not globally available
// You might not need this if your project already has Cloudflare Worker types configured.
interface KVNamespace {
  get<T = string>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<T | null>;
  getWithMetadata<T = string, Metadata = unknown>(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<{ value: T | null; metadata: Metadata | null }>;
  put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown; }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string; }): Promise<{ keys: { name: string; expiration?: number; metadata?: unknown }[]; list_complete: boolean; cursor?: string; }>;
}

import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { fetchRssEntriesFromPlanetScale, getFeedIdsByUrls } from './planetscale';

// KV Namespace Binding Name - ensure this matches the binding name in your wrangler.toml or Cloudflare dashboard
// For example, if your wrangler.toml has:
// [[kv_namespaces]]
// binding = "FEATURED_FEED_KV"
// id = "f1bc80c723d14a31b015bce648de2982"
// Then FEATURED_FEED_KV is your binding.
// This code expects the KVNamespace object to be passed directly to functions.

// Define the KV keys
const FEATURED_ENTRIES_KEY = 'featured_entries_v2'; // Consider versioning keys if format changes
const REFRESH_LOCK_KEY_KV = 'featured_entries_lock_kv_v2';

// Cache and Lock Expiration Times (in seconds)
const CACHE_EXPIRATION_SECONDS = 4 * 60 * 60; // 4 hours
const LOCK_EXPIRATION_SECONDS = 90; // 90 seconds for best-effort lock (increased from 60)
const STALE_WHILE_REVALIDATE_SECONDS = 5 * 60; // Serve stale for 5 mins while revalidating

// Interface for RSS entry from PlanetScale (mirroring what was in featured_redis.ts)
interface RssEntry {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_url: string;
}

// Interface for featured entries (from featured_redis.ts)
export interface FeaturedEntry {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  link: string;
  description?: string;
  pub_date: string;
  image?: string;
  feed_url: string;
  post_title?: string; // From Convex post
  category?: string; // From Convex post
}

interface KVStoredData {
  entries: FeaturedEntry[];
  fetchedAt: number; // Timestamp of when the data was fetched
}

// This function contains the original logic to fetch data from Convex and PlanetScale
async function fetchAndCacheFromSources(): Promise<FeaturedEntry[]> {
  try {
    console.log('KV_FETCH: Fetching featured posts from Convex and entries from PlanetScale');
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const featuredPosts = await convex.query(api.featured.getFeaturedPosts);

    if (!featuredPosts || featuredPosts.length === 0) {
      console.log('KV_FETCH: No featured posts found in Convex');
      return [];
    }

    const feedUrls = featuredPosts.map(post => post.feedUrl);
    const feedsData = await getFeedIdsByUrls(feedUrls);

    if (!feedsData || feedsData.length === 0) {
      console.log('KV_FETCH: No matching feeds found in PlanetScale');
      return [];
    }

    const feedIds: number[] = (feedsData as Array<{ id: number }>).map(feed => feed.id);

    const entries = await fetchRssEntriesFromPlanetScale(feedIds);

    if (!entries || entries.length === 0) {
      console.log('KV_FETCH: No entries found in PlanetScale for featured posts');
      return [];
    }
    console.log(`KV_FETCH: Retrieved ${entries.length} entries from the last 24 hours`);

    const feedUrlToPostMap = new Map();
    featuredPosts.forEach(post => {
      feedUrlToPostMap.set(post.feedUrl, {
        title: post.title,
        category: post.category
      });
    });

    const enrichedEntries = (entries as Array<RssEntry>).map(entry => ({
      ...entry,
      post_title: feedUrlToPostMap.get(entry.feed_url)?.title,
      category: feedUrlToPostMap.get(entry.feed_url)?.category
    }));

    return enrichedEntries;
  } catch (error) {
    console.error('KV_FETCH: Error fetching data from sources:', error);
    throw error; // Re-throw to be handled by the caller
  }
}

async function acquireBestEffortLockKV(kv: KVNamespace, lockKey: string, ttlSeconds: number): Promise<boolean> {
  try {
    const currentLock = await kv.get(lockKey);
    if (currentLock) {
      console.log("KV_LOCK: Lock key already exists.");
      return false;
    }
    // Attempt to set the lock
    await kv.put(lockKey, "locked", { expirationTtl: ttlSeconds });
    console.log("KV_LOCK: Attempted to acquire best-effort lock.");
    // Due to eventual consistency, we can't be 100% sure. This is a "best-effort".
    return true;
  } catch (e) {
    console.error("KV_LOCK: Error acquiring lock", e);
    return false;
  }
}

async function fetchAndCacheWithBestEffortLockKV(kv: KVNamespace, currentCachedData?: KVStoredData): Promise<FeaturedEntry[]> {
  const lockAcquired = await acquireBestEffortLockKV(kv, REFRESH_LOCK_KEY_KV, LOCK_EXPIRATION_SECONDS);

  if (!lockAcquired && !currentCachedData) {
    console.log("KV_REFRESH: Lock not acquired and no stale data, waiting briefly...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    const refreshedCache = await kv.get<KVStoredData>(FEATURED_ENTRIES_KEY, "json");
    if (refreshedCache?.entries && refreshedCache?.fetchedAt &&
        (Date.now() - refreshedCache.fetchedAt) / 1000 < STALE_WHILE_REVALIDATE_SECONDS) {
      console.log("KV_REFRESH: Cache updated by another process while waiting.");
      return refreshedCache.entries;
    }
    console.log("KV_REFRESH: Lock not acquired & cache not updated, proceeding with fetch (potential contention).");
  }

  try {
    const newEntries = await fetchAndCacheFromSources();

    if (newEntries && newEntries.length > 0) {
      const dataToStore: KVStoredData = { entries: newEntries, fetchedAt: Date.now() };
      await kv.put(FEATURED_ENTRIES_KEY, JSON.stringify(dataToStore), { expirationTtl: CACHE_EXPIRATION_SECONDS });
      console.log(`KV_REFRESH: Cached ${newEntries.length} entries.`);
    } else if (newEntries) { // Successfully fetched, but got zero entries
      const dataToStore: KVStoredData = { entries: [], fetchedAt: Date.now() };
      await kv.put(FEATURED_ENTRIES_KEY, JSON.stringify(dataToStore), { expirationTtl: STALE_WHILE_REVALIDATE_SECONDS / 2 }); // Cache empty for shorter time
      console.log("KV_REFRESH: Fetched 0 entries, cached empty result for a shorter duration.");
    }
    // If newEntries is null/undefined due to an error in fetchAndCacheFromSources,
    // we don't overwrite a potentially good stale cache here. The error will be caught below.
    return newEntries || [];
  } catch (error) {
    console.error("KV_REFRESH: Error during fetch and cache process:", error);
    if (currentCachedData?.entries) {
      console.warn("KV_REFRESH: Fetch failed, returning previous stale data due to error.");
      return currentCachedData.entries;
    }
    throw error; // Re-throw if no stale data to serve
  } finally {
    if (lockAcquired) {
      await kv.delete(REFRESH_LOCK_KEY_KV);
      console.log("KV_LOCK: Best-effort lock released.");
    }
  }
}

/**
 * Gets featured entries from Cloudflare KV.
 * Implements a stale-while-revalidate pattern.
 *
 * @param kv The KVNamespace binding.
 * @returns A promise that resolves to an array of FeaturedEntry.
 */
export async function getFeaturedEntriesKV(kv: KVNamespace): Promise<FeaturedEntry[]> {
  if (!kv) {
    console.error("KV_GET: KV namespace binding is undefined. Cannot fetch featured entries.");
    // Fallback or throw error. For now, returning empty array.
    // Consider if your application should throw an error here to catch misconfigurations earlier.
    return [];
  }

  const now = Date.now();
  let cacheResult: KVStoredData | null = null;
  try {
    cacheResult = await kv.get<KVStoredData>(FEATURED_ENTRIES_KEY, "json");
  } catch (e) {
    console.error("KV_GET: Error reading from KV:", e);
    // Proceed as if cache miss, but log the error
  }
  

  if (cacheResult?.entries && typeof cacheResult?.fetchedAt === 'number') {
    const dataAgeSeconds = (now - cacheResult.fetchedAt) / 1000;

    if (dataAgeSeconds < STALE_WHILE_REVALIDATE_SECONDS) {
      console.log("KV_GET: Cache is fresh, serving from KV.");
      return cacheResult.entries;
    } else if (dataAgeSeconds < CACHE_EXPIRATION_SECONDS) {
      console.log("KV_GET: Cache is stale, serving from KV and revalidating in background.");
      // Don't await - let it run in background
      fetchAndCacheWithBestEffortLockKV(kv, cacheResult).catch(err => console.error("KV_GET: Background refresh failed:", err));
      return cacheResult.entries;
    }
  }

  console.log("KV_GET: Cache miss or hard-expired, fetching synchronously.");
  try {
    return await fetchAndCacheWithBestEffortLockKV(kv, cacheResult ?? undefined);
  } catch (error) {
    console.error("KV_GET: Synchronous fetch failed:", error);
    // If even the synchronous fetch fails, and we had some very old (but valid) cacheResult,
    // we might consider returning it as a last resort, or just return empty.
    // For now, returning empty on full failure.
    return [];
  }
} 