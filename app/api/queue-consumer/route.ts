// LIGHTWEIGHT Pages Function for queue processing
// RSS processing now handled by Worker for better performance and scalability
// This API primarily handles database queries and batch status updates

import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';
import { checkAndRefreshFeeds } from '@/lib/rss.server';
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { 
  QueueFeedRefreshMessage, 
  QueueFeedRefreshResult, 
  RSSEntriesDisplayEntry,
  QueueBatchStatus 
} from '@/lib/types';
import { getRequestContext } from '@cloudflare/next-on-pages';

// Define route context type for Cloudflare Pages Functions
interface RouteContext {
  params: Promise<{}>;
  env: {
    BATCH_STATUS?: any;
    BATCH_STATUS_DO?: any;
    [key: string]: any;
  };
}

// KV storage helper functions for batch status
async function setBatchStatus(batchId: string, status: QueueBatchStatus, contextEnv?: any): Promise<void> {
  try {
    console.log(`🔄 KV: Attempting to store batch status for ${batchId}:`, status.status);
    
    // Use getRequestContext to access KV binding
    const { env } = getRequestContext();
    const kvBinding = env.BATCH_STATUS;
    console.log(`🔍 KV: Using getRequestContext for BATCH_STATUS...`);
    
    console.log(`🔍 KV: Runtime environment:`, process.env.NODE_ENV || 'unknown');
    console.log(`🔍 KV: Cloudflare env:`, (globalThis as any).Cloudflare ? 'available' : 'not available');
    console.log(`🔍 KV: KV binding found:`, !!kvBinding);
    console.log(`🔍 KV: KV binding type:`, typeof kvBinding);
    console.log(`🔍 KV: KV binding methods:`, kvBinding ? Object.getOwnPropertyNames(kvBinding) : 'none');
    console.log(`🔍 KV: Dashboard binding test - expecting this to work now!`);
    
    if (!kvBinding) {
      console.error(`❌ KV: BATCH_STATUS binding not found in globalThis OR context.env!`);
      console.error(`❌ KV: Available global keys:`, Object.keys(globalThis).filter(key => 
        key.includes('KV') || key.includes('BATCH') || key.includes('STATUS') || key.toUpperCase() === key
      ));
      
      if (contextEnv) {
        console.error(`❌ KV: Available context.env keys:`, Object.keys(contextEnv));
      }
      
      // Try alternative binding access methods
      const envBindings = process.env;
      console.log(`🔍 KV: Environment variables with BATCH/KV:`, Object.keys(envBindings).filter(key => 
        key.includes('BATCH') || key.includes('KV')
      ));
      
      return;
    }
    
    // Store in KV for persistence
    const kvResult = await kvBinding.put(
      `batch:${batchId}`,
      JSON.stringify(status),
      { ttl: 300 } // 5 minute TTL for auto-cleanup
    );
    
    console.log(`📦 KV: Successfully stored batch status for ${batchId}:`, status.status);
    console.log(`📦 KV: Storage result:`, kvResult);

    // REAL-TIME UPDATE: Notify Durable Object for instant SSE/WebSocket broadcasting
    const durableObjectNamespace = env.BATCH_STATUS_DO;
    if (durableObjectNamespace) {
      try {
        const durableObjectId = durableObjectNamespace.idFromName(batchId);
        const durableObject = durableObjectNamespace.get(durableObjectId);
        
        // Send the status update to the Durable Object (NO POLLING!)
        await durableObject.fetch(new Request('https://batch-status/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(status)
        }));
        
        console.log(`🚀 DO: Notified Durable Object for batch ${batchId} - INSTANT real-time updates!`);
      } catch (doError) {
        console.warn(`⚠️ DO: Failed to notify Durable Object for ${batchId}:`, doError);
        // Continue execution - KV storage succeeded
      }
    }
  } catch (error) {
    console.error(`❌ KV: Consumer failed to store batch ${batchId}:`, error);
  }
}

// Add Edge Runtime configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Helper function to log in production for queue debugging
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

// Component-specific database row type
interface RSSEntryRow {
  guid: string;
  title: string;
  link: string;
  pub_date: string;
  description: string;
  content: string;
  image: string | null;
  media_type: string | null;
  feed_title: string;
  feed_url: string;
}

