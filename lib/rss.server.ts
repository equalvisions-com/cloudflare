import { connect, ExecutedQuery } from '@planetscale/database';
import { XMLParser } from 'fast-xml-parser';
import 'server-only';
import type { RSSItem } from './rss';
import { PlanetScaleQueryResult, RSSFeedRow, RSSEntryRow } from './types';

/**
 * NOTE on TypeScript linter errors:
 * 
 * This file contains several TypeScript linter errors related to accessing properties
 * on dynamically parsed XML data. These errors are expected due to the nature of
 * RSS/Atom feeds which can have widely varying structures and property names.
 * 
 * The code includes extensive runtime type checking to ensure safe operation despite
 * these linting warnings. Common errors include:
 * 
 * 1. "Property 'attr' does not exist on type '{}'"
 * 2. "Element implicitly has an 'any' type because expression of type '@_url' can't be used to index"
 * 
 * These errors occur because TypeScript cannot infer the shape of parsed XML objects.
 * Type assertions (as Record<string, unknown>) are used at key points to address
 * these issues without compromising type safety where it matters.
 */

// Define types for logging
type LogParams = string | number | boolean | object | null | undefined;

// Add a production-ready logging utility
const logger = {
  debug: (message: string, ...args: LogParams[]) => {
    // Only log debug messages in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔍 DEBUG: ${message}`, ...args);
    }
  },
  info: (message: string, ...args: LogParams[]) => {
    console.log(`ℹ️ INFO: ${message}`, ...args);
  },
  warn: (message: string, ...args: LogParams[]) => {
    console.warn(`⚠️ WARN: ${message}`, ...args);
  },
  error: (message: string, ...args: LogParams[]) => {
    console.error(`❌ ERROR: ${message}`, ...args);
  },
  cache: (message: string, ...args: LogParams[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`💾 CACHE: ${message}`, ...args);
    } else {
      // In production, only log cache misses or errors, not hits
      if (message.includes('error') || message.includes('miss') || message.includes('stale')) {
        console.log(`💾 CACHE: ${message}`, ...args);
      }
    }
  },
  external: (message: string, ...args: LogParams[]) => {
    // Always log external API calls in both environments
    console.log(`🌐 EXTERNAL: ${message}`, ...args);
  }
};

// Initialize parser once, not on every request
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

// Initialize PlanetScale connection
const connection = connect({
  url: process.env.DATABASE_URL,
  // PlanetScale handles connection pooling automatically
});

// Handle process termination
process.on('exit', () => {
  logger.info('Process exit: Application shutting down');
});

// Handle graceful shutdown for SIGINT and SIGTERM
process.on('SIGINT', () => {
  logger.info('SIGINT signal received: Application shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: Application shutting down');
  process.exit(0);
});

// Add error handling for database operations
const executeQuery = async <T = Record<string, unknown>>(
  query: string, 
  params: unknown[] = []
): Promise<PlanetScaleQueryResult<T>> => {
  try {
    const result = await connection.execute(query, params);
    return result as unknown as PlanetScaleQueryResult<T>;
  } catch (error) {
    logger.error(`Database query error: ${error}`);
    throw error;
  }
};

