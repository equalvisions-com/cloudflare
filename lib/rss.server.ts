import * as mysql from 'mysql2/promise';
import { XMLParser } from 'fast-xml-parser';
import 'server-only';
import type { RSSItem } from './rss';

// Add a production-ready logging utility
const logger = {
  debug: (message: string, ...args: unknown[]) => {
    // Only log debug messages in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    console.log(`ℹ️ INFO: ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`⚠️ WARN: ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`❌ ERROR: ${message}`, ...args);
  },
  cache: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`💾 CACHE: ${message}`, ...args);
    } else {
      // In production, only log cache misses or errors, not hits
      if (message.includes('error') || message.includes('miss') || message.includes('stale')) {
        console.log(`💾 CACHE: ${message}`, ...args);
      }
    }
  },
  external: (message: string, ...args: unknown[]) => {
    // Always log external API calls in both environments
    console.log(`🌐 EXTERNAL: ${message}`, ...args);
  }
};

// Initialize parser once, not on every request
// const parser = new XMLParser({
//   ignoreAttributes: false,
//   attributeNamePrefix: "@_",
//   parseAttributeValue: true,
//   trimValues: true,
//   parseTagValue: false,
//   isArray: (tagName) => tagName === "item",
// });

// Configure connection pool for high concurrency
const poolConfig: mysql.PoolOptions = {
  uri: process.env.DATABASE_URL,
  connectionLimit: 500,      // Default is 10, increase for high concurrency
  queueLimit: 750,           // Maximum connection requests to queue
  waitForConnections: true, // Queue requests when no connections available
  enableKeepAlive: true,    // Keep connections alive
  keepAliveInitialDelay: 10000, // 10 seconds
  // Add timeouts to prevent hanging connections
  connectTimeout: 10000,    // 10 seconds
  // Remove invalid options that are causing warnings
  // acquireTimeout: 10000,
  // timeout: 60000,
};

// Initialize MySQL connection pool
const pool = mysql.createPool(poolConfig);

// Set up connection timeouts using the recommended approach
pool.on('connection', function (connection) {
  logger.debug('New database connection established');
  // Set session variables for timeouts
  connection.query('SET SESSION wait_timeout=28800'); // 8 hours
  connection.query('SET SESSION interactive_timeout=28800'); // 8 hours
});

// Handle connection errors - using process error handler instead of pool.on('error')
// since mysql2 doesn't support the 'error' event directly on the pool
process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('mysql')) {
    logger.error(`Database error: ${err.message}`);
    // Don't crash the server on connection errors
    // Just log them and let the pool handle reconnection
  } else {
    // For other uncaught exceptions, log and exit
    logger.error(`Uncaught exception: ${err.message}`);
    process.exit(1);
  }
});

// Add connection monitoring
process.on('exit', () => {
  gracefulShutdown();
});

// Handle graceful shutdown for SIGINT and SIGTERM
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT signal received');
});

process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM signal received');
});

// Graceful shutdown function
async function gracefulShutdown(msg?: string) {
  if (msg) {
    logger.info(`${msg}: Closing database pool connections`);
  }
  
  try {
    await pool.end();
    logger.info('Database pool connections closed successfully');
  } catch (err) {
    logger.error(`Error closing database pool: ${err}`);
  }
  
  // If this was triggered by a signal, exit with a success code
  if (msg) {
    process.exit(0);
  }
}

// Add error handling for database operations
const executeQuery = async <T extends mysql.RowDataPacket[] | mysql.ResultSetHeader>(
  query: string, 
  params: unknown[] = []
): Promise<T> => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Validate connection is still alive with a ping
    await connection.ping();
    
    const [result] = await connection.query(query, params) as [T, unknown];
    return result;
  } catch (error) {
    logger.error(`Database query error: ${error}`);
    throw error;
  } finally {
    if (connection) connection.release();
  }
};

// Export these interfaces and functions since they might be used in other files
export interface RawRSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { "#text": string };
  enclosure?: { "@_url": string; "@_type": string; "@_length": string };
  "media:content"?: { "@_url": string; "@_medium"?: string };
  "itunes:image"?: { "@_href": string };
  "itunes:summary"?: string;
  "content:encoded"?: string;
}

export function isGuidObject(guid: string | { "#text": string } | undefined): guid is { "#text": string } {
  return typeof guid === 'object' && guid !== null && "#text" in guid;
}

