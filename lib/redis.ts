/// <reference types="node" />
import { Redis } from '@upstash/redis';
import { XMLParser } from 'fast-xml-parser';
import orderBy from 'lodash/orderBy';
import { cache } from 'react';

// Initialize Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  automaticDeserialization: true,
});

// Add error handling for Redis operations
const handleRedisOperation = async <T>(operation: () => Promise<T>): Promise<T | null> => {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.warn('[Redis] Missing configuration. Some features may be unavailable.');
      return null;
    }
    return await operation();
  } catch (error) {
    console.error('[Redis] Operation failed:', error);
    return null;
  }
};

// Initialize XML parser with options
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  trimValues: true,
});

export interface RSSItem {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  guid: string;
  image?: string;
  feedUrl: string;
}

interface RSSCache {
  lastFetched: number;
  entries: RSSItem[];
}

interface RawRSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { "#text": string };
  enclosure?: { "@_url": string };
  "media:content"?: { "@_url": string };
}

function isGuidObject(guid: string | { "#text": string } | undefined): guid is { "#text": string } {
  return typeof guid === 'object' && guid !== null && "#text" in guid;
}

// Format RSS key to match Convex schema
export function formatRSSKey(postTitle: string): string {
  return `rss.${postTitle.replace(/\s+/g, '_')}`;
}

// Function to fetch and parse RSS feed
async function fetchRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'Accept': 'application/rss+xml, application/xml' },
      next: { revalidate: 14400 }, // 4 hours
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);
    }

    const xml = await response.text();
    const result = parser.parse(xml);
    const channel = result.rss?.channel;

    if (!channel) {
      throw new Error('Invalid RSS feed format');
    }

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    
    return items.map((item: RawRSSItem) => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      description: item.description || '',
      pubDate: item.pubDate || new Date().toISOString(),
      guid: isGuidObject(item.guid) ? item.guid["#text"] : (item.guid || item.link || ''),
      image: item.enclosure?.["@_url"] || item["media:content"]?.["@_url"] || null,
      feedUrl,
    }));
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    return [];
  }
}

// Optimized merge function using Map for O(1) lookups
function mergeAndSortEntries(oldEntries: RSSItem[] = [], newEntries: RSSItem[] = []): RSSItem[] {
  // Use Map for O(1) lookups instead of Set
  const entriesMap = new Map<string, RSSItem>();
  
  // Process old entries first (they'll be overwritten by newer ones if duplicates exist)
  oldEntries.forEach((entry: RSSItem) => {
    entriesMap.set(entry.guid, entry);
  });
  
  // Add or update with new entries
  newEntries.forEach((entry: RSSItem) => {
    entriesMap.set(entry.guid, entry);
  });
  
  // Convert to array and sort using lodash orderBy (more performant than fast-sort)
  return orderBy(
    Array.from(entriesMap.values()),
    [(entry: RSSItem) => new Date(entry.pubDate).getTime()],
    ['desc']
  );
}

// Get RSS entries with caching
export const getRSSEntries = cache(async (postTitle: string, feedUrl: string): Promise<RSSItem[]> => {
  try {
    const cacheKey = formatRSSKey(postTitle);
    console.log(`[RSS Cache] Checking cache for key: ${cacheKey}`);
    
    const cached = await handleRedisOperation(() => redis.get<RSSCache>(cacheKey));
    const now = Date.now();

    if (cached) {
      const cacheAge = now - cached.lastFetched;
      const cacheAgeHours = Math.round(cacheAge / (1000 * 60 * 60) * 10) / 10;
      
      if (cacheAge < 4 * 60 * 60 * 1000) {
        console.log(`[RSS Cache] HIT - Key: ${cacheKey}, Age: ${cacheAgeHours}h, Entries: ${cached.entries.length}`);
        return cached.entries;
      }
      
      console.log(`[RSS Cache] STALE - Key: ${cacheKey}, Age: ${cacheAgeHours}h`);
    } else {
      console.log(`[RSS Cache] MISS - Key: ${cacheKey}`);
    }

    // Fetch fresh entries
    console.log(`[RSS Cache] Fetching fresh entries from: ${feedUrl}`);
    const freshEntries = await fetchRSSFeed(feedUrl);
    console.log(`[RSS Cache] Fetched ${freshEntries.length} fresh entries`);
    
    if (freshEntries.length > 0) {
      // Use optimized merge function
      const mergedEntries = mergeAndSortEntries(cached?.entries, freshEntries);
      
      const newCache: RSSCache = {
        lastFetched: now,
        entries: mergedEntries,
      };
      
      await handleRedisOperation(() => redis.set(cacheKey, newCache));
      console.log(`[RSS Cache] Updated cache for key: ${cacheKey} with ${mergedEntries.length} entries`);
      return mergedEntries;
    }

    if (cached?.entries) {
      console.log(`[RSS Cache] Using ${cached.entries.length} cached entries for key: ${cacheKey}`);
      return cached.entries;
    }

    console.log(`[RSS Cache] No entries available for key: ${cacheKey}`);
    return [];
  } catch (error) {
    console.error(`[RSS Cache] Error in getRSSEntries:`, error);
    return [];
  }
});

// Function to fetch multiple RSS feeds and merge their entries
export async function getMergedRSSEntries(rssKeys: string[]): Promise<RSSItem[]> {
  try {
    console.log(`[RSS Cache] Fetching entries for ${rssKeys.length} feeds using MGET`);
    
    // Use MGET to fetch all keys in a single operation
    const results = await handleRedisOperation(() => redis.mget<RSSCache[]>(...rssKeys));
    if (!results) return [];
    
    console.log(`[RSS Cache] Retrieved ${results.length} results from Redis`);
    
    // Use Map for O(1) lookups
    const entriesMap = new Map<string, RSSItem>();
    let totalEntries = 0;

    // Process results from MGET
    for (const cached of results) {
      if (cached?.entries) {
        totalEntries += cached.entries.length;
        cached.entries.forEach((entry: RSSItem) => {
          const existing = entriesMap.get(entry.guid);
          if (!existing || new Date(entry.pubDate) > new Date(existing.pubDate)) {
            entriesMap.set(entry.guid, entry);
          }
        });
      }
    }

    console.log(`[RSS Cache] Merged Feed Stats:`);
    console.log(`- Total entries before deduplication: ${totalEntries}`);
    console.log(`- Unique entries after deduplication: ${entriesMap.size}`);

    const sortedEntries = orderBy(
      Array.from(entriesMap.values()),
      [(entry: RSSItem) => new Date(entry.pubDate).getTime()],
      ['desc']
    );

    console.log(`[RSS Cache] Final sorted entries count: ${sortedEntries.length}`);
    return sortedEntries;
  } catch (error) {
    console.error('[RSS Cache] Error in getMergedRSSEntries:', error);
    return [];
  }
} 