// Define interfaces for RSS item related types
// These interfaces are exported for use in other files
export interface MediaItem {
  "@_url"?: string;
  "@_medium"?: string;
  "@_type"?: string;
  attr?: {
    "@_url"?: string;
    "@_medium"?: string;
    "@_type"?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface EnclosureItem {
  "@_url"?: string;
  "@_type"?: string;
  "@_length"?: string;
  attr?: {
    "@_url"?: string;
    "@_type"?: string;
    "@_length"?: string;
    [key: string]: unknown;
  };
  url?: string;
  [key: string]: unknown;
}

export interface ItunesImage {
  "@_href"?: string;
  attr?: {
    "@_href"?: string;
    [key: string]: unknown;
  };
  url?: string;
  href?: string;
  [key: string]: unknown;
}

// Add RSSFeed interface definition
interface RSSFeed {
  title: string;
  description: string;
  link: string;
  items: RSSItem[];
  mediaType?: string;
}

// This is the parsed channel or feed object structure
interface ParsedChannel {
  title: string | Record<string, unknown>;
  description?: string | Record<string, unknown>;
  subtitle?: string | Record<string, unknown>;
  link?: string | Record<string, unknown> | Array<Record<string, unknown>>;
  item?: Record<string, unknown>[];
  entry?: Record<string, unknown>[];
  [key: string]: unknown;
}

// Add a simple in-memory cache for parsed XML
// This will avoid re-parsing the same feed multiple times in a short period
interface ParsedXMLCacheEntry {
  timestamp: number;
  result: Record<string, unknown>;
}

const parsedXMLCache = new Map<string, ParsedXMLCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Define a type for the parsed XML result
interface ParsedXML {
  rss?: {
    channel: ParsedChannel;
    [key: string]: unknown;
  };
  feed?: ParsedChannel;
  [key: string]: unknown;
}

// Function to parse XML with caching
function parseXMLWithCache(xml: string, url: string): ParsedXML {
  const currentTime = Date.now();
  const cacheKey = `${url}:${xml.length}`;
  
  // Check if we have a valid cached result
  const cachedEntry = parsedXMLCache.get(cacheKey);
  if (cachedEntry && (currentTime - cachedEntry.timestamp) < CACHE_TTL) {
    logger.cache(`Using cached parsed XML for ${url}`);
    return cachedEntry.result as ParsedXML;
  }
  
  // Parse the XML
  logger.debug(`Parsing XML for ${url}`);
  const result = parser.parse(xml);
  
  // Cache the result
  parsedXMLCache.set(cacheKey, {
    timestamp: currentTime,
    result
  });
  
  // Clean up old cache entries periodically
  if (Math.random() < 0.1) { // 10% chance to clean up on each parse
    cleanupCache();
  }
  
  return result as ParsedXML;
}

// Function to clean up old cache entries
function cleanupCache(): void {
  const currentTime = Date.now();
  let deletedCount = 0;
  
  for (const [key, entry] of parsedXMLCache.entries()) {
    if ((currentTime - entry.timestamp) > CACHE_TTL) {
      parsedXMLCache.delete(key);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    logger.debug(`Cleaned up ${deletedCount} expired cache entries`);
  }
}

// Function to create a fallback feed when there's an error
function createFallbackFeed(url: string, error: unknown, mediaType?: string): RSSFeed {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.warn(`Creating fallback feed for ${url} due to error: ${errorMessage}`);
  
  return {
    title: `Error fetching feed from ${url}`,
    description: `There was an error fetching the feed: ${errorMessage}`,
    link: url,
    mediaType,
    items: [{
      title: 'Error fetching feed',
      description: `There was an error fetching the feed from ${url}: ${errorMessage}`,
      link: url,
      guid: `error-${Date.now()}`,
      pubDate: new Date().toISOString(),
      image: undefined,
      mediaType,
      feedUrl: url
    }]
  };
}

// Function to fetch and parse RSS feed
async function fetchAndParseFeed(url: string, mediaType?: string): Promise<RSSFeed> {
  try {
    // Fetch the feed with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    logger.external(`Fetching feed from ${url}`);
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    logger.debug(`Received ${xml.length} bytes from ${url}`);
    
    if (xml.length < 100) {
      logger.warn(`Suspiciously small XML response from ${url}: ${xml.substring(0, 100)}`);
    }
    
    // Special handling for Libsyn feeds which have a specific format for iTunes images
    const isLibsynFeed = url.includes('libsyn.com');
    if (isLibsynFeed) {
      logger.debug('Detected Libsyn feed, using special handling for iTunes images');
    }
    
    try {
      // Use our cached parser function
      const result = parseXMLWithCache(xml, url);
      
      logger.debug(`Parsed XML structure: ${Object.keys(result).join(', ')}`);
      
      // Handle both RSS and Atom formats
      let channel: ParsedChannel;
      let items: Record<string, unknown>[] = [];
      
      if (result.rss && result.rss.channel) {
        // RSS format
        channel = result.rss.channel as ParsedChannel;
        items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
        logger.debug(`Detected RSS format with ${items.length} items`);
      } else if (result.feed) {
        // Atom format
        channel = result.feed as ParsedChannel;
        items = Array.isArray(channel.entry) ? channel.entry : (channel.entry ? [channel.entry] : []);
        logger.debug(`Detected Atom format with ${items.length} items`);
      } else {
        logger.warn(`Unrecognized feed format. Available keys: ${Object.keys(result).join(', ')}`);
        throw new Error('Unsupported feed format');
      }
      
      // Extract channel-level image for fallback
      let channelImage: string | null = null;
      
      // Check for channel-level iTunes image
      if (channel['itunes:image']) {
        if (typeof channel['itunes:image'] === 'object' && channel['itunes:image'] !== null) {
          const itunesImage = channel['itunes:image'] as Record<string, unknown>;
          
          // Direct @_href attribute (common in libsyn feeds)
          if (itunesImage['@_href']) {
            channelImage = String(itunesImage['@_href']);
            logger.debug(`Found channel iTunes image with direct @_href: ${channelImage}`);
          } else if (itunesImage.attr && typeof itunesImage.attr === 'object') {
            const attr = itunesImage.attr as Record<string, unknown>;
            if (attr['@_href']) {
              channelImage = String(attr['@_href']);
              logger.debug(`Found channel iTunes image with attr/@_href: ${channelImage}`);
            }
          }
        }
      }
      
      // Check for standard channel image
      if (!channelImage && channel.image) {
        if (typeof channel.image === 'object' && channel.image !== null) {
          const image = channel.image as Record<string, unknown>;
          if (image.url) {
            channelImage = String(image.url);
            logger.debug(`Found standard channel image: ${channelImage}`);
          }
        }
      }
      
      // Extract feed information
      const feed: RSSFeed = {
        title: getTextContent(channel.title),
        description: getTextContent(channel.description || channel.subtitle || ''),
        link: getLink(channel),
        mediaType,
        items: []
      };
      
      logger.debug(`Feed title: "${feed.title}", description length: ${feed.description.length}, link: ${feed.link}`);
      
      // For Libsyn feeds, try to extract item-level iTunes images from the raw XML
      const itemItunesImages: Record<string, string> = {};
      if (isLibsynFeed) {
        // Extract item-level iTunes images using regex
        const itemImageMatches = xml.matchAll(/<item>[\s\S]*?<itunes:image href="([^"]+)"[\s\S]*?<guid[^>]*>([^<]+)<\/guid>/gi);
        for (const match of itemImageMatches) {
          if (match[1] && match[2]) {
            const imageUrl = match[1];
            const guid = match[2];
            itemItunesImages[guid] = imageUrl;
            logger.debug(`Found item-level iTunes image for guid ${guid}: ${imageUrl}`);
          }
        }
      }
      
      // Process items with error handling for each item
      feed.items = items.map((item: Record<string, unknown>, index: number) => {
        try {
          // Add channel reference to item for image extraction
          if (channelImage) {
            item.channelImage = channelImage;
          }
          
          // For Libsyn feeds, add the item-level iTunes image if we found it
          const itemGuid = getTextContent(item.guid || item.id || item.link);
          if (isLibsynFeed && itemItunesImages[itemGuid]) {
            // Add the image URL directly to the item
            if (!item['itunes:image']) {
              item['itunes:image'] = { '@_href': itemItunesImages[itemGuid] };
              logger.debug(`Added item-level iTunes image for guid ${itemGuid}: ${itemItunesImages[itemGuid]}`);
            }
          }
          
          // Extract image with priority to item-level images
          const itemImage = extractImage(item);
          
          const processedItem: RSSItem = {
            title: getTextContent(item.title),
            description: getTextContent(item.description || item.summary || item.content || ''),
            link: getLink(item),
            guid: itemGuid,
            pubDate: formatDate(item.pubDate || item.published || item.updated || new Date().toISOString()),
            image: itemImage || channelImage || undefined,
            mediaType,
            feedUrl: url // Add the feedUrl property which is required by the RSSItem interface
          };
          
          if (index < 2) {
            logger.debug(`Sample item ${index}: title="${processedItem.title}", guid=${processedItem.guid}, link=${processedItem.link}, image=${processedItem.image}`);
          }
          
          return processedItem;
        } catch (itemError) {
          logger.warn(`Error processing feed item ${index}: ${itemError}`);
          // Return a minimal valid item to prevent the entire feed from failing
          return {
            title: 'Error processing item',
            description: '',
            link: '',
            guid: `error-${Date.now()}-${Math.random()}`,
            pubDate: new Date().toISOString(),
            image: channelImage || undefined,
            mediaType,
            feedUrl: url // Add the feedUrl property here too
          };
        }
      }).filter((item: RSSItem) => {
        const isValid = Boolean(item.guid && item.title);
        if (!isValid) {
          logger.warn(`Filtered out invalid item: guid=${item.guid}, title=${item.title}`);
        }
        return isValid;
      }); // Filter out invalid items
      
      logger.info(`Successfully parsed feed from ${url} with ${feed.items.length} valid items`);
      return feed;
    } catch (parseError) {
      logger.error(`XML parsing error for ${url}: ${parseError}`);
      logger.debug(`First 500 characters of XML: ${xml.substring(0, 500).replace(/\n/g, ' ')}`);
      throw parseError;
    }
  } catch (error) {
    logger.error(`Error fetching feed from ${url}: ${error}`);
    // Return a fallback feed instead of throwing
    return createFallbackFeed(url, error, mediaType);
  }
}

// Helper function to safely extract text content
function getTextContent(node: unknown): string {
  if (!node) return '';
  
  // Direct string
  if (typeof node === 'string') {
    return stripHtmlTags(node);
  }
  
  // Object with text content
  if (typeof node === 'object' && node !== null) {
    const nodeObj = node as Record<string, unknown>;
    
    // fast-xml-parser puts text content in #text property
    if ('#text' in nodeObj) {
      return stripHtmlTags(String(nodeObj['#text'] || ''));
    }
    
    // CDATA content might be in __cdata with newer versions
    if ('__cdata' in nodeObj) {
      return stripHtmlTags(String(nodeObj['__cdata'] || ''));
    }
    
    // Some feeds use direct content
    if ('content' in nodeObj && typeof nodeObj.content === 'string') {
      return stripHtmlTags(nodeObj.content);
    }
    
    // For complex objects with both attributes and text
    if ('attr' in nodeObj && '#text' in nodeObj) {
      return stripHtmlTags(String(nodeObj['#text'] || ''));
    }
  }
  
  // Fallback to string conversion
  return stripHtmlTags(String(node || ''));
}

// Helper function to strip HTML tags
function stripHtmlTags(html: string): string {
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

// Helper function to extract link from different formats
function getLink(node: Record<string, unknown>): string {
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
      
      const enclosure = enc as Record<string, unknown>;
      // Direct attribute access with fast-xml-parser's @_ prefix
      if (enclosure['@_url']) {
        return String(enclosure['@_url']);
      }
      
      // Fallback to nested attr object if direct access fails
      if (enclosure.attr && typeof enclosure.attr === 'object') {
        const attr = enclosure.attr as Record<string, unknown>;
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
    const linkObj = node.link as Record<string, unknown>;
    
    // Direct attribute access with fast-xml-parser's @_ prefix
    if (linkObj['@_href']) {
      return String(linkObj['@_href']);
    }
    
    // Fallback to nested attr object
    if (linkObj.attr && typeof linkObj.attr === 'object') {
      const attr = linkObj.attr as Record<string, unknown>;
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
      const link = l as Record<string, unknown>;
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
        const attr = firstLink.attr as Record<string, unknown>;
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

// Helper function to extract image from item
function extractImage(item: Record<string, unknown>): string | null {
  try {
    // First, check for enclosures with image types for all feed types (podcast or not)
    if (item.enclosure) {
      // With our updated parser config, enclosure is always an array
      const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
      
      // First pass: Look specifically for image type enclosures
      for (const enc of enclosures) {
        if (typeof enc !== 'object' || enc === null) continue;
        
        const enclosure = enc as Record<string, unknown>;
        let isImageEnclosure = false;
        let enclosureUrl: string | null = null;
        
        // Check if it's an image type enclosure
        if (enclosure.attr && typeof enclosure.attr === 'object') {
          const attr = enclosure.attr as Record<string, unknown>;
          if (attr['@_type'] && String(attr['@_type']).startsWith('image/')) {
            isImageEnclosure = true;
          }
          
          if (attr['@_url']) {
            enclosureUrl = String(attr['@_url']);
          }
        }
        
        // Direct attribute access
        if (!isImageEnclosure && enclosure['@_type'] && String(enclosure['@_type']).startsWith('image/')) {
          isImageEnclosure = true;
        }
        
        if (!enclosureUrl && enclosure['@_url']) {
          enclosureUrl = String(enclosure['@_url']);
        }
        
        // If we found an image enclosure with a URL, return it immediately
        if (isImageEnclosure && enclosureUrl) {
          logger.debug(`Found image enclosure with URL: ${enclosureUrl}`);
          return enclosureUrl;
        }
        
        // Check for image URL by extension even if type is not specified
        if (enclosureUrl && enclosureUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i)) {
          logger.debug(`Found enclosure with image extension: ${enclosureUrl}`);
          return enclosureUrl;
        }
      }
    }
    
    // Debug logging for podcast feeds
    if (item['itunes:image']) {
      logger.debug(`Found itunes:image in item: ${JSON.stringify(item['itunes:image']).substring(0, 200)}`);
    }
    
    // Check for itunes:image (for podcasts)
    if (item['itunes:image']) {
      // Standard format with attr/@_href
      if (typeof item['itunes:image'] === 'object' && item['itunes:image'] !== null) {
        const itunesImage = item['itunes:image'] as Record<string, unknown>;
        
        // Direct @_href attribute (common in libsyn feeds)
        if (itunesImage['@_href']) {
          logger.debug(`Using direct @_href attribute: ${itunesImage['@_href']}`);
          return String(itunesImage['@_href']);
        }
        
        // Nested attr/@_href format
        if (itunesImage.attr && typeof itunesImage.attr === 'object') {
          const attr = itunesImage.attr as Record<string, unknown>;
          if (attr['@_href']) {
            logger.debug(`Using nested attr/@_href format: ${attr['@_href']}`);
            return String(attr['@_href']);
          }
        }
        
        // Alternative format: url attribute directly on the object
        if (itunesImage.url) {
          logger.debug(`Using url attribute: ${itunesImage.url}`);
          return String(itunesImage.url);
        }
        
        // Alternative format: href directly on the object
        if (itunesImage.href) {
          logger.debug(`Using href attribute: ${itunesImage.href}`);
          return String(itunesImage.href);
        }
        
        // Log all keys for debugging
        logger.debug(`iTunes image keys: ${Object.keys(itunesImage).join(', ')}`);
      }
      
      // Alternative format: direct string URL
      if (typeof item['itunes:image'] === 'string' && 
          item['itunes:image'].match(/^https?:\/\//)) {
        logger.debug(`Using direct string URL: ${item['itunes:image']}`);
        return item['itunes:image'];
      }
    }
    
    // Also check for iTunes image at the channel level which may be stored with the item
    if (item['itunes:image:href'] && typeof item['itunes:image:href'] === 'string') {
      logger.debug(`Using itunes:image:href: ${item['itunes:image:href']}`);
      return item['itunes:image:href'];
    }

    // Check for media:content
    if (item['media:content']) {
      if (Array.isArray(item['media:content'])) {
        // Find the first image in the array
        for (const media of item['media:content']) {
          if (typeof media === 'object' && media !== null) {
            const mediaObj = media as Record<string, unknown>;
            if (mediaObj.attr && typeof mediaObj.attr === 'object') {
              const attr = mediaObj.attr as Record<string, unknown>;
              if ((attr['@_medium'] === 'image') || 
                  (attr['@_type'] && String(attr['@_type']).startsWith('image/'))) {
                if (attr['@_url']) return String(attr['@_url']);
              }
            }
          }
        }
      } else if (typeof item['media:content'] === 'object' && item['media:content'] !== null) {
        const mediaContent = item['media:content'] as Record<string, unknown>;
        if (mediaContent.attr && typeof mediaContent.attr === 'object') {
          const attr = mediaContent.attr as Record<string, unknown>;
          if (attr['@_url']) {
            // Make sure it's not an audio file
            if (attr['@_medium'] === 'image' || 
                (attr['@_type'] && String(attr['@_type']).startsWith('image/'))) {
              return String(attr['@_url']);
            }
          }
        }
      }
    }
    
    // Check for media:thumbnail
    if (item['media:thumbnail']) {
      if (Array.isArray(item['media:thumbnail'])) {
        const thumbnail = item['media:thumbnail'][0] as Record<string, unknown>;
        if (thumbnail && thumbnail.attr && typeof thumbnail.attr === 'object') {
          const attr = thumbnail.attr as Record<string, unknown>;
          if (attr['@_url']) return String(attr['@_url']);
        }
      } else if (typeof item['media:thumbnail'] === 'object' && item['media:thumbnail'] !== null) {
        const thumbnail = item['media:thumbnail'] as Record<string, unknown>;
        if (thumbnail.attr && typeof thumbnail.attr === 'object') {
          const attr = thumbnail.attr as Record<string, unknown>;
          if (attr['@_url']) return String(attr['@_url']);
        }
      }
    }
    
    // Second pass for enclosures: check for any URL that looks like an image
    if (item.enclosure) {
      const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
      
      for (const enc of enclosures) {
        if (typeof enc !== 'object' || enc === null) continue;
        
        const enclosure = enc as Record<string, unknown>;
        let enclosureUrl: string | null = null;
        
        // Check for URL in attr
        if (enclosure.attr && typeof enclosure.attr === 'object') {
          const attr = enclosure.attr as Record<string, unknown>;
          if (attr['@_url']) {
            enclosureUrl = String(attr['@_url']);
          }
        }
        
        // Check for direct URL
        if (!enclosureUrl && enclosure['@_url']) {
          enclosureUrl = String(enclosure['@_url']);
        }
        
        // Check for url property
        if (!enclosureUrl && enclosure.url) {
          enclosureUrl = String(enclosure.url);
        }
        
        if (enclosureUrl) {
          // Skip audio files
          if (enclosure['@_type'] && String(enclosure['@_type']).startsWith('audio/')) {
            continue;
          }
          
          if (enclosure.attr && typeof enclosure.attr === 'object') {
            const attr = enclosure.attr as Record<string, unknown>;
            if (attr['@_type'] && String(attr['@_type']).startsWith('audio/')) {
              continue;
            }
          }
          
          // Skip audio files by extension
          if (enclosureUrl.match(/\.(mp3|m4a|wav|ogg|flac)($|\?)/i)) {
            continue;
          }
          
          // Check for image indicators in the URL
          if (
            // Check for common image extensions
            enclosureUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) ||
            // Check for URLs containing image-related terms
            /\/(image|img|photo|thumbnail|cover|banner|logo)s?\//i.test(enclosureUrl) ||
            // Check for CDN image providers
            /cdn(-cgi)?\/image/i.test(enclosureUrl)
          ) {
            logger.debug(`Found image URL in enclosure: ${enclosureUrl}`);
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
              logger.debug(`Extracted image from content field ${field}: ${match[1].substring(0, 100)}`);
              return match[1];
            }
          }
        }
      }
    }
    
    // Use the channelImage property we added in fetchAndParseFeed
    if (item.channelImage && typeof item.channelImage === 'string') {
      return item.channelImage;
    }
    
    // Try to get channel-level image as a last resort
    if (item.channel && typeof item.channel === 'object' && item.channel !== null) {
      const channel = item.channel as Record<string, unknown>;
      
      // Check for channel image
      if (channel.image && typeof channel.image === 'object' && channel.image !== null) {
        const image = channel.image as Record<string, unknown>;
        if (image.url) return String(image.url);
      }
      
      // Check for channel itunes:image
      if (channel['itunes:image'] && typeof channel['itunes:image'] === 'object' && channel['itunes:image'] !== null) {
        const itunesImage = channel['itunes:image'] as Record<string, unknown>;
        if (itunesImage.attr && typeof itunesImage.attr === 'object') {
          const attr = itunesImage.attr as Record<string, unknown>;
          if (attr['@_href']) return String(attr['@_href']);
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.warn(`Error extracting image: ${error}`);
    return null;
  }
}

// Helper function to format date consistently
function formatDate(dateStr: unknown): string {
  try {
    // If dateStr is empty or undefined, return current date
    if (!dateStr) {
      logger.warn(`Empty date value encountered, falling back to current date`);
      return new Date().toISOString();
    }
    
    // Add detailed debugging for the date value
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`Formatting date: ${dateStr}, type: ${typeof dateStr}, constructor: ${dateStr.constructor?.name}`);
    }
    
    // Special handling for PlanetScale date format
    // PlanetScale returns dates as strings in MySQL format: YYYY-MM-DD HH:MM:SS
    if (typeof dateStr === 'string') {
      // Check if it's a MySQL datetime format (YYYY-MM-DD HH:MM:SS)
      const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (mysqlDateRegex.test(dateStr)) {
        // Convert MySQL datetime format to ISO format
        const [datePart, timePart] = dateStr.split(' ');
        const isoString = `${datePart}T${timePart}.000Z`;
        logger.debug(`Converted MySQL datetime to ISO: ${isoString}`);
        return isoString;
      }
    }
    
    // Handle PlanetScale's specific date format
    // PlanetScale might return dates in a different format than mysql2
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
    
    // Handle RFC 822/RFC 2822 format (e.g., "Wed, 12 Dec 2018 14:00:00 -0000")
    const rfc822Regex = /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+)(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4}|[A-Z]{3,4})$/;
    if (rfc822Regex.test(dateString)) {
      // JavaScript's Date constructor should handle this format, but let's log for debugging
      logger.debug(`Parsing RFC 822 date format: ${dateString}`);
    }
    
    // Handle pubDate without timezone (add Z for UTC)
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString)) {
      normalizedDateString = `${dateString}Z`;
      logger.debug(`Added Z suffix to ISO date without timezone: ${normalizedDateString}`);
    }
    
    // Handle pubDate with only date part
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      normalizedDateString = `${dateString}T00:00:00Z`;
      logger.debug(`Added time component to date-only string: ${normalizedDateString}`);
    }
    
    // Create Date object from normalized string
    const date = new Date(normalizedDateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      logger.warn(`Invalid date format encountered: ${dateString}, falling back to current date`);
      return new Date().toISOString();
    }
    
    // Return consistent ISO format
    return date.toISOString();
  } catch {
    // Log the specific error for debugging
    logger.warn(`Error parsing date "${dateStr}": falling back to current date`);
    // We don't use the error, just return a default date
    return new Date().toISOString();
  }
}

