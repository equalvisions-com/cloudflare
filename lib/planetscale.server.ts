import mysql, { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { XMLParser } from 'fast-xml-parser';
import orderBy from 'lodash/orderBy';
import { cache } from 'react';
import 'server-only';
import type { RSSItem } from './rss';

// Initialize parser once
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (tagName) => tagName === "item",
});

// Create a connection pool using the connection string
export const pool = mysql.createPool(process.env.DATABASE_URL || '');

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

// Using the imported RSSItem type instead of redefining it
// export interface RSSItem {
//   title: string;
//   link: string;
//   description?: string;
//   pubDate: string;
//   guid: string;
//   image?: string;
//   feedUrl: string;
// }

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

      const description = cleanHtmlContent(item.description || item["itunes:summary"] || item["content:encoded"] || '');

      return {
        title: item.title || 'Untitled',
        link,
        description,
        pubDate: item.pubDate || new Date().toISOString(),
        guid: isGuidObject(item.guid) ? item.guid["#text"] : (item.guid || link || ''),
        image,
        feedUrl,
      };
    }).filter((item: RSSItem) => item.title && item.link); // Filter out invalid items
  } catch (error) {
    console.error(`Error fetching RSS feed ${feedUrl}:`, error);
    return [];
  }
}

// Get or create a feed in the database
async function getOrCreateFeed(feedUrl: string, title: string): Promise<number> {
  try {
    // Check if feed exists
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
    
    // Create new feed
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const currentTimeMs = Date.now(); // Use milliseconds for last_fetched (bigint column)
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO rss_feeds (feed_url, title, last_fetched, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [feedUrl, title, currentTimeMs, now, now]
    );
    
    return Number(result.insertId);
  } catch (error) {
    console.error(`Error getting or creating feed for ${feedUrl}:`, error);
    throw error;
  }
}

// Store RSS entries in the database
async function storeRSSEntries(feedId: number, entries: RSSItem[]): Promise<void> {
  try {
    for (const entry of entries) {
      // Check if entry exists
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM rss_entries WHERE feed_id = ? AND guid = ?',
        [feedId, entry.guid]
      );
      
      if (rows.length === 0) {
        // Insert new entry
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        // Ensure all parameters are primitive values
        const params = [
          Number(feedId),
          String(entry.guid),
          String(entry.title),
          String(entry.link),
          String(entry.description?.slice(0, 200) || ''),
          String(entry.pubDate),
          entry.image ? String(entry.image) : null,
          String(now)
        ];
        
        await pool.query<ResultSetHeader>(
          'INSERT INTO rss_entries (feed_id, guid, title, link, description, pub_date, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          params
        );
      }
    }
    
    // Update last_fetched timestamp and updated_at
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const currentTimeMs = Date.now(); // Use milliseconds for last_fetched (bigint column)
    await pool.query<ResultSetHeader>(
      'UPDATE rss_feeds SET updated_at = ?, last_fetched = ? WHERE id = ?',
      [now, currentTimeMs, feedId]
    );
  } catch (error) {
    console.error(`Error storing RSS entries for feed ${feedId}:`, error);
    throw error;
  }
}

export const getRSSEntries = cache(async (postTitle: string, feedUrl: string): Promise<RSSItem[]> => {
  const currentTime = Date.now(); // Keep this as milliseconds for comparison

  // Return empty array if feedUrl is undefined
  if (!feedUrl) {
    console.error(`Attempted to fetch RSS feed for ${postTitle} with undefined URL`);
    return [];
  }

  try {
    // Get feed from database
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, updated_at, last_fetched FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    let feedId: number;
    let shouldFetch = true;
    
    if (rows.length > 0) {
      feedId = Number(rows[0].id);
      
      // Use last_fetched instead of updated_at for staleness check
      const lastFetchedMs = Number(rows[0].last_fetched);
      
      // Check if we need to fetch fresh entries (older than 4 hours)
      shouldFetch = (currentTime - lastFetchedMs) >= 4 * 60 * 60 * 1000;
      
      // Log for debugging
      console.log(`💾 CACHE: Data is ${((currentTime - lastFetchedMs) / (60 * 1000)).toFixed(0)} minutes old for ${postTitle}`);
      console.log(`⏰ CACHE: ${shouldFetch ? 'Data is stale' : 'Using cached data'} for ${postTitle}`);
    } else {
      // Create new feed
      feedId = await getOrCreateFeed(feedUrl, postTitle);
    }
    
    // Fetch fresh entries if needed
    let freshEntries: RSSItem[] = [];
    if (shouldFetch) {
      console.log(`Fetching fresh RSS entries for ${postTitle} from ${feedUrl}`);
      freshEntries = await fetchRSSFeed(feedUrl);
      
      if (freshEntries.length > 0) {
        await storeRSSEntries(feedId, freshEntries);
      }
    }
    
    // Get entries from database
    const [entryRows] = await pool.query<RowDataPacket[]>(
      'SELECT guid, title, link, description, pub_date as pubDate, image FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC',
      [feedId]
    );
    
    // If we have no entries in the database but have fresh entries, return those
    if (entryRows.length === 0 && freshEntries.length > 0) {
      return freshEntries;
    }
    
    // Map database rows to RSSItem objects
    return entryRows.map((row: RowDataPacket) => ({
      title: row.title,
      link: row.link,
      description: row.description,
      pubDate: row.pubDate,
      guid: row.guid,
      image: row.image,
      feedUrl,
    }));
  } catch (error) {
    console.error(`Error in getRSSEntries for ${postTitle}:`, error);
    
    // If database query fails, try to fetch directly
    console.log(`Falling back to direct fetch for ${postTitle}`);
    return await fetchRSSFeed(feedUrl);
  }
});

export async function getMergedRSSEntries(
  rssKeys: string[], 
  offset: number = 0, 
  limit: number = 30
): Promise<RSSItem[] | null> {
  try {
    if (!rssKeys || rssKeys.length === 0) return null;
    
    const allEntries: RSSItem[] = [];
    
    // Process each RSS key
    for (const key of rssKeys) {
      // Extract the post title from the RSS key (remove 'rss.' prefix)
      const postTitle = key.replace(/^rss\./, '').replace(/_/g, ' ');
      
      // Get feed URL from database using the post title
      const [postRows] = await pool.query<RowDataPacket[]>(
        'SELECT feed_url FROM rss_feeds WHERE title = ?',
        [postTitle]
      );
      
      if (postRows.length === 0) continue;
      
      const feedUrl = postRows[0].feed_url;
      
      // Get entries for this feed
      const [entryRows] = await pool.query<RowDataPacket[]>(
        'SELECT guid, title, link, description, pub_date as pubDate, image FROM rss_entries WHERE feed_id = (SELECT id FROM rss_feeds WHERE feed_url = ?)',
        [feedUrl]
      );
      
      // Map database rows to RSSItem objects and add to allEntries
      allEntries.push(...entryRows.map((row: RowDataPacket) => ({
        title: row.title,
        link: row.link,
        description: row.description,
        pubDate: row.pubDate,
        guid: row.guid,
        image: row.image,
        feedUrl,
      })));
    }
    
    if (allEntries.length === 0) return null;
    
    // Sort by publication date (newest first)
    const sortedEntries = orderBy(
      allEntries,
      [(entry: RSSItem) => new Date(entry.pubDate).getTime()],
      ['desc']
    );
    
    // Apply pagination
    return sortedEntries.slice(offset, offset + limit);
  } catch (error) {
    console.error('Error merging RSS entries:', error);
    return null;
  }
}
