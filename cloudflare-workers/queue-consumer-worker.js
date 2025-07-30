// Enhanced Cloudflare Worker for RSS processing with parallel batching
// ELIMINATES server bottleneck by processing RSS feeds directly in Worker

const PARALLEL_BATCH_SIZE = 15; // Process 15 feeds simultaneously
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

export default {
  async queue(batch, env) {
    console.log(`🔄 QUEUE WORKER: Processing ${batch.messages.length} messages with parallel RSS processing`);

    for (const message of batch.messages) {
      try {
        const startTime = Date.now();
        const queueMessage = message.body;

        console.log('🔍 QUEUE WORKER: Processing message', {
          batchId: queueMessage.batchId,
          feedCount: queueMessage.feeds?.length
        });

        if (!queueMessage.feeds || !Array.isArray(queueMessage.feeds)) {
          console.error('❌ QUEUE WORKER: Invalid message format - missing feeds array');
          message.ack(); // Acknowledge to prevent reprocessing
          continue;
        }

        // Process RSS feeds with parallel batching
        const result = await processRSSFeedsInParallel(queueMessage, env);
        
        // Notify Pages Function of completion
        await notifyPagesFunction(result, env);
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ QUEUE WORKER: Successfully processed batch in ${processingTime}ms`, {
          batchId: queueMessage.batchId,
          newEntriesCount: result.newEntriesCount,
          processingTime
        });

        message.ack();

      } catch (error) {
        console.error('❌ QUEUE WORKER: Error processing message:', error);
        message.retry();
      }
    }
  },

  async fetch(request, env) {
    return new Response('Enhanced RSS Queue Consumer Worker', { status: 200 });
  }
};

// Parallel RSS processing function
async function processRSSFeedsInParallel(queueMessage, env) {
  const { batchId, feeds, existingGuids = [], newestEntryDate, userId } = queueMessage;
  
  // Extract feed data
  const postTitles = feeds.map(feed => feed.postTitle);
  const feedUrls = feeds.map(feed => feed.feedUrl);
  const mediaTypes = feeds.map(feed => feed.mediaType).filter(Boolean);

  console.log(`🔄 WORKER RSS: Starting parallel processing for ${feeds.length} feeds`);

  // Check which feeds need refreshing
  const staleFeedTitles = await checkFeedsNeedingRefresh(postTitles, env);
  
  if (staleFeedTitles.length === 0) {
    console.log('✅ WORKER RSS: All feeds are fresh, no processing needed');
    return {
      batchId,
      success: true,
      refreshedAny: false,
      entries: [],
      newEntriesCount: 0,
      totalEntries: 0,
      postTitles,
      refreshTimestamp: new Date().toISOString(),
      processingTimeMs: 0
    };
  }

  console.log(`🔄 WORKER RSS: Found ${staleFeedTitles.length} stale feeds to refresh`);

  // Get feeds that need processing
  const feedsToProcess = feeds.filter(feed => staleFeedTitles.includes(feed.postTitle));
  
  // Process feeds in parallel batches
  const allNewEntries = [];
  const feedBatches = chunkArray(feedsToProcess, PARALLEL_BATCH_SIZE);
  
  for (let batchIndex = 0; batchIndex < feedBatches.length; batchIndex++) {
    const batch = feedBatches[batchIndex];
    console.log(`🔄 WORKER RSS: Processing batch ${batchIndex + 1}/${feedBatches.length} (${batch.length} feeds)`);
    
    // Process batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(feed => processSingleFeed(feed, env))
    );
    
    // Collect successful results
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value?.entries) {
        allNewEntries.push(...result.value.entries);
        console.log(`✅ WORKER RSS: Processed ${batch[index].postTitle} - ${result.value.entries.length} entries`);
      } else {
        console.error(`❌ WORKER RSS: Failed to process ${batch[index].postTitle}:`, result.reason);
      }
    });
  }

  console.log(`✅ WORKER RSS: Parallel processing complete - ${allNewEntries.length} total new entries`);

  return {
    batchId,
    success: true,
    refreshedAny: allNewEntries.length > 0,
    entries: allNewEntries,
    newEntriesCount: allNewEntries.length,
    totalEntries: allNewEntries.length,
    postTitles,
    refreshTimestamp: new Date().toISOString(),
    processingTimeMs: Date.now()
  };
}

// Process a single feed
async function processSingleFeed(feed, env) {
  try {
    // Fetch RSS content
    const rssResponse = await fetch(feed.feedUrl, {
      headers: {
        'User-Agent': 'RSS-Reader/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      },
      cf: {
        timeout: 30000 // 30 second timeout
      }
    });

    if (!rssResponse.ok) {
      throw new Error(`HTTP ${rssResponse.status}: ${rssResponse.statusText}`);
    }

    const rssContent = await rssResponse.text();
    
    // Parse RSS content using a simple XML parser
    const entries = await parseRSSContent(rssContent, feed.mediaType, feed.postTitle);
    
    // Store entries via Pages Function API
    if (entries.length > 0) {
      await storeRSSEntries(feed, entries, env);
    }

    return { entries, feedTitle: feed.postTitle };
    
  } catch (error) {
    console.error(`❌ WORKER RSS: Error processing feed ${feed.postTitle}:`, error);
    throw error;
  }
}

// Simple RSS parser for Worker environment
async function parseRSSContent(content, mediaType, feedTitle) {
  try {
    console.log(`📝 WORKER RSS: Parsing RSS content for ${feedTitle}`);
    
    // Simple regex-based parsing (not ideal but works for basic RSS)
    const entries = [];
    
    // Extract items/entries
    const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/gi;
    const items = content.match(itemRegex) || [];
    
    for (const item of items.slice(0, 10)) { // Limit to 10 entries per feed
      const entry = {};
      
      // Extract basic fields
      entry.title = extractField(item, 'title') || '';
      entry.description = extractField(item, 'description') || extractField(item, 'summary') || '';
      entry.link = extractField(item, 'link') || extractField(item, 'id') || '';
      entry.pubDate = extractField(item, 'pubDate') || extractField(item, 'published') || extractField(item, 'updated') || new Date().toISOString();
      entry.guid = extractField(item, 'guid') || extractField(item, 'id') || entry.link || Math.random().toString(36);
      
      // Extract media info
      const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="([^"]*)"[^>]*>/i);
      if (enclosureMatch) {
        entry.enclosure = {
          url: enclosureMatch[1],
          type: enclosureMatch[2]
        };
      }
      
      // Add media type
      entry.mediaType = mediaType || 'article';
      
      if (entry.title && entry.link) {
        entries.push(entry);
      }
    }
    
    console.log(`✅ WORKER RSS: Parsed ${entries.length} entries from ${feedTitle}`);
    return entries;
    
  } catch (error) {
    console.error(`❌ WORKER RSS: Error parsing RSS for ${feedTitle}:`, error);
    return [];
  }
}

// Helper function to extract field from XML
function extractField(xml, fieldName) {
  const regex = new RegExp(`<${fieldName}[^>]*>([\\s\\S]*?)<\\/${fieldName}>`, 'i');
  const match = xml.match(regex);
  if (match) {
    return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  }
  
  // Try self-closing tags
  const selfClosingRegex = new RegExp(`<${fieldName}[^>]*\\/>`, 'i');
  const selfClosingMatch = xml.match(selfClosingRegex);
  if (selfClosingMatch) {
    const hrefMatch = selfClosingMatch[0].match(/href="([^"]*)"/i);
    return hrefMatch ? hrefMatch[1] : '';
  }
  
  return null;
}

// Store RSS entries via Pages Function API
async function storeRSSEntries(feed, entries, env) {
  try {
    console.log(`💾 WORKER RSS: Storing ${entries.length} entries for ${feed.postTitle}`);
    
    // Send to Pages Function for database storage
    const response = await fetch(`${env.PAGES_FUNCTION_URL}/api/entries/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.PAGES_FUNCTION_TOKEN || ''}`,
        'X-Worker-Store': 'true'
      },
      body: JSON.stringify({
        feed: feed,
        entries: entries
      })
    });
    
    if (!response.ok) {
      throw new Error(`Storage API failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`✅ WORKER RSS: Stored entries for ${feed.postTitle}`, result);
    
  } catch (error) {
    console.error(`❌ WORKER RSS: Failed to store entries for ${feed.postTitle}:`, error);
    throw error;
  }
}