// Function to clean HTML content
export function cleanHtmlContent(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&[^;]+;/g, '')
    .trim();
}

// Function to extract image from HTML
export function extractImageFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']((?!data:)[^"']+)["']/i);
  return match ? match[1] : undefined;
}

// Add RSSFeed interface definition
interface RSSFeed {
  title: string;
  description: string;
  link: string;
  items: RSSItem[];
}

// Function to create a fallback feed when there's an error
function createFallbackFeed(url: string, error: Error | unknown): RSSFeed {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn(`Creating fallback feed for ${url} due to error: ${errorMessage}`);
  
  return {
    title: `Error fetching feed from ${url}`,
    description: `There was an error fetching the feed: ${errorMessage}`,
    link: url,
    items: [{
      title: 'Error fetching feed',
      description: `There was an error fetching the feed from ${url}: ${errorMessage}`,
      link: url,
      guid: `error-${Date.now()}`,
      pubDate: new Date().toISOString(),
      image: undefined,
      feedUrl: url
    }]
  };
}

// Function to fetch and parse RSS feed
async function fetchAndParseFeed(url: string): Promise<RSSFeed> {
  try {
    // Fetch the feed with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    logger.external(`Fetching feed from ${url}`);
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    logger.debug(`Received ${xml.length} bytes from ${url}`);
    
    if (xml.length < 100) {
      logger.warn(`Suspiciously small XML response from ${url}: ${xml.substring(0, 100)}`);
    }
    
    // Configure fast-xml-parser options for optimal performance
    const options = {
      attributeNamePrefix: "@_",
      attrNodeName: "attr",
      textNodeName: "#text",
      ignoreAttributes: false,
      parseAttributeValue: true,
      trimValues: true,
      isArray: (name: string) => {
        return name === "item" || name === "entry";
      }
    };
    
    try {
      const parser = new XMLParser(options);
      const result = parser.parse(xml);
      
      logger.debug(`Parsed XML structure: ${Object.keys(result).join(', ')}`);
      
      // Handle both RSS and Atom formats
      let channel;
      let items = [];
      
      if (result.rss && result.rss.channel) {
        // RSS format
        channel = result.rss.channel;
        items = channel.item || [];
        logger.debug(`Detected RSS format with ${items.length} items`);
      } else if (result.feed) {
        // Atom format
        channel = result.feed;
        items = channel.entry || [];
        logger.debug(`Detected Atom format with ${items.length} items`);
      } else {
        logger.warn(`Unrecognized feed format. Available keys: ${Object.keys(result).join(', ')}`);
        throw new Error('Unsupported feed format');
      }
      
      // Extract feed information
      const feed: RSSFeed = {
        title: getTextContent(channel.title),
        description: getTextContent(channel.description || channel.subtitle || ''),
        link: getLink(channel),
        items: []
      };
      
      logger.debug(`Feed title: "${feed.title}", description length: ${feed.description.length}, link: ${feed.link}`);
      
      // Process items with error handling for each item
      feed.items = items.map((item: Record<string, unknown>, index: number) => {
        try {
          const processedItem = {
            title: getTextContent(item.title),
            description: getTextContent(item.description || item.summary || item.content || ''),
            link: getLink(item),
            guid: getTextContent(item.guid || item.id || item.link || ''),
            pubDate: formatDate(item.pubDate || item.published || item.updated || new Date().toISOString()),
            image: extractImage(item),
            feedUrl: url // Add the feedUrl property which is required by the RSSItem interface
          };
          
          if (index < 2) {
            logger.debug(`Sample item ${index}: title="${processedItem.title}", guid=${processedItem.guid}, link=${processedItem.link}`);
          }
          
          return processedItem;
        } catch (itemError) {
          logger.warn(`Error processing feed item ${index}: ${itemError}`);
          // Return a minimal valid item to prevent the entire feed from failing
          return {
            title: 'Error processing item',
            description: '',
            link: '',
            guid: `error-${Date.now()}-${Math.random()}`,
            pubDate: new Date().toISOString(),
            image: null,
            feedUrl: url // Add the feedUrl property here too
          };
        }
      }).filter((item: RSSItem) => {
        const isValid = item.guid && item.title;
        if (!isValid) {
          logger.warn(`Filtered out invalid item: guid=${item.guid}, title=${item.title}`);
        }
        return isValid;
      }); // Filter out invalid items
      
      logger.info(`Successfully parsed feed from ${url} with ${feed.items.length} valid items`);
      return feed;
    } catch (parseError) {
      logger.error(`XML parsing error for ${url}: ${parseError}`);
      logger.debug(`First 500 characters of XML: ${xml.substring(0, 500).replace(/\n/g, ' ')}`);
      throw parseError;
    }
  } catch (error) {
    logger.error(`Error fetching feed from ${url}: ${error}`);
    // Return a fallback feed instead of throwing
    return createFallbackFeed(url, error);
  }
}

