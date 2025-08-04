import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';
// Removed import of checkAndRefreshFeeds - workers handle RSS processing directly
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
}

// KV storage helper functions for batch status
async function setBatchStatus(batchId: string, status: QueueBatchStatus, contextEnv?: any): Promise<void> {
  try {
    console.log(`🔄 KV: Attempting to store batch status for ${batchId}:`, status.status);
    
    // Note: BATCH_STATUS KV operations removed - Durable Objects handle all status
    const { env } = getRequestContext();
    console.log(`ℹ️ Legacy: setBatchStatus called for ${batchId} (${status.status}) - enhanced worker handles this via Durable Objects`);

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
    
    // Note: Legacy context.env debugging removed - using getRequestContext() for bindings
    
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

        // ✅ WORKER HANDLES RSS PROCESSING: No server-side refresh needed
        // The Cloudflare Worker has already processed all RSS feeds with database locking
        // This Pages API only receives the results and handles client communication
        
        console.log('✅ QUEUE CONSUMER: Worker has processed RSS feeds, handling results only', { batchId });
        
        // Assume worker processed feeds (worker logs will show actual processing)
        let refreshedAny = true;
        
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
        
        // Note: Batch status now handled by enhanced worker via Durable Objects
        if (batchId) {
          await setBatchStatus(batchId, {
            batchId,
            status: 'completed',
            queuedAt: Date.now() - processingTime, // Approximate queue time
            processedAt: Date.now() - processingTime,
            completedAt: Date.now(),
            result: result
          });
          
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
          });
          
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

// Helper functions removed - Workers handle RSS processing with database locking
// Pages API only handles result communication and client updates

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