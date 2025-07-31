// Enhanced RSS Processing Queue Consumer Worker
// Processes RSS feeds directly in Worker for maximum performance
// Follows Cloudflare best practices for scalable RSS processing

import { XMLParser } from 'fast-xml-parser';

// Initialize XML parser with optimized settings
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  ignoreNameSpace: false,
  removeNSPrefix: false,
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
  cdataPropName: "__cdata",
  processEntities: true,
});

// Parallel processing configuration following Cloudflare limits
const PARALLEL_BATCH_SIZE = 15; // Optimal for 128MB memory + 6 concurrent connections
const FETCH_TIMEOUT = 10000; // 10 second timeout per feed
const MAX_RETRIES = 3;

export default {
  async queue(batch, env) {
    console.log(`🔄 ENHANCED WORKER: Processing ${batch.messages.length} messages with RSS parsing`);

    const startTime = Date.now();
    let totalProcessed = 0;
    let totalFailed = 0;

    for (const message of batch.messages) {
      try {
        const queueMessage = message.body;
        console.log('🔍 WORKER: Processing queue message', queueMessage);

        if (!queueMessage?.feeds || !Array.isArray(queueMessage.feeds)) {
          throw new Error('Invalid message: feeds array missing');
        }

        const { batchId, feeds, existingGuids = [], newestEntryDate, userId } = queueMessage;
        
        // Set batch status to processing
        await setBatchStatus(batchId, {
          batchId,
          status: 'processing',
          queuedAt: startTime,
          processedAt: Date.now(),
          totalFeeds: feeds.length,
          processedFeeds: 0
        }, env);

        // ✅ PARALLEL RSS PROCESSING IN WORKER
        const processedFeeds = await processRSSFeedsInParallel(feeds, env);
        
        // Get new entries from processed feeds
        const newEntries = await getNewEntriesFromProcessedFeeds(
          processedFeeds, 
          existingGuids, 
          newestEntryDate,
          env
        );

        // Update batch status to completed
        const result = {
          batchId,
          success: true,
          refreshedAny: processedFeeds.length > 0,
          entries: newEntries.entries,
          newEntriesCount: newEntries.entries.length,
          totalEntries: newEntries.totalEntries,
          postTitles: feeds.map(f => f.postTitle),
          refreshTimestamp: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime
        };

        await setBatchStatus(batchId, {
          batchId,
          status: 'completed',
          queuedAt: startTime,
          processedAt: startTime,
          completedAt: Date.now(),
          result
        }, env);

        // Notify Durable Object of completion
        if (env.BATCH_STATUS_DO) {
          try {
            const durableObject = env.BATCH_STATUS_DO.get(env.BATCH_STATUS_DO.idFromName(batchId));
            await durableObject.fetch('https://worker/notify', {
              method: 'POST',
              body: JSON.stringify(result)
            });
          } catch (doError) {
            console.error('❌ WORKER: Durable Object notification failed:', doError);
          }
        }

        totalProcessed++;
        message.ack();
        
      } catch (messageError) {
        console.error('❌ WORKER: Error processing message:', messageError);
        
        const batchId = message.body?.batchId;
        if (batchId) {
          await setBatchStatus(batchId, {
            batchId,
            status: 'failed',
            queuedAt: startTime,
            processedAt: startTime,
            completedAt: Date.now(),
            error: messageError.message
          }, env);
        }
        
        totalFailed++;
        message.retry();
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ ENHANCED WORKER: Completed batch processing`, {
      totalMessages: batch.messages.length,
      totalProcessed,
      totalFailed,
      processingTimeMs: processingTime,
      avgTimePerMessage: Math.round(processingTime / batch.messages.length)
    });
  },

  async fetch(request, env) {
    return new Response('Enhanced RSS Processing Worker', { status: 200 });
  }
};

// ✅ CORE RSS PROCESSING FUNCTION - Parallel batching
async function processRSSFeedsInParallel(feeds, env) {
  const processedFeeds = [];
  
  // Check which feeds need refreshing
  const staleFeedTitles = await checkFeedsNeedingRefresh(feeds.map(f => f.postTitle), env);
  const feedsToRefresh = feeds.filter(feed => staleFeedTitles.includes(feed.postTitle));
  
  if (feedsToRefresh.length === 0) {
    console.log('✅ WORKER: All feeds are up to date');
    return [];
  }

  console.log(`🔄 WORKER: Processing ${feedsToRefresh.length} stale feeds in parallel batches`);
  
  // Process feeds in parallel batches
  const feedBatches = chunkArray(feedsToRefresh, PARALLEL_BATCH_SIZE);
  
  for (let i = 0; i < feedBatches.length; i++) {
    const batch = feedBatches[i];
    console.log(`🔄 WORKER: Processing batch ${i + 1}/${feedBatches.length} (${batch.length} feeds)`);
    
    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(feed => processSingleRSSFeed(feed, env))
    );
    
    // Collect successful results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        processedFeeds.push({
          feed: batch[index],
          data: result.value
        });
      } else {
        console.error(`❌ WORKER: Failed to process feed ${batch[index].postTitle}:`, result.reason);
      }
    });
  }
  
  return processedFeeds;
}

// ✅ SINGLE RSS FEED PROCESSING - Following Cloudflare best practices
async function processSingleRSSFeed(feed, env) {
  const { postTitle, feedUrl, mediaType } = feed;
  
  try {
    // Acquire lock for feed processing
    const lockAcquired = await acquireFeedRefreshLock(feedUrl, env);
    if (!lockAcquired) {
      console.log(`🔒 WORKER: Feed ${postTitle} is being processed by another worker`);
      return null;
    }

    try {
      // Fetch RSS feed with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      
      console.log(`📡 WORKER: Fetching RSS feed for ${postTitle}`);
      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Cache-Control': 'no-cache'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      
      // Parse XML using fast-xml-parser
      const parsedXML = parser.parse(xmlText);
      
      // Extract feed data
      const feedData = await extractFeedData(parsedXML, feedUrl, mediaType);
      
      // Store in database using Hyperdrive connection
      if (feedData.items.length > 0) {
        await storeFeedData(feed, feedData, env);
        console.log(`✅ WORKER: Processed ${feedData.items.length} items for ${postTitle}`);
      }
      
      return feedData;
      
    } finally {
      await releaseFeedRefreshLock(feedUrl, env);
    }
    
  } catch (error) {
    console.error(`❌ WORKER: Error processing feed ${postTitle}:`, error);
    return null;
  }
}

// ✅ HELPER FUNCTIONS

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function setBatchStatus(batchId, status, env) {
  if (!env.BATCH_STATUS || !batchId) return;
  
  try {
    const statusJson = JSON.stringify(status);
    await env.BATCH_STATUS.put(batchId, statusJson, { expirationTtl: 3600 });
  } catch (error) {
    console.error('❌ WORKER: KV write failed:', error);
  }
}

async function checkFeedsNeedingRefresh(postTitles, env) {
  // Use Hyperdrive connection to check database
  // For now, assume all feeds need refresh (implement with real DB connection)
  return postTitles;
}

async function extractFeedData(parsedXML, feedUrl, mediaType) {
  // Extract RSS/Atom data following your existing logic
  let channel, items = [];
  
  if (parsedXML.rss?.channel) {
    channel = parsedXML.rss.channel;
    items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
  } else if (parsedXML.feed) {
    channel = parsedXML.feed;
    items = Array.isArray(channel.entry) ? channel.entry : (channel.entry ? [channel.entry] : []);
  }
  
  return {
    title: channel.title || '',
    link: feedUrl,
    mediaType,
    items: items.map((item, index) => ({
      title: item.title || '',
      description: item.description || item.summary || '',
      link: item.link?.href || item.link || '',
      guid: item.guid || item.id || `${feedUrl}-${Date.now()}-${index}`,
      pubDate: item.pubDate || item.published || new Date().toISOString(),
      mediaType,
      feedUrl
    }))
  };
}

async function storeFeedData(feed, feedData, env) {
  // Use Hyperdrive connection to store data
  // Implementation would mirror your existing storeRSSEntriesWithTransaction
  console.log(`💾 WORKER: Would store ${feedData.items.length} items for ${feed.postTitle}`);
  // TODO: Implement actual database storage via Hyperdrive
}

async function getNewEntriesFromProcessedFeeds(processedFeeds, existingGuids, newestEntryDate, env) {
  // Filter and return new entries
  const allEntries = processedFeeds.flatMap(pf => pf.data.items);
  const newEntries = allEntries.filter(entry => !existingGuids.includes(entry.guid));
  
  return {
    entries: newEntries,
    totalEntries: newEntries.length
  };
}

async function acquireFeedRefreshLock(feedUrl, env) {
  // Simple lock implementation using KV
  const lockKey = `lock:${feedUrl}`;
  const lockValue = Date.now().toString();
  const existingLock = await env.BATCH_STATUS?.get(lockKey);
  
  if (existingLock) {
    const lockTime = parseInt(existingLock);
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    if (lockTime > fiveMinutesAgo) {
      return false; // Lock is still valid
    }
  }
  
  await env.BATCH_STATUS?.put(lockKey, lockValue, { expirationTtl: 300 }); // 5 minute lock
  return true;
}

async function releaseFeedRefreshLock(feedUrl, env) {
  const lockKey = `lock:${feedUrl}`;
  await env.BATCH_STATUS?.delete(lockKey);
}