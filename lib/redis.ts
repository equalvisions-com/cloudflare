// lib/redis.ts
import { Redis } from '@upstash/redis';
import { XMLParser } from 'fast-xml-parser';
import orderBy from 'lodash/orderBy';
import { cache } from 'react';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: true,
});

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (tagName) => tagName === "item",
});

function cleanHtmlContent(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&[^;]+;/g, '')
    .trim();
}

function extractImageFromHtml(html?: string): string | undefined {
  if (!html) return undefined;
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
    if (!feedUrl) {
      console.error('Attempted to fetch RSS feed with undefined URL');
      return [];
    }
    
    const response = await fetch(feedUrl, {
      headers: { 'Accept': 'application/rss+xml, application/xml' },
      next: { revalidate: 14400 },
    });

    if (!response.ok) throw new Error(`Failed to fetch RSS feed: ${response.statusText}`);

    const xml = await response.text();
    const result = parser.parse(xml);
    const channel = result.rss?.channel;
    if (!channel) throw new Error('Invalid RSS feed format');

    const channelImage = channel["itunes:image"]?.["@_href"];
    const items = Array.isArray(channel.item) ? channel.item : [channel.item].filter(Boolean);

    return items.map((item: RawRSSItem) => {
      const enclosureUrl = item.enclosure?.["@_type"]?.startsWith("audio/") ? item.enclosure["@_url"] : undefined;
      const link = enclosureUrl || item.link || '';

      let image = item["itunes:image"]?.["@_href"] ||
                  item["media:content"]?.["@_url"] ||
                  (item.enclosure?.["@_type"]?.startsWith("image/") ? item.enclosure["@_url"] : undefined);

      if (!image) {
        image = extractImageFromHtml(item["content:encoded"]) || 
                extractImageFromHtml(item.description || item["itunes:summary"]) ||
                channelImage;
      }

      const description = cleanHtmlContent(item.description || item["itunes:summary"] || '');

      return {
        title: item.title || 'Untitled',
        link,
        description,
        pubDate: item.pubDate || new Date().toISOString(),
        guid: isGuidObject(item.guid) ? item.guid["#text"] : (item.guid || link || ''),
        image,
        feedUrl,
      };
    });
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    return [];
  }
}

function mergeAndSortEntries(entriesArray: RSSItem[][]): RSSItem[] {
  const entriesMap = new Map<string, RSSItem>();
  entriesArray.flat().forEach((entry) => {
    const existing = entriesMap.get(entry.guid);
    if (!existing || new Date(entry.pubDate) > new Date(existing.pubDate)) {
      entriesMap.set(entry.guid, entry);
    }
  });
  return orderBy(
    Array.from(entriesMap.values()),
    [(entry: RSSItem) => new Date(entry.pubDate).getTime()],
    ['desc']
  );
}

export const getRSSEntries = cache(async (postTitle: string, feedUrl: string): Promise<RSSItem[]> => {
  const cacheKey = formatRSSKey(postTitle);
  const now = Date.now();

  // Return empty array if feedUrl is undefined
  if (!feedUrl) {
    console.error(`Attempted to fetch RSS feed for ${postTitle} with undefined URL`);
    return [];
  }

  const cached = await redis.get<RSSCache>(cacheKey);
  if (cached && (now - cached.lastFetched) < 4 * 60 * 60 * 1000) {
    return cached.entries;
  }

  console.log(`Fetching fresh RSS entries for ${postTitle} from ${feedUrl}`);
  const freshEntries = await fetchRSSFeed(feedUrl);
  
  // If we couldn't get fresh entries but have cached ones, use those
  if (freshEntries.length === 0 && cached?.entries) {
    console.log(`No fresh entries found for ${postTitle}, using cached entries`);
    return cached.entries;
  }

  // Merge with existing entries if we have them
  const mergedEntries = mergeAndSortEntries([cached?.entries || [], freshEntries]);
  
  // Optimize entries for storage (trim description)
  const optimizedEntries = mergedEntries.map(({ title, link, description, pubDate, guid, image, feedUrl }) => ({
    title,
    link,
    description: description?.slice(0, 200),
    pubDate,
    guid,
    image,
    feedUrl,
  }));

  // Update the cache
  await redis.set(cacheKey, { lastFetched: now, entries: optimizedEntries });
  console.log(`Updated cache for ${postTitle} with ${optimizedEntries.length} entries`);
  
  return optimizedEntries;
});

export async function getMergedRSSEntries(
  rssKeys: string[], 
  offset: number = 0, 
  limit: number = 10
): Promise<RSSItem[] | null> {
  try {
    if (!rssKeys || rssKeys.length === 0) return null;
    
    // Get cached entries for each RSS key
    const cachedFeeds = await redis.mget<RSSCache[]>(...rssKeys);
    const now = Date.now();
    
    const allEntries: RSSItem[] = [];
    
    // Process each feed
    for (let i = 0; i < rssKeys.length; i++) {
      const cache = cachedFeeds[i];
      const key = rssKeys[i];
      
      // Extract the post title from the RSS key (remove 'rss.' prefix)
      const postTitle = key.replace(/^rss\./, '').replace(/_/g, ' ');
      
      if (cache) {
        // If cache exists, use it directly
        if (cache.entries && Array.isArray(cache.entries)) {
          allEntries.push(...cache.entries);
        }
        
        // If cache is stale, refresh it in the background
        if ((now - cache.lastFetched) >= 4 * 60 * 60 * 1000 && cache.entries?.length > 0) {
          const feedUrl = cache.entries[0]?.feedUrl;
          if (feedUrl) {
            // Don't await this - let it update in the background
            getRSSEntries(postTitle, feedUrl).catch(err => 
              console.error(`Background refresh failed for ${postTitle}:`, err)
            );
          }
        }
      }
    }
    
    if (allEntries.length === 0) return null;
    
    // Sort by publication date (newest first)
    allEntries.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });
    
    // Apply pagination
    return allEntries.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error merging RSS entries:', error);
    return null;
  }
}