// Main queue consumer function
export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  
  try {
    // This endpoint is called by Cloudflare Queues
    // Cloudflare sends queue messages in a specific format
    const requestBody = await request.json();
    
    devLog('🔄 QUEUE CONSUMER: Received request body', requestBody);
    
    // Debug: Check if bindings are available via context
    if (context.env) {
      console.log('🔍 KV: Context env available, checking for BATCH_STATUS...');
      console.log('🔍 KV: Context env keys:', Object.keys(context.env));
    }
    
    // Handle Cloudflare Queue message format
    let messages: QueueFeedRefreshMessage[] = [];
    
    if (requestBody.messages && Array.isArray(requestBody.messages)) {
      // Cloudflare queue format: { messages: [...] }
      messages = requestBody.messages.map((msg: any) => msg.body);
    } else if (requestBody.batchId) {
      // Direct format (for testing)
      messages = [requestBody];
    } else {
      throw new Error('Invalid message format');
    }
    
    devLog(`🔄 QUEUE CONSUMER: Processing ${messages.length} messages`);
    
    // Process each message
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    for (const queueMessage of messages) {
      try {
        // Always log in production for debugging
        console.log('🔍 QUEUE CONSUMER: Message content', queueMessage);
        
        if (!queueMessage || typeof queueMessage !== 'object') {
          throw new Error('Invalid message: not an object');
        }
        
        if (!queueMessage.feeds || !Array.isArray(queueMessage.feeds)) {
          console.log('❌ QUEUE CONSUMER: Missing or invalid feeds', {
            hasFeeds: !!queueMessage.feeds,
            feedsType: typeof queueMessage.feeds,
            messageKeys: Object.keys(queueMessage),
            message: queueMessage
          });
          throw new Error('Invalid message: feeds array missing');
        }
        
        devLog('🔄 QUEUE CONSUMER: Processing batch', {
          batchId: queueMessage.batchId,
          feedCount: queueMessage.feeds.length,
          priority: queueMessage.priority,
          retryCount: queueMessage.retryCount
        });

                const { batchId, feeds, existingGuids = [], newestEntryDate, userId } = queueMessage;

        // Extract arrays for processing
        const postTitles = feeds.map(feed => feed.postTitle);
        const feedUrls = feeds.map(feed => feed.feedUrl);
        const mediaTypes = feeds.map(feed => feed.mediaType).filter(Boolean) as string[];

        // Check which feeds need refreshing (older than 4 hours)
        const staleFeedTitles = await checkFeedsNeedingRefresh(postTitles);
        
        let refreshedAny = false;
        
        if (staleFeedTitles.length === 0) {
          console.log('✅ QUEUE CONSUMER: All feeds are up to date, no refresh needed', { batchId });
          
          // Early exit optimization - skip heavy processing if no feeds need refresh
          const processingTime = Date.now() - startTime;
          const quickResult: QueueFeedRefreshResult = {
            batchId,
            success: true,
            refreshedAny: false,
            entries: [],
            newEntriesCount: 0,
            totalEntries: 0,
            postTitles,
            refreshTimestamp: new Date().toISOString(),
            processingTimeMs: processingTime
          };
          
          // Update batch status immediately for fast response
          await setBatchStatus(batchId, {
            batchId,
            status: 'completed',
            queuedAt: Date.now() - processingTime,
            processedAt: Date.now() - processingTime,
            completedAt: Date.now(),
            result: quickResult
          }, context.env);
          
                  console.log('📊 QUEUE CONSUMER: Fast-track completion (no refresh needed)', {
          batchId,
          processingTimeMs: processingTime,
          feedCount: feeds.length
        });
          
          totalSuccessful++;
          continue; // Skip to next message
        } else {
          devLog(`🔄 QUEUE CONSUMER: Found ${staleFeedTitles.length} stale feeds that need refreshing`, { 
            batchId, 
            staleFeedTitles 
          });
          
          // Check if any feeds are new (don't exist yet)
          const allExistingFeeds = await getAllExistingFeeds(postTitles);
          const newFeeds = postTitles.filter((title: string) => !allExistingFeeds.includes(title));
          
          if (newFeeds.length > 0) {
            devLog(`🆕 QUEUE CONSUMER: Found ${newFeeds.length} new feeds to create`, { 
              batchId, 
              newFeeds 
            });
            refreshedAny = true;
          }
          
                  // RSS processing now handled by Worker - just check if result was passed from Worker
        const isWorkerResult = request.headers.get('X-Worker-Result') === 'true';
        
        if (isWorkerResult) {
          // This is a result notification from Worker - RSS processing already done
          devLog(`✅ QUEUE CONSUMER: Received Worker processing result`, { batchId });
          refreshedAny = true;
        } else {
          // Legacy fallback - shouldn't happen with new Worker architecture
          devLog(`⚠️ QUEUE CONSUMER: No Worker result header - RSS processing may not have occurred`, { batchId });
        }
        }
        
        // Get new entries that were inserted during this refresh cycle
        let newEntries: { entries: RSSEntriesDisplayEntry[], totalEntries: number } = { 
          entries: [], 
          totalEntries: 0 
        };
        
        if (refreshedAny) {
          newEntries = await getNewEntriesFromRefresh(postTitles, existingGuids, newestEntryDate, userId);
          
          if (newEntries.entries.length > 0) {
            devLog(`✅ QUEUE CONSUMER: Found ${newEntries.entries.length} new entries from refresh`, { batchId });
          } else {
            devLog('✅ QUEUE CONSUMER: No new entries found after refresh', { batchId });
          }
        }
        
        const processingTime = Date.now() - startTime;
        
        // Create result
        const result: QueueFeedRefreshResult = {
          batchId,
          success: true,
          refreshedAny,
          entries: newEntries.entries,
          newEntriesCount: newEntries.entries.length,
          totalEntries: newEntries.totalEntries,
          postTitles,
          refreshTimestamp: new Date().toISOString(),
          processingTimeMs: processingTime
        };
        
        devLog('✅ QUEUE CONSUMER: Batch processing completed', {
          batchId,
          processingTimeMs: processingTime,
          refreshedAny: result.refreshedAny,
          newEntriesCount: result.newEntriesCount,
          // Performance metrics
          averageTimePerFeed: Math.round(processingTime / feeds.length),
          throughput: Math.round((feeds.length / processingTime) * 1000), // feeds per second
          efficiency: result.newEntriesCount > 0 ? 'high' : 'low' // new content found vs no new content
        });
        
        // Update batch status in KV for SSE streaming
        if (batchId) {
          await setBatchStatus(batchId, {
            batchId,
            status: 'completed',
            queuedAt: Date.now() - processingTime, // Approximate queue time
            processedAt: Date.now() - processingTime,
            completedAt: Date.now(),
            result: result
          }, context.env);
          
          console.log('📊 QUEUE CONSUMER: Updated batch status in KV', {
            batchId,
            status: 'completed',
            entriesCount: result.newEntriesCount
          });
        }
        
        totalSuccessful++;
        
      } catch (messageError) {
        errorLog('❌ QUEUE: Error processing message', messageError);
        
        // Update batch status for failed processing
        const batchId = queueMessage?.batchId;
        if (batchId) {
          await setBatchStatus(batchId, {
            batchId,
            status: 'failed',
            queuedAt: Date.now(),
            processedAt: Date.now(),
            completedAt: Date.now(),
            error: messageError instanceof Error ? messageError.message : 'Processing failed'
          }, context.env);
          
          console.log('📊 QUEUE CONSUMER: Updated batch status (failed)', {
            batchId,
            status: 'failed',
            error: messageError instanceof Error ? messageError.message : 'Unknown error'
          });
        }
        
        totalFailed++;
      }
    }
    
    devLog(`✅ QUEUE Consumer: Processed ${totalSuccessful} successful, ${totalFailed} failed`);
    
    return NextResponse.json({ 
      success: true, 
      processed: totalSuccessful,
      failed: totalFailed 
    });
    
  } catch (error) {
    errorLog('❌ QUEUE CONSUMER: Error parsing queue message', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid queue message format' 
    }, { status: 400 });
  }
}

