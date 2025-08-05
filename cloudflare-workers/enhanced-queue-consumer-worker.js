// Enhanced RSS Processing Queue Consumer Worker - Database Locking Version
// Replaces KV locks with atomic MySQL operations for better performance and reliability

import { XMLParser } from 'fast-xml-parser';

// Initialize XML parser with EXACT same settings as rss.server.ts
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (tagName) => {
    return ['item', 'entry', 'link', 'category', 'enclosure'].includes(tagName);
  },
  stopNodes: ['description', 'content:encoded', 'summary'],
  processEntities: true,
  htmlEntities: true
});

// Parallel processing configuration
const PARALLEL_BATCH_SIZE = 20;
const FETCH_TIMEOUT = 10000;
const MAX_RETRIES = 3;

// Lock configuration
const LOCK_DURATION_MS = 5 * 60 * 1000;      // 5 minutes
const STALE_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours

export default {
  async queue(batch, env) {
    console.log(`🔄 ENHANCED WORKER V2: Processing ${batch.messages.length} messages with database locking`);

    const startTime = Date.now();
    let totalProcessed = 0;
    let totalFailed = 0;

    for (const message of batch.messages) {
      try {
        const queueMessage = message.body;
        console.log('🔍 WORKER V2: Processing queue message', queueMessage);

        if (!queueMessage?.feeds || !Array.isArray(queueMessage.feeds)) {
          throw new Error('Invalid message: feeds array missing');
        }

        const { batchId, feeds, existingGuids = [], newestEntryDate, userId } = queueMessage;
        
        console.log(`🚀 WORKER V2: Processing batch ${batchId} with ${feeds.length} feeds`);

        // Process RSS feeds with database locking
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

        console.log(`✅ WORKER V2: Batch ${batchId} completed - notifying Durable Object`);

        // Notify Durable Object of completion
        if (env.BATCH_STATUS_DO) {
          try {
            const durableObject = env.BATCH_STATUS_DO.get(env.BATCH_STATUS_DO.idFromName(batchId));
            await durableObject.fetch('https://worker/notify', {
              method: 'POST',
              body: JSON.stringify(result)
            });
            console.log('✅ WORKER V2: Successfully notified Durable Object');
          } catch (doError) {
            console.error('❌ WORKER V2: Durable Object notification failed:', doError);
          }
        }

        totalProcessed++;
        message.ack();
        
      } catch (messageError) {
        console.error('❌ WORKER V2: Error processing message:', messageError);
        
        const batchId = message.body?.batchId;
        if (batchId) {
          console.log(`❌ WORKER V2: Batch ${batchId} failed - Durable Object will handle cleanup`);
        }
        
        totalFailed++;
        message.retry();
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ ENHANCED WORKER V2: Completed batch processing`, {
      totalMessages: batch.messages.length,
      totalProcessed,
      totalFailed,
      processingTimeMs: processingTime,
      avgTimePerMessage: Math.round(processingTime / batch.messages.length)
    });
  },

  async fetch(request, env) {
    return new Response('Enhanced RSS Processing Worker V2 - Database Locking', { status: 200 });
  }
};

// Database locking functions - replacing KV locks
async function acquireFeedLock(feedUrl, env) {
  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      disableEval: true
    });
    
    try {
      const now = Date.now();
      const lockUntil = now + LOCK_DURATION_MS;
      const staleThreshold = now - STALE_THRESHOLD_MS;
      
      // Atomic operation: acquire lock only if feed is stale and not locked
      const [result] = await connection.query(
        `UPDATE rss_feeds 
         SET processing_until = ?
         WHERE feed_url = ? 
           AND processing_until < ?
           AND last_fetched < ?`,
        [lockUntil, feedUrl, now, staleThreshold]
      );
      
      const acquired = result.affectedRows > 0;
      console.log(`🔒 WORKER V2: Lock acquisition for ${feedUrl}: ${acquired ? 'SUCCESS' : 'DENIED'}`);
      
      return {
        acquired,
        lockUntil: acquired ? lockUntil : null
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ WORKER V2: Lock acquisition failed:', error);
    return { acquired: false, lockUntil: null };
  }
}

async function releaseFeedLock(feedUrl, success, env) {
  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      disableEval: true
    });
    
    try {
      if (success) {
        // Successful processing: clear lock and update last_fetched
        await connection.query(
          `UPDATE rss_feeds 
           SET processing_until = 0, last_fetched = ?
           WHERE feed_url = ?`,
          [Date.now(), feedUrl]
        );
        console.log(`✅ WORKER V2: Released lock and updated last_fetched for ${feedUrl}`);
      } else {
        // Failed processing: clear lock but don't update last_fetched
        await connection.query(
          `UPDATE rss_feeds 
           SET processing_until = 0
           WHERE feed_url = ?`,
          [feedUrl]
        );
        console.log(`🔓 WORKER V2: Released lock (failed processing) for ${feedUrl}`);
      }
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ WORKER V2: Lock release failed for ${feedUrl}:`, error);
  }
}

// Core RSS processing function with database locking
async function processRSSFeedsInParallel(feeds, env) {
  const processedFeeds = [];
  
  console.log(`🔄 WORKER V2: Processing ${feeds.length} feeds with database locking`);
  
  // Process feeds in parallel batches
  const feedBatches = chunkArray(feeds, PARALLEL_BATCH_SIZE);
  
  for (let i = 0; i < feedBatches.length; i++) {
    const batch = feedBatches[i];
    console.log(`🔄 WORKER V2: Processing batch ${i + 1}/${feedBatches.length} (${batch.length} feeds)`);
    
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
        console.error(`❌ WORKER V2: Failed to process feed ${batch[index].postTitle}:`, result.reason);
      }
    });
  }
  
  return processedFeeds;
}

