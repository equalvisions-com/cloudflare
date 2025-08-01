// Enhanced RSS Processing Queue Consumer Worker
// Processes RSS feeds directly in Worker for maximum performance
// Follows Cloudflare best practices for scalable RSS processing

import { XMLParser } from 'fast-xml-parser';
import mysql from 'mysql2/promise';

// Initialize XML parser with EXACT same settings as rss.server.ts
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  trimValues: true,
  parseTagValue: false,
  isArray: (tagName) => {
    // Common array elements in RSS/Atom feeds
    return ['item', 'entry', 'link', 'category', 'enclosure'].includes(tagName);
  },
  // Add stopNodes for CDATA sections that shouldn't be parsed
  stopNodes: ['description', 'content:encoded', 'summary'],
  // Add processing instruction handling for XML declaration
  processEntities: true,
  htmlEntities: true
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
        
        // Note: Batch status now handled entirely by Durable Objects via /notify
        console.log(`🚀 WORKER: Processing batch ${batchId} with ${feeds.length} feeds`);

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

        // Batch completion status now handled entirely by Durable Objects
        console.log(`✅ WORKER: Batch ${batchId} completed - notifying Durable Object only`);

        // Notify Durable Object of completion
        if (env.BATCH_STATUS_DO) {
          try {
            console.log('🔔 WORKER: Notifying Durable Object of completion', { batchId, newEntriesCount: newEntries.entries.length });
            const durableObject = env.BATCH_STATUS_DO.get(env.BATCH_STATUS_DO.idFromName(batchId));
            await durableObject.fetch('https://worker/notify', {
              method: 'POST',
              body: JSON.stringify(result)
            });
            console.log('✅ WORKER: Successfully notified Durable Object');
          } catch (doError) {
            console.error('❌ WORKER: Durable Object notification failed:', doError);
          }
        } else {
          console.error('❌ WORKER: BATCH_STATUS_DO binding not available');
        }

        totalProcessed++;
        message.ack();
        
      } catch (messageError) {
        console.error('❌ WORKER: Error processing message:', messageError);
        
        // Error handling: Durable Objects will handle timeout/cleanup
        const batchId = message.body?.batchId;
        if (batchId) {
          console.log(`❌ WORKER: Batch ${batchId} failed - Durable Object will handle cleanup`);
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
  
  // 🎯 OPTIMIZED: API pre-filtered feeds, all feeds here need refreshing
  console.log(`🔄 WORKER: Processing ${feeds.length} pre-validated stale feeds in parallel batches`);
  
  // Process feeds in parallel batches
  const feedBatches = chunkArray(feeds, PARALLEL_BATCH_SIZE);
  
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
    // 🔒 OPTIMIZED: API pre-filtered stale feeds, acquire lock and process
    console.log(`🔄 WORKER: Processing pre-validated stale feed ${postTitle}`);
    
    const lockAcquired = await acquireFeedRefreshLock(feedUrl, env);
    if (!lockAcquired) {
      console.log(`🔒 WORKER: Feed ${postTitle} is being processed by another worker`);
      return null;
    }
    console.log(`✅ WORKER: Acquired lock for feed ${postTitle}: ${feedUrl}`);

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

// setBatchStatus function removed - batch status now handled entirely by Durable Objects
// This simplifies the architecture and removes redundant KV operations



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



// Helper function to safely extract text content (from rss.server.ts)
function getTextContent(node) {
  if (!node) return '';
  
  // Direct string
  if (typeof node === 'string') {
    return stripHtmlTags(node);
  }
  
  // Object with text content
  if (typeof node === 'object' && node !== null) {
    // fast-xml-parser puts text content in #text property
    if ('#text' in node) {
      return stripHtmlTags(String(node['#text'] || ''));
    }
    
    // CDATA content might be in __cdata with newer versions
    if ('__cdata' in node) {
      return stripHtmlTags(String(node['__cdata'] || ''));
    }
    
    // Some feeds use direct content
    if ('content' in node && typeof node.content === 'string') {
      return stripHtmlTags(node.content);
    }
    
    // For complex objects with both attributes and text
    if ('attr' in node && '#text' in node) {
      return stripHtmlTags(String(node['#text'] || ''));
    }
  }
  
  // Fallback to string conversion
  return stripHtmlTags(String(node || ''));
}

// Helper function to strip HTML tags (from rss.server.ts)
function stripHtmlTags(html) {
  if (!html) return '';
  
  // First replace common entities
  let text = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');
  
  // Replace multiple spaces with a single space
  text = text.replace(/\s+/g, ' ');
  
  // Trim leading/trailing whitespace
  return text.trim();
}

// Helper function to extract link from different formats (from rss.server.ts)
function getLink(node) {
  if (!node) return '';
  
  // Simple check if this is a podcast feed (has iTunes namespace elements)
  const isPodcast = Boolean(
    node['itunes:duration'] || 
    node['itunes:author'] || 
    node['itunes:subtitle'] || 
    node['itunes:explicit'] ||
    node['itunes:image']
  );
  
  // For podcasts, extract the audio file URL from enclosure
  if (isPodcast && node.enclosure) {
    // With our updated parser config, enclosure is always an array
    const enclosures = Array.isArray(node.enclosure) ? node.enclosure : [node.enclosure];
    
    // Try to find an audio enclosure first
    for (const enc of enclosures) {
      if (typeof enc !== 'object' || enc === null) continue;
      
      const enclosure = enc;
      // Direct attribute access with fast-xml-parser's @_ prefix
      if (enclosure['@_url']) {
        return String(enclosure['@_url']);
      }
      
      // Fallback to nested attr object if direct access fails
      if (enclosure.attr && typeof enclosure.attr === 'object') {
        const attr = enclosure.attr;
        if (attr['@_url']) {
          return String(attr['@_url']);
        }
      }
      
      // Last resort - check for url property
      if (enclosure.url) {
        return String(enclosure.url);
      }
    }
  }
  
  // For regular feeds (newsletters, blogs, etc.), extract the standard link
  
  // Case 1: Simple string link (common in many feeds)
  if (typeof node.link === 'string') {
    return node.link;
  }
  
  // Case 2: Link as object with text content
  if (typeof node.link === 'object' && node.link !== null && !Array.isArray(node.link)) {
    const linkObj = node.link;
    
    // Direct attribute access with fast-xml-parser's @_ prefix
    if (linkObj['@_href']) {
      return String(linkObj['@_href']);
    }
    
    // Fallback to nested attr object
    if (linkObj.attr && typeof linkObj.attr === 'object') {
      const attr = linkObj.attr;
      if (attr['@_href']) {
        return String(attr['@_href']);
      }
    }
    
    // Check for text content
    if (linkObj['#text']) {
      return String(linkObj['#text']);
    }
  }
  
  // Case 3: Array of links (with our updated parser config, link is always an array)
  if (Array.isArray(node.link) && node.link.length > 0) {
    // Try to find the main/alternate link first
    const mainLink = node.link.find(l => {
      if (typeof l !== 'object' || l === null) return false;
      const link = l;
      return link['@_rel'] === 'alternate' || !link['@_rel'];
    });
    
    if (mainLink && typeof mainLink === 'object') {
      // Direct attribute access
      if (mainLink['@_href']) {
        return String(mainLink['@_href']);
      }
      
      // Text content
      if (mainLink['#text']) {
        return String(mainLink['#text']);
      }
    }
    
    // Fallback to first link
    const firstLink = node.link[0];
    if (typeof firstLink === 'object' && firstLink !== null) {
      // Direct attribute access
      if (firstLink['@_href']) {
        return String(firstLink['@_href']);
      }
      
      // Nested attr object
      if (firstLink.attr && typeof firstLink.attr === 'object') {
        const attr = firstLink.attr;
        if (attr['@_href']) {
          return String(attr['@_href']);
        }
      }
      
      // Text content
      if (firstLink['#text']) {
        return String(firstLink['#text']);
      }
    }
    
    // String representation
    return String(node.link[0]);
  }
  
  // Fallback to guid if it's a URL
  if (typeof node.guid === 'string' && node.guid.startsWith('http')) {
    return node.guid;
  }
  
  return '';
}

// Helper function to extract image from item (comprehensive version from rss.server.ts)
function extractImage(item) {
  try {
    // Check for itunes:image (for podcasts)
    if (item['itunes:image']) {
      // Standard format with attr/@_href
      if (typeof item['itunes:image'] === 'object' && item['itunes:image'] !== null) {
        const itunesImage = item['itunes:image'];
        
        // Direct @_href attribute (common in libsyn feeds)
        if (itunesImage['@_href']) {
          return String(itunesImage['@_href']);
        }
        
        // Nested attr/@_href format
        if (itunesImage.attr && typeof itunesImage.attr === 'object') {
          const attr = itunesImage.attr;
          if (attr['@_href']) {
            return String(attr['@_href']);
          }
        }
        
        // Alternative format: url attribute directly on the object
        if (itunesImage.url) {
          return String(itunesImage.url);
        }
        
        // Alternative format: href directly on the object
        if (itunesImage.href) {
          return String(itunesImage.href);
        }
      }
      
      // Alternative format: direct string URL
      if (typeof item['itunes:image'] === 'string' && 
          item['itunes:image'].match(/^https?:\/\//)) {
        return item['itunes:image'];
      }
    }
    
    // Check for enclosures with image types
    if (item.enclosure) {
      const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
      
      for (const enc of enclosures) {
        if (typeof enc !== 'object' || enc === null) continue;
        
        const enclosure = enc;
        let enclosureUrl = null;
        
        // Check for URL in attr
        if (enclosure.attr && typeof enclosure.attr === 'object') {
          const attr = enclosure.attr;
          if (attr['@_url']) {
            enclosureUrl = String(attr['@_url']);
          }
        }
        
        // Check for direct URL
        if (!enclosureUrl && enclosure['@_url']) {
          enclosureUrl = String(enclosure['@_url']);
        }
        
        if (enclosureUrl) {
          // Check for image indicators in the URL
          if (
            // Check for common image extensions
            enclosureUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) ||
            // Check for URLs containing image-related terms
            /\/(image|img|photo|thumbnail|cover|banner|logo)s?\//i.test(enclosureUrl)
          ) {
            return enclosureUrl;
          }
        }
      }
    }
    
    // Check for image in content
    const contentFields = ['content', 'description', 'summary', 'content:encoded'];
    for (const field of contentFields) {
      const content = item[field];
      if (typeof content === 'string' && content.length > 0) {
        // Try different image tag patterns
        const patterns = [
          /<img[^>]+src=["']([^"']+)["']/i,
          /<img[^>]+src=([^ >]+)/i,
          /src=["']([^"']+\.(?:jpg|jpeg|png|gif|webp))["']/i
        ];
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            // Ignore data URLs
            if (!match[1].startsWith('data:')) {
              return match[1];
            }
          }
        }
      }
    }
    
    // Use the channelImage property we added in extractFeedData
    if (item.channelImage && typeof item.channelImage === 'string') {
      return item.channelImage;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to format date consistently (from rss.server.ts)
function formatDate(dateStr) {
  try {
    // If dateStr is empty or undefined, return current date
    if (!dateStr) {
      return new Date().toISOString();
    }
    
    // Special handling for PlanetScale date format
    if (typeof dateStr === 'string') {
      // Check if it's a MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (mysqlDateRegex.test(dateStr)) {
        // Convert MySQL datetime format to ISO format
        const [datePart, timePart] = dateStr.split(' ');
        const isoString = `${datePart}T${timePart}.000Z`;
        return isoString;
      }
    }
    
    // Handle PlanetScale's specific date format
    if (typeof dateStr === 'object' && dateStr !== null) {
      // If it's a Date object already, just return its ISO string
      if (dateStr instanceof Date) {
        return dateStr.toISOString();
      }
      
      // If it has a toISOString method, use it
      if ('toISOString' in dateStr && typeof dateStr.toISOString === 'function') {
        return dateStr.toISOString();
      }
      
      // If it has a toString method, use it and then parse
      if ('toString' in dateStr && typeof dateStr.toString === 'function') {
        dateStr = dateStr.toString();
      }
    }
    
    // Ensure we have a string before creating a Date
    const dateString = typeof dateStr === 'string' 
      ? dateStr 
      : dateStr instanceof Date
        ? dateStr.toISOString()
        : String(dateStr || '');
        
    // Handle common RSS date formats that JavaScript's Date constructor might struggle with
    let normalizedDateString = dateString;
    
    // Handle pubDate without timezone (add Z for UTC)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString)) {
      normalizedDateString = `${dateString}Z`;
    }
    
    // Handle pubDate with only date part
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      normalizedDateString = `${dateString}T00:00:00Z`;
    }
    
    // Create Date object from normalized string
    const date = new Date(normalizedDateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    
    // Return consistent ISO format
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function extractFeedData(parsedXML, feedUrl, mediaType) {
  // Handle both RSS and Atom formats (exactly like rss.server.ts)
  let channel, items = [];
  
  if (parsedXML.rss && parsedXML.rss.channel) {
    // RSS format
    channel = parsedXML.rss.channel;
    items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
  } else if (parsedXML.feed) {
    // Atom format
    channel = parsedXML.feed;
    items = Array.isArray(channel.entry) ? channel.entry : (channel.entry ? [channel.entry] : []);
  } else {
    throw new Error('Unsupported feed format');
  }
  
  // Extract channel-level image for fallback (exactly like rss.server.ts)
  let channelImage = null;
  
  // Check for channel-level iTunes image
  if (channel['itunes:image']) {
    if (typeof channel['itunes:image'] === 'object' && channel['itunes:image'] !== null) {
      const itunesImage = channel['itunes:image'];
      
      // Direct @_href attribute (common in libsyn feeds)
      if (itunesImage['@_href']) {
        channelImage = String(itunesImage['@_href']);
      } else if (itunesImage.attr && typeof itunesImage.attr === 'object') {
        const attr = itunesImage.attr;
        if (attr['@_href']) {
          channelImage = String(attr['@_href']);
        }
      }
    }
  }
  
  // Check for standard channel image
  if (!channelImage && channel.image) {
    if (typeof channel.image === 'object' && channel.image !== null) {
      const image = channel.image;
      if (image.url) {
        channelImage = String(image.url);
      }
    }
  }
  
  // Extract feed information (exactly like rss.server.ts)
  const feed = {
    title: getTextContent(channel.title),
    description: getTextContent(channel.description || channel.subtitle || ''),
    link: getLink(channel),
    mediaType,
    items: []
  };
  
  // Process items with comprehensive error handling (exactly like rss.server.ts)
  feed.items = items.map((item, index) => {
    try {
      // Add channel reference to item for image extraction
      if (channelImage) {
        item.channelImage = channelImage;
      }
      
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
      
      // Extract image with priority to item-level images
      const itemImage = extractImage(item);
      
      const processedItem = {
        title: getTextContent(item.title),
        description: getTextContent(item.description || item.summary || item.content || ''),
        link: getLink(item),
        guid: guid,
        pubDate: formatDate(item.pubDate || item.published || item.updated || new Date().toISOString()),
        image: itemImage || channelImage || undefined,
        mediaType, // Ensure mediaType is always set from the parent function
        feedUrl: feedUrl // Add the feedUrl property which is required by the RSSItem interface
      };
      
      return processedItem;
    } catch (itemError) {
      console.warn(`Error processing feed item ${index}: ${itemError}`);
      // Return a minimal valid item to prevent the entire feed from failing
      return {
        title: 'Error processing item',
        description: '',
        link: '',
        guid: `error-${Date.now()}-${Math.random()}`,
        pubDate: new Date().toISOString(),
        image: channelImage || undefined,
        mediaType, // Ensure even error items have the mediaType
        feedUrl: feedUrl // Add the feedUrl property here too
      };
    }
  }).filter((item) => {
    const isValid = Boolean(item.guid && item.title);
    if (!isValid) {
      console.warn(`Filtered out invalid item: guid=${item.guid}, title=${item.title}`);
    }
    return isValid;
  }); // Filter out invalid items
  
  // Ensure all items have the feed's mediaType if provided
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
      // Check if feed exists
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
      
      // Insert entries one by one to avoid multi-statement issues with Hyperdrive
      let insertedCount = 0;
      for (const entry of newEntries) {
        try {
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
          
          // Sanitize content to prevent multi-statement issues
          const sanitizeContent = (content) => {
            if (!content) return '';
            return String(content)
              .replace(/;/g, ',')      // Replace semicolons with commas
              .replace(/--/g, '-')     // Replace SQL comment markers
              .replace(/\/\*/g, '/')   // Replace SQL block comment start
              .replace(/\*\//g, '/')   // Replace SQL block comment end
              .slice(0, 200);
          };

          // Use escaped string query with sanitized content
          const insertQuery = `INSERT IGNORE INTO rss_entries (feed_id, guid, title, link, description, pub_date, image, media_type, created_at, updated_at) VALUES (${feedId}, ${connection.escape(entry.guid)}, ${connection.escape(sanitizeContent(entry.title))}, ${connection.escape(entry.link)}, ${connection.escape(sanitizeContent(entry.description))}, ${connection.escape(pubDateForMySQL)}, ${connection.escape(entry.image || null)}, ${connection.escape(mediaType || entry.mediaType || null)}, ${connection.escape(now)}, ${connection.escape(now)})`;
          
          await connection.query(insertQuery);
          insertedCount++;
        } catch (entryError) {
          console.warn(`⚠️ WORKER: Failed to insert entry ${entry.guid}:`, entryError);
          // Continue with other entries
        }
      }
      
      // 🔥 CRITICAL: Update last_fetched timestamp (separate query)
      const finalUpdateQuery = `UPDATE rss_feeds SET updated_at = ${connection.escape(now)}, last_fetched = ${currentTimeMs} WHERE id = ${feedId}`;
      await connection.query(finalUpdateQuery);
      
      console.log(`✅ WORKER: Inserted ${insertedCount} new entries and updated last_fetched for feedId ${feedId}`);
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ WORKER: Error storing RSS entries for feedId ${feedId}:`, error);
    throw error;
  }
}

async function getNewEntriesFromProcessedFeeds(processedFeeds, existingGuids, newestEntryDate, env) {
  console.log(`🔍 WORKER: Checking for new entries since ${newestEntryDate}`, { existingGuidsCount: existingGuids.length });
  
  try {
    // Use the mysql2 driver with Hyperdrive credentials
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
      // Query for entries created since the user's newest entry date (JOIN with feeds to get feedUrl for cache lookup)
      const since = new Date(newestEntryDate).toISOString().slice(0, 19).replace('T', ' ');
      const query = `
        SELECT e.guid, e.title, e.link, e.description, e.pub_date, e.image, e.media_type, e.created_at, f.feed_url as feedUrl
        FROM rss_entries e
        JOIN rss_feeds f ON e.feed_id = f.id
        WHERE e.created_at > ${connection.escape(since)}
        ORDER BY e.created_at DESC 
        LIMIT 50
      `;
      
      const [dbEntries] = await connection.query(query);
      console.log(`📊 WORKER: Found ${dbEntries.length} entries in database since ${since}`);
      
      // Filter out entries that the user already has
      const newEntries = dbEntries.filter(entry => !existingGuids.includes(entry.guid));
      console.log(`🆕 WORKER: ${newEntries.length} entries are truly new for this user`);
      
      if (newEntries.length > 0) {
        console.log(`🎯 WORKER: New entry GUIDs:`, newEntries.slice(0, 3).map(e => e.guid));
      }
      
      return {
        entries: newEntries,
        totalEntries: newEntries.length
      };
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error('❌ WORKER: Error checking for new entries:', error);
    
    // Fallback: check processed feeds only (old behavior)
    const allEntries = processedFeeds.flatMap(pf => pf.data.items);
    const newEntries = allEntries.filter(entry => !existingGuids.includes(entry.guid));
    
    return {
      entries: newEntries,
      totalEntries: newEntries.length
    };
  }
}

async function acquireFeedRefreshLock(feedUrl, env) {
  // BULLETPROOF: PlanetScale database-backed atomic lock using existing rss_locks table
  const lockKey = `feed:${feedUrl}`;
  const lockTimeoutMs = 10 * 60 * 1000; // 10 minutes
  
  console.log(`🔍 LOCK: Attempting PlanetScale lock for ${feedUrl}`);
  console.log(`🎯 LOCK: LockKey: ${lockKey}`);
  
  try {
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
      const expirationTime = now + lockTimeoutMs;
      const escapedLockKey = connection.escape(lockKey);
      
      // Step 1: Try to create a new lock (will fail if exists due to PRIMARY KEY)
      const insertQuery = `
        INSERT INTO rss_locks (lock_key, expires_at, created_at) 
        VALUES (${escapedLockKey}, ${expirationTime}, NOW())
      `;
      
      try {
        await connection.query(insertQuery);
        console.log(`🔒 LOCK: SUCCESS! PlanetScale lock acquired for ${feedUrl}`);
        return true;
        
      } catch (insertError) {
        // Lock already exists, check if it's expired
        console.log(`🔍 LOCK: Lock exists, checking expiration...`);
        
        const selectQuery = `
          SELECT lock_key, expires_at, created_at 
          FROM rss_locks 
          WHERE lock_key = ${escapedLockKey}
        `;
        
        const [lockRows] = await connection.query(selectQuery);
        
        if (lockRows.length === 0) {
          console.log(`🤔 LOCK: Race condition - lock disappeared, retrying...`);
          return false; // Retry
        }
        
        const existingLock = lockRows[0];
        const expiresAt = Number(existingLock.expires_at);
        
        if (now > expiresAt) {
          // Lock expired, try to take it over
          console.log(`⏰ LOCK: Expired lock found, attempting takeover...`);
          
          const updateQuery = `
            UPDATE rss_locks 
            SET expires_at = ${expirationTime}, created_at = NOW()
            WHERE lock_key = ${escapedLockKey} AND expires_at = ${expiresAt}
          `;
          
          const [updateResult] = await connection.query(updateQuery);
          
          if (updateResult.affectedRows > 0) {
            console.log(`🔒 LOCK: SUCCESS! Took over expired lock for ${feedUrl}`);
            return true;
          } else {
            console.log(`🚫 LOCK: Another worker took over the expired lock`);
            return false;
          }
          
        } else {
          const remainingMs = expiresAt - now;
          const remainingSeconds = Math.round(remainingMs / 1000);
          console.log(`🚫 LOCK: Valid lock exists for ${feedUrl} (${remainingSeconds}s remaining)`);
          return false;
        }
      }
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ LOCK: PlanetScale error acquiring lock for ${feedUrl}:`, error);
    return false;
  }
}

async function releaseFeedRefreshLock(feedUrl, env) {
  const lockKey = `feed:${feedUrl}`;
  console.log(`🔓 LOCK: Releasing PlanetScale lock for ${feedUrl}`);
  
  try {
    const connection = await mysql.createConnection({
      host: env.HYPERDRIVE.host,
      user: env.HYPERDRIVE.user,
      password: env.HYPERDRIVE.password,
      database: env.HYPERDRIVE.database,
      port: env.HYPERDRIVE.port,
      disableEval: true
    });
    
    try {
      const escapedLockKey = connection.escape(lockKey);
      const deleteQuery = `DELETE FROM rss_locks WHERE lock_key = ${escapedLockKey}`;
      
      const [result] = await connection.query(deleteQuery);
      
      if (result.affectedRows > 0) {
        console.log(`✅ LOCK: Successfully released PlanetScale lock for ${feedUrl}`);
      } else {
        console.log(`ℹ️ LOCK: No lock found to release for ${feedUrl}`);
      }
      
    } finally {
      await connection.end();
    }
    
  } catch (error) {
    console.error(`❌ LOCK: Error releasing PlanetScale lock for ${feedUrl}:`, error);
  }
}