// Helper function to safely extract text content
function getTextContent(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'object' && node !== null) {
    const obj = node as Record<string, unknown>;
    if (obj['#text']) return String(obj['#text']);
    if (obj.attr && obj['#text']) return String(obj['#text']);
  }
  return String(node);
}

// Helper function to extract link from different formats
function getLink(node: unknown): string {
  if (!node) return '';
  if (typeof node !== 'object' || node === null) return '';
  
  const obj = node as Record<string, unknown>;
  if (typeof obj.link === 'string') return obj.link;
  if (obj.link && typeof obj.link === 'object' && obj.link !== null) {
    const link = obj.link as Record<string, unknown>;
    if (link.attr && typeof link.attr === 'object' && link.attr !== null) {
      const attr = link.attr as Record<string, unknown>;
      if (attr['@_href']) return String(attr['@_href']);
    }
  }
  if (Array.isArray(obj.link)) {
    if (obj.link[0] && typeof obj.link[0] === 'object' && obj.link[0] !== null) {
      const firstLink = obj.link[0] as Record<string, unknown>;
      if (firstLink.attr) return String((firstLink.attr as Record<string, unknown>)['@_href']);
    }
    return String(obj.link[0]);
  }
  return '';
}

// Helper function to extract image from item
function extractImage(item: Record<string, unknown>): string | null {
  try {
    // Check for media:content
    if (item['media:content']) {
      if (Array.isArray(item['media:content'])) {
        // Find the first image in the array
        const mediaImage = item['media:content'].find((media) => {
          if (typeof media !== 'object' || media === null) return false;
          const mediaObj = media as Record<string, unknown>;
          if (!mediaObj.attr || typeof mediaObj.attr !== 'object' || mediaObj.attr === null) return false;
          
          const attr = mediaObj.attr as Record<string, unknown>;
          return (attr['@_medium'] === 'image') || 
                 (attr['@_type'] && typeof attr['@_type'] === 'string' && attr['@_type'].startsWith('image/'));
        });
        
        if (mediaImage) {
          const mediaObj = mediaImage as Record<string, unknown>;
          if (mediaObj.attr && typeof mediaObj.attr === 'object' && mediaObj.attr !== null) {
            const attr = mediaObj.attr as Record<string, unknown>;
            if (attr['@_url']) return String(attr['@_url']);
          }
        }
      } else if (typeof item['media:content'] === 'object' && item['media:content'] !== null) {
        const media = item['media:content'] as Record<string, unknown>;
        if (media.attr && typeof media.attr === 'object' && media.attr !== null) {
          const attr = media.attr as Record<string, unknown>;
          if (attr['@_url']) return String(attr['@_url']);
        }
      }
    }
    
    // Check for itunes:image
    if (item['itunes:image'] && typeof item['itunes:image'] === 'object' && item['itunes:image'] !== null) {
      const itunesImage = item['itunes:image'] as Record<string, unknown>;
      if (itunesImage.attr && typeof itunesImage.attr === 'object' && itunesImage.attr !== null) {
        const attr = itunesImage.attr as Record<string, unknown>;
        if (attr['@_href']) return String(attr['@_href']);
      }
    }
    
    // Check for enclosure
    if (item.enclosure && typeof item.enclosure === 'object' && item.enclosure !== null) {
      const enclosure = item.enclosure as Record<string, unknown>;
      if (enclosure.attr && typeof enclosure.attr === 'object' && enclosure.attr !== null) {
        const attr = enclosure.attr as Record<string, unknown>;
        if (attr['@_type'] && 
            typeof attr['@_type'] === 'string' && 
            attr['@_type'].startsWith('image/') && 
            attr['@_url']) {
          return String(attr['@_url']);
        }
      }
    }
    
    // Check for image tag
    if (item.image) {
      if (typeof item.image === 'string') return item.image;
      if (typeof item.image === 'object' && item.image !== null) {
        const image = item.image as Record<string, unknown>;
        if (image.url) return String(image.url);
      }
    }
    
    // Extract from content or description as last resort
    if (item['content:encoded'] && typeof item['content:encoded'] === 'string') {
      const extracted = extractImageFromHtml(item['content:encoded']);
      if (extracted) return extracted;
    }
    
    if (item.description && typeof item.description === 'string') {
      const extracted = extractImageFromHtml(item.description);
      if (extracted) return extracted;
    }
    
    return null;
  } catch {
    // Handle the error without using a variable
    logger.error('Error extracting image from RSS item');
    return null;
  }
}