// Single RSS feed processing with database locking
async function processSingleRSSFeed(feed, env) {
  const { postTitle, feedUrl, mediaType } = feed;
  
  try {
    // Acquire database lock for feed processing
    const lockResult = await acquireFeedLock(feedUrl, env);
    
    if (!lockResult.acquired) {
      console.log(`🔒 WORKER V2: Feed ${postTitle} is locked or not stale - skipping`);
      return null;
    }
    
    console.log(`✅ WORKER V2: Acquired database lock for ${postTitle}: ${feedUrl}`);

    try {
      // Fetch RSS feed with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      
      console.log(`📡 WORKER V2: Fetching RSS feed for ${postTitle}`);
      const response = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/2.0)',
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
        console.log(`✅ WORKER V2: Processed ${feedData.items.length} items for ${postTitle}`);
      }
      
      // Release lock with success=true
      await releaseFeedLock(feedUrl, true, env);
      
      return feedData;
      
    } catch (processingError) {
      // Release lock with success=false (allows retry before 4 hours)
      await releaseFeedLock(feedUrl, false, env);
      throw processingError;
    }
    
  } catch (error) {
    console.error(`❌ WORKER V2: Error processing feed ${postTitle}:`, error);
    return null;
  }
}

// Helper function to chunk arrays
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Helper function to safely extract text content
function getTextContent(node) {
  if (!node) return '';
  
  if (typeof node === 'string') {
    return stripHtmlTags(node);
  }
  
  if (typeof node === 'object' && node !== null) {
    if ('#text' in node) {
      return stripHtmlTags(String(node['#text'] || ''));
    }
    
    if ('__cdata' in node) {
      return stripHtmlTags(String(node['__cdata'] || ''));
    }
    
    if ('content' in node && typeof node.content === 'string') {
      return stripHtmlTags(node.content);
    }
    
    if ('attr' in node && '#text' in node) {
      return stripHtmlTags(String(node['#text'] || ''));
    }
  }
  
  return stripHtmlTags(String(node || ''));
}

// Helper function to strip HTML tags
function stripHtmlTags(html) {
  if (!html) return '';
  
  let text = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  text = text.replace(/<[^>]*>/g, ' ');
  text = text.replace(/\s+/g, ' ');
  
  return text.trim();
}

