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
  if (!postTitles || postTitles.length === 0) return [];
  
  try {
    // Use the mysql2 driver with Hyperdrive credentials
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      // Required for Workers compatibility
      disableEval: true
    });
    
    try {
      const fourHoursInMs = 4 * 60 * 60 * 1000;
      const currentTime = Date.now();
      const cutoffTime = currentTime - fourHoursInMs;
      
      // Query database for feeds with their last_fetched timestamps
      const escapedTitles = postTitles.map(title => connection.escape(title)).join(',');
      const query = `SELECT title, last_fetched FROM rss_feeds WHERE title IN (${escapedTitles})`;
      
      const [result] = await connection.query(query);
      
      const staleFeedTitles = [];
      
      // Check which feeds need refreshing
      for (const row of result) {
        const lastFetchedMs = Number(row.last_fetched);
        
        if (lastFetchedMs < cutoffTime) {
          staleFeedTitles.push(row.title);
          const timeSinceLastFetch = currentTime - lastFetchedMs;
          const minutesAgo = Math.round(timeSinceLastFetch / 60000);
          console.log(`💾 WORKER: Feed "${row.title}" is stale (last fetched ${minutesAgo} minutes ago)`);
        } else {
          const timeSinceLastFetch = currentTime - lastFetchedMs;
          const minutesAgo = Math.round(timeSinceLastFetch / 60000);
          console.log(`✅ WORKER: Feed "${row.title}" is fresh (last fetched ${minutesAgo} minutes ago)`);
        }
      }
      
      // Check for feeds that don't exist in database (new feeds)
      const existingFeedTitles = new Set(result.map(row => row.title));
      const newFeeds = postTitles.filter(title => !existingFeedTitles.has(title));
      
      if (newFeeds.length > 0) {
        console.log(`🆕 WORKER: Found ${newFeeds.length} new feeds that need to be created:`, newFeeds);
        staleFeedTitles.push(...newFeeds);
      }
      
      console.log(`🔄 WORKER: ${staleFeedTitles.length} of ${postTitles.length} feeds need refreshing`);
      return staleFeedTitles;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ WORKER: Error checking feed freshness:`, error);
    // Fallback: refresh all feeds if we can't check database
    return postTitles;
  }
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
    items: items.map((item, index) => {
      // Extract GUID properly - handle both string and object formats
      let guid;
      if (typeof item.guid === 'string') {
        guid = item.guid;
      } else if (item.guid && typeof item.guid === 'object') {
        // Handle CDATA or complex objects: { __cdata: "actual-guid", @_isPermaLink: false }
        guid = item.guid.__cdata || item.guid['#text'] || item.guid.value || String(item.guid);
      } else if (typeof item.id === 'string') {
        guid = item.id;
      } else if (item.id && typeof item.id === 'object') {
        guid = item.id.__cdata || item.id['#text'] || item.id.value || String(item.id);
      } else {
        // Fallback to generated GUID
        guid = `${feedUrl}-${Date.now()}-${index}`;
      }
      
      // Helper function to extract text from potentially complex objects
      const extractText = (field) => {
        if (typeof field === 'string') return field;
        if (field && typeof field === 'object') {
          return field.__cdata || field['#text'] || field.value || String(field);
        }
        return '';
      };
      
      return {
        title: extractText(item.title) || '',
        description: extractText(item.description || item.summary) || '',
        link: item.link?.href || item.link || '',
        guid: guid,
        pubDate: item.pubDate || item.published || new Date().toISOString(),
        mediaType,
        feedUrl
      };
    })
  };
}

async function storeFeedData(feed, feedData, env) {
  const { postTitle, feedUrl, mediaType } = feed;
  
  try {
    // Get or create feed and get the feed ID
    const feedId = await getOrCreateFeed(feedUrl, postTitle, mediaType, env);
    
    // Store RSS entries and update last_fetched timestamp
    await storeRSSEntriesWithTimestamp(feedId, feedData.items, mediaType, env);
    
    console.log(`✅ WORKER: Stored ${feedData.items.length} items for ${postTitle} (feedId: ${feedId})`);
    
  } catch (error) {
    console.error(`❌ WORKER: Failed to store feed data for ${postTitle}:`, error);
    throw error;
  }
}

async function getOrCreateFeed(feedUrl, postTitle, mediaType, env) {
  try {
    // Use the mysql2 driver with Hyperdrive credentials
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      // Required for Workers compatibility
      disableEval: true
    });
    
    try {
      // Check if feed exists (use simple query, not prepared statement)
      const existingFeedsQuery = `SELECT id, media_type FROM rss_feeds WHERE feed_url = ${connection.escape(feedUrl)}`;
      const [existingFeeds] = await connection.query(existingFeedsQuery);
      
      if (existingFeeds.length > 0) {
        const feedId = existingFeeds[0].id;
        
        // Update mediaType if provided and different
        if (mediaType && (!existingFeeds[0].media_type || existingFeeds[0].media_type !== mediaType)) {
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const updateQuery = `UPDATE rss_feeds SET media_type = ${connection.escape(mediaType)}, updated_at = ${connection.escape(now)} WHERE id = ${feedId}`;
          await connection.query(updateQuery);
        }
        
        return feedId;
      }
      
      // Create new feed
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const currentTimeMs = Date.now();
      
      const insertQuery = `INSERT INTO rss_feeds (feed_url, title, media_type, last_fetched, created_at, updated_at) VALUES (${connection.escape(feedUrl)}, ${connection.escape(postTitle)}, ${connection.escape(mediaType || null)}, ${currentTimeMs}, ${connection.escape(now)}, ${connection.escape(now)})`;
      const [insertResult] = await connection.query(insertQuery);
      
      return insertResult.insertId;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ WORKER: Error getting/creating feed for ${feedUrl}:`, error);
    throw error;
  }
}