// Function to get or create a feed in PlanetScale
async function getOrCreateFeed(feedUrl: string, postTitle: string, mediaType?: string): Promise<number> {
  try {
    // Check if feed exists
    const result = await executeQuery<RSSFeedRow>(
      'SELECT id FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    if (result.rows.length > 0) {
      // If feed exists and mediaType is provided, update the mediaType
      if (mediaType) {
        await executeQuery(
          'UPDATE rss_feeds SET media_type = ? WHERE feed_url = ?',
          [mediaType, feedUrl]
        );
      }
      return Number(result.rows[0].id);
    }
    
    // Create new feed
    // Format date in MySQL format (YYYY-MM-DD HH:MM:SS)
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const currentTimeMs = Date.now(); // Use milliseconds for last_fetched (bigint column)
    
    logger.debug(`Creating new feed with date: ${now}, timestamp: ${currentTimeMs}`);
    
    const insertResult = await executeQuery(
      'INSERT INTO rss_feeds (feed_url, title, media_type, last_fetched, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [feedUrl, postTitle, mediaType || null, currentTimeMs, now, now]
    );
    
    return Number(insertResult.insertId);
  } catch (error) {
    logger.error(`Error getting or creating feed for ${feedUrl}: ${error}`);
    throw error;
  }
}