// Helper function to check which feeds need refreshing
async function checkFeedsNeedingRefresh(postTitles: string[]): Promise<string[]> {
  try {
    if (!postTitles || postTitles.length === 0) {
      return [];
    }
    
    const placeholders = postTitles.map(() => '?').join(',');
    const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
    
    const query = `
      SELECT title
      FROM rss_feeds
      WHERE title IN (${placeholders}) AND last_fetched < ?
    `;
    
    const result = await executeRead(query, [...postTitles, fourHoursAgo]);
    const staleFeedTitles = (result.rows as { title: string }[]).map(row => row.title);
    
    return staleFeedTitles;
  } catch (error) {
    errorLog('Error checking feeds needing refresh:', error);
    return [];
  }
}

// Helper function to get all existing feeds
async function getAllExistingFeeds(postTitles: string[]): Promise<string[]> {
  try {
    if (!postTitles || postTitles.length === 0) {
      return [];
    }

    const placeholders = postTitles.map(() => '?').join(',');
    const query = `SELECT title FROM rss_feeds WHERE title IN (${placeholders})`;
    
    const result = await executeRead(query, postTitles);
    return (result.rows as { title: string }[]).map(row => row.title);
  } catch (error) {
    errorLog('Error getting existing feeds:', error);
    return [];
  }
}

