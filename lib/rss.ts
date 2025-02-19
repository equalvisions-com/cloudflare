import { Redis } from '@upstash/redis';
import { XMLParser } from 'fast-xml-parser';
import { sort } from 'fast-sort';

// Initialize parser once, not on every request
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Add parser options for better performance
  ignoreDeclaration: true,
  ignorePiTags: true,
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

// Initialize Redis once
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: true,
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

interface RSSCache {
  lastFetched: number;
  entries: RSSItem[];
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

// Get RSS entries with caching
export async function getRSSEntries(postTitle: string, feedUrl: string): Promise<RSSItem[]> {
  try {
    const cacheKey = formatRSSKey(postTitle);
    const cached = await redis.get<RSSCache>(cacheKey);
    const now = Date.now();

    // If cache exists and is fresh (less than 4 hours old), return cached entries
    if (cached && (now - cached.lastFetched) < 4 * 60 * 60 * 1000) {
      return cached.entries;
    }

    // Fetch fresh entries
    const freshEntries = await fetchRSSFeed(feedUrl);
    
    if (freshEntries.length > 0) {
      // If we have cached entries, merge with new ones
      let mergedEntries = freshEntries;
      if (cached?.entries) {
        // Create a Set of existing GUIDs for deduplication
        const existingGuids = new Set(cached.entries.map(entry => entry.guid));
        // Only add new entries that don't exist in cache
        const newEntries = freshEntries.filter(entry => !existingGuids.has(entry.guid));
        mergedEntries = [...cached.entries, ...newEntries];
      }

      // Sort entries by date, newest first
      mergedEntries = sort(mergedEntries).desc(entry => new Date(entry.pubDate).getTime());

      // Update cache with merged entries and new timestamp
      const newCache: RSSCache = {
        lastFetched: now,
        entries: mergedEntries,
      };
      
      await redis.set(cacheKey, newCache);
      return mergedEntries;
    }

    // If fresh fetch failed but we have cached entries, return those
    if (cached?.entries) {
      return cached.entries;
    }

    return [];
  } catch (error) {
    console.error('Error in getRSSEntries:', error);
    return [];
  }
}

// Function to fetch and store RSS feed (used by page.tsx)
export async function fetchAndStoreRSSFeed(feedUrl: string, postTitle: string): Promise<void> {
  try {
    // Use the same getRSSEntries function to maintain consistency
    await getRSSEntries(postTitle, feedUrl);
  } catch (error) {
    console.error('Error in fetchAndStoreRSSFeed:', error);
  }
} 