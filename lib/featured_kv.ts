// Import types from centralized location
import type { 
  KVNamespace, 
  RssEntry, 
  FeaturedEntry, 
  KVStoredData 
} from './types';
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
const LOCK_EXPIRATION_SECONDS = 90; // 90 seconds for best-effort lock
// const STALE_WHILE_REVALIDATE_SECONDS = 5 * 60; // No longer primarily used in getFeaturedEntriesKV for SWR logic

// Types are now imported from centralized location

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
    console.log("KV_REFRESH: Lock not acquired and no existing data, waiting briefly...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
    // Check if another process populated the cache while we waited
    const refreshedCache = await kv.get<KVStoredData>(FEATURED_ENTRIES_KEY, "json");
    if (refreshedCache?.entries && typeof refreshedCache.fetchedAt === 'number' && 
        ((Date.now() - refreshedCache.fetchedAt) / 1000) < CACHE_EXPIRATION_SECONDS) { // Check against full cache expiration
      console.log("KV_REFRESH: Cache updated by another process while waiting.");
      return refreshedCache.entries;
    }
    console.log("KV_REFRESH: Lock not acquired & cache not updated by another, proceeding with fetch (potential contention).");
  } else if (!lockAcquired && currentCachedData) {
    console.log("KV_REFRESH: Lock not acquired, but serving existing (potentially expired) data while another process likely refreshes.");
    return currentCachedData.entries; // Return the data we have, even if it's now considered expired by the caller
  }

  // If lock was acquired, or if it wasn't but we decided to proceed with fetch anyway
  try {
    const newEntries = await fetchAndCacheFromSources();

    if (newEntries && newEntries.length > 0) {
      const dataToStore: KVStoredData = { entries: newEntries, fetchedAt: Date.now() };
      await kv.put(FEATURED_ENTRIES_KEY, JSON.stringify(dataToStore), { expirationTtl: CACHE_EXPIRATION_SECONDS });
      console.log(`KV_REFRESH: Cached ${newEntries.length} entries for ${CACHE_EXPIRATION_SECONDS}s.`);
    } else if (newEntries) { // Successfully fetched, but got zero entries
      const dataToStore: KVStoredData = { entries: [], fetchedAt: Date.now() };
      // Cache empty result for a shorter period, or same as full cache? For now, let's use full cache time.
      // If empty results are common and undesirable to cache for long, this TTL could be shorter.
      await kv.put(FEATURED_ENTRIES_KEY, JSON.stringify(dataToStore), { expirationTtl: CACHE_EXPIRATION_SECONDS });
      console.log("KV_REFRESH: Fetched 0 entries, cached empty result for full duration.");
    }
    return newEntries || [];
  } catch (error) {
    console.error("KV_REFRESH: Error during fetch and cache process:", error);
    if (currentCachedData?.entries) {
      console.warn("KV_REFRESH: Fetch failed, returning previous data due to error (may be expired).");
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
 * Fetches and caches for 4 hours if data is missing or expired.
 *
 * @param kv The KVNamespace binding.
 * @returns A promise that resolves to an array of FeaturedEntry.
 */
export async function getFeaturedEntriesKV(kv: KVNamespace): Promise<FeaturedEntry[]> {
  if (!kv) {
    console.error("KV_GET: KV namespace binding is undefined. Cannot fetch featured entries.");
    return [];
  }

  const now = Date.now();
  let cacheResult: KVStoredData | null = null;
  try {
    cacheResult = await kv.get<KVStoredData>(FEATURED_ENTRIES_KEY, "json");
  } catch (e) {
    console.error("KV_GET: Error reading from KV:", e);
    // Proceed as if cache miss
  }

  if (cacheResult?.entries && typeof cacheResult?.fetchedAt === 'number') {
    const dataAgeSeconds = (now - cacheResult.fetchedAt) / 1000;
    if (dataAgeSeconds < CACHE_EXPIRATION_SECONDS) {
      console.log(`KV_GET: Cache is valid (age: ${Math.round(dataAgeSeconds / 60)} mins), serving from KV.`);
      return cacheResult.entries;
    }
    console.log(`KV_GET: Cache is hard-expired (age: ${Math.round(dataAgeSeconds / 60)} mins), will fetch fresh data.`);
  } else {
    console.log("KV_GET: Cache miss, will fetch fresh data.");
  }

  // Cache is missing or expired, fetch synchronously with lock
  try {
    // Pass the potentially expired cacheResult so fetchAndCacheWithBestEffortLockKV can serve it if lock isn't acquired immediately
    return await fetchAndCacheWithBestEffortLockKV(kv, cacheResult ?? undefined);
  } catch (error) {
    console.error("KV_GET: Synchronous fetch failed:", error);
    // If even the synchronous fetch fails, and we had some very old (but valid) cacheResult from the initial get,
    // we could return it as a last resort, but this would mean serving very old data.
    // For now, returning empty on full failure if no prior cache was deemed servable by fetchAndCacheWithBestEffortLockKV.
    return [];
  }
} 