// Helper function to get new entries from refresh
async function getNewEntriesFromRefresh(
  postTitles: string[], 
  existingGuids: string[],
  newestEntryDate?: string,
  userId?: string
): Promise<{ entries: RSSEntriesDisplayEntry[], totalEntries: number }> {
  try {
    if (!postTitles || postTitles.length === 0) {
      return { entries: [], totalEntries: 0 };
    }

    const placeholders = postTitles.map(() => '?').join(',');
    let whereClause = `f.title IN (${placeholders})`;
    const queryParams = [...postTitles];

    // CRITICAL FIX: Get entries created in the last 5 minutes (during this refresh cycle)
    // This is much more accurate than filtering by publication date
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    whereClause += ` AND e.created_at >= ?`;
    queryParams.push(fiveMinutesAgo);

    // Exclude existing GUIDs if provided
    if (existingGuids && existingGuids.length > 0) {
      const guidPlaceholders = existingGuids.map(() => '?').join(',');
      whereClause += ` AND e.guid NOT IN (${guidPlaceholders})`;
      queryParams.push(...existingGuids);
    }

    console.log(`🔍 QUEUE: Looking for entries created after ${fiveMinutesAgo} for feeds:`, postTitles);

    const entriesQuery = `
      SELECT e.*, f.title as feed_title, f.feed_url
      FROM rss_entries e
      JOIN rss_feeds f ON e.feed_id = f.id
      WHERE ${whereClause}
      ORDER BY e.pub_date DESC
      LIMIT 100
    `;

    const entriesResult = await executeRead(entriesQuery, queryParams);
    const entries = entriesResult.rows as RSSEntryRow[];
    
    console.log(`🔍 QUEUE: Found ${entries.length} recently created entries`);

    // Apply publication date filter as secondary filter if needed
    let filteredEntries = entries;
    if (newestEntryDate && entries.length > 0) {
      try {
        const clientNewestDate = new Date(newestEntryDate);
        if (!isNaN(clientNewestDate.getTime())) {
          const clientNewestTimestamp = clientNewestDate.getTime();
          console.log(`🔍 QUEUE: Applying pub_date filter for entries newer than ${newestEntryDate}`);
          
          filteredEntries = entries.filter(entry => {
            const entryDate = new Date(entry.pub_date);
            return !isNaN(entryDate.getTime()) && entryDate.getTime() > clientNewestTimestamp;
          });
          
          console.log(`🔍 QUEUE: After pub_date filter: ${filteredEntries.length} entries`);
        }
      } catch (error) {
        console.warn(`⚠️ QUEUE: Invalid newestEntryDate ${newestEntryDate}, skipping filter`);
      }
    }

    if (filteredEntries.length === 0) {
      return { entries: [], totalEntries: 0 };
    }

    // Map entries to expected format
    const mappedEntries = filteredEntries.map(entry => ({
      guid: entry.guid,
      title: entry.title,
      link: entry.link,
      pubDate: entry.pub_date,
      description: entry.description,
      content: entry.content,
      image: entry.image || undefined,
      mediaType: entry.media_type || undefined,
      feedTitle: entry.feed_title,
      feedUrl: entry.feed_url
    }));

    // Get entry metrics if we have user context
    let entriesWithData: RSSEntriesDisplayEntry[] = [];
    
    // Create entries with default metrics (since we don't have user context in queue)
    entriesWithData = mappedEntries.map(entry => ({
      entry,
      initialData: {
        likes: { isLiked: false, count: 0 },
        comments: { count: 0 },
        retweets: { isRetweeted: false, count: 0 }
      },
      postMetadata: {
        title: entry.feedTitle || '',
        featuredImg: entry.image || '',
        mediaType: entry.mediaType || undefined,
        postSlug: '',
        categorySlug: '',
        verified: false
      }
    }));

    return { 
      entries: entriesWithData, 
      totalEntries: filteredEntries.length 
    };
    
  } catch (error) {
    errorLog('Error getting new entries from refresh:', error);
    return { entries: [], totalEntries: 0 };
  }
} 