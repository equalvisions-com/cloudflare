import { ExecutedQuery } from '@planetscale/database';
import 'server-only';
import type { RSSItem } from './rss';
import { PlanetScaleQueryResult, RSSFeedRow, RSSEntryRow } from './types';
import { executeRead, executeWrite } from './database';

// Production-ready logging utility
const logger = {
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    console.log(`ℹ️ INFO: ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️ WARN: ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`❌ ERROR: ${message}`, ...args);
  },
  cache: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`💾 CACHE: ${message}`, ...args);
      }
  }
};

// Helper function to execute queries with proper error handling
async function executeQuery<T = Record<string, unknown>>(
  query: string, 
  params: unknown[] = []
): Promise<PlanetScaleQueryResult> {
  try {
    const result = await executeRead(query, params);
    return result as PlanetScaleQueryResult;
  } catch (error) {
    logger.error(`Database query error: ${error}`);
    throw error;
  }
}

/**
 * Creates or gets an existing feed record in the database
 * Workers handle the actual RSS processing and entry storage
 */
async function getOrCreateFeed(feedUrl: string, postTitle: string, mediaType?: string): Promise<number> {
  try {
    // Check if feed exists
    const existingFeedResult = await executeRead(
      'SELECT id FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    if (existingFeedResult.rows.length > 0) {
      const feedId = Number((existingFeedResult.rows[0] as any).id);
      logger.debug(`Using existing feed ID ${feedId} for ${postTitle}`);
      return feedId;
    }
    
    // Create new feed record (Workers will populate entries)
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const currentTimeMs = Date.now();
    
    const insertResult = await executeWrite(
      'INSERT INTO rss_feeds (feed_url, title, media_type, last_fetched, processing_until, created_at, updated_at) VALUES (?, ?, ?, 0, 0, ?, ?)',
      [feedUrl, postTitle, mediaType || null, now, now]
    );

    const feedId = Number(insertResult.insertId);
    logger.info(`Created new feed record ID ${feedId} for ${postTitle} - Workers will populate entries`);
    return feedId;

  } catch (error) {
    logger.error(`Error creating/getting feed for ${feedUrl}: ${error}`);
    throw error;
  }
}

/**
 * Read-only RSS entries retrieval
 * All processing/refreshing handled by Cloudflare Workers
 */
export async function getRSSEntries(
  postTitle: string, 
  feedUrl: string, 
  mediaType?: string,
  page: number = 1,
  pageSize: number = 30
): Promise<{ entries: RSSItem[], hasMore: boolean }> {
  try {
    logger.info(`Getting RSS entries for: ${postTitle} (${feedUrl})`);
    
    // Get feed ID from database
    const feedsResult = await executeRead(
      'SELECT id FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    let feedId: number;
    
    if (feedsResult.rows.length > 0) {
      // Use existing feed
      const feeds = feedsResult.rows as any[];
      feedId = Number(feeds[0].id);
      logger.debug(`Using existing feed ID ${feedId} for ${postTitle}`);
      } else {
      // Create new feed record (Workers will populate it with entries)
      logger.debug(`Creating new feed entry for ${postTitle} - Workers will populate entries`);
      feedId = await getOrCreateFeed(feedUrl, postTitle, mediaType);
    }
    
    // Calculate pagination values
    const offset = (page - 1) * pageSize;
    
    // Get paginated entries using limit+1 for hasMore detection (no COUNT needed!)
    logger.debug(`Retrieving paginated entries for ${postTitle} from database (page ${page}, pageSize ${pageSize})`);
    const entriesResult = await executeRead(
      'SELECT guid, title, link, description, pub_date, image, media_type FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC, id DESC LIMIT ? OFFSET ?',
      [feedId, pageSize + 1, offset] // +1 for hasMore detection
    );
    
    const allEntryRows = entriesResult.rows as any[];
    
    // Limit+1 pagination: Check if we got more than pageSize (means there are more pages)
    const hasMore = allEntryRows.length > pageSize;
    
    // Keep only the requested pageSize (drop the extra row if it exists)
    const entryRows = hasMore ? allEntryRows.slice(0, pageSize) : allEntryRows;
    
    // Map to RSSItem format
    const entries: RSSItem[] = entryRows.map(row => ({
      guid: row.guid,
      title: row.title,
      link: row.link,
      description: row.description || '',
      pubDate: row.pub_date,
      image: row.image || undefined,
      mediaType: row.media_type || mediaType,
        feedUrl
    }));
    
    logger.debug(`Retrieved ${entries.length} entries (hasMore: ${hasMore})`);
    
    return {
      entries,
      hasMore
    };

  } catch (error) {
    logger.error(`Error in getRSSEntries for ${postTitle}: ${error}`);
    throw error;
  }
}

// Legacy RSS processing functions removed - all processing now handled by Cloudflare Workers
// Removed functions:
// - checkAndRefreshFeeds: Workers handle feed refreshing with database locking
// - refreshExistingFeeds: Workers handle all refresh operations
// - fetchAndParseFeed: Workers handle RSS fetching and XML parsing
// - storeRSSEntriesWithTransaction: Workers handle database storage and deduplication