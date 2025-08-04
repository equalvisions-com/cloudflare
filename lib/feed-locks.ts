/**
 * Enterprise-grade database locking for RSS feed processing
 * Replaces KV-based locks with atomic MySQL operations
 */

import { executeWrite, executeRead } from './database';

export interface FeedLockResult {
  success: boolean;
  acquired: boolean;
  reason?: 'not_stale' | 'already_locked' | 'database_error';
  lockUntil?: number;
}

export interface FeedLockConfig {
  lockDurationMs?: number;    // Default: 5 minutes
  staleThresholdMs?: number;  // Default: 4 hours
}

const DEFAULT_CONFIG: Required<FeedLockConfig> = {
  lockDurationMs: 5 * 60 * 1000,      // 5 minutes
  staleThresholdMs: 4 * 60 * 60 * 1000, // 4 hours
};

/**
 * Atomically acquire a processing lock for a feed if it's stale
 * Combines lock acquisition and staleness check in single query
 */
export async function acquireFeedLock(
  feedUrl: string, 
  config: FeedLockConfig = {}
): Promise<FeedLockResult> {
  const { lockDurationMs, staleThresholdMs } = { ...DEFAULT_CONFIG, ...config };
  
  try {
    const now = Date.now();
    const lockUntil = now + lockDurationMs;
    const staleThreshold = now - staleThresholdMs;
    
    // Atomic operation: acquire lock only if feed is stale and not locked
    const result = await executeWrite(
      `UPDATE rss_feeds 
       SET processing_until = ?
       WHERE feed_url = ? 
         AND processing_until < ?
         AND last_fetched < ?`,
      [lockUntil, feedUrl, now, staleThreshold]
    );
    
    if (result.rowsAffected > 0) {
      return {
        success: true,
        acquired: true,
        lockUntil
      };
    }
    
    // Check why lock was not acquired
    const feedStatus = await executeRead(
      `SELECT last_fetched, processing_until 
       FROM rss_feeds 
       WHERE feed_url = ?`,
      [feedUrl]
    );
    
    if (feedStatus.rows.length === 0) {
      // Feed doesn't exist - this is unexpected but not an error
      return {
        success: true,
        acquired: false,
        reason: 'not_stale'
      };
    }
    
    const feed = feedStatus.rows[0] as { last_fetched: number; processing_until: number };
    
    if (feed.processing_until >= now) {
      return {
        success: true,
        acquired: false,
        reason: 'already_locked'
      };
    }
    
    if (feed.last_fetched >= staleThreshold) {
      return {
        success: true,
        acquired: false,
        reason: 'not_stale'
      };
    }
    
    // Edge case: race condition between UPDATE and SELECT
    return {
      success: true,
      acquired: false,
      reason: 'already_locked'
    };
    
  } catch (error) {
    console.error('Feed lock acquisition failed:', {
      feedUrl,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      success: false,
      acquired: false,
      reason: 'database_error'
    };
  }
}

/**
 * Release a feed lock and optionally update last_fetched timestamp
 */
export async function releaseFeedLock(
  feedUrl: string,
  success: boolean = true
): Promise<boolean> {
  try {
    if (success) {
      // Successful processing: clear lock and update last_fetched
      await executeWrite(
        `UPDATE rss_feeds 
         SET processing_until = 0, last_fetched = ?
         WHERE feed_url = ?`,
        [Date.now(), feedUrl]
      );
    } else {
      // Failed processing: clear lock but don't update last_fetched
      // This allows retry before the 4-hour threshold
      await executeWrite(
        `UPDATE rss_feeds 
         SET processing_until = 0
         WHERE feed_url = ?`,
        [feedUrl]
      );
    }
    
    return true;
    
  } catch (error) {
    console.error('Feed lock release failed:', {
      feedUrl,
      success,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return false;
  }
}

/**
 * Check if a feed is currently locked without acquiring a lock
 */
export async function isFeedLocked(feedUrl: string): Promise<boolean> {
  try {
    const result = await executeRead(
      `SELECT processing_until 
       FROM rss_feeds 
       WHERE feed_url = ? AND processing_until > ?`,
      [feedUrl, Date.now()]
    );
    
    return result.rows.length > 0;
    
  } catch (error) {
    console.error('Feed lock check failed:', {
      feedUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Assume locked on error to be safe
    return true;
  }
}

/**
 * Clean up expired locks (maintenance function)
 * Called periodically to handle orphaned locks from crashed processes
 */
export async function cleanupExpiredLocks(): Promise<number> {
  try {
    const result = await executeWrite(
      `UPDATE rss_feeds 
       SET processing_until = 0 
       WHERE processing_until > 0 AND processing_until < ?`,
      [Date.now()]
    );
    
    const cleanedCount = result.rowsAffected;
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired feed locks`);
    }
    
    return cleanedCount;
    
  } catch (error) {
    console.error('Lock cleanup failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return 0;
  }
}

/**
 * Get processing status for multiple feeds
 * Useful for monitoring and debugging
 */
export async function getFeedLockStatus(feedUrls: string[]): Promise<Record<string, {
  isLocked: boolean;
  lockUntil?: number;
  lastFetched: number;
  isStale: boolean;
}>> {
  if (feedUrls.length === 0) return {};
  
  try {
    const placeholders = feedUrls.map(() => '?').join(',');
    const now = Date.now();
    const staleThreshold = now - DEFAULT_CONFIG.staleThresholdMs;
    
    const result = await executeRead(
      `SELECT feed_url, processing_until, last_fetched
       FROM rss_feeds 
       WHERE feed_url IN (${placeholders})`,
      feedUrls
    );
    
    const status: Record<string, any> = {};
    
    for (const row of result.rows) {
      const feed = row as { feed_url: string; processing_until: number; last_fetched: number };
      
      status[feed.feed_url] = {
        isLocked: feed.processing_until > now,
        lockUntil: feed.processing_until > now ? feed.processing_until : undefined,
        lastFetched: feed.last_fetched,
        isStale: feed.last_fetched < staleThreshold
      };
    }
    
    // Handle feeds not found in database
    for (const feedUrl of feedUrls) {
      if (!status[feedUrl]) {
        status[feedUrl] = {
          isLocked: false,
          lastFetched: 0,
          isStale: true
        };
      }
    }
    
    return status;
    
  } catch (error) {
    console.error('Feed status check failed:', {
      feedUrls,
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Return safe defaults on error
    const status: Record<string, any> = {};
    for (const feedUrl of feedUrls) {
      status[feedUrl] = {
        isLocked: true, // Assume locked to be safe
        lastFetched: Date.now(), // Assume fresh to prevent processing
        isStale: false
      };
    }
    
    return status;
  }
}