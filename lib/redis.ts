// lib/redis.ts
import { Redis } from '@upstash/redis';
import { XMLParser } from 'fast-xml-parser';
import orderBy from 'lodash/orderBy';
import { cache } from 'react';

// Initialize Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: true,
});

// Initialize XML parser with options
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (tagName) => tagName === "item",
});

// Function to clean HTML content
function cleanHtmlContent(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/&[^;]+;/g, '') // Remove other HTML entities
    .trim();
}

// Function to extract first image from HTML content
function extractImageFromHtml(html?: string): string | undefined {
  if (!html) return undefined;
  // Improved regex to match img src more reliably, ignoring data URLs or invalid sources
  const match = html.match(/<img[^>]+src=["']((?!data:)[^"']+)["']/i);
  return match ? match[1] : undefined;
}

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
  "itunes:summary"?: string;
  "content:encoded"?: string;
  pubDate?: string;
  guid?: string | { "#text": string };
  enclosure?: { "@_url": string; "@_type": string; "@_length": string };
  "media:content"?: { "@_url": string; "@_medium"?: string };
  "itunes:image"?: { "@_href": string };
}

function isGuidObject(guid: string | { "#text": string } | undefined): guid is { "#text": string } {
  return typeof guid === 'object' && guid !== null && "#text" in guid;
}

export function formatRSSKey(postTitle: string): string {
  return `rss.${postTitle.replace(/\s+/g, '_')}`;
}

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

    const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

    return items.map((item: RawRSSItem) => {
      const enclosureUrl = item.enclosure?.["@_type"]?.startsWith("audio/") ? item.enclosure["@_url"] : undefined;
      const link = enclosureUrl || item.link || '';

      // Image handling: try explicit fields first, then fall back to HTML content
      let image =
        item["itunes:image"]?.["@_href"] ||
        item["media:content"]?.["@_url"] ||
        (item.enclosure?.["@_type"]?.startsWith("image/") ? item.enclosure["@_url"] : undefined);

      // Fallback to content:encoded first, then description or itunes:summary
      if (!image) {
        image = extractImageFromHtml(item["content:encoded"]) || 
                extractImageFromHtml(item.description || item["itunes:summary"]);
      }

      const description = cleanHtmlContent(item.description || item["itunes:summary"] || '');

      const entry = {
        title: item.title || 'Untitled',
        link,
        description,
        pubDate: item.pubDate || new Date().toISOString(),
        guid: isGuidObject(item.guid) ? item.guid["#text"] : (item.guid || link || ''),
        image,
        feedUrl,
      };

      if (!image) {
        console.log(`[RSS Parse] No image found for item: ${entry.title} in feed: ${feedUrl}`);
      }

      return entry;
    });
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    return [];
  }
}

function mergeAndSortEntries(oldEntries: RSSItem[] = [], newEntries: RSSItem[] = []): RSSItem[] {
  const entriesMap = new Map<string, RSSItem>();
  oldEntries.forEach((entry) => entriesMap.set(entry.guid, entry));
  newEntries.forEach((entry) => entriesMap.set(entry.guid, entry));
  return orderBy(
    Array.from(entriesMap.values()),
    [(entry: RSSItem) => new Date(entry.pubDate).getTime()],
    ['desc']
  );
}

export const getRSSEntries = cache(async (postTitle: string, feedUrl: string): Promise<RSSItem[]> => {
  try {
    const cacheKey = formatRSSKey(postTitle);
    console.log(`[RSS Cache] Checking cache for key: ${cacheKey}`);
    
    const cached = await redis.get<RSSCache>(cacheKey);
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

    console.log(`[RSS Cache] Fetching fresh entries from: ${feedUrl}`);
    const freshEntries = await fetchRSSFeed(feedUrl);
    console.log(`[RSS Cache] Fetched ${freshEntries.length} fresh entries`);
    
    if (freshEntries.length > 0) {
      const mergedEntries = mergeAndSortEntries(cached?.entries, freshEntries);
      const optimizedEntries = mergedEntries.map(({ title, link, description, pubDate, guid, image, feedUrl }) => ({
        title,
        link,
        description: description?.slice(0, 500),
        pubDate,
        guid,
        image,
        feedUrl,
      }));

      const newCache: RSSCache = {
        lastFetched: now,
        entries: optimizedEntries,
      };
      
      await redis.set(cacheKey, newCache);
      console.log(`[RSS Cache] Updated cache for key: ${cacheKey} with ${optimizedEntries.length} entries`);
      return optimizedEntries;
    }

    if (cached?.entries) {
      console.log(`[RSS Cache] Using ${cached.entries.length} cached entries for key: ${cacheKey}`);
      return cached.entries;
    }

    console.log(`[RSS Cache] No entries available for key: ${cacheKey}`);
    return [];
  } catch (error) {
    console.error(`[RSS Cache] Error in getRSSEntries for key ${formatRSSKey(postTitle)}:`, error);
    return [];
  }
});

export async function getMergedRSSEntries(rssKeys: string[]): Promise<RSSItem[]> {
  try {
    console.log(`[RSS Cache] Fetching entries for ${rssKeys.length} feeds using MGET`);
    const results = await redis.mget<RSSCache[]>(...rssKeys);
    console.log(`[RSS Cache] Retrieved ${results.length} results from Redis`);
    
    const entriesMap = new Map<string, RSSItem>();
    let totalEntries = 0;

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