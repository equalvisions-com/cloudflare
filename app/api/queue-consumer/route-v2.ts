import { NextRequest, NextResponse } from 'next/server';
import { executeRead } from '@/lib/database';
import { acquireFeedLock, releaseFeedLock, getFeedLockStatus } from '@/lib/feed-locks';
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
}

// Batch status helper using Durable Objects only
async function setBatchStatus(batchId: string, status: QueueBatchStatus, contextEnv?: any): Promise<void> {
  try {
    console.log(`🔄 DO: Setting batch status for ${batchId}:`, status.status);
    
    const { env } = getRequestContext();
    
    // Use Durable Objects for real-time status updates
    const durableObjectNamespace = env.BATCH_STATUS_DO;
    if (durableObjectNamespace) {
      try {
        const durableObjectId = durableObjectNamespace.idFromName(batchId);
        const durableObject = durableObjectNamespace.get(durableObjectId);
        
        await durableObject.fetch(new Request('https://batch-status/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(status)
        }));
        
        console.log(`✅ DO: Successfully updated batch status for ${batchId}`);
      } catch (doError) {
        console.error(`❌ DO: Failed to update batch status for ${batchId}:`, doError);
        throw doError;
      }
    } else {
      console.warn('⚠️ DO: BATCH_STATUS_DO binding not available');
    }
  } catch (error) {
    console.error(`❌ DO: Error setting batch status for ${batchId}:`, error);
    throw error;
  }
}

// Add Edge Runtime configuration
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

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