// Function to execute a batch of operations in a transaction
async function executeBatchTransaction<T = ExecutedQuery>(
  operations: Array<{ query: string; params: unknown[] }>
): Promise<T[]> {
  try {
    // PlanetScale's transaction API is different from mysql2
    const results: T[] = [];
    
    // Use the transaction method provided by PlanetScale
    await connection.transaction(async (tx) => {
      for (const op of operations) {
        const result = await tx.execute(op.query, op.params);
        results.push(result as unknown as T);
      }
    });
    
    return results;
  } catch (error) {
    logger.error(`Transaction error: ${error}`);
    throw error;
  }
}

// Function to store RSS entries with transaction support
async function storeRSSEntriesWithTransaction(feedId: number, entries: RSSItem[], mediaType?: string): Promise<void> {
  try {
    if (entries.length === 0) return;
    
    // Get all existing entries in one query
    const existingEntriesResult = await executeQuery<{ guid: string }>(
      'SELECT guid FROM rss_entries WHERE feed_id = ?',
      [feedId]
    );
    
    // Create a Set for faster lookups
    const existingGuids = new Set((existingEntriesResult.rows as Array<{ guid: string }>).map(row => row.guid));
    
    // Filter entries that don't exist yet
    const newEntries = entries.filter(entry => !existingGuids.has(entry.guid));
    
    if (newEntries.length === 0) {
      logger.debug(`No new entries to insert for feed ${feedId}`);
      
      // Just update the last_fetched timestamp
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const currentTimeMs = Date.now();
      await executeQuery(
        'UPDATE rss_feeds SET updated_at = ?, last_fetched = ? WHERE id = ?',
        [now, currentTimeMs, feedId]
      );
      return;
    }
    
    // Prepare batch operations
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const currentTimeMs = Date.now();
    
    // Split into chunks of 100 entries to avoid too large queries
    const chunkSize = 100;
    const chunks = [];
    
    for (let i = 0; i < newEntries.length; i += chunkSize) {
      chunks.push(newEntries.slice(i, i + chunkSize));
    }
    
    // Create operations for each chunk
    const operations = chunks.map(chunk => {
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = chunk.flatMap(entry => {
        // Ensure pubDate is properly formatted for MySQL
        let pubDateForMySQL: string;
        try {
          const date = new Date(entry.pubDate);
          if (isNaN(date.getTime())) {
            pubDateForMySQL = new Date().toISOString().slice(0, 19).replace('T', ' ');
          } else {
            pubDateForMySQL = date.toISOString().slice(0, 19).replace('T', ' ');
          }
        } catch {
          pubDateForMySQL = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
        
        return [
          Number(feedId),
          String(entry.guid),
          String(entry.title),
          String(entry.link),
          String(entry.description?.slice(0, 200) || ''),
          pubDateForMySQL,
          entry.image ? String(entry.image) : null,
          entry.mediaType || mediaType || null,
          String(now),
          String(now)
        ];
      });
      
      return {
        query: `INSERT INTO rss_entries (feed_id, guid, title, link, description, pub_date, image, media_type, created_at, updated_at) VALUES ${placeholders}`,
        params: values
      };
    });
    
    // Add the update operation
    operations.push({
      query: 'UPDATE rss_feeds SET updated_at = ?, last_fetched = ? WHERE id = ?',
      params: [now, currentTimeMs, feedId]
    });
    
    // Execute all operations in a transaction
    await executeBatchTransaction(operations);
    logger.info(`Batch inserted ${newEntries.length} entries for feed ${feedId} in ${chunks.length} chunks`);
  } catch (error) {
    logger.error(`Error storing RSS entries with transaction for feed ${feedId}: ${error}`);
    throw error;
  }
}

// Add a new function to acquire a lock
async function acquireFeedRefreshLock(feedUrl: string): Promise<boolean> {
  try {
    // Use an atomic INSERT operation to acquire a lock
    // If another process already has the lock, this will fail with a duplicate key error
    const lockKey = `refresh_lock:${feedUrl}`;
    const expiryTime = Date.now() + 60000; // Lock expires after 60 seconds
    
    // Format date in MySQL format (YYYY-MM-DD HH:MM:SS)
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    logger.debug(`Acquiring lock with key: ${lockKey}, expiry: ${expiryTime}, created_at: ${now}`);
    
    const result = await executeQuery(
      'INSERT INTO rss_locks (lock_key, expires_at, created_at) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE lock_key = IF(expires_at < ?, VALUES(lock_key), lock_key), ' +
      'expires_at = IF(expires_at < ?, VALUES(expires_at), expires_at)',
      [lockKey, expiryTime, now, Date.now(), expiryTime]
    );
    
    // If rows affected is 1, we acquired the lock
    // If rows affected is 0, someone else has the lock
    return result.rowsAffected > 0;
  } catch (error) {
    logger.error(`Error acquiring lock for ${feedUrl}: ${error}`);
    // In case of error, assume we don't have the lock
    return false;
  }
}

// Function to release a lock
async function releaseFeedRefreshLock(feedUrl: string): Promise<void> {
  try {
    const lockKey = `refresh_lock:${feedUrl}`;
    await executeQuery('DELETE FROM rss_locks WHERE lock_key = ?', [lockKey]);
  } catch {
    logger.error(`Error releasing lock for ${feedUrl}`);
  }
}

// Get RSS entries with caching
export async function getRSSEntries(
  postTitle: string, 
  feedUrl: string, 
  mediaType?: string,
  page: number = 1,
  pageSize: number = 10
): Promise<{ entries: RSSItem[], totalCount: number, hasMore: boolean }> {
  try {
    logger.info(`Checking for RSS feed: ${postTitle} (${feedUrl})`);
    
    // Check if we have recent entries in the database
    const feedsResult = await executeQuery<RSSFeedRow>(
      'SELECT id, feed_url, title, updated_at, last_fetched FROM rss_feeds WHERE feed_url = ?',
      [feedUrl]
    );
    
    const currentTime = Date.now();
    let feedId: number;
    let shouldFetchFresh = true;
    
    if (feedsResult.rows.length > 0) {
      // Use type assertion to ensure TypeScript knows rows is an array of RSSFeedRow
      const feeds = feedsResult.rows as RSSFeedRow[];
      feedId = Number(feeds[0].id);
      // Check if feed was fetched recently (less than 4 hours ago)
      const lastFetchedMs = Number(feeds[0].last_fetched);
      const timeSinceLastFetch = currentTime - lastFetchedMs;
      const fourHoursInMs = 4 * 60 * 60 * 1000;
      
      if (timeSinceLastFetch < fourHoursInMs) {
        shouldFetchFresh = false;
        logger.cache(`Using cached data for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
      } else {
        logger.cache(`Data is stale for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
      }
    } else {
      // Create new feed
      logger.cache(`No existing data for ${postTitle}, creating new feed entry`);
      feedId = await getOrCreateFeed(feedUrl, postTitle, mediaType);
    }
    
    // If we need fresh data, fetch it
    if (shouldFetchFresh) {
      // Try to acquire a lock before fetching fresh data
      const lockAcquired = await acquireFeedRefreshLock(feedUrl);
      
      if (lockAcquired) {
        try {
          logger.debug(`Acquired refresh lock for ${postTitle}`);
          
          // Double-check if someone else refreshed while we were acquiring the lock
          const refreshCheckResult = await executeQuery<RSSFeedRow>(
            'SELECT last_fetched FROM rss_feeds WHERE feed_url = ?',
            [feedUrl]
          );
          
          if (refreshCheckResult.rows.length > 0) {
            // Use type assertion to ensure TypeScript knows rows is an array of RSSFeedRow
            const refreshCheck = refreshCheckResult.rows as RSSFeedRow[];
            const lastFetchedMs = Number(refreshCheck[0].last_fetched);
            const timeSinceLastFetch = currentTime - lastFetchedMs;
            const fourHoursInMs = 4 * 60 * 60 * 1000;
            
            if (timeSinceLastFetch < fourHoursInMs) {
              // Someone else refreshed the data while we were acquiring the lock
              logger.debug(`Another process refreshed the data for ${postTitle} while we were acquiring the lock`);
              shouldFetchFresh = false;
            }
          }
          
          if (shouldFetchFresh) {
            try {
              const freshFeed = await fetchAndParseFeed(feedUrl, mediaType);
              
              if (freshFeed.items.length > 0) {
                logger.info(`Storing ${freshFeed.items.length} fresh entries for ${postTitle}`);
                await storeRSSEntriesWithTransaction(feedId, freshFeed.items, mediaType);
              } else {
                logger.warn(`Feed ${postTitle} returned 0 items, not updating database`);
              }
            } catch (fetchError) {
              logger.error(`Error fetching feed ${postTitle}: ${fetchError}`);
              // Continue execution to return whatever data we have in the database
            }
          }
        } finally {
          // Always release the lock when done
          await releaseFeedRefreshLock(feedUrl);
          logger.debug(`Released refresh lock for ${postTitle}`);
        }
      } else {
        logger.info(`Another process is currently refreshing data for ${postTitle}, using existing data`);
        // Another process is refreshing, we'll use whatever data is available
      }
    }
    
    // Calculate pagination values
    const offset = (page - 1) * pageSize;
    
    // First get the total count of entries
    const countResult = await executeQuery<{ total: number }>(
      'SELECT COUNT(*) as total FROM rss_entries WHERE feed_id = ?',
      [feedId]
    );
    
    const totalCount = Number((countResult.rows[0] as { total: number }).total);
    
    // Get paginated entries for this feed from the database
    logger.debug(`Retrieving paginated entries for ${postTitle} from database (page ${page}, pageSize ${pageSize})`);
    const entriesResult = await executeQuery<RSSEntryRow>(
      'SELECT guid, title, link, description, pub_date, image, media_type FROM rss_entries WHERE feed_id = ? ORDER BY pub_date DESC LIMIT ? OFFSET ?',
      [feedId, pageSize, offset]
    );
    
    // Log the raw query result for debugging
    if (process.env.NODE_ENV !== 'production' && entriesResult.rows.length > 0) {
      const sampleEntry = entriesResult.rows[0];
      logger.debug(`Sample entry from DB: ${JSON.stringify(sampleEntry)}`);
      logger.debug(`Sample entry pub_date: ${sampleEntry.pub_date}, type: ${typeof sampleEntry.pub_date}`);
    }
    
    if (entriesResult.rows.length === 0 && page === 1) {
      logger.warn(`No entries found in database for ${postTitle}, fetching fresh data as fallback`);
      
      // If we have no entries in the database, try to fetch fresh data as a fallback
      try {
        const freshFeed = await fetchAndParseFeed(feedUrl, mediaType);
        
        if (freshFeed.items.length > 0) {
          logger.info(`Fallback: Storing ${freshFeed.items.length} fresh entries for ${postTitle}`);
          await storeRSSEntriesWithTransaction(feedId, freshFeed.items, mediaType);
          
          // Return the fresh items directly with mediaType
          return {
            entries: freshFeed.items,
            totalCount: freshFeed.items.length,
            hasMore: false
          };
        }
      } catch {
        // Continue to return empty array
      }
    }
    
    logger.info(`Retrieved ${entriesResult.rows.length} entries for ${postTitle} (page ${page} of ${Math.ceil(totalCount / pageSize)})`);
    
    // Use type assertion to ensure TypeScript knows rows is an array of RSSEntryRow
    const entries = entriesResult.rows as RSSEntryRow[];
    const mappedEntries = entries.map((entry) => {
      // Debug log to see what's coming from the database
      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`Entry date from DB: ${entry.pub_date}, type: ${typeof entry.pub_date}`);
      }
      
      // Pass through the date directly from the database
      // The client can parse it with new Date() regardless of format
      // This avoids redundant conversions
      return {
        guid: entry.guid,
        title: entry.title,
        link: entry.link,
        description: entry.description || '',
        pubDate: entry.pub_date, // Use the date directly from the database
        image: entry.image || undefined,
        mediaType: entry.media_type || undefined,
        feedUrl
      };
    });
    
    // Calculate if there are more entries
    const hasMore = offset + mappedEntries.length < totalCount;
    
    return {
      entries: mappedEntries,
      totalCount,
      hasMore
    };
  } catch (error) {
    logger.error(`Error in getRSSEntries for ${postTitle}: ${error}`);
    
    // Try a direct fetch as a last resort
    try {
      logger.info(`Attempting direct fetch for ${postTitle} as last resort`);
      const directFeed = await fetchAndParseFeed(feedUrl, mediaType);
      return {
        entries: directFeed.items,
        totalCount: directFeed.items.length,
        hasMore: false
      };
    } catch {
      logger.error(`Direct fetch failed for ${postTitle}`);
      return {
        entries: [],
        totalCount: 0,
        hasMore: false
      };
    }
  }
}