// Check which feeds need refreshing via Pages Function API
async function checkFeedsNeedingRefresh(postTitles, env) {
  try {
    console.log(`🔍 WORKER RSS: Checking ${postTitles.length} feeds for staleness`);
    
    const response = await fetch(`${env.PAGES_FUNCTION_URL}/api/feeds/check-stale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.PAGES_FUNCTION_TOKEN || ''}`,
        'X-Worker-Check': 'true'
      },
      body: JSON.stringify({ postTitles })
    });
    
    if (!response.ok) {
      console.error(`❌ WORKER RSS: Stale check API failed: ${response.status}`);
      // Fallback: assume all feeds need refresh
      return postTitles;
    }
    
    const result = await response.json();
    console.log(`✅ WORKER RSS: Found ${result.staleFeedTitles?.length || 0} stale feeds`);
    
    return result.staleFeedTitles || [];
    
  } catch (error) {
    console.error('❌ WORKER RSS: Error checking stale feeds:', error);
    // Fallback: assume all feeds need refresh
    return postTitles;
  }
}

// Notify Pages Function of completion
async function notifyPagesFunction(result, env) {
  try {
    console.log(`📡 WORKER RSS: Notifying Pages Function of completion`);
    
    const response = await fetch(`${env.PAGES_FUNCTION_URL}/api/queue-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.PAGES_FUNCTION_TOKEN || ''}`,
        'X-Worker-Result': 'true'
      },
      body: JSON.stringify({ result })
    });
    
    if (response.ok) {
      console.log(`✅ WORKER RSS: Successfully notified Pages Function`);
    } else {
      console.error(`❌ WORKER RSS: Failed to notify Pages Function: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ WORKER RSS: Failed to notify Pages Function:', error);
    // Don't throw - this is not critical
  }
}

// Utility function to chunk arrays
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}