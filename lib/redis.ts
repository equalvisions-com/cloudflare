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

  const cached = await redis.get<RSSCache>(cacheKey);
  if (cached && (now - cached.lastFetched) < 4 * 60 * 60 * 1000) {
    return cached.entries;
  }

  const freshEntries = await fetchRSSFeed(feedUrl);
  if (freshEntries.length === 0 && cached?.entries) return cached.entries;

  const mergedEntries = mergeAndSortEntries([cached?.entries || [], freshEntries]);
  const optimizedEntries = mergedEntries.map(({ title, link, description, pubDate, guid, image, feedUrl }) => ({
    title,
    link,
    description: description?.slice(0, 200),
    pubDate,
    guid,
    image,
    feedUrl,
  }));

  await redis.set(cacheKey, { lastFetched: now, entries: optimizedEntries });
  return optimizedEntries;
});

export const getMergedRSSEntries = cache(async (rssKeys: string[]): Promise<RSSItem[]> => {
  if (!rssKeys.length) return [];

  const cachedFeeds = await redis.mget<RSSCache[]>(...rssKeys);
  const now = Date.now();
  const validCachedEntries = cachedFeeds
    .filter(cache => cache && (now - cache.lastFetched) < 4 * 60 * 60 * 1000)
    .map(cache => cache!.entries);

  if (validCachedEntries.length === rssKeys.length) {
    return mergeAndSortEntries(validCachedEntries);
  }

  // Map rssKeys to their corresponding feedUrls from the database
  // This assumes we have a way to get feedUrl from rssKey, we'll need to enhance this
  const feedUrls = rssKeys.map(key => {
    // For now, we'll assume the feedUrl is stored elsewhere or can be derived
    // In a real implementation, we'd need to fetch this from Convex
    return key.replace(/^rss\./, '').replace(/_/g, ' '); // Placeholder logic
  });

  const freshFeeds = await Promise.all(feedUrls.map(url => fetchRSSFeed(url)));
  const allEntries = [...validCachedEntries, ...freshFeeds.filter(entries => entries.length > 0)];
  const mergedEntries = mergeAndSortEntries(allEntries);

  // Update cache for each feed
  await Promise.all(rssKeys.map((key, index) => {
    const entries = freshFeeds[index] || [];
    if (entries.length > 0) {
      return redis.set(key, { lastFetched: now, entries });
    }
  }));

  return mergedEntries;
});