// Helper function to extract link from different formats
function getLink(node) {
  if (!node) return '';
  
  const isPodcast = Boolean(
    node['itunes:duration'] || 
    node['itunes:author'] || 
    node['itunes:subtitle'] || 
    node['itunes:explicit'] ||
    node['itunes:image']
  );
  
  if (isPodcast && node.enclosure) {
    const enclosures = Array.isArray(node.enclosure) ? node.enclosure : [node.enclosure];
    
    for (const enc of enclosures) {
      if (typeof enc !== 'object' || enc === null) continue;
      
      if (enc['@_url']) {
        return String(enc['@_url']);
      }
      
      if (enc.attr && typeof enc.attr === 'object' && enc.attr['@_url']) {
        return String(enc.attr['@_url']);
      }
      
      if (enc.url) {
        return String(enc.url);
      }
    }
  }
  
  if (typeof node.link === 'string') {
    return node.link;
  }
  
  if (typeof node.link === 'object' && node.link !== null && !Array.isArray(node.link)) {
    const linkObj = node.link;
    
    if (linkObj['@_href']) {
      return String(linkObj['@_href']);
    }
    
    if (linkObj.attr && typeof linkObj.attr === 'object' && linkObj.attr['@_href']) {
      return String(linkObj.attr['@_href']);
    }
    
    if (linkObj['#text']) {
      return String(linkObj['#text']);
    }
  }
  
  if (Array.isArray(node.link) && node.link.length > 0) {
    const mainLink = node.link.find(l => {
      if (typeof l !== 'object' || l === null) return false;
      return l['@_rel'] === 'alternate' || !l['@_rel'];
    });
    
    if (mainLink && typeof mainLink === 'object') {
      if (mainLink['@_href']) {
        return String(mainLink['@_href']);
      }
      
      if (mainLink['#text']) {
        return String(mainLink['#text']);
      }
    }
    
    const firstLink = node.link[0];
    if (typeof firstLink === 'object' && firstLink !== null) {
      if (firstLink['@_href']) {
        return String(firstLink['@_href']);
      }
      
      if (firstLink.attr && typeof firstLink.attr === 'object' && firstLink.attr['@_href']) {
        return String(firstLink.attr['@_href']);
      }
      
      if (firstLink['#text']) {
        return String(firstLink['#text']);
      }
    }
    
    return String(node.link[0]);
  }
  
  if (typeof node.guid === 'string' && node.guid.startsWith('http')) {
    return node.guid;
  }
  
  return '';
}