// Function to fetch and store RSS feed (used by page.tsx)
export async function fetchAndStoreRSSFeed(feedUrl: string, postTitle: string, mediaType?: string): Promise<void> {
  try {
    // Use the same getRSSEntries function to maintain consistency
    await getRSSEntries(postTitle, feedUrl, mediaType);
  } catch (error) {
    logger.error(`Error in fetchAndStoreRSSFeed for ${postTitle}: ${error}`);
  }
}

// Function to store RSS entries in PlanetScale (for backward compatibility)
export async function storeRSSEntries(feedId: number, entries: RSSItem[], mediaType?: string): Promise<void> {
  // Call the transaction-based version for better performance
  return storeRSSEntriesWithTransaction(feedId, entries, mediaType);
}

// Function to ensure the RSS locks table exists
async function ensureRSSLocksTableExists(): Promise<void> {
  try {
    // Check if the table exists
    const result = await executeQuery<{ Tables_in_database: string }>(
      "SHOW TABLES LIKE 'rss_locks'"
    );
    
    if (result.rows.length === 0) {
      logger.info('Creating rss_locks table...');
      
      // Create the table
      await executeQuery(
        `CREATE TABLE IF NOT EXISTS rss_locks (
          lock_key VARCHAR(255) PRIMARY KEY,
          expires_at BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;`
      );
      
      logger.info('rss_locks table created successfully');
    } else {
      logger.debug('rss_locks table already exists');
    }
  } catch {
    logger.error(`Error ensuring rss_locks table exists`);
    // Don't throw the error, just log it
    // The application can still function without the locks table
  }
}