// Main queue consumer function with database locking
export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now();
  
  try {
    const requestBody = await request.json();
    console.log('🔄 QUEUE V2: Received request with database locking', requestBody);
    
    // Handle Cloudflare Queue message format
    let messages: QueueFeedRefreshMessage[] = [];
    
    if (requestBody.messages && Array.isArray(requestBody.messages)) {
      messages = requestBody.messages.map((msg: any) => msg.body);
    } else if (requestBody.batchId) {
      messages = [requestBody];
    } else {
      throw new Error('Invalid message format');
    }
    
    console.log(`🔄 QUEUE V2: Processing ${messages.length} messages with database locking`);
    
    let totalSuccessful = 0;
    let totalFailed = 0;
    
    for (const queueMessage of messages) {
      try {
        console.log('🔍 QUEUE V2: Processing message', queueMessage);
        
        if (!queueMessage || typeof queueMessage !== 'object') {
          throw new Error('Invalid message: not an object');
        }
        
        if (!queueMessage.feeds || !Array.isArray(queueMessage.feeds)) {
          console.log('❌ QUEUE V2: Missing or invalid feeds', {
            hasFeeds: !!queueMessage.feeds,
            feedsType: typeof queueMessage.feeds,
            messageKeys: Object.keys(queueMessage)
          });
          throw new Error('Invalid message: feeds array missing');
        }
        
        const { batchId, feeds, existingGuids = [], newestEntryDate, userId } = queueMessage;
        
        console.log('🔄 QUEUE V2: Processing batch with database locking', {
          batchId,
          feedCount: feeds.length,
          priority: queueMessage.priority,
          retryCount: queueMessage.retryCount
        });

        // Extract feed URLs for database locking
        const feedUrls = feeds.map(feed => feed.feedUrl);
        const postTitles = feeds.map(feed => feed.postTitle);
        const mediaTypes = feeds.map(feed => feed.mediaType).filter(Boolean) as string[];

        // Check feed lock status to determine which feeds can be processed
        const feedLockStatus = await getFeedLockStatus(feedUrls);
        
        // Filter feeds that can be processed (not locked and stale)
        const feedsToProcess = feeds.filter(feed => {
          const status = feedLockStatus[feed.feedUrl];
          const canProcess = !status.isLocked && status.isStale;
          
          if (!canProcess) {
            if (status.isLocked) {
              console.log(`🔒 QUEUE V2: Feed ${feed.postTitle} is locked, skipping`);
            } else if (!status.isStale) {
              console.log(`✅ QUEUE V2: Feed ${feed.postTitle} is fresh, skipping`);
            }
          }
          
          return canProcess;
        });
        
        console.log(`📊 QUEUE V2: ${feedsToProcess.length}/${feeds.length} feeds can be processed`);
        
        let refreshedAny = false;
        let newEntries: { entries: RSSEntriesDisplayEntry[], totalEntries: number } = { 
          entries: [], 
          totalEntries: 0 
        };
        
        if (feedsToProcess.length === 0) {
          console.log('✅ QUEUE V2: No feeds need processing - all locked or fresh');
        } else {
          // Acquire locks for feeds that need processing
          const lockResults = await Promise.all(
            feedsToProcess.map(async (feed) => {
              const lockResult = await acquireFeedLock(feed.feedUrl);
              return {
                feed,
                lockResult
              };
            })
          );
          
          // Filter to only feeds where we successfully acquired locks
          const lockedFeeds = lockResults.filter(result => 
            result.lockResult.success && result.lockResult.acquired
          );
          
          console.log(`🔒 QUEUE V2: Successfully acquired ${lockedFeeds.length} locks`);
          
          if (lockedFeeds.length > 0) {
            try {
              // Process the locked feeds
              const lockedFeedTitles = lockedFeeds.map(lf => lf.feed.postTitle);
              const lockedFeedUrls = lockedFeeds.map(lf => lf.feed.feedUrl);
              const lockedMediaTypes = lockedFeeds.map(lf => lf.feed.mediaType).filter(Boolean) as string[];
              
              console.log(`🔄 QUEUE V2: Processing ${lockedFeeds.length} locked feeds`);
              
              // Refresh the feeds
              await checkAndRefreshFeeds(lockedFeedTitles, lockedFeedUrls, lockedMediaTypes);
              refreshedAny = true;
              
              // Get new entries from the refresh
              newEntries = await getNewEntriesFromRefresh(
                lockedFeedTitles, 
                existingGuids, 
                newestEntryDate, 
                userId
              );
              
              console.log(`✅ QUEUE V2: Found ${newEntries.entries.length} new entries`);
              
              // Release locks with success=true
              await Promise.all(
                lockedFeeds.map(lf => releaseFeedLock(lf.feed.feedUrl, true))
              );
              
              console.log(`🔓 QUEUE V2: Released ${lockedFeeds.length} locks (success)`);
              
            } catch (processingError) {
              console.error('❌ QUEUE V2: Error during feed processing:', processingError);
              
              // Release locks with success=false (allows retry before 4 hours)
              await Promise.all(
                lockedFeeds.map(lf => releaseFeedLock(lf.feed.feedUrl, false))
              );
              
              console.log(`🔓 QUEUE V2: Released ${lockedFeeds.length} locks (failed)`);
              throw processingError;
            }
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
        
        console.log('✅ QUEUE V2: Batch processing completed with database locking', {
          batchId,
          processingTimeMs: processingTime,
          refreshedAny: result.refreshedAny,
          newEntriesCount: result.newEntriesCount,
          locksAcquired: feedsToProcess.length,
          averageTimePerFeed: feedsToProcess.length > 0 ? Math.round(processingTime / feedsToProcess.length) : 0
        });
        
        // Update batch status
        if (batchId) {
          await setBatchStatus(batchId, {
            batchId,
            status: 'completed',
            queuedAt: Date.now() - processingTime,
            processedAt: Date.now() - processingTime,
            completedAt: Date.now(),
            result: result
          });
          
          console.log('📊 QUEUE V2: Updated batch status', {
            batchId,
            status: 'completed',
            entriesCount: result.newEntriesCount
          });
        }
        
        totalSuccessful++;
        
      } catch (messageError) {
        console.error('❌ QUEUE V2: Error processing message:', messageError);
        
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
          
          console.log('📊 QUEUE V2: Updated batch status (failed)', {
            batchId,
            status: 'failed',
            error: messageError instanceof Error ? messageError.message : 'Unknown error'
          });
        }
        
        totalFailed++;
      }
    }
    
    console.log(`✅ QUEUE V2: Processed ${totalSuccessful} successful, ${totalFailed} failed`);
    
    return NextResponse.json({ 
      success: true, 
      processed: totalSuccessful,
      failed: totalFailed,
      version: 'v2-database-locking'
    });
    
  } catch (error) {
    console.error('❌ QUEUE V2: Error parsing queue message:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Invalid queue message format',
      version: 'v2-database-locking'
    }, { status: 400 });
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

    // Get entries created in the last 5 minutes (during this refresh cycle)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    whereClause += ` AND e.created_at >= ?`;
    queryParams.push(fiveMinutesAgo);

    // Exclude existing GUIDs if provided
    if (existingGuids && existingGuids.length > 0) {
      const guidPlaceholders = existingGuids.map(() => '?').join(',');
      whereClause += ` AND e.guid NOT IN (${guidPlaceholders})`;
      queryParams.push(...existingGuids);
    }

    console.log(`🔍 QUEUE V2: Looking for entries created after ${fiveMinutesAgo} for feeds:`, postTitles);

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
    
    console.log(`🔍 QUEUE V2: Found ${entries.length} recently created entries`);

    // Apply publication date filter as secondary filter
    let filteredEntries = entries;
    if (newestEntryDate && entries.length > 0) {
      try {
        const clientNewestDate = new Date(newestEntryDate);
        if (!isNaN(clientNewestDate.getTime())) {
          const clientNewestTimestamp = clientNewestDate.getTime();
          console.log(`🔍 QUEUE V2: Applying pub_date filter for entries newer than ${newestEntryDate}`);
          
          filteredEntries = entries.filter(entry => {
            const entryDate = new Date(entry.pub_date);
            return !isNaN(entryDate.getTime()) && entryDate.getTime() > clientNewestTimestamp;
          });
          
          console.log(`🔍 QUEUE V2: After pub_date filter: ${filteredEntries.length} entries`);
        }
      } catch (error) {
        console.warn(`⚠️ QUEUE V2: Invalid newestEntryDate ${newestEntryDate}, skipping filter`);
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

    // Create entries with default metrics
    const entriesWithData: RSSEntriesDisplayEntry[] = mappedEntries.map(entry => ({
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
    console.error('❌ QUEUE V2: Error getting new entries from refresh:', error);
    return { entries: [], totalEntries: 0 };
  }
}