// Helper function to extract image from item
function extractImage(item) {
  try {
    if (item['itunes:image']) {
      if (typeof item['itunes:image'] === 'object' && item['itunes:image'] !== null) {
        const itunesImage = item['itunes:image'];
        
        if (itunesImage['@_href']) {
          return String(itunesImage['@_href']);
        }
        
        if (itunesImage.attr && typeof itunesImage.attr === 'object' && itunesImage.attr['@_href']) {
          return String(itunesImage.attr['@_href']);
        }
        
        if (itunesImage.url) {
          return String(itunesImage.url);
        }
        
        if (itunesImage.href) {
          return String(itunesImage.href);
        }
      }
      
      if (typeof item['itunes:image'] === 'string' && 
          item['itunes:image'].match(/^https?:\/\//)) {
        return item['itunes:image'];
      }
    }
    
    if (item.enclosure) {
      const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
      
      for (const enc of enclosures) {
        if (typeof enc !== 'object' || enc === null) continue;
        
        let enclosureUrl = null;
        
        if (enc.attr && typeof enc.attr === 'object' && enc.attr['@_url']) {
          enclosureUrl = String(enc.attr['@_url']);
        }
        
        if (!enclosureUrl && enc['@_url']) {
          enclosureUrl = String(enc['@_url']);
        }
        
        if (enclosureUrl) {
          if (
            enclosureUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) ||
            /\/(image|img|photo|thumbnail|cover|banner|logo)s?\//i.test(enclosureUrl)
          ) {
            return enclosureUrl;
          }
        }
      }
    }
    
    const contentFields = ['content', 'description', 'summary', 'content:encoded'];
    for (const field of contentFields) {
      const content = item[field];
      if (typeof content === 'string' && content.length > 0) {
        const patterns = [
          /<img[^>]+src=["']([^"']+)["']/i,
          /<img[^>]+src=([^ >]+)/i,
          /src=["']([^"']+\.(?:jpg|jpeg|png|gif|webp))["']/i
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1] && !match[1].startsWith('data:')) {
            return match[1];
          }
        }
      }
    }
    
    if (item.channelImage && typeof item.channelImage === 'string') {
      return item.channelImage;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to format date consistently
function formatDate(dateStr) {
  try {
    if (!dateStr) {
      return new Date().toISOString();
    }
    
    if (typeof dateStr === 'string') {
      const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (mysqlDateRegex.test(dateStr)) {
        const [datePart, timePart] = dateStr.split(' ');
        const isoString = `${datePart}T${timePart}.000Z`;
        return isoString;
      }
    }
    
    if (typeof dateStr === 'object' && dateStr !== null) {
      if (dateStr instanceof Date) {
        return dateStr.toISOString();
      }
      
      if ('toISOString' in dateStr && typeof dateStr.toISOString === 'function') {
        return dateStr.toISOString();
      }
      
      if ('toString' in dateStr && typeof dateStr.toString === 'function') {
        dateStr = dateStr.toString();
      }
    }
    
    const dateString = typeof dateStr === 'string' 
      ? dateStr 
      : dateStr instanceof Date
        ? dateStr.toISOString()
        : String(dateStr || '');
        
    let normalizedDateString = dateString;
    
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString)) {
      normalizedDateString = `${dateString}Z`;
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      normalizedDateString = `${dateString}T00:00:00Z`;
    }
    
    const date = new Date(normalizedDateString);
    
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function extractFeedData(parsedXML, feedUrl, mediaType) {
  let channel, items = [];
  
  if (parsedXML.rss && parsedXML.rss.channel) {
    channel = parsedXML.rss.channel;
    items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
  } else if (parsedXML.feed) {
    channel = parsedXML.feed;
    items = Array.isArray(channel.entry) ? channel.entry : (channel.entry ? [channel.entry] : []);
  } else {
    throw new Error('Unsupported feed format');
  }
  
  let channelImage = null;
  
  if (channel['itunes:image']) {
    if (typeof channel['itunes:image'] === 'object' && channel['itunes:image'] !== null) {
      const itunesImage = channel['itunes:image'];
      
      if (itunesImage['@_href']) {
        channelImage = String(itunesImage['@_href']);
      } else if (itunesImage.attr && typeof itunesImage.attr === 'object' && itunesImage.attr['@_href']) {
        channelImage = String(itunesImage.attr['@_href']);
      }
    }
  }
  
  if (!channelImage && channel.image) {
    if (typeof channel.image === 'object' && channel.image !== null && channel.image.url) {
      channelImage = String(channel.image.url);
    }
  }
  
  const feed = {
    title: getTextContent(channel.title),
    description: getTextContent(channel.description || channel.subtitle || ''),
    link: getLink(channel),
    mediaType,
    items: []
  };
  
  feed.items = items.map((item, index) => {
    try {
      if (channelImage) {
        item.channelImage = channelImage;
      }
      
      let guid;
      if (typeof item.guid === 'string') {
        guid = item.guid;
      } else if (item.guid && typeof item.guid === 'object') {
        guid = item.guid.__cdata || item.guid['#text'] || item.guid.value || String(item.guid);
      } else if (typeof item.id === 'string') {
        guid = item.id;
      } else if (item.id && typeof item.id === 'object') {
        guid = item.id.__cdata || item.id['#text'] || item.id.value || String(item.id);
      } else {
        guid = `${feedUrl}-${Date.now()}-${index}`;
      }
      
      const itemImage = extractImage(item);
      
      const processedItem = {
        title: getTextContent(item.title),
        description: getTextContent(item.description || item.summary || item.content || ''),
        link: getLink(item),
        guid: guid,
        pubDate: formatDate(item.pubDate || item.published || item.updated || new Date().toISOString()),
        image: itemImage || channelImage || undefined,
        mediaType,
        feedUrl: feedUrl
      };
      
      return processedItem;
    } catch (itemError) {
      console.warn(`Error processing feed item ${index}: ${itemError}`);
      return {
        title: 'Error processing item',
        description: '',
        link: '',
        guid: `error-${Date.now()}-${Math.random()}`,
        pubDate: new Date().toISOString(),
        image: channelImage || undefined,
        mediaType,
        feedUrl: feedUrl
      };
    }
  }).filter((item) => {
    const isValid = Boolean(item.guid && item.title);
    if (!isValid) {
      console.warn(`Filtered out invalid item: guid=${item.guid}, title=${item.title}`);
    }
    return isValid;
  });
  
  if (mediaType) {
    feed.items.forEach(item => {
      if (!item.mediaType) {
        item.mediaType = mediaType;
      }
    });
  }
  
  return feed;
}

async function storeFeedData(feed, feedData, env) {
  const { postTitle, feedUrl, mediaType } = feed;
  
  try {
    const feedId = await getOrCreateFeed(feedUrl, postTitle, mediaType, env);
    await storeRSSEntriesWithTimestamp(feedId, feedData.items, mediaType, env);
    
    console.log(`✅ WORKER V2: Stored ${feedData.items.length} items for ${postTitle} (feedId: ${feedId})`);
    
  } catch (error) {
    console.error(`❌ WORKER V2: Failed to store feed data for ${postTitle}:`, error);
    throw error;
  }
}

async function getOrCreateFeed(feedUrl, postTitle, mediaType, env) {
  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      disableEval: true
    });
    
    try {
      const [existingFeeds] = await connection.query(
        'SELECT id, media_type FROM rss_feeds WHERE feed_url = ?',
        [feedUrl]
      );
      
      if (existingFeeds.length > 0) {
        const feedId = existingFeeds[0].id;
        
        if (mediaType && (!existingFeeds[0].media_type || existingFeeds[0].media_type !== mediaType)) {
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          await connection.query(
            'UPDATE rss_feeds SET media_type = ?, updated_at = ? WHERE id = ?',
            [mediaType, now, feedId]
          );
        }
        
        return feedId;
      }
      
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const currentTimeMs = Date.now();
      
      const [insertResult] = await connection.query(
        'INSERT INTO rss_feeds (feed_url, title, media_type, last_fetched, processing_until, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
        [feedUrl, postTitle, mediaType || null, currentTimeMs, now, now]
      );
      
      return insertResult.insertId;
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ WORKER V2: Error getting/creating feed for ${feedUrl}:`, error);
    throw error;
  }
}

async function storeRSSEntriesWithTimestamp(feedId, entries, mediaType, env) {
  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      disableEval: true
    });
    
    try {
      if (entries.length === 0) {
        console.log(`📅 WORKER V2: No entries to store for feedId ${feedId}`);
        return;
      }

      // Get existing GUIDs to filter duplicates
      const entryGuids = entries.map(entry => entry.guid);
      
      const [existingEntries] = await connection.query(
        `SELECT guid FROM rss_entries WHERE feed_id = ? AND guid IN (${entryGuids.map(() => '?').join(',')})`,
        [feedId, ...entryGuids]
      );
      
      const existingGuids = new Set(existingEntries.map(row => row.guid));
      const newEntries = entries.filter(entry => !existingGuids.has(entry.guid));
      
      console.log(`📊 WORKER V2: Filtered ${entries.length - newEntries.length} existing entries, ${newEntries.length} are new`);
      
      if (newEntries.length === 0) {
        console.log(`📅 WORKER V2: No new entries to store for feedId ${feedId}`);
        return;
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      // Insert new entries
      let insertedCount = 0;
      for (const entry of newEntries) {
        try {
          let pubDateForMySQL;
          try {
            const date = new Date(entry.pubDate);
            pubDateForMySQL = isNaN(date.getTime()) 
              ? now 
              : date.toISOString().slice(0, 19).replace('T', ' ');
          } catch {
            pubDateForMySQL = now;
          }
          
          const sanitizeContent = (content) => {
            if (!content) return '';
            return String(content)
              .replace(/;/g, ',')
              .replace(/--/g, '-')
              .replace(/\/\*/g, '/')
              .replace(/\*\//g, '/')
              .slice(0, 200);
          };

          await connection.query(
            'INSERT IGNORE INTO rss_entries (feed_id, guid, title, link, description, pub_date, image, media_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              feedId,
              entry.guid,
              sanitizeContent(entry.title),
              entry.link,
              sanitizeContent(entry.description),
              pubDateForMySQL,
              entry.image || null,
              mediaType || entry.mediaType || null,
              now,
              now
            ]
          );
          
          insertedCount++;
        } catch (entryError) {
          console.warn(`⚠️ WORKER V2: Failed to insert entry ${entry.guid}:`, entryError);
        }
      }
      
      console.log(`✅ WORKER V2: Inserted ${insertedCount} new entries for feedId ${feedId}`);
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ WORKER V2: Error storing RSS entries for feedId ${feedId}:`, error);
    throw error;
  }
}