async function storeRSSEntriesWithTimestamp(feedId, entries, mediaType, env) {
  try {
    // Use the mysql2 driver with Hyperdrive credentials
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      // Required for Workers compatibility
      disableEval: true
    });
    
    try {
      if (entries.length === 0) {
        // Just update the last_fetched timestamp
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const currentTimeMs = Date.now();
        
        const updateQuery = `UPDATE rss_feeds SET updated_at = ${connection.escape(now)}, last_fetched = ${currentTimeMs} WHERE id = ${feedId}`;
        await connection.query(updateQuery);
        
        console.log(`📅 WORKER: Updated last_fetched timestamp for feedId ${feedId} (no new entries)`);
        return;
      }

      // Get existing GUIDs to filter duplicates
      const entryGuids = entries.map(entry => connection.escape(entry.guid)).join(',');
      
      const existingEntriesQuery = `SELECT guid FROM rss_entries WHERE feed_id = ${feedId} AND guid IN (${entryGuids})`;
      const [existingEntries] = await connection.query(existingEntriesQuery);
      
      const existingGuids = new Set(existingEntries.map(row => row.guid));
      const newEntries = entries.filter(entry => !existingGuids.has(entry.guid));
      
      console.log(`📊 WORKER: Filtered ${entries.length - newEntries.length} existing entries, ${newEntries.length} are new`);
      
      if (newEntries.length === 0) {
        // Just update the last_fetched timestamp
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const currentTimeMs = Date.now();
        
        const updateQuery = `UPDATE rss_feeds SET updated_at = ${connection.escape(now)}, last_fetched = ${currentTimeMs} WHERE id = ${feedId}`;
        await connection.query(updateQuery);
        
        console.log(`📅 WORKER: Updated last_fetched timestamp for feedId ${feedId} (no new entries after filtering)`);
        return;
      }

      // Insert new entries in batches and update timestamp
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const currentTimeMs = Date.now();
      
      // Process in smaller batches for Workers
      const batchSize = 25;
      for (let i = 0; i < newEntries.length; i += batchSize) {
        const batch = newEntries.slice(i, i + batchSize);
        
        // Build values for simple query (no prepared statements)
        const valueRows = batch.map(entry => {
          // Format pubDate for MySQL
          let pubDateForMySQL;
          try {
            const date = new Date(entry.pubDate);
            pubDateForMySQL = isNaN(date.getTime()) 
              ? now 
              : date.toISOString().slice(0, 19).replace('T', ' ');
          } catch {
            pubDateForMySQL = now;
          }
          
          return `(${feedId}, ${connection.escape(entry.guid)}, ${connection.escape(entry.title)}, ${connection.escape(entry.link)}, ${connection.escape(entry.description?.slice(0, 200) || '')}, ${connection.escape(pubDateForMySQL)}, ${connection.escape(entry.image || null)}, ${connection.escape(mediaType || entry.mediaType || null)}, ${connection.escape(now)}, ${connection.escape(now)})`;
        }).join(', ');
        
        const insertQuery = `INSERT IGNORE INTO rss_entries (feed_id, guid, title, link, description, pub_date, image, media_type, created_at, updated_at) VALUES ${valueRows}`;
        await connection.query(insertQuery);
      }
      
      // 🔥 CRITICAL: Update last_fetched timestamp
      const finalUpdateQuery = `UPDATE rss_feeds SET updated_at = ${connection.escape(now)}, last_fetched = ${currentTimeMs} WHERE id = ${feedId}`;
      await connection.query(finalUpdateQuery);
      
      console.log(`✅ WORKER: Inserted ${newEntries.length} new entries and updated last_fetched for feedId ${feedId}`);
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ WORKER: Error storing RSS entries for feedId ${feedId}:`, error);
    throw error;
  }
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