// Call the function to ensure the table exists
ensureRSSLocksTableExists().catch(err => {
  logger.error(`Failed to check/create rss_locks table: ${err}`);
});

/**
 * Checks if any feeds need refreshing and refreshes them if necessary
 * This function is used to incorporate the 4-hour revalidation logic
 * into components that use direct PlanetScale queries
 */
export async function checkAndRefreshFeeds(postTitles: string[], feedUrls: string[], mediaTypes?: string[]): Promise<void> {
  if (!postTitles || postTitles.length === 0 || !feedUrls || feedUrls.length === 0) {
    return;
  }

  if (postTitles.length !== feedUrls.length || (mediaTypes && mediaTypes.length !== feedUrls.length)) {
    logger.error('Mismatch between postTitles, feedUrls, and mediaTypes arrays');
    return;
  }
  
  const currentTime = Date.now();
  const fourHoursInMs = 4 * 60 * 60 * 1000;
  
  try {
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Get feed information for all requested feeds
    const feedsResult = await executeQuery<RSSFeedRow>(
      `SELECT id, feed_url, title, updated_at, last_fetched FROM rss_feeds WHERE title IN (${placeholders})`,
      [...postTitles]
    );

    // Create a map of existing feeds
    const existingFeeds = new Map(
      (feedsResult.rows as RSSFeedRow[]).map(feed => [feed.title, feed])
    );

    // Find feeds that don't exist yet
    const newFeeds = postTitles.map((title, index) => ({
      title,
      feedUrl: feedUrls[index],
      mediaType: mediaTypes?.[index]
    })).filter(feed => !existingFeeds.has(feed.title));

    // Create new feeds
    for (const feed of newFeeds) {
      try {
        logger.info(`Creating new feed: ${feed.title} (${feed.feedUrl})`);
        const freshFeed = await fetchAndParseFeed(feed.feedUrl, feed.mediaType);
        const feedId = await getOrCreateFeed(feed.feedUrl, feed.title, feed.mediaType);
        
        if (freshFeed.items.length > 0) {
          await storeRSSEntriesWithTransaction(feedId, freshFeed.items, feed.mediaType);
          logger.info(`Successfully created and populated new feed: ${feed.title} with ${freshFeed.items.length} items`);
        } else {
          logger.warn(`Created new feed ${feed.title} but no items were found`);
        }
      } catch (error) {
        logger.error(`Error creating new feed ${feed.title}: ${error}`);
      }
    }
    
    // Process existing feeds that need refreshing
    const feedsToRefresh: Array<{feedId: number, feedUrl: string, postTitle: string, mediaType?: string}> = [];
    
    for (const feed of feedsResult.rows as RSSFeedRow[]) {
      const feedId = Number(feed.id);
      const feedUrl = feed.feed_url;
      const postTitle = feed.title;
      const lastFetchedMs = Number(feed.last_fetched);
      const timeSinceLastFetch = currentTime - lastFetchedMs;
      
      if (timeSinceLastFetch >= fourHoursInMs) {
        logger.cache(`Data is stale for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
        feedsToRefresh.push({ 
          feedId, 
          feedUrl, 
          postTitle, 
          mediaType: feed.media_type || undefined 
        });
      } else {
        logger.cache(`Using cached data for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
      }
    }
    
    // Process feeds that need refreshing
    for (const feed of feedsToRefresh) {
      // Try to acquire a lock before fetching fresh data
      const lockAcquired = await acquireFeedRefreshLock(feed.feedUrl);
      
      if (lockAcquired) {
        try {
          logger.debug(`Acquired refresh lock for ${feed.postTitle}`);
          
          // Double-check if someone else refreshed while we were acquiring the lock
          const refreshCheckResult = await executeQuery<RSSFeedRow>(
            'SELECT last_fetched FROM rss_feeds WHERE feed_url = ?',
            [feed.feedUrl]
          );
          
          if (refreshCheckResult.rows.length > 0) {
            const refreshCheck = refreshCheckResult.rows as RSSFeedRow[];
            const lastFetchedMs = Number(refreshCheck[0].last_fetched);
            const timeSinceLastFetch = currentTime - lastFetchedMs;
            
            if (timeSinceLastFetch < fourHoursInMs) {
              // Someone else refreshed the data while we were acquiring the lock
              logger.debug(`Another process refreshed the data for ${feed.postTitle} while we were acquiring the lock`);
              continue; // Skip to the next feed
            }
          }
          
          try {
            const freshFeed = await fetchAndParseFeed(feed.feedUrl, feed.mediaType);
            
            if (freshFeed.items.length > 0) {
              logger.info(`Storing ${freshFeed.items.length} fresh entries for ${feed.postTitle}`);
              await storeRSSEntriesWithTransaction(feed.feedId, freshFeed.items, feed.mediaType);
            } else {
              logger.warn(`Feed ${feed.postTitle} returned 0 items, not updating database`);
            }
          } catch (fetchError) {
            logger.error(`Error fetching feed ${feed.postTitle}: ${fetchError}`);
            // Continue to the next feed
          }
        } finally {
          // Always release the lock when done
          await releaseFeedRefreshLock(feed.feedUrl);
          logger.debug(`Released refresh lock for ${feed.postTitle}`);
        }
      } else {
        logger.info(`Another process is currently refreshing data for ${feed.postTitle}, using existing data`);
      }
    }
  } catch (error) {
    logger.error(`Error checking and refreshing feeds: ${error}`);
  }
}

/**
 * Refreshes existing feeds without creating new ones
 * Used for endpoints like paginate where we know the feeds already exist
 */
export async function refreshExistingFeeds(postTitles: string[]): Promise<void> {
  if (!postTitles || postTitles.length === 0) {
    return;
  }
  
  const currentTime = Date.now();
  const fourHoursInMs = 4 * 60 * 60 * 1000;
  
  try {
    // Create placeholders for the SQL query
    const placeholders = postTitles.map(() => '?').join(',');
    
    // Get feed information for all requested feeds
    const feedsResult = await executeQuery<RSSFeedRow>(
      `SELECT id, feed_url, title, updated_at, last_fetched FROM rss_feeds WHERE title IN (${placeholders})`,
      [...postTitles]
    );
    
    // Process existing feeds that need refreshing
    const feedsToRefresh: Array<{feedId: number, feedUrl: string, postTitle: string, mediaType?: string}> = [];
    
    for (const feed of feedsResult.rows as RSSFeedRow[]) {
      const feedId = Number(feed.id);
      const feedUrl = feed.feed_url;
      const postTitle = feed.title;
      const lastFetchedMs = Number(feed.last_fetched);
      const timeSinceLastFetch = currentTime - lastFetchedMs;
      
      if (timeSinceLastFetch >= fourHoursInMs) {
        logger.cache(`Data is stale for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
        feedsToRefresh.push({ 
          feedId, 
          feedUrl, 
          postTitle, 
          mediaType: feed.media_type || undefined 
        });
      } else {
        logger.cache(`Using cached data for ${postTitle} (last fetched ${Math.round(timeSinceLastFetch / 60000)} minutes ago)`);
      }
    }
    
    // Process feeds that need refreshing
    for (const feed of feedsToRefresh) {
      // Try to acquire a lock before fetching fresh data
      const lockAcquired = await acquireFeedRefreshLock(feed.feedUrl);
      
      if (lockAcquired) {
        try {
          logger.debug(`Acquired refresh lock for ${feed.postTitle}`);
          const freshFeed = await fetchAndParseFeed(feed.feedUrl);
          
          if (freshFeed.items.length > 0) {
            await storeRSSEntriesWithTransaction(feed.feedId, freshFeed.items);
            logger.info(`Successfully refreshed feed: ${feed.postTitle} with ${freshFeed.items.length} items`);
          } else {
            logger.warn(`No new items found for feed: ${feed.postTitle}`);
          }
          
          // Update the last_fetched timestamp
          await executeQuery(
            'UPDATE rss_feeds SET last_fetched = ? WHERE id = ?',
            [Date.now(), feed.feedId]
          );
        } catch (error) {
          logger.error(`Error refreshing feed ${feed.postTitle}: ${error}`);
        } finally {
          // Release the lock
          await releaseFeedRefreshLock(feed.feedUrl);
          logger.debug(`Released refresh lock for ${feed.postTitle}`);
        }
      } else {
        logger.warn(`Could not acquire refresh lock for ${feed.postTitle}, skipping refresh`);
      }
    }
  } catch (error) {
    logger.error(`Error in refreshExistingFeeds: ${error}`);
  }
}