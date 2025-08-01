import { NextRequest, NextResponse } from 'next/server';
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { validateHeaders } from '@/lib/headers';
import type { QueueFeedRefreshMessage, QueueBatchStatus } from '@/lib/types';

// Add Edge Runtime configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Helper function to log queue operations in production
const devLog = (message: string, data?: unknown) => {
  // Always log queue operations for debugging
  if (data) {
    console.log(message, data);
  } else {
    console.log(message);
  }
};

// Helper function to log errors
const errorLog = (message: string, error?: unknown) => {
  if (error) {
    console.error(message, error);
  } else {
    console.error(message);
  }
};

// In-memory store for tracking batch status (in production, use KV or D1)
// Note: Batch status is now handled entirely by Durable Objects
// KV operations removed to eliminate redundancy

// Fallback function to process directly when queue isn't available
async function processDirectly(queueMessage: QueueFeedRefreshMessage) {
  try {
    // Call our own consumer endpoint directly
    const response = await fetch('/api/queue-consumer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queueMessage),
    });

    if (!response.ok) {
      throw new Error(`Direct processing error: ${response.status}`);
    }

    const result = await response.json();
    
    return NextResponse.json({
      success: true,
      batchId: queueMessage.batchId,
      status: 'completed',
      processedDirectly: true,
      result: result
    });
  } catch (error) {
    console.error('❌ Direct processing failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Processing failed' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!validateHeaders(request as any)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  try {
    // Verify user authentication
    const token = await convexAuthNextjsToken();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { postTitles, feedUrls, mediaTypes, existingGuids = [], newestEntryDate, priority = 'normal' } = body;
    
    // Always log for debugging
    console.log('📥 QUEUE PRODUCER: Received request', {
      postTitlesCount: postTitles?.length || 0,
      feedUrlsCount: feedUrls?.length || 0,
      mediaTypesCount: mediaTypes?.length || 0,
      existingGuidsCount: existingGuids?.length || 0,
      newestEntryDate,
      priority
    });
    
    devLog('📥 QUEUE PRODUCER: Received refresh request', {
      postTitlesCount: postTitles?.length || 0,
      feedUrlsCount: feedUrls?.length || 0,
      mediaTypesCount: mediaTypes?.length || 0,
      existingGuidsCount: existingGuids?.length || 0,
      newestEntryDate,
      priority
    });

    // Validate input
    if (!postTitles || !Array.isArray(postTitles) || postTitles.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid postTitles - must be non-empty array' 
      }, { status: 400 });
    }

    if (!feedUrls || !Array.isArray(feedUrls) || feedUrls.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid feedUrls - must be non-empty array' 
      }, { status: 400 });
    }

    if (postTitles.length !== feedUrls.length) {
      return NextResponse.json({ 
        success: false, 
        error: 'postTitles and feedUrls arrays must have the same length' 
      }, { status: 400 });
    }

    // Generate unique batch ID
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Extract user ID from token for queue context
    // Note: You may need to decode the JWT token to get the actual user ID
    const userId = 'user_from_token'; // TODO: Extract actual user ID from token

    // Normalize arrays
    const normalizedPostTitles = postTitles.map((title: string) => String(title).trim());
    const normalizedFeedUrls = feedUrls.map((url: string) => String(url).trim());
    const normalizedMediaTypes = mediaTypes ? mediaTypes.map((type: string) => String(type).trim()) : [];

    // 🔍 CRITICAL: Check staleness BEFORE queuing to prevent unnecessary processing
    console.log('🔍 QUEUE PRODUCER: Checking which feeds need refreshing...');
    const staleFeedTitles = await checkFeedsNeedingRefresh(normalizedPostTitles);
    
    if (staleFeedTitles.length === 0) {
      console.log('✅ QUEUE PRODUCER: All feeds are fresh - no queue message needed');
      return NextResponse.json({
        success: true,
        batchId,
        status: 'skipped',
        message: 'All feeds are up to date',
        staleFeedsCount: 0,
        totalFeedsCount: normalizedPostTitles.length
      });
    }
    
      // 🔒 BULLETPROOF PROTECTION: Check for active locks AND update last_fetched
  console.log(`🔒 QUEUE PRODUCER: Checking for active locks on ${staleFeedTitles.length} stale feeds`);
  const feedsNotLocked = await filterOutLockedFeeds(staleFeedTitles);
  
  if (feedsNotLocked.length === 0) {
    console.log('🔒 QUEUE PRODUCER: All feeds are currently locked - skipping queue');
    return NextResponse.json({ 
      batchId: null,
      message: 'Feed is being processed by another request',
      status: 'skipped'
    }, { status: 200 });
  }
  
  console.log(`🔒 QUEUE PRODUCER: ${feedsNotLocked.length} feeds available for processing (${staleFeedTitles.length - feedsNotLocked.length} locked)`);
  
  // Create temporary API locks for feeds we're about to queue (longer duration for queue delays)
  await createTemporaryAPILocks(feedsNotLocked);
  console.log('✅ QUEUE PRODUCER: Protected feeds from concurrent processing');
    
    // Filter to only include feeds that actually need refreshing AND are not locked
    const staleFeeds = normalizedPostTitles
      .map((title, index) => ({
        postTitle: title,
        feedUrl: normalizedFeedUrls[index],
        mediaType: normalizedMediaTypes[index] || undefined
      }))
      .filter(feed => feedsNotLocked.includes(feed.postTitle));
    
    console.log(`🔄 QUEUE PRODUCER: ${staleFeeds.length} of ${normalizedPostTitles.length} feeds need refreshing`);
    
    // Create feed objects for the queue message (only stale feeds)
    const feeds = staleFeeds;

    // Create queue message
    const queueMessage: QueueFeedRefreshMessage = {
      batchId,
      timestamp,
      userId,
      feeds,
      existingGuids,
      newestEntryDate,
      priority,
      retryCount: 0,
      maxRetries: 3
    };

    // Always log in production for debugging
    console.log('📤 QUEUE PRODUCER: Sending message', {
      batchId,
      feedsCount: feeds.length,
      messageStructure: {
        hasFeeds: !!queueMessage.feeds,
        feedsLength: queueMessage.feeds?.length,
        feedsType: typeof queueMessage.feeds,
        sampleFeed: queueMessage.feeds?.[0]
      }
    });

    // Try queue binding first, fallback to HTTP API
    const queue = (globalThis as any).QUEUE || (process.env as any).QUEUE;
    
    try {
      if (queue) {
        // Use queue binding if available
        await queue.send(queueMessage, {
          delaySeconds: priority === 'high' ? 0 : 2,
        });
        console.log('✅ QUEUE PRODUCER: Message sent via binding', { batchId, feedCount: feeds.length });
      } else {
        // Fallback: Use Cloudflare REST API to send to queue
        console.log('⚠️ QUEUE PRODUCER: No binding, using REST API fallback');
        
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const apiToken = process.env.CLOUDFLARE_API_TOKEN;
        
        if (!accountId || !apiToken) {
          console.log('❌ QUEUE PRODUCER: Missing Cloudflare credentials for REST API');
          // For now, process directly to avoid blocking users
          return await processDirectly(queueMessage);
        }

        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/ac0fb53bb4eb4fdb9d8e2fa36f8e7504/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            body: queueMessage,
            delaySeconds: priority === 'high' ? 0 : 2,
          }]),
        });

        if (!response.ok) {
          throw new Error(`Queue REST API error: ${response.status}`);
        }

        console.log('✅ QUEUE PRODUCER: Message sent via REST API', { batchId, feedCount: feeds.length });
      }

      // Note: Batch status now tracked entirely by Durable Objects via enhanced worker
      console.log(`🚀 Queue: Batch ${batchId} queued - status tracked by Durable Objects`);

      // Return immediate response with batch tracking info
      return NextResponse.json({
        success: true,
        batchId,
        status: 'queued',
        queuedAt: timestamp,
        estimatedProcessingTime: feeds.length * 500, // Rough estimate in ms
        message: `Queued ${feeds.length} feeds for refresh`
      });

    } catch (queueError) {
      errorLog('❌ QUEUE PRODUCER: Failed to send message to queue', queueError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to queue refresh request' 
      }, { status: 500 });
    }

  } catch (error) {
    errorLog('❌ QUEUE PRODUCER: Error processing request', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint - Deprecated: Use SSE via /api/batch-stream/[batchId] for real-time updates
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const batchId = url.searchParams.get('batchId');

  return NextResponse.json({ 
    message: 'Batch status polling deprecated. Use real-time SSE instead.',
    batchId,
    sseEndpoint: batchId ? `/api/batch-stream/${batchId}` : '/api/batch-stream/[batchId]',
    note: 'Connect to SSE endpoint for real-time updates via Durable Objects'
  }, { status: 200 });
}

// Helper function to check which feeds need refreshing (>4 hours old)
async function checkFeedsNeedingRefresh(postTitles: string[]): Promise<string[]> {
  if (!postTitles || postTitles.length === 0) return [];
  
  try {
    // Import the database function
    const { executeRead } = await import('@/lib/database');
    
    // Create placeholders for the IN clause
    const placeholders = postTitles.map(() => '?').join(',');
    const query = `
      SELECT title, last_fetched 
      FROM rss_feeds 
      WHERE title IN (${placeholders})
    `;
    
    const result = await executeRead(query, postTitles);
    const rows = result.rows as Array<{
      title: string;
      last_fetched: string | null;
    }>;
    
    const now = Date.now();
    const fourHoursAgo = now - (4 * 60 * 60 * 1000); // 4 hours in milliseconds
    
    const staleFeeds: string[] = [];
    
    // Check each requested post title
    for (const postTitle of postTitles) {
      const feedRow = rows.find(row => row.title === postTitle);
      
      if (!feedRow) {
        // Feed doesn't exist in database, needs refreshing
        staleFeeds.push(postTitle);
        console.log(`📊 STALENESS: Feed "${postTitle}" not found - needs initial fetch`);
        continue;
      }
      
      if (!feedRow.last_fetched) {
        // Feed exists but never fetched, needs refreshing
        staleFeeds.push(postTitle);
        console.log(`📊 STALENESS: Feed "${postTitle}" never fetched - needs refresh`);
        continue;
      }
      
      const lastFetchedTime = new Date(feedRow.last_fetched).getTime();
      const ageMinutes = Math.round((now - lastFetchedTime) / (1000 * 60));
      
      if (lastFetchedTime < fourHoursAgo) {
        staleFeeds.push(postTitle);
        console.log(`📊 STALENESS: Feed "${postTitle}" is stale (${ageMinutes} minutes old)`);
      } else {
        console.log(`📊 STALENESS: Feed "${postTitle}" is fresh (${ageMinutes} minutes old)`);
      }
    }
    
    console.log(`📊 STALENESS CHECK: ${staleFeeds.length} of ${postTitles.length} feeds need refreshing`);
    return staleFeeds;
    
  } catch (error) {
    console.error('❌ Error checking feed staleness:', error);
    // Return all feeds as stale on error to be safe
    return postTitles;
  }
}



// Helper function to filter out feeds that are currently locked
async function filterOutLockedFeeds(feedTitles: string[]): Promise<string[]> {
  if (!feedTitles || feedTitles.length === 0) return [];
  
  try {
    // Import the database function
    const { executeRead } = await import('@/lib/database');
    
    // Get feed URLs for these titles first
    const titlePlaceholders = feedTitles.map(() => '?').join(',');
    const feedQuery = `
      SELECT title, feed_url 
      FROM rss_feeds 
      WHERE title IN (${titlePlaceholders})
    `;
    
    const feedResult = await executeRead(feedQuery, feedTitles);
    const feedRows = feedResult.rows as Array<{ title: string; feed_url: string; }>;
    
    if (feedRows.length === 0) {
      console.log('🔍 LOCK CHECK: No feeds found in database');
      return feedTitles; // If feeds don't exist, they're not locked
    }
    
    // Check for active locks
    const feedUrls = feedRows.map(row => row.feed_url);
    const lockKeys = feedUrls.map(url => `feed:${url}`);
    const lockPlaceholders = lockKeys.map(() => '?').join(',');
    
    const lockQuery = `
      SELECT lock_key, expires_at 
      FROM rss_locks 
      WHERE lock_key IN (${lockPlaceholders}) AND expires_at > ?
    `;
    
    const now = Date.now();
    const lockParams = [...lockKeys, now];
    
    const lockResult = await executeRead(lockQuery, lockParams);
    const activeLocks = lockResult.rows as Array<{ lock_key: string; expires_at: number; }>;
    
    console.log(`🔍 LOCK CHECK: Found ${activeLocks.length} active locks out of ${feedRows.length} feeds`);
    
    if (activeLocks.length === 0) {
      return feedTitles; // No active locks
    }
    
    // Filter out locked feeds
    const lockedFeedUrls = activeLocks.map(lock => lock.lock_key.replace('feed:', ''));
    const unlockedFeeds = feedRows
      .filter(row => !lockedFeedUrls.includes(row.feed_url))
      .map(row => row.title);
    
    const lockedCount = feedTitles.length - unlockedFeeds.length;
    if (lockedCount > 0) {
      console.log(`🔒 LOCK CHECK: ${lockedCount} feeds are currently locked, ${unlockedFeeds.length} available`);
    }
    
    return unlockedFeeds;
    
  } catch (error) {
    console.error('❌ LOCK CHECK: Error checking locks:', error);
    // On error, assume no locks to avoid blocking legitimate requests
    return feedTitles;
  }
}

// Helper function to create temporary API locks (longer duration to handle queue delays)
async function createTemporaryAPILocks(feedTitles: string[]): Promise<void> {
  if (!feedTitles || feedTitles.length === 0) return;
  
  try {
    // Import the database function
    const { executeRead, executeWrite } = await import('@/lib/database');
    
    // Get feed URLs for these titles
    const titlePlaceholders = feedTitles.map(() => '?').join(',');
    const feedQuery = `
      SELECT title, feed_url 
      FROM rss_feeds 
      WHERE title IN (${titlePlaceholders})
    `;
    
    const feedResult = await executeRead(feedQuery, feedTitles);
    const feedRows = feedResult.rows as Array<{ title: string; feed_url: string; }>;
    
    if (feedRows.length === 0) {
      console.log('🔒 API LOCK: No feeds found to lock');
      return;
    }
    
    // Create locks with extended duration (15 minutes to handle queue delays + processing)
    const now = Date.now();
    const lockDuration = 15 * 60 * 1000; // 15 minutes
    const expirationTime = now + lockDuration;
    
    for (const feed of feedRows) {
      const lockKey = `feed:${feed.feed_url}`;
      
      try {
        const lockQuery = `
          INSERT INTO rss_locks (lock_key, expires_at, created_at) 
          VALUES (?, ?, NOW())
          ON DUPLICATE KEY UPDATE 
          expires_at = ?, created_at = NOW()
        `;
        
        await executeWrite(lockQuery, [lockKey, expirationTime, expirationTime]);
        console.log(`🔒 API LOCK: Created temporary lock for "${feed.title}" (15min duration)`);
        
      } catch (lockError) {
        console.error(`❌ API LOCK: Failed to create lock for ${feed.title}:`, lockError);
      }
    }
    
    console.log(`✅ API LOCK: Created ${feedRows.length} temporary locks`);
    
  } catch (error) {
    console.error('❌ API LOCK: Error creating temporary locks:', error);
    // Don't throw - continue with queueing even if locks fail
  }
}