async function getNewEntriesFromProcessedFeeds(processedFeeds, existingGuids, newestEntryDate, env) {
  console.log(`🔍 WORKER V2: Checking for new entries since ${newestEntryDate}`, { existingGuidsCount: existingGuids.length });
  
  try {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      disableEval: true
    });
    
    try {
      const since = new Date(newestEntryDate).toISOString().slice(0, 19).replace('T', ' ');
      
      const [dbEntries] = await connection.query(
        `SELECT e.guid, e.title, e.link, e.description, e.pub_date, e.image, e.media_type, e.created_at, f.feed_url as feedUrl
         FROM rss_entries e
         JOIN rss_feeds f ON e.feed_id = f.id
         WHERE e.created_at > ?
         ORDER BY e.created_at DESC 
         LIMIT 50`,
        [since]
      );
      
      console.log(`📊 WORKER V2: Found ${dbEntries.length} entries in database since ${since}`);
      
      const newEntries = dbEntries.filter(entry => !existingGuids.includes(entry.guid));
      console.log(`🆕 WORKER V2: ${newEntries.length} entries are truly new for this user`);
      
      if (newEntries.length > 0) {
        console.log(`🎯 WORKER V2: New entry GUIDs:`, newEntries.slice(0, 3).map(e => e.guid));
      }
      
      return {
        entries: newEntries,
        totalEntries: newEntries.length
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ WORKER V2: Error checking for new entries:', error);
    
    const allEntries = processedFeeds.flatMap(pf => pf.data.items);
    const newEntries = allEntries.filter(entry => !existingGuids.includes(entry.guid));
    
    return {
      entries: newEntries,
      totalEntries: newEntries.length
    };
  }
}