// Helper function to format date consistently
function formatDate(dateStr: unknown): string {
  try {
    if (typeof dateStr === 'string') {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    }
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Function to get or create a feed in PlanetScale
async function getOrCreateFeed(feedUrl: string, postTitle: string): Promise<number> {
  try {
    // Check if feed exists
    const rows = await executeQuery<mysql.RowDataPacket[]>(
      'SELECT id FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
    
    // Create new feed
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const currentTimeMs = Date.now(); // Use milliseconds for last_fetched (bigint column)
    const result = await executeQuery<mysql.ResultSetHeader>(
      'INSERT INTO rss_feeds (feed_url, title, last_fetched, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [feedUrl, postTitle, currentTimeMs, now, now]
    );
    
    return Number(result.insertId);
  } catch (error) {
    logger.error(`Error getting or creating feed for ${feedUrl}: ${error}`);
    throw error;
  }
}

// Function to execute a batch of operations in a transaction
async function executeBatchTransaction<T extends mysql.RowDataPacket[] | mysql.ResultSetHeader>(
  operations: Array<{ query: string; params: unknown[] }>
): Promise<T[]> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const results: T[] = [];
    for (const op of operations) {
      const [result] = await connection.query<T>(op.query, op.params);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    logger.error(`Transaction error: ${error}`);
    throw error;
  } finally {
    connection.release();
  }
}

// Function to store RSS entries with transaction support
async function storeRSSEntriesWithTransaction(feedId: number, entries: RSSItem[]): Promise<void> {
  try {
    if (entries.length === 0) return;
    
    // Get all existing entries in one query
    const existingEntries = await executeQuery<mysql.RowDataPacket[]>(
      'SELECT guid FROM rss_entries WHERE feed_id = ?',
      [feedId]
    );
    
    // Create a Set for faster lookups
    const existingGuids = new Set(existingEntries.map(row => row.guid));
    
    // Filter entries that don't exist yet
    const newEntries = entries.filter(entry => !existingGuids.has(entry.guid));
    
    if (newEntries.length === 0) {
      logger.debug(`No new entries to insert for feed ${feedId}`);
      
      // Just update the last_fetched timestamp
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const currentTimeMs = Date.now();
      await executeQuery<mysql.ResultSetHeader>(
        'UPDATE rss_feeds SET updated_at = ?, last_fetched = ? WHERE id = ?',
        [now, currentTimeMs, feedId]
      );
      return;
    }
    
    // Prepare batch operations
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const currentTimeMs = Date.now();
    
    // Split into chunks of 100 entries to avoid too large queries
    const chunkSize = 100;
    const chunks = [];
    
    for (let i = 0; i < newEntries.length; i += chunkSize) {
      chunks.push(newEntries.slice(i, i + chunkSize));
    }
    
    // Create operations for each chunk
    const operations = chunks.map(chunk => {
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = chunk.flatMap(entry => [
          Number(feedId),
          String(entry.guid),
          String(entry.title),
          String(entry.link),
          String(entry.description?.slice(0, 200) || ''),
          String(entry.pubDate),
          entry.image ? String(entry.image) : null,
          String(now)
      ]);
      
      return {
        query: `INSERT INTO rss_entries (feed_id, guid, title, link, description, pub_date, image, created_at) VALUES ${placeholders}`,
        params: values
      };
    });
    
    // Add the update operation
    operations.push({
      query: 'UPDATE rss_feeds SET updated_at = ?, last_fetched = ? WHERE id = ?',
      params: [now, currentTimeMs, feedId]
    });
    
    // Execute all operations in a transaction
    await executeBatchTransaction(operations);
    logger.info(`Batch inserted ${newEntries.length} entries for feed ${feedId} in ${chunks.length} chunks`);
  } catch (error) {
    logger.error(`Error storing RSS entries with transaction for feed ${feedId}: ${error}`);
    throw error;
  }
}

// Add a new function to acquire a lock
async function acquireFeedRefreshLock(feedUrl: string): Promise<boolean> {
  try {
    // Use an atomic INSERT operation to acquire a lock
    // If another process already has the lock, this will fail with a duplicate key error
    const lockKey = `refresh_lock:${feedUrl}`;
    const expiryTime = Date.now() + 60000; // Lock expires after 60 seconds
    
    const result = await executeQuery<mysql.ResultSetHeader>(
      'INSERT INTO rss_locks (lock_key, expires_at, created_at) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE lock_key = IF(expires_at < ?, VALUES(lock_key), lock_key), ' +
      'expires_at = IF(expires_at < ?, VALUES(expires_at), expires_at)',
      [lockKey, expiryTime, new Date(), Date.now(), expiryTime]
    );
    
    // If rows affected is 1, we acquired the lock
    // If rows affected is 0, someone else has the lock
    return result.affectedRows > 0;
  } catch (error) {
    logger.error(`Error acquiring lock for ${feedUrl}: ${error}`);
    // In case of error, assume we don't have the lock
    return false;
  }
}

// Function to release a lock
async function releaseFeedRefreshLock(feedUrl: string): Promise<void> {
  try {
    const lockKey = `refresh_lock:${feedUrl}`;
    await executeQuery<mysql.ResultSetHeader>('DELETE FROM rss_locks WHERE lock_key = ?', [lockKey]);
  } catch (error) {
    logger.error(`Error releasing lock for ${feedUrl}: ${error}`);
  }
}

// Get RSS entries with caching
export async function getRSSEntries(postTitle: string, feedUrl: string): Promise<RSSItem[]> {
  try {
    logger.info(`Checking for RSS feed: ${postTitle} (${feedUrl})`);
    
    // Check if we have recent entries in the database
    const feeds = await executeQuery<mysql.RowDataPacket[]>(
      'SELECT id, feed_url, title, updated_at, last_fetched FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    const currentTime = Date.now();
    let feedId: number;
    let shouldFetchFresh = true;
    
    if (feeds.length > 0) {
      feedId = Number(feeds[0].id);
      // Check if feed was fetched recently (less than 4 hours ago)
      const lastFetchedMs = Number(feeds[0].last_fetched);
      const timeSinceLastFetch = currentTime - lastFetchedMs;
      const fourHoursInMs = 4 * 60 * 60 * 1000;
      
      if (timeSinceLastFetch < fourHoursInMs) {
        shouldFetchFresh = false;
        logger.cache(`Using cached data for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
      } else {
        logger.cache(`Data is stale for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
      }
    } else {
      // Create new feed
      logger.cache(`No existing data for ${postTitle}, creating new feed entry`);
      feedId = await getOrCreateFeed(feedUrl, postTitle);
    }
    
    // If we need fresh data, fetch it
    if (shouldFetchFresh) {
      // Try to acquire a lock before fetching fresh data
      const lockAcquired = await acquireFeedRefreshLock(feedUrl);
      
      if (lockAcquired) {
        try {
          logger.debug(`Acquired refresh lock for ${postTitle}`);
          
          // Double-check if someone else refreshed while we were acquiring the lock
          const refreshCheck = await executeQuery<mysql.RowDataPacket[]>(
            'SELECT last_fetched FROM rss_feeds WHERE feed_url = ?',
            [feedUrl]
          );
          
          if (refreshCheck.length > 0) {
            const lastFetchedMs = Number(refreshCheck[0].last_fetched);
            const timeSinceLastFetch = currentTime - lastFetchedMs;
            const fourHoursInMs = 4 * 60 * 60 * 1000;
            
            if (timeSinceLastFetch < fourHoursInMs) {
              // Someone else refreshed the data while we were acquiring the lock
              logger.debug(`Another process refreshed the data for ${postTitle} while we were acquiring the lock`);
              shouldFetchFresh = false;
            }
          }
          
          if (shouldFetchFresh) {
            try {
              const freshFeed = await fetchAndParseFeed(feedUrl);
              if (freshFeed.items.length > 0) {
                logger.info(`Storing ${freshFeed.items.length} fresh entries for ${postTitle}`);
                await storeRSSEntriesWithTransaction(feedId, freshFeed.items);
              } else {
                logger.warn(`Feed ${postTitle} returned 0 items, not updating database`);
              }
            } catch (fetchError) {
              logger.error(`Error fetching feed ${postTitle}: ${fetchError}`);
              // Continue execution to return whatever data we have in the database
            }
          }
        } finally {
          // Always release the lock when done
          await releaseFeedRefreshLock(feedUrl);
          logger.debug(`Released refresh lock for ${postTitle}`);
        }
      } else {
        logger.info(`Another process is currently refreshing data for ${postTitle}, using existing data`);
        // Another process is refreshing, we'll use whatever data is available
      }
    }
    
    // Get all entries for this feed from the database
    logger.debug(`Retrieving entries for ${postTitle} from database`);
    const entries = await executeQuery<mysql.RowDataPacket[]>(
      'SELECT guid, title, link, description, pub_date as pubDate, image FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC',
      [feedId]
    );
    
    if (entries.length === 0) {
      logger.warn(`No entries found in database for ${postTitle}, fetching fresh data as fallback`);
      
      // If we have no entries in the database, try to fetch fresh data as a fallback
      try {
        const freshFeed = await fetchAndParseFeed(feedUrl);
        if (freshFeed.items.length > 0) {
          logger.info(`Fallback: Storing ${freshFeed.items.length} fresh entries for ${postTitle}`);
          await storeRSSEntriesWithTransaction(feedId, freshFeed.items);
          
          // Return the fresh items directly
          return freshFeed.items;
        }
      } catch (fallbackError) {
        logger.error(`Fallback fetch failed for ${postTitle}: ${fallbackError}`);
        // Continue to return empty array
      }
    }
    
    logger.info(`Retrieved ${entries.length} entries for ${postTitle}`);
    return entries.map((entry: mysql.RowDataPacket) => ({
      guid: entry.guid,
      title: entry.title,
      link: entry.link,
      description: entry.description,
      pubDate: entry.pubDate,
      image: entry.image,
      feedUrl
    }));
  } catch (error) {
    logger.error(`Error in getRSSEntries for ${postTitle}: ${error}`);
    
    // Try a direct fetch as a last resort
    try {
      logger.info(`Attempting direct fetch for ${postTitle} as last resort`);
      const directFeed = await fetchAndParseFeed(feedUrl);
      return directFeed.items;
    } catch (directError) {
      logger.error(`Direct fetch failed for ${postTitle}: ${directError}`);
    return [];
    }
  }
}

// Function to fetch and store RSS feed (used by page.tsx)
export async function fetchAndStoreRSSFeed(feedUrl: string, postTitle: string): Promise<void> {
  try {
    // Use the same getRSSEntries function to maintain consistency
    await getRSSEntries(postTitle, feedUrl);
  } catch (error) {
    logger.error(`Error in fetchAndStoreRSSFeed for ${postTitle}: ${error}`);
  }
}

// Function to store RSS entries in PlanetScale (for backward compatibility)
export async function storeRSSEntries(feedId: number, entries: RSSItem[]): Promise<void> {
  // Call the transaction-based version for better performance
  return storeRSSEntriesWithTransaction(feedId, entries);
}

// Function to ensure the RSS locks table exists
async function ensureRSSLocksTableExists(): Promise<void> {
  try {
    // Check if the table exists
    const connection = await pool.getConnection();
    try {
      const [tables] = await connection.query<mysql.RowDataPacket[]>(
        "SHOW TABLES LIKE 'rss_locks'"
      );
      
      if (tables.length === 0) {
        logger.info('Creating rss_locks table...');
        
        // Create the table
        await connection.query(`
          CREATE TABLE IF NOT EXISTS rss_locks (
            lock_key VARCHAR(255) PRIMARY KEY,
            expires_at BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB;
        `);
        
        logger.info('rss_locks table created successfully');
      } else {
        logger.debug('rss_locks table already exists');
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`Error ensuring rss_locks table exists: ${error}`);
    // Don't throw the error, just log it
    // The application can still function without the locks table
  }
}

// Call the function to ensure the table exists
ensureRSSLocksTableExists().catch(err => {
  logger.error(`Failed to check/create rss_locks table